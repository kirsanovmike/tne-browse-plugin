/**
 * Загрузка PDF через pdfjs-dist (Phase 3). Worker отдаётся как
 * web_accessible_resource и грузится по runtime.getURL — локально, без CDN.
 * Работает в content (нужен DOM/canvas; в Chromium SW их нет). Проверка — ручная.
 */
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { browser } from "../../shared/browser";

let workerConfigured = false;

function configureWorker(): void {
  if (workerConfigured) return;
  pdfjs.GlobalWorkerOptions.workerSrc = browser.runtime.getURL("pdf.worker.min.mjs");
  workerConfigured = true;
}

/** Открывает PDF из ArrayBuffer. Бросает при повреждённом/зашифрованном файле. */
export async function loadPdfDocument(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  configureWorker();
  // copy в Uint8Array: pdfjs «забирает» (transfers/neutralises) переданный буфер.
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  return task.promise;
}
