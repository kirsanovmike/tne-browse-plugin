/**
 * Замечание 5: редактируемая панель готовых промптов внизу панели. Единый
 * хранимый список (`promptTemplates` в storage.local) объединяет бывшие
 * захардкоженные QUICK_ACTIONS и шаблоны со страницы настроек. Клик по промпту
 * отправляет вопрос сразу; ✎/✕ и «＋ Добавить» правят список прямо из панели;
 * `storage.onChanged` держит панель и настройки синхронными.
 *
 * DOM-модуль → без юнит-тестов (§6). Чистая логика (сид/нормализация) живёт в
 * `shared/templates.ts` и покрыта там.
 */
import { browser } from "../../shared/browser";
import { STATE, $ } from "../state";
import { readSettings, writeSettings } from "../../shared/settings";
import {
  type PromptTemplate,
  newTemplateId,
  normalizeTemplate,
  withSeededDefaults,
  applyTemplateVariables,
  firstTableBlock,
} from "../../shared/templates";
import { refreshContext } from "../context/refresh";
import { getSafeSelection } from "../context/text-extract";
import { sendQuestion } from "./chat";

const NEW_ID = "__new__";

// id промпта в режиме инлайн-редактора, NEW_ID для нового, или null — список.
let editingId: string | null = null;
let storageListenerBound = false;

/** Инициализация панели: сид дефолтов при первом запуске + реактивный рендер. */
export async function initPromptPanel(root: HTMLElement): Promise<void> {
  const container = root.querySelector("#tne-quick-actions") as HTMLElement | null;
  if (!container) return;
  container.classList.add("tne-prompt-panel");

  const settings = await readSettings();
  const { templates, seeded } = withSeededDefaults(settings.promptTemplates);
  // Засеваем дефолты один раз; onChanged затем перерисует панель.
  if (seeded) await writeSettings({ promptTemplates: templates });

  bindStorageListener();
  await renderPromptPanel();
}

/** Реактивность (баг №1): следим за promptTemplates — правки из настроек видны сразу. */
function bindStorageListener(): void {
  if (storageListenerBound) return;
  storageListenerBound = true;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.promptTemplates) return;
    void renderPromptPanel();
  });
}

async function renderPromptPanel(): Promise<void> {
  const container = $("#tne-quick-actions") as HTMLElement | null;
  if (!container) return;
  const settings = await readSettings();
  const templates = settings.promptTemplates || [];

  container.innerHTML = "";
  for (const tpl of templates) {
    container.appendChild(editingId === tpl.id ? buildEditor(tpl, templates) : buildChip(tpl));
  }
  // «＋ Добавить» — всегда видна (баг №2): точка входа есть даже при пустом списке.
  container.appendChild(editingId === NEW_ID ? buildEditor(null, templates) : buildAddButton());
}

/** Чип готового промпта: основная кнопка (отправка) + ✎ + ✕. */
function buildChip(tpl: PromptTemplate): HTMLElement {
  const chip = document.createElement("div");
  chip.className = "tne-prompt-chip";

  const run = document.createElement("button");
  run.type = "button";
  run.className = "tne-prompt-run";
  run.textContent = tpl.label || "Без названия";
  run.title = tpl.body || "Готовый промпт";
  run.addEventListener("click", () => void runPrompt(tpl));

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "tne-prompt-edit";
  edit.title = "Изменить";
  edit.setAttribute("aria-label", `Изменить промпт «${tpl.label}»`);
  edit.textContent = "✎";
  edit.addEventListener("click", () => {
    editingId = tpl.id;
    void renderPromptPanel();
  });

  const del = document.createElement("button");
  del.type = "button";
  del.className = "tne-prompt-del";
  del.title = "Удалить";
  del.setAttribute("aria-label", `Удалить промпт «${tpl.label}»`);
  del.textContent = "✕";
  del.addEventListener("click", () => void deletePrompt(tpl.id));

  chip.append(run, edit, del);
  return chip;
}

function buildAddButton(): HTMLElement {
  const add = document.createElement("button");
  add.type = "button";
  add.className = "tne-prompt-add";
  add.title = "Добавить готовый промпт";
  add.setAttribute("aria-label", "Добавить готовый промпт");
  add.textContent = "＋";
  add.addEventListener("click", () => {
    editingId = NEW_ID;
    void renderPromptPanel();
  });
  return add;
}

/** Инлайн-редактор: название + текст промпта + Сохранить/Отмена. */
function buildEditor(tpl: PromptTemplate | null, templates: PromptTemplate[]): HTMLElement {
  const box = document.createElement("div");
  box.className = "tne-prompt-editor";

  const label = document.createElement("input");
  label.type = "text";
  label.className = "tne-prompt-editor-label";
  label.placeholder = "Название";
  label.value = tpl?.label ?? "";

  const body = document.createElement("textarea");
  body.className = "tne-prompt-editor-body";
  body.rows = 3;
  body.placeholder = "Текст промпта. Переменные: {{выделение}} {{url}} {{таблица}}";
  body.value = tpl?.body ?? "";

  const actions = document.createElement("div");
  actions.className = "tne-prompt-editor-actions";

  const save = document.createElement("button");
  save.type = "button";
  save.className = "tne-prompt-editor-save";
  save.textContent = "Сохранить";
  save.addEventListener("click", () => void savePrompt(tpl, label.value, body.value, templates));

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "tne-prompt-editor-cancel";
  cancel.textContent = "Отмена";
  cancel.addEventListener("click", () => {
    editingId = null;
    void renderPromptPanel();
  });

  actions.append(save, cancel);
  box.append(label, body, actions);
  // Фокус на названии при открытии редактора.
  setTimeout(() => label.focus(), 0);
  return box;
}

/** Отправляет вопрос по промпту сразу (как бывшие QUICK_ACTIONS), подставив переменные. */
async function runPrompt(tpl: PromptTemplate): Promise<void> {
  const input = $("#tne-chat-input") as HTMLTextAreaElement | null;
  if (!input || STATE.isSending) return;
  if (STATE.contextDirty || !STATE.page) await refreshContext(false, "prompt");
  const vars = {
    selection: STATE.page?.selection || getSafeSelection() || "",
    url: location.href,
    table: firstTableBlock(STATE.page?.text || ""),
  };
  input.value = applyTemplateVariables(tpl.body, vars);
  void sendQuestion();
}

async function savePrompt(
  existing: PromptTemplate | null,
  label: string,
  body: string,
  templates: PromptTemplate[]
): Promise<void> {
  // Пустой промпт не сохраняем — просто закрываем редактор.
  if (!label.trim() && !body.trim()) {
    editingId = null;
    await renderPromptPanel();
    return;
  }
  const normalized = normalizeTemplate({ id: existing?.id || newTemplateId(), label, body });
  const next = existing
    ? templates.map((t) => (t.id === existing.id ? normalized : t))
    : [...templates, normalized];
  editingId = null;
  // onChanged перерисует панель после записи.
  await writeSettings({ promptTemplates: next });
}

async function deletePrompt(id: string): Promise<void> {
  const settings = await readSettings();
  const next = (settings.promptTemplates || []).filter((t) => t.id !== id);
  if (editingId === id) editingId = null;
  await writeSettings({ promptTemplates: next });
}
