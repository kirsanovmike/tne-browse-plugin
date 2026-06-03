/**
 * 5.4: подстановка предложенных значений в поля формы. Нативные сеттеры +
 * dispatch input/change (совместимость с React/Vue). Сабмит НЕ вызывается.
 * DOM-модуль → ручная проверка (§6).
 */
import { normalizeText } from "../../shared/text";
import type { FillableField } from "./fillable";
import type { FillProposal } from "./parse-fill";

const TRUTHY = new Set(["да", "yes", "true", "on", "1", "вкл", "включить", "✓"]);

/** Подставляет значения по отмеченным полям; возвращает число применённых. */
export function applyFillProposals(fields: FillableField[], proposals: FillProposal[]): number {
  const byId = new Map(fields.map((f) => [f.fieldId, f]));
  let applied = 0;

  for (const { fieldId, value } of proposals) {
    const field = byId.get(fieldId);
    if (!field) continue;
    if (applyToField(field, value)) {
      applied++;
      flashField(field.element);
    }
  }
  return applied;
}

function applyToField(field: FillableField, value: string): boolean {
  switch (field.type) {
    case "select":
      return applySelect(field.element as HTMLSelectElement, value);
    case "checkbox":
      return applyCheckbox(field.element as HTMLInputElement, value);
    case "radio":
      return applyRadio(field.elements as HTMLInputElement[], value);
    default:
      return applyText(field.element, value);
  }
}

function applyText(el: HTMLElement, value: string): boolean {
  setNativeValue(el, value);
  dispatch(el, "input");
  dispatch(el, "change");
  return true;
}

function applySelect(el: HTMLSelectElement, value: string): boolean {
  const want = normalizeText(value).toLowerCase();
  const match = [...el.options].find(
    (o) => normalizeText(o.textContent || "").toLowerCase() === want ||
      normalizeText(o.value).toLowerCase() === want
  ) || [...el.options].find(
    (o) => normalizeText(o.textContent || "").toLowerCase().includes(want) && want.length > 0
  );
  if (!match) return false;
  el.value = match.value;
  dispatch(el, "input");
  dispatch(el, "change");
  return true;
}

function applyCheckbox(el: HTMLInputElement, value: string): boolean {
  const v = normalizeText(value).toLowerCase();
  el.checked = TRUTHY.has(v) || v === normalizeText(el.value).toLowerCase();
  dispatch(el, "click");
  dispatch(el, "change");
  return true;
}

function applyRadio(group: HTMLInputElement[], value: string): boolean {
  const want = normalizeText(value).toLowerCase();
  const match = group.find((r) => {
    const label = normalizeText(labelTextFor(r)).toLowerCase();
    return label === want || normalizeText(r.value).toLowerCase() === want ||
      (want.length > 0 && label.includes(want));
  });
  if (!match) return false;
  match.checked = true;
  dispatch(match, "click");
  dispatch(match, "change");
  return true;
}

function labelTextFor(el: HTMLElement): string {
  const wrapping = el.closest("label");
  if (wrapping) return wrapping.textContent || "";
  return (el as HTMLInputElement).value || "";
}

/** Выставляет значение через нативный сеттер прототипа (обход React value-trap). */
function setNativeValue(el: HTMLElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else (el as HTMLInputElement).value = value;
}

function dispatch(el: HTMLElement, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

/** Кратко подсвечивает заполненное поле (inline-стиль, снимается через 1.6 c). */
function flashField(el: HTMLElement): void {
  const prevOutline = el.style.outline;
  const prevTransition = el.style.transition;
  el.style.outline = "2px solid #0d9488";
  el.style.transition = "outline 0.4s ease";
  setTimeout(() => {
    el.style.outline = prevOutline;
    el.style.transition = prevTransition;
  }, 1600);
}
