/**
 * Страница настроек. M1: переведена на единый источник правды настроек
 * (`shared/settings.ts`) — больше не дублирует дефолты и парсинг формы.
 */
import { browser } from "../shared/browser";
import {
  coerceModelSettings,
  parseDomainList,
  readSettings,
  writeSettings,
} from "../shared/settings";
import type { DiagPingResponse, DiagTarget, GetDiagResponse } from "../shared/messages";
import {
  newTemplateId,
  parseImportedTemplates,
  type PromptTemplate,
} from "../shared/templates";

const form = document.getElementById("settings-form") as HTMLFormElement;
const accessForm = document.getElementById("access-form") as HTMLFormElement;
const status = document.getElementById("status") as HTMLElement;
const accessStatus = document.getElementById("access-status") as HTMLElement;
const diagOutput = document.getElementById("diag-output") as HTMLElement;
const connLlm = document.getElementById("conn-llm") as HTMLElement;
const connVision = document.getElementById("conn-vision") as HTMLElement;
const tplList = document.getElementById("templates-list") as HTMLElement;
const tplStatus = document.getElementById("tpl-status") as HTMLElement;
let templates: PromptTemplate[] = [];

void init();

function renderTemplates(): void {
  tplList.innerHTML = "";
  templates.forEach((tpl, index) => {
    const wrap = document.createElement("div");
    wrap.className = "tpl-item";

    const label = document.createElement("input");
    label.type = "text";
    label.placeholder = "Название";
    label.value = tpl.label;
    label.addEventListener("input", () => {
      templates[index]!.label = label.value;
    });

    const body = document.createElement("textarea");
    body.rows = 3;
    body.placeholder = "Текст промпта. Переменные: {{выделение}} {{url}} {{таблица}}";
    body.value = tpl.body;
    body.addEventListener("input", () => {
      templates[index]!.body = body.value;
    });

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "Удалить";
    del.addEventListener("click", () => {
      templates.splice(index, 1);
      renderTemplates();
    });

    wrap.append(label, body, del);
    tplList.appendChild(wrap);
  });
}

async function init(): Promise<void> {
  const settings = await readSettings();

  for (const [key, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(key) as HTMLInputElement | null;
    if (field) field.value = String(value);
  }

  (form.elements.namedItem("autoScreenshot") as HTMLInputElement).checked =
    Boolean(settings.autoScreenshot);

  (accessForm.elements.namedItem("allowExternal") as HTMLInputElement).checked =
    Boolean(settings.allowExternal);
  (accessForm.elements.namedItem("whitelist") as HTMLTextAreaElement).value = (
    settings.whitelist || []
  ).join("\n");
  (accessForm.elements.namedItem("denylist") as HTMLTextAreaElement).value = (
    settings.denylist || []
  ).join("\n");

  templates = settings.promptTemplates || [];
  renderTemplates();

  // 5.R3-6: автопроверка соединения при открытии — не блокируем форму (без await).
  autoCheckConnections(Boolean(settings.endpoint), Boolean(settings.visionEndpoint));
}

/** Цветовой статус-пилюли: state ∈ checking | ok | error | off. */
function setPill(pill: HTMLElement, state: "checking" | "ok" | "error" | "off", text: string): void {
  pill.dataset.state = state;
  pill.textContent = text;
}

/** Стартовый автопинг LLM и (если задан) vision endpoint; пишет только в пилюли. */
function autoCheckConnections(hasLlm: boolean, hasVision: boolean): void {
  if (hasLlm) void pingPill("llm", connLlm, "LLM");
  else setPill(connLlm, "off", "LLM: не задан");

  if (hasVision) void pingPill("vision", connVision, "Vision");
  else setPill(connVision, "off", "Vision: не задан");
}

/** Пингует endpoint и отражает результат в статус-пилюле (без вывода в diagOutput). */
async function pingPill(target: DiagTarget, pill: HTMLElement, label: string): Promise<void> {
  setPill(pill, "checking", `${label}: проверка…`);
  try {
    const result = (await browser.runtime.sendMessage({
      type: "TNE_DIAG_PING",
      target,
    })) as DiagPingResponse | undefined;
    if (result?.ok && result.reachable) setPill(pill, "ok", `${label}: доступен`);
    else setPill(pill, "error", `${label}: ошибка`);
  } catch {
    setPill(pill, "error", `${label}: ошибка`);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await writeSettings({
    ...coerceModelSettings(toRecord(new FormData(form))),
    autoScreenshot: (form.elements.namedItem("autoScreenshot") as HTMLInputElement).checked,
  });
  flash(status, "Настройки сохранены.");
});

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(accessForm);
  await writeSettings({
    allowExternal: (accessForm.elements.namedItem("allowExternal") as HTMLInputElement).checked,
    whitelist: parseDomainList(asString(data.get("whitelist"))),
    denylist: parseDomainList(asString(data.get("denylist"))),
  });
  flash(accessStatus, "Настройки доступа сохранены.");
});

document.getElementById("diag-ping")?.addEventListener("click", () => void runPing("llm"));
document.getElementById("diag-vision")?.addEventListener("click", () => void runPing("vision"));
document.getElementById("diag-payload")?.addEventListener("click", () => void showDiag("payload"));
document.getElementById("diag-error")?.addEventListener("click", () => void showDiag("error"));

document.getElementById("tpl-add")?.addEventListener("click", () => {
  templates.push({ id: newTemplateId(), label: "", body: "" });
  renderTemplates();
});

document.getElementById("tpl-save")?.addEventListener("click", async () => {
  templates = templates.filter((t) => t.label.trim() || t.body.trim());
  await writeSettings({ promptTemplates: templates });
  renderTemplates();
  flash(tplStatus, "Шаблоны сохранены.");
});

document.getElementById("tpl-export")?.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(templates, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tne-prompts.json";
  a.click();
  URL.revokeObjectURL(url);
});

const tplImport = document.getElementById("tpl-import") as HTMLInputElement;
document.getElementById("tpl-import-btn")?.addEventListener("click", () => tplImport.click());
tplImport.addEventListener("change", async () => {
  const file = tplImport.files?.[0];
  if (!file) return;
  try {
    const parsed = parseImportedTemplates(JSON.parse(await file.text()));
    templates = templates.concat(parsed);
    renderTemplates();
    flash(tplStatus, `Импортировано: ${parsed.length}. Нажмите «Сохранить шаблоны».`);
  } catch (error) {
    flash(tplStatus, `Ошибка импорта: ${errorMessage(error)}`);
  }
  tplImport.value = "";
});

async function runPing(target: DiagTarget): Promise<void> {
  const pill = target === "vision" ? connVision : connLlm;
  const label = target === "vision" ? "Vision" : "LLM";
  diagOutput.textContent =
    target === "vision" ? "Проверяю vision endpoint…" : "Проверяю соединение с моделью…";
  setPill(pill, "checking", `${label}: проверка…`);
  try {
    const result = (await browser.runtime.sendMessage({
      type: "TNE_DIAG_PING",
      target,
    })) as DiagPingResponse | undefined;
    if (result?.ok) {
      diagOutput.textContent = `${result.reachable ? "✅" : "⚠️"} ${result.message}`;
      setPill(pill, result.reachable ? "ok" : "error", `${label}: ${result.reachable ? "доступен" : "ошибка"}`);
    } else {
      diagOutput.textContent = `❌ ${result?.error || "Не удалось выполнить проверку."}`;
      setPill(pill, "error", `${label}: ошибка`);
    }
  } catch (error) {
    diagOutput.textContent = `❌ ${errorMessage(error)}`;
    setPill(pill, "error", `${label}: ошибка`);
  }
}

async function showDiag(kind: "payload" | "error"): Promise<void> {
  try {
    const result = (await browser.runtime.sendMessage({ type: "TNE_GET_DIAG" })) as
      | GetDiagResponse
      | undefined;
    if (!result?.ok) {
      diagOutput.textContent = "Нет данных диагностики.";
      return;
    }
    if (kind === "payload") {
      diagOutput.textContent = result.lastPayload
        ? `Последний payload (${result.lastPayloadAt || "—"}):\n\n${JSON.stringify(result.lastPayload, null, 2)}`
        : "Последний payload ещё не сформирован.";
    } else {
      diagOutput.textContent = result.lastError
        ? `Последняя ошибка (${result.lastErrorAt || "—"}):\n\n${result.lastError}`
        : "Ошибок пока не зафиксировано.";
    }
  } catch (error) {
    diagOutput.textContent = `❌ ${errorMessage(error)}`;
  }
}

function toRecord(data: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    out[key] = typeof value === "string" ? value : "";
  }
  return out;
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function flash(node: HTMLElement, message: string): void {
  node.textContent = message;
  setTimeout(() => {
    node.textContent = "";
  }, 1800);
}
