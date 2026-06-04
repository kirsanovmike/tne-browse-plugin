// src/sandbox/protocol.ts
/**
 * PHASE 7 — общий протокол content ↔ pdf-sandbox (postMessage). Sandbox — это
 * extension-страница (moz-extension://) в скрытом iframe; там PDF.js работает без
 * Xray-обёрток Firefox, поэтому стриминг getTextContent не падает.
 */

/** Запрос: открыть PDF из ArrayBuffer (buffer передаётся как transferable). */
export interface OpenRequest {
  type: "TNE_PDF_OPEN";
  reqId: string;
  buffer: ArrayBuffer;
}

/** Ответ: PDF открыт. */
export interface OpenedReply {
  type: "TNE_PDF_OPENED";
  reqId: string;
  numPages: number;
}

/** Запрос: обработать выбранные страницы (1-based). */
export interface PagesRequest {
  type: "TNE_PDF_PAGES";
  reqId: string;
  pages: number[];
  withImages: boolean;
  scale: number;
}

/** Прогресс обработки. */
export interface ProgressReply {
  type: "TNE_PDF_PROGRESS";
  reqId: string;
  stage: "text" | "render";
  index: number; // 0-based в пределах батча
  total: number;
}

/** Итог: тексты страниц (в порядке pages) + картинки страниц (JPEG data URL). */
export interface ResultReply {
  type: "TNE_PDF_RESULT";
  reqId: string;
  texts: string[];
  images: { page: number; dataUrl: string }[];
}

/** Любая ошибка sandbox. */
export interface ErrorReply {
  type: "TNE_PDF_ERROR";
  reqId: string;
  message: string;
}

/** Готовность sandbox (шлётся один раз после загрузки модуля). */
export interface ReadyReply {
  type: "TNE_PDF_SANDBOX_READY";
}

export type SandboxRequest = OpenRequest | PagesRequest;
export type SandboxReply = OpenedReply | ProgressReply | ResultReply | ErrorReply | ReadyReply;

let counter = 0;
/**
 * Уникальный id запроса в пределах сессии страницы.
 * Генерируется ТОЛЬКО на стороне content; sandbox лишь возвращает reqId обратно
 * в ответах — поэтому per-module counter не порождает коллизий между фреймами.
 */
export function makeReqId(): string {
  counter += 1;
  return `pdfreq-${Date.now().toString(36)}-${counter}`;
}
