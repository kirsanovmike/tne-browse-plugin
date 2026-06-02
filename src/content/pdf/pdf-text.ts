/**
 * Извлечение текстового слоя страницы PDF (3.2). Склеивает текстовые элементы,
 * переносы строк восстанавливаются по флагу hasEOL. DOM/рантайм → ручная проверка.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

/** Возвращает текст одной страницы (1-based). Пустая строка, если слоя нет. */
export async function extractPageText(doc: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  let out = "";
  for (const item of content.items) {
    if (!("str" in item)) continue;
    out += item.str;
    if (item.hasEOL) out += "\n";
    else out += " ";
  }
  return out.replace(/[ \t]+\n/g, "\n").trim();
}
