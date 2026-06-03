/**
 * Чистая нормализация сырого текста .docx (Mammoth.extractRawText) перед
 * вставкой в [DOCUMENT D1]. Без DOM/IO → Vitest. Phase 5 (5.1).
 */

/** Схлопывает лишние пустые строки, нормализует переводы строк и тримит. */
export function normalizeDocxText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
