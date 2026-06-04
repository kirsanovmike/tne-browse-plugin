// src/sandbox/pdf-sandbox.ts
/**
 * PHASE 7 — PDF.js внутри extension-страницы (iframe). Принимает ArrayBuffer от
 * content-скрипта, открывает документ, извлекает текст и рендерит страницы в JPEG,
 * отвечает через postMessage родителю. Запускается из pdf-sandbox.html.
 */
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { browser } from "../shared/browser";
import type { OpenRequest, PagesRequest, SandboxReply } from "./protocol";

const LOAD_TIMEOUT_MS = 25000;
// Сохраняем прежнее поведение оркестратора: текст дешевле рендера.
const PAGE_TEXT_TIMEOUT_MS = 15000;
const PAGE_RENDER_TIMEOUT_MS = 20000;

let workerConfigured = false;
let doc: PDFDocumentProxy | null = null;

function configureWorker(): void {
  if (workerConfigured) return;
  // Worker лежит в корне расширения; sandbox — тоже extension origin → без Xray.
  pdfjs.GlobalWorkerOptions.workerSrc = browser.runtime.getURL("pdf.worker.min.mjs");
  workerConfigured = true;
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function reply(msg: SandboxReply): void {
  // Родитель — content-скрипт на странице любого origin; targetOrigin "*" ок,
  // полезной нагрузки секретов нет (только текст/картинки выбранного PDF).
  window.parent.postMessage(msg, "*");
}

async function extractPageText(d: PDFDocumentProxy, n: number): Promise<string> {
  const page = await d.getPage(n);
  const content = await page.getTextContent();
  let out = "";
  for (const item of content.items) {
    if (!("str" in item)) continue;
    out += item.str;
    out += item.hasEOL ? "\n" : " ";
  }
  return out.replace(/[ \t]+\n/g, "\n").trim();
}

async function renderPage(d: PDFDocumentProxy, n: number, scale: number): Promise<string> {
  const page = await d.getPage(n);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен для рендера PDF.");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function handleOpen(req: OpenRequest): Promise<void> {
  configureWorker();
  // Освобождаем прошлый документ (worker/кэш), если открывают второй PDF подряд.
  if (doc) {
    try { await doc.destroy(); } catch { /* best-effort */ }
    doc = null;
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(req.buffer) });
  try {
    doc = await withTimeout(
      task.promise,
      LOAD_TIMEOUT_MS,
      "PDF не открылся за отведённое время — возможно, не запустился worker PDF.js."
    );
    reply({ type: "TNE_PDF_OPENED", reqId: req.reqId, numPages: doc.numPages });
  } catch (e) {
    try { await task.destroy(); } catch { /* best-effort */ }
    reply({ type: "TNE_PDF_ERROR", reqId: req.reqId, message: (e as Error)?.message || String(e) });
  }
}

async function handlePages(req: PagesRequest): Promise<void> {
  if (!doc) {
    reply({ type: "TNE_PDF_ERROR", reqId: req.reqId, message: "PDF ещё не открыт." });
    return;
  }
  try {
    const texts: string[] = [];
    for (let i = 0; i < req.pages.length; i++) {
      reply({ type: "TNE_PDF_PROGRESS", reqId: req.reqId, stage: "text", index: i, total: req.pages.length });
      texts.push(await withTimeout(extractPageText(doc, req.pages[i]!), PAGE_TEXT_TIMEOUT_MS,
        `PDF.js не ответил при извлечении текста страницы ${req.pages[i]}.`));
    }
    const images: { page: number; dataUrl: string }[] = [];
    if (req.withImages) {
      for (let i = 0; i < req.pages.length; i++) {
        const p = req.pages[i]!;
        reply({ type: "TNE_PDF_PROGRESS", reqId: req.reqId, stage: "render", index: i, total: req.pages.length });
        const dataUrl = await withTimeout(renderPage(doc, p, req.scale), PAGE_RENDER_TIMEOUT_MS,
          `PDF.js не ответил при отрисовке страницы ${p}.`);
        images.push({ page: p, dataUrl });
      }
    }
    reply({ type: "TNE_PDF_RESULT", reqId: req.reqId, texts, images });
  } catch (e) {
    reply({ type: "TNE_PDF_ERROR", reqId: req.reqId, message: (e as Error)?.message || String(e) });
  }
}

window.addEventListener("message", (ev: MessageEvent) => {
  const data = ev.data as OpenRequest | PagesRequest | undefined;
  if (!data || typeof data !== "object") return;
  if (data.type === "TNE_PDF_OPEN") void handleOpen(data);
  else if (data.type === "TNE_PDF_PAGES") void handlePages(data);
});

// Сообщаем родителю, что модуль загрузился и слушатель навешен.
reply({ type: "TNE_PDF_SANDBOX_READY" });
