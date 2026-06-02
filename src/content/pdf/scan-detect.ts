/**
 * Чистая эвристика: PDF выглядит как скан / имеет бедный текстовый слой, если
 * среднее число непробельных символов на страницу ниже порога. Пустой список
 * страниц трактуется как скан (текстового слоя нет вовсе). Покрыта Vitest (Phase 3).
 */
import { PDF_SCAN_MIN_CHARS_PER_PAGE } from "../../shared/limits";

export function looksLikeScan(
  pageTexts: string[],
  minCharsPerPage: number = PDF_SCAN_MIN_CHARS_PER_PAGE
): boolean {
  if (pageTexts.length === 0) return true;
  const total = pageTexts.reduce((sum, t) => sum + t.replace(/\s/g, "").length, 0);
  return total / pageTexts.length < minCharsPerPage;
}
