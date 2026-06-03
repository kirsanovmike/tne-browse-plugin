/**
 * Загрузка PDF через pdfjs-dist (Phase 3). Worker отдаётся как
 * web_accessible_resource и грузится по runtime.getURL — локально, без CDN.
 * Работает в content (нужен DOM/canvas; в Chromium SW их нет). Проверка — ручная.
 *
 * 5.R2-9: добавлены таймауты, чтобы при незапустившемся worker'е в закрытом
 * контуре пользователь видел понятную ошибку, а не вечное «Извлекаю текст…».
 */
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { browser } from "../../shared/browser";

let workerConfigured = false;

const LOAD_TIMEOUT_MS = 25000;

/** Гонка промиса с таймаутом: при просрочке — отклонение с понятным сообщением. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function configureWorker(): void {
  if (workerConfigured) return;
  // Стабильное имя файла из web_accessible_resources (vite копирует в корень dist).
  pdfjs.GlobalWorkerOptions.workerSrc = browser.runtime.getURL("pdf.worker.min.mjs");
  workerConfigured = true;
}

/** Открывает PDF из ArrayBuffer. Бросает при повреждённом/зашифрованном файле или таймауте. */
export async function loadPdfDocument(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  configureWorker();
  // copy в Uint8Array: pdfjs «забирает» (transfers/neutralises) переданный буфер.
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    return await withTimeout(
      task.promise,
      LOAD_TIMEOUT_MS,
      "PDF не открылся за отведённое время — возможно, не запустился worker PDF.js. Попробуйте ещё раз."
    );
  } catch (error) {
    try {
      await task.destroy();
    } catch {
      // освобождение ресурсов — best-effort
    }
    throw error;
  }
}
