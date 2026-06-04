// src/content/pdf/pdf-sandbox-client.ts
/**
 * PHASE 7 — клиент PDF-sandbox на стороне content. Держит скрытый iframe с
 * extension-страницей pdf-sandbox.html и гоняет RPC по postMessage. PDF.js больше
 * не исполняется в изолированном мире content (Xray), поэтому стриминг не падает.
 */
import { browser } from "../../shared/browser";
import { makeReqId, type SandboxReply, type ResultReply } from "../../sandbox/protocol";

let iframe: HTMLIFrameElement | null = null;
let readyPromise: Promise<void> | null = null;

type Pending = {
  resolve: (r: ResultReply | { numPages: number }) => void;
  reject: (e: Error) => void;
  onProgress?: (stage: "text" | "render", index: number, total: number) => void;
  kind: "open" | "pages";
};
const pending = new Map<string, Pending>();

function onMessage(ev: MessageEvent): void {
  const msg = ev.data as SandboxReply | undefined;
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "TNE_PDF_SANDBOX_READY") return; // обрабатывается в ensureSandbox
  const p = "reqId" in msg ? pending.get(msg.reqId) : undefined;
  if (!p) return;
  if (msg.type === "TNE_PDF_PROGRESS") {
    p.onProgress?.(msg.stage, msg.index, msg.total);
  } else if (msg.type === "TNE_PDF_OPENED") {
    pending.delete(msg.reqId);
    p.resolve({ numPages: msg.numPages });
  } else if (msg.type === "TNE_PDF_RESULT") {
    pending.delete(msg.reqId);
    p.resolve(msg);
  } else if (msg.type === "TNE_PDF_ERROR") {
    pending.delete(msg.reqId);
    p.reject(new Error(msg.message));
  }
}

/** Создаёт iframe (один раз) и ждёт TNE_PDF_SANDBOX_READY. */
function ensureSandbox(host: HTMLElement): Promise<void> {
  if (readyPromise && iframe?.isConnected) return readyPromise;
  readyPromise = new Promise<void>((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.src = browser.runtime.getURL("src/sandbox/pdf-sandbox.html");
    frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden;";
    frame.setAttribute("aria-hidden", "true");
    const ready = (ev: MessageEvent) => {
      const m = ev.data as SandboxReply | undefined;
      if (m?.type === "TNE_PDF_SANDBOX_READY" && ev.source === frame.contentWindow) {
        window.removeEventListener("message", ready);
        resolve();
      }
    };
    window.addEventListener("message", ready);
    frame.addEventListener("error", () => {
      window.removeEventListener("message", ready);
      reject(new Error("Не удалось загрузить служебную страницу PDF."));
    });
    window.addEventListener("message", onMessage);
    host.appendChild(frame);
    iframe = frame;
    // Страховка от вечного ожидания готовности.
    setTimeout(() => reject(new Error("Служебная страница PDF не ответила (таймаут готовности).")), 10000);
  });
  return readyPromise;
}

function post(msg: object, transfer: Transferable[] = []): void {
  iframe?.contentWindow?.postMessage(msg, "*", transfer);
}

/** Открывает PDF в sandbox. host — элемент, в который вешается iframe (хост панели). */
export async function openPdf(host: HTMLElement, buffer: ArrayBuffer): Promise<number> {
  await ensureSandbox(host);
  const reqId = makeReqId();
  return new Promise<number>((resolve, reject) => {
    pending.set(reqId, {
      kind: "open",
      resolve: (r) => resolve((r as { numPages: number }).numPages),
      reject,
    });
    post({ type: "TNE_PDF_OPEN", reqId, buffer }, [buffer]);
  });
}

/** Обрабатывает выбранные страницы: возвращает тексты (в порядке pages) и картинки. */
export function processPages(
  pages: number[],
  withImages: boolean,
  scale: number,
  onProgress?: (stage: "text" | "render", index: number, total: number) => void
): Promise<{ texts: string[]; images: { page: number; dataUrl: string }[] }> {
  const reqId = makeReqId();
  return new Promise((resolve, reject) => {
    pending.set(reqId, {
      kind: "pages",
      resolve: (r) => {
        const res = r as ResultReply;
        resolve({ texts: res.texts, images: res.images });
      },
      reject,
      onProgress,
    });
    post({ type: "TNE_PDF_PAGES", reqId, pages, withImages, scale });
  });
}

/** Полностью убирает sandbox (вызов из clearPdf). */
export function destroySandbox(): void {
  window.removeEventListener("message", onMessage);
  pending.clear();
  iframe?.remove();
  iframe = null;
  readyPromise = null;
}
