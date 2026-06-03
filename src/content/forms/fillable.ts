/**
 * 5.4: сбор заполняемых форм и их полей. Никогда не трогаем password/hidden и
 * собственный UI. radio группируем по name в одно поле с вариантами. DOM-модуль →
 * ручная проверка (§6); чистые части (манифест/парсер) вынесены отдельно.
 */
import { isReadableElement, isInsideExtension } from "../dom-utils";
import { deepQueryAll } from "../context/roots";
import { getFieldLabel } from "../context/collectors";
import { normalizeText } from "../../shared/text";

/** Типы input, которые имеет смысл заполнять текстом. */
const TEXT_INPUT_TYPES = new Set([
  "text", "email", "tel", "url", "number", "search", "date", "datetime-local",
  "month", "week", "time", "color", "range", "password", // password отфильтруется ниже
]);

export interface FillableField {
  fieldId: string;
  /** Для radio — первый элемент группы (для подсветки); подстановка идёт по группе. */
  element: HTMLElement;
  /** Для radio — все элементы группы. */
  elements: HTMLElement[];
  label: string;
  type: string; // text | textarea | select | checkbox | radio
  options?: string[];
}

export interface FillableForm {
  element: Element;
  fields: FillableField[];
  score: number;
}

/** Собирает заполняемые формы страницы, отсортированные по числу полей (убыв.). */
export function collectFillableForms(): FillableForm[] {
  const containers = deepQueryAll("form, [role='form'], .v-form")
    .filter((el) => isReadableElement(el) && !isInsideExtension(el));

  const forms: FillableForm[] = [];
  for (const container of containers) {
    const fields = collectFieldsIn(container);
    if (fields.length) forms.push({ element: container, fields, score: fields.length });
  }

  // Standalone-поля вне форм — как одна «виртуальная» форма (контейнер = body).
  const standalone = collectStandaloneFields();
  if (standalone.length) {
    forms.push({ element: document.body, fields: standalone, score: standalone.length });
  }

  forms.sort((a, b) => b.score - a.score);
  return forms;
}

function collectStandaloneFields(): FillableField[] {
  const els = deepQueryAll("input, textarea, select").filter(
    (el) => isReadableElement(el) && !isInsideExtension(el) && !el.closest("form, [role='form'], .v-form")
  );
  return buildFields(els);
}

function collectFieldsIn(root: Element): FillableField[] {
  const els = [...root.querySelectorAll("input, textarea, select")].filter(
    (el) => isReadableElement(el) && !isInsideExtension(el)
  );
  return buildFields(els);
}

/** Превращает плоский список элементов в поля, группируя radio по name. */
function buildFields(elements: Element[]): FillableField[] {
  const fields: FillableField[] = [];
  const radioGroups = new Map<string, HTMLElement[]>();
  let counter = 0;
  const nextId = (): string => `field${++counter}`;

  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    const type = String(el.getAttribute("type") || tag).toLowerCase();

    // Приватность/смысл: пароли, скрытые, файловые и кнопки — не заполняем.
    if (tag === "input" && (type === "password" || type === "hidden" || type === "file" ||
      type === "submit" || type === "reset" || type === "button" || type === "image")) continue;
    if (tag === "input" && !TEXT_INPUT_TYPES.has(type) && type !== "checkbox" && type !== "radio") continue;

    if (tag === "input" && type === "radio") {
      const name = el.getAttribute("name") || "";
      const key = name || `__radio_${nextId()}`;
      if (!radioGroups.has(key)) radioGroups.set(key, []);
      radioGroups.get(key)!.push(el as HTMLElement);
      continue;
    }

    const fieldType =
      tag === "textarea" ? "textarea" :
      tag === "select" ? "select" :
      type === "checkbox" ? "checkbox" : "text";

    const field: FillableField = {
      fieldId: nextId(),
      element: el as HTMLElement,
      elements: [el as HTMLElement],
      label: normalizeText(getFieldLabel(el)) || normalizeText(el.getAttribute("placeholder") || ""),
      type: fieldType,
    };
    if (tag === "select") {
      field.options = [...(el as HTMLSelectElement).options]
        .map((o) => normalizeText(o.textContent || o.value || ""))
        .filter(Boolean);
    }
    fields.push(field);
  }

  // radio-группы → отдельные поля с вариантами.
  for (const group of radioGroups.values()) {
    if (!group.length) continue;
    const options = group
      .map((r) => normalizeText(getFieldLabel(r) || (r as HTMLInputElement).value || ""))
      .filter(Boolean);
    fields.push({
      fieldId: nextId(),
      element: group[0]!,
      elements: group,
      label: normalizeText(groupLabel(group[0]!)) || "Выбор",
      type: "radio",
      options,
    });
  }

  return fields;
}

/** Метка radio-группы: ближайший fieldset>legend, иначе метка первого варианта. */
function groupLabel(first: HTMLElement): string {
  const fieldset = first.closest("fieldset");
  const legend = fieldset?.querySelector("legend");
  if (legend) return legend.textContent || "";
  return getFieldLabel(first);
}
