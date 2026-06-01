/**
 * Чистые строковые утилиты, общие для сбора контекста, рендера и скана.
 *
 * Перенесено из `content.js` (normalizeText / isUsefulText / removeDuplicateLines /
 * smartTrim / escapeHtml) без изменения поведения — покрыто Vitest как
 * характеризационная сетка для strangler-миграции (дизайн §6, §7 M3).
 */
import { MAX_CONTEXT_HARD_LIMIT } from "./settings";

/** Сворачивает пробелы/табы, схлопывает 3+ перевода строки до 2, тримит. */
export function normalizeText(text: string | null | undefined): string {
  return String(text || "")
    .replace(/ /g, " ")
    .replace(/[ \t\r\f]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Истина, если строка несёт смысл (длиннее 1 символа и не только разделители). */
export function isUsefulText(text: string): boolean {
  if (!text || text.length < 2) return false;
  if (/^[\s\-–—•|:;,.]+$/.test(text)) return false;
  return true;
}

/** Убирает повторяющиеся (без учёта регистра) и бессмысленные строки. */
export function removeDuplicateLines(text: string | null | undefined): string {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of String(text || "").split(/\n+/)) {
    const normalized = normalizeText(line);
    if (!isUsefulText(normalized)) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result.join("\n");
}

/** Обрезает длинный текст, вырезая середину и оставляя «голову» и «хвост». */
export function smartTrim(text: string | null | undefined, maxChars: number): string {
  const value = String(text || "").trim();
  const limit = Math.min(Number(maxChars) || MAX_CONTEXT_HARD_LIMIT, MAX_CONTEXT_HARD_LIMIT);
  if (value.length <= limit) return value;
  const head = Math.floor(limit * 0.72);
  const tail = Math.max(0, limit - head - 120);
  return `${value.slice(0, head)}\n\n[...середина сокращена расширением...]\n\n${value.slice(-tail)}`;
}

/** Экранирует пять HTML-значимых символов. */
export function escapeHtml(text: string | null | undefined): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
