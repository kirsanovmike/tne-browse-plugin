/**
 * Рендер страницы PDF в detached canvas → data URL (3.3). Дальше dataUrl ужимается
 * существующим compressDataUrl (≤ IMAGE_MAX_SIDE, jpeg). DOM → ручная проверка.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PDF_RENDER_SCALE } from "../../shared/limits";

/** Рендерит страницу (1-based) в JPEG data URL. */
export async function renderPageToDataUrl(
  doc: PDFDocumentProxy,
  pageNumber: number,
  scale: number = PDF_RENDER_SCALE
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен для рендера PDF.");

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}
