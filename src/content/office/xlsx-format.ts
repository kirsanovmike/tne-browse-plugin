/**
 * Чистый формат XLSX → текст контекста: каждый лист как [SHEET «имя»] + markdown
 * таблица (переиспользует matrixToMarkdown). Без IO/DOM → Vitest. Phase 5 (5.2).
 */
import { matrixToMarkdown } from "../context/tables-to-md";

export interface SheetData {
  name: string;
  matrix: string[][];
}

/** Склеивает листы в тело [DOCUMENT D1]; пустые листы пропускаются. */
export function sheetsToContextText(sheets: SheetData[]): string {
  return sheets
    .map((sheet) => {
      const md = matrixToMarkdown(sheet.matrix);
      return md ? `[SHEET «${sheet.name}»]\n${md}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}
