/**
 * DOM-предикаты для сбора контекста: что читаемо, что относится к расширению.
 *
 * Перенесено из `content.js` (isReadableElement / isInsideExtension / toElement /
 * cssEscape) при декомпозиции на M3. Зависят от DOM → без юнит-тестов (дизайн §6),
 * проверка ручная в браузере.
 */
import { STATE, TNE_HOST_ID } from "./state";

/** Приводит узел к ближайшему Element (сам элемент или родитель текстового узла). */
export function toElement(node: Node | null | undefined): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

/** Истина, если узел принадлежит хосту/панели расширения (исключаем из сбора). */
export function isInsideExtension(node: Node | null | undefined): boolean {
  const el = toElement(node);
  if (!el) return false;
  if (el.id === TNE_HOST_ID) return true;
  if (el.closest?.(`#${TNE_HOST_ID}`)) return true;
  const root = el.getRootNode?.();
  if (root && STATE.shadow && root === STATE.shadow) return true;
  return false;
}

/** Истина, если элемент видим и пригоден для извлечения текста. */
export function isReadableElement(el: Element | null | undefined): el is Element {
  if (!el || !el.tagName || isInsideExtension(el)) return false;
  const htmlEl = el as HTMLElement;
  if (htmlEl.hidden || el.getAttribute("aria-hidden") === "true") return false;
  try {
    const view = el.ownerDocument?.defaultView || window;
    const style = view.getComputedStyle(el);
    if (!style || style.display === "none" || style.visibility === "hidden") return false;
  } catch {
    return true;
  }
  return true;
}

/** Экранирует значение для использования в CSS-селекторе. */
export function cssEscape(value: string): string {
  if (typeof window.CSS?.escape === "function") return window.CSS.escape(value);
  return String(value).replace(/(["\\])/g, "\\$1");
}
