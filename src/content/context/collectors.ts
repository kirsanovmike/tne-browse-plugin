/**
 * DOM-коллекторы структурированного контекста: модалки, формы, таблицы,
 * заголовки, интерактивные элементы, описание полей.
 *
 * Перенесено из `content.js` при декомпозиции на M3. Чистые части вынесены в
 * `tables-to-md.ts` (формат) и `security/mask.ts` (маскирование). DOM → без
 * юнит-тестов (дизайн §6).
 */
import { isReadableElement, isInsideExtension, cssEscape } from "../dom-utils";
import { deepQueryAll } from "./roots";
import { readableFromElement } from "./text-extract";
import { normalizeText, removeDuplicateLines } from "../../shared/text";
import { matrixToMarkdown } from "./tables-to-md";
import { formatField } from "../security/mask";

export interface CollectedBlock {
  element: Element;
  text: string;
}

export interface CollectedTable {
  element: Element;
  markdown: string;
  matrix: string[][];
}

export function collectModals(): CollectedBlock[] {
  const selector =
    "dialog, [role='dialog'], [aria-modal='true'], .modal, .popup, .v-dialog, .v-overlay__content, .ant-modal, .el-dialog, .MuiDialog-root, .modal-content";
  const result: CollectedBlock[] = [];
  const seen = new Set<string>();

  for (const el of deepQueryAll(selector)) {
    if (!isReadableElement(el) || isInsideExtension(el)) continue;
    const text = removeDuplicateLines(readableFromElement(el, { skipLayout: false }));
    if (!text || text.length < 5) continue;
    const key = text.slice(0, 300).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ element: el, text });
  }
  return result;
}

export function collectForms(): CollectedBlock[] {
  const formContainers = deepQueryAll("form, [role='form'], .v-form")
    .filter((el) => isReadableElement(el) && !isInsideExtension(el));

  const result: CollectedBlock[] = [];
  const seen = new Set<string>();

  for (const form of formContainers) {
    const fields = collectFields(form);
    if (!fields.length) continue;
    const text = fields.join("\n");
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ element: form, text });
  }

  const standaloneFields = deepQueryAll("input, textarea, select")
    .filter((el) => isReadableElement(el) && !isInsideExtension(el) && !el.closest("form, [role='form'], .v-form"));
  const standaloneText = standaloneFields.map((el) => describeField(el)).filter(Boolean);
  if (standaloneText.length) {
    result.push({ element: standaloneFields[0]?.parentElement || document.body, text: standaloneText.join("\n") });
  }

  return result;
}

export function collectTables(): CollectedTable[] {
  const tables = deepQueryAll("table").filter((el) => isReadableElement(el) && !isInsideExtension(el));

  const result: CollectedTable[] = [];
  const seen = new Set<string>();

  for (const table of tables) {
    const matrix = tableToMatrix(table);
    const markdown = matrixToMarkdown(matrix);
    if (!markdown) continue;
    const key = markdown.slice(0, 300).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ element: table, markdown, matrix });
    if (result.length >= 8) break;
  }
  return result;
}

/**
 * 5.R2-5: фолбэк для экспорта таблиц. Если строгий collectTables() ничего не
 * нашёл (эвристика видимости/размера отсекла реальную таблицу), собираем по
 * сырому `document.querySelectorAll("table")`, отсекая лишь таблицы расширения.
 */
export function collectTablesLoose(): CollectedTable[] {
  const tables = [...document.querySelectorAll("table")].filter((el) => !isInsideExtension(el));
  const result: CollectedTable[] = [];
  const seen = new Set<string>();
  for (const table of tables) {
    const matrix = tableToMatrix(table);
    const markdown = matrixToMarkdown(matrix);
    if (!markdown) continue;
    const key = markdown.slice(0, 300).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ element: table, markdown, matrix });
    if (result.length >= 8) break;
  }
  return result;
}

function tableToMatrix(table: Element): string[][] {
  const rows = [...table.querySelectorAll("tr")]
    .filter((tr) => isReadableElement(tr) && !isInsideExtension(tr))
    .slice(0, 60);
  if (!rows.length) return [];

  return rows.map((tr) =>
    [...tr.children]
      .filter((cell) => ["td", "th"].includes(cell.tagName.toLowerCase()))
      .slice(0, 12)
      .map((cell) => normalizeText((cell as HTMLElement).innerText || cell.textContent || ""))
  );
}

export function collectHeadings(): string[] {
  return deepQueryAll("h1,h2,h3")
    .filter((h) => isReadableElement(h) && !isInsideExtension(h))
    .map((h) => normalizeText((h as HTMLElement).innerText || h.textContent || ""))
    .filter(Boolean);
}

export function collectInteractiveText(): string {
  const selectors = [
    "[contenteditable='true']",
    "[role='textbox']",
    "[role='button']",
    "button",
    "[aria-label]",
    "[title]",
  ].join(",");

  const lines: string[] = [];
  const seen = new Set<string>();

  for (const el of deepQueryAll(selectors)) {
    if (!isReadableElement(el) || isInsideExtension(el)) continue;
    const tag = el.tagName.toLowerCase();
    const htmlEl = el as HTMLElement;
    let text = "";

    if (tag === "button" || el.getAttribute("role") === "button") {
      text = normalizeText(htmlEl.innerText || el.textContent || el.getAttribute("aria-label") || htmlEl.title || "");
      if (text) text = `Кнопка: ${text}`;
    } else if (el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox") {
      const label = normalizeText(el.getAttribute("aria-label") || htmlEl.title || "Редактируемый блок");
      const value = normalizeText(htmlEl.innerText || el.textContent || "");
      text = value ? `${label}: ${value}` : "";
    } else {
      const label = normalizeText(el.getAttribute("aria-label") || htmlEl.title || "");
      if (label && !["input", "textarea", "select"].includes(tag)) text = `Элемент интерфейса: ${label}`;
    }

    if (!text || text.length < 3) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(text);
    if (lines.length >= 80) break;
  }

  return lines.length ? lines.join("\n") : "";
}

function collectFields(root: Element): string[] {
  return [...root.querySelectorAll("input, textarea, select")]
    .filter((el) => isReadableElement(el) && !isInsideExtension(el))
    .map((el) => describeField(el))
    .filter(Boolean);
}

/** Собирает свойства поля из DOM и форматирует строку «label: value» (маскируя секреты). */
export function describeField(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const type = String(el.getAttribute("type") || tag).toLowerCase();
  const input = el as HTMLInputElement;
  const label = getFieldLabel(el);
  const nameHint = `${el.getAttribute("name") || ""} ${el.id || ""} ${label} ${el.getAttribute("placeholder") || ""} ${el.getAttribute("autocomplete") || ""}`;

  let selectedText = "";
  if (tag === "select") {
    selectedText = [...(el as HTMLSelectElement).selectedOptions]
      .map((option) => normalizeText(option.textContent || option.value || ""))
      .filter(Boolean)
      .join(", ");
  }

  return formatField({
    tag,
    type,
    label,
    nameHint,
    value: normalizeText(input.value || el.getAttribute("value") || ""),
    hasValue: Boolean(input.value),
    selectedText,
    checked: Boolean(input.checked),
    placeholder: normalizeText(el.getAttribute("placeholder") || ""),
  });
}

export function getFieldLabel(el: Element): string {
  const id = el.id;
  const explicit = id ? document.querySelector(`label[for="${cssEscape(id)}"]`) : null;
  const wrapping = el.closest("label");
  const ariaLabelledBy = el.getAttribute("aria-labelledby");
  const ariaLabel = normalizeText(el.getAttribute("aria-label") || "");
  const title = normalizeText(el.getAttribute("title") || "");
  const name = normalizeText(el.getAttribute("name") || el.id || "");

  if (explicit) return normalizeText((explicit as HTMLElement).innerText || explicit.textContent || "");
  if (wrapping) return normalizeText((wrapping as HTMLElement).innerText || wrapping.textContent || "");
  if (ariaLabelledBy) {
    const text = ariaLabelledBy
      .split(/\s+/)
      .map((ref) => document.getElementById(ref))
      .filter((node): node is HTMLElement => Boolean(node))
      .map((node) => normalizeText(node.innerText || node.textContent || ""))
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }
  return ariaLabel || title || name;
}
