/**
 * 5.4: оркестратор заполнения формы по описанию. Самодостаточная карточка в ленте
 * чата: выбор формы (если их несколько) → описание данных → предпросмотр значений →
 * подстановка без авто-сабмита. DOM-модуль → ручная проверка (§6).
 */
import { $ } from "../state";
import { collectFillableForms, type FillableForm, type FillableField } from "./fillable";
import { buildFillPrompt, type ManifestField } from "./field-manifest";
import { parseFillResponse, type FillProposal } from "./parse-fill";
import { applyFillProposals } from "./apply-fill";
import { requestPlainAnswer } from "../chat/plain-request";

/** Точка входа кнопки «Заполнить форму». */
export function startFormFill(): void {
  const messages = $("#tne-chat-messages");
  if (!messages) return;

  const forms = collectFillableForms();
  if (!forms.length) {
    appendNote(messages, "Заполняемых форм на странице не найдено.");
    return;
  }

  const card = document.createElement("div");
  card.className = "tne-fill-card";
  messages.appendChild(card);
  scrollInto(messages);

  if (forms.length === 1) renderDescribeStep(card, forms[0]!);
  else renderFormPicker(card, forms);
}

function renderFormPicker(card: HTMLElement, forms: FillableForm[]): void {
  card.innerHTML = "";
  const title = document.createElement("div");
  title.className = "tne-fill-title";
  title.textContent = "Выберите форму для заполнения:";
  card.appendChild(title);

  forms.forEach((form, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tne-fill-form-option";
    const labels = form.fields.map((f) => f.label).filter(Boolean).slice(0, 3).join(", ");
    btn.textContent = `Форма ${i + 1} · полей: ${form.fields.length}${labels ? ` · ${labels}…` : ""}`;
    btn.addEventListener("mouseenter", () => outline(form.element, true));
    btn.addEventListener("mouseleave", () => outline(form.element, false));
    btn.addEventListener("click", () => {
      outline(form.element, false);
      renderDescribeStep(card, form);
    });
    card.appendChild(btn);
  });

  appendCancel(card);
}

function renderDescribeStep(card: HTMLElement, form: FillableForm): void {
  card.innerHTML = "";
  const title = document.createElement("div");
  title.className = "tne-fill-title";
  title.textContent = `Опишите данные для формы (полей: ${form.fields.length}):`;

  const area = document.createElement("textarea");
  area.className = "tne-fill-input";
  area.rows = 3;
  area.placeholder = "Например: Иван Петров, г. Тюмень, телефон +7 999 000-00-00, согласен с условиями";

  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "tne-fill-primary";
  submit.textContent = "Подобрать значения";

  submit.addEventListener("click", () => {
    const description = area.value.trim();
    if (!description) {
      area.focus();
      return;
    }
    void runMatch(card, form, description);
  });

  card.append(title, area, submit);
  appendCancel(card);
  setTimeout(() => area.focus(), 30);
}

async function runMatch(card: HTMLElement, form: FillableForm, description: string): Promise<void> {
  card.innerHTML = "";
  const status = document.createElement("div");
  status.className = "tne-fill-status";
  status.textContent = "Подбираю значения…";
  card.appendChild(status);

  const manifest: ManifestField[] = form.fields.map((f) => toManifest(f));
  const knownIds = manifest.map((f) => f.fieldId);
  const answer = await requestPlainAnswer(buildFillPrompt(description, manifest));

  if (!answer.ok) {
    renderError(card, form, description, answer.error || "Не удалось получить ответ модели.");
    return;
  }
  const proposals = parseFillResponse(answer.content, knownIds);
  if (!proposals.length) {
    renderError(card, form, description, "Не удалось определить значения из описания. Уточните формулировку.");
    return;
  }
  renderPreview(card, form, proposals);
}

function renderPreview(card: HTMLElement, form: FillableForm, proposals: FillProposal[]): void {
  card.innerHTML = "";
  const title = document.createElement("div");
  title.className = "tne-fill-title";
  title.textContent = "Предпросмотр — отметьте, что подставить:";
  card.appendChild(title);

  const byId = new Map(form.fields.map((f) => [f.fieldId, f]));
  const checks: Array<{ proposal: FillProposal; input: HTMLInputElement }> = [];

  for (const proposal of proposals) {
    const field = byId.get(proposal.fieldId);
    if (!field) continue;
    const row = document.createElement("label");
    row.className = "tne-fill-row";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = true;
    const text = document.createElement("span");
    text.className = "tne-fill-row-text";
    text.innerHTML = `<b>${escapeText(field.label || proposal.fieldId)}</b>: ${escapeText(proposal.value)}`;
    row.append(check, text);
    card.appendChild(row);
    checks.push({ proposal, input: check });
  }

  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "tne-fill-primary";
  apply.textContent = "Подставить";
  apply.addEventListener("click", () => {
    const selected = checks.filter((c) => c.input.checked).map((c) => c.proposal);
    const count = applyFillProposals(form.fields, selected);
    card.innerHTML = "";
    appendNote(card, `Подставлено полей: ${count}. Проверьте значения и отправьте форму вручную — расширение её не отправляет.`, false);
  });

  card.appendChild(apply);
  appendCancel(card);
}

function renderError(card: HTMLElement, form: FillableForm, description: string, message: string): void {
  card.innerHTML = "";
  appendNote(card, message, false);
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "tne-fill-primary";
  retry.textContent = "Изменить описание";
  retry.addEventListener("click", () => {
    renderDescribeStep(card, form);
    const area = card.querySelector(".tne-fill-input") as HTMLTextAreaElement | null;
    if (area) area.value = description;
  });
  card.appendChild(retry);
  appendCancel(card);
}

function toManifest(f: FillableField): ManifestField {
  const m: ManifestField = { fieldId: f.fieldId, type: f.type, label: f.label };
  if (f.options && f.options.length) m.options = f.options;
  return m;
}

function appendCancel(card: HTMLElement): void {
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "tne-fill-cancel";
  cancel.textContent = "Отмена";
  cancel.addEventListener("click", () => card.remove());
  card.appendChild(cancel);
}

function appendNote(parent: HTMLElement, text: string, ownCard = true): void {
  const note = document.createElement("div");
  note.className = ownCard ? "tne-fill-card tne-fill-note" : "tne-fill-note";
  note.textContent = text;
  parent.appendChild(note);
  const messages = $("#tne-chat-messages");
  if (messages) scrollInto(messages);
}

function outline(el: Element, on: boolean): void {
  (el as HTMLElement).style.outline = on ? "2px dashed #0d9488" : "";
}

function escapeText(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function scrollInto(messages: HTMLElement): void {
  messages.scrollTop = messages.scrollHeight;
}
