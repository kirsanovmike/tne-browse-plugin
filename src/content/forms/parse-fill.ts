/**
 * 5.4: чистый разбор ответа модели в список подстановок. Терпим к ограждениям
 * ```json, тексту вокруг и мусору: извлекаем первый сбалансированный {…},
 * оставляем только известные fieldId со скалярными значениями. Покрыто Vitest.
 */

export interface FillProposal {
  fieldId: string;
  value: string;
}

/** Разбирает ответ модели; неизвестные id и нескалярные значения отбрасываются. */
export function parseFillResponse(modelText: string, knownIds: string[]): FillProposal[] {
  const json = extractFirstObject(modelText);
  if (!json) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];

  const known = new Set(knownIds);
  const result: FillProposal[] = [];
  for (const [fieldId, raw] of Object.entries(parsed as Record<string, unknown>)) {
    if (!known.has(fieldId)) continue;
    const value = scalarToString(raw);
    if (value === null) continue;
    result.push({ fieldId, value });
  }
  return result;
}

/** Превращает скаляр в строку; объекты/массивы/null/undefined → null (отбросить). */
function scalarToString(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "boolean") return String(raw);
  return null;
}

/** Находит первый сбалансированный JSON-объект в тексте (учитывая строки/экранирование). */
function extractFirstObject(text: string): string | null {
  if (!text) return null;
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
