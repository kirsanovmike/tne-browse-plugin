/**
 * Маскирование полей форм (дизайн §3, §7 M3; Phase 1.11).
 *
 * Чистая часть: по уже извлечённым свойствам поля собирает строку
 * «label: value», маскируя пароли и token/secret-подобные поля. DOM-сбор полей
 * (describeField / getFieldLabel / collectFields) живёт в `collectors.ts`.
 * Перенесено из `content.js` без изменения поведения → Vitest.
 */

/** Имена/подсказки, при которых значение поля скрывается как чувствительное. */
export const SENSITIVE_NAME_RE = /pass|secret|token|apikey|api[-_ ]?key|authoriz|пароль|секрет|ключ|cvv|cvc/i;

/** Разрешённые свойства поля, на основе которых строится строка контекста. */
export interface FieldInput {
  /** tagName в нижнем регистре (input/textarea/select). */
  tag: string;
  /** type (или tag) в нижнем регистре. */
  type: string;
  /** Человеческий лейбл поля (уже нормализован). */
  label: string;
  /** Сводка name/id/label/placeholder/autocomplete для эвристики чувствительности. */
  nameHint: string;
  /** Нормализованное текстовое значение для обычных полей. */
  value: string;
  /** Есть ли «сырое» значение (для маскируемых веток password/secret). */
  hasValue: boolean;
  /** Текст выбранных опций select, склеенный через запятую. */
  selectedText: string;
  /** Состояние checkbox/radio. */
  checked: boolean;
  /** Нормализованный placeholder. */
  placeholder: string;
}

/** Строит строку «label: value» поля, маскируя чувствительные значения. "" — скрыть поле. */
export function formatField(f: FieldInput): string {
  if (f.type === "hidden" || f.type === "submit" || f.type === "button") return "";

  let value = "";
  if (f.type === "password") {
    value = f.hasValue ? "[скрыто]" : "";
  } else if (f.tag === "select") {
    value = f.selectedText;
  } else if (f.type === "checkbox" || f.type === "radio") {
    value = f.checked ? "выбрано" : "не выбрано";
  } else if (SENSITIVE_NAME_RE.test(f.nameHint)) {
    value = f.hasValue ? "[скрыто]" : "";
  } else {
    value = f.value;
  }

  const state = value || (f.placeholder ? `плейсхолдер: ${f.placeholder}` : "пусто");
  return `${f.label || f.type}: ${state}`;
}
