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

const form = document.getElementById("settings-form") as HTMLFormElement;
const accessForm = document.getElementById("access-form") as HTMLFormElement;
const status = document.getElementById("status") as HTMLElement;
const accessStatus = document.getElementById("access-status") as HTMLElement;
const diagOutput = document.getElementById("diag-output") as HTMLElement;

void init();

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

async function runPing(target: DiagTarget): Promise<void> {
  diagOutput.textContent =
    target === "vision" ? "Проверяю vision endpoint…" : "Проверяю соединение с моделью…";
  try {
    const result = (await browser.runtime.sendMessage({
      type: "TNE_DIAG_PING",
      target,
    })) as DiagPingResponse | undefined;
    if (result?.ok) {
      diagOutput.textContent = `${result.reachable ? "✅" : "⚠️"} ${result.message}`;
    } else {
      diagOutput.textContent = `❌ ${result?.error || "Не удалось выполнить проверку."}`;
    }
  } catch (error) {
    diagOutput.textContent = `❌ ${errorMessage(error)}`;
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
