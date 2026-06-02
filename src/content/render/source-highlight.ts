/**
 * 4.2: подсветка DOM-источника по клику на метку в ответе + тост в панели, если
 * источник не найден (например [DOCUMENT D1] для PDF или устаревший blockMap).
 *
 * DOM-модуль → без юнит-тестов (§6 стиля проекта). Overlay рисуется в page DOM
 * инлайн-стилями (вне shadow root панели, как region-capture).
 */
import { STATE } from "../state";

const OVERLAY_ID = "tne-source-highlight";
const TOAST_HIDE_MS = 2200;
const TOAST_REMOVE_MS = 2600;

/** Подсвечивает DOM-элемент, сопоставленный блоку; иначе показывает тост. */
export function highlightBlock(blockId: string): void {
  const el = STATE.blockMap[blockId];
  if (!el || !(el instanceof Element) || !el.isConnected) {
    showPanelToast("Источник не найден на странице (возможно, это загруженный документ или страница изменилась).");
    return;
  }

  el.scrollIntoView({ behavior: "smooth", block: "center" });

  document.getElementById(OVERLAY_ID)?.remove();
  const rect = viewportRect(el);
  const box = document.createElement("div");
  box.id = OVERLAY_ID;
  box.style.cssText = [
    "position:fixed",
    `left:${rect.left}px`,
    `top:${rect.top}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    "z-index:2147483646",
    "pointer-events:none",
    "border:2px solid #14b8a6",
    "border-radius:6px",
    "background:rgba(20,184,166,0.18)",
    "box-shadow:0 0 0 4px rgba(20,184,166,0.25)",
    "transition:opacity .35s ease",
  ].join(";");
  document.documentElement.appendChild(box);
  setTimeout(() => { box.style.opacity = "0"; }, 1600);
  setTimeout(() => box.remove(), 2000);
}

/** Прямоугольник элемента в координатах вьюпорта верхнего окна (учёт same-origin iframe). */
function viewportRect(el: Element): { left: number; top: number; width: number; height: number } {
  const rect = el.getBoundingClientRect();
  let left = rect.left;
  let top = rect.top;
  let win: Window | null = el.ownerDocument.defaultView;
  try {
    while (win && win.frameElement) {
      const frameRect = (win.frameElement as Element).getBoundingClientRect();
      left += frameRect.left;
      top += frameRect.top;
      win = win.parent === win ? null : win.parent;
    }
  } catch {
    // cross-origin родитель недоступен — используем то, что насчитали.
  }
  return { left, top, width: rect.width, height: rect.height };
}

/** Транзиентный тост внизу панели (в shadow root). */
export function showPanelToast(text: string): void {
  const root = STATE.panel;
  if (!root) return;
  root.querySelector(".tne-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "tne-toast";
  toast.textContent = text;
  root.appendChild(toast);
  setTimeout(() => toast.classList.add("tne-toast--hide"), TOAST_HIDE_MS);
  setTimeout(() => toast.remove(), TOAST_REMOVE_MS);
}
