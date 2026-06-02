/**
 * 4.7: библиотека промптов. Чистый модуль (Vitest): тип шаблона, подстановка
 * переменных, извлечение первой таблицы из структурированного контекста и
 * валидация импортируемого JSON. CRUD/хранение — в options (storage.local).
 */

export interface PromptTemplate {
  id: string;
  label: string;
  body: string;
}

export interface TemplateVars {
  selection: string;
  url: string;
  table: string;
}

/** Ключ хранения массива шаблонов в storage.local. */
export const TEMPLATES_KEY = "promptTemplates";

/** Генератор id шаблона (по аналогии с requestId). */
export function newTemplateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Подстановка {{выделение}} / {{url}} / {{таблица}} (терпима к пробелам/регистру). */
export function applyTemplateVariables(body: string, vars: TemplateVars): string {
  return String(body ?? "")
    .replace(/\{\{\s*выделение\s*\}\}/gi, vars.selection ?? "")
    .replace(/\{\{\s*url\s*\}\}/gi, vars.url ?? "")
    .replace(/\{\{\s*таблица\s*\}\}/gi, vars.table ?? "");
}

/** Первый блок [TABLE Tn] из контекста до следующего блока-заголовка; иначе "". */
export function firstTableBlock(pageText: string): string {
  const text = String(pageText ?? "");
  const start = text.search(/\[TABLE T\d+\]/);
  if (start === -1) return "";
  const rest = text.slice(start);
  const nextIdx = rest.search(/\n\n\[[A-Z]/);
  return (nextIdx === -1 ? rest : rest.slice(0, nextIdx)).trim();
}

/** Валидация/нормализация импортируемого JSON шаблонов. */
export function parseImportedTemplates(json: unknown): PromptTemplate[] {
  if (!Array.isArray(json)) {
    throw new Error("Ожидался JSON-массив шаблонов.");
  }
  const out: PromptTemplate[] = [];
  for (const item of json) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    const body = typeof rec.body === "string" ? rec.body : "";
    if (!label && !body.trim()) continue;
    const id = typeof rec.id === "string" && rec.id ? rec.id : newTemplateId();
    out.push({ id, label: label || "Без названия", body });
  }
  return out;
}
