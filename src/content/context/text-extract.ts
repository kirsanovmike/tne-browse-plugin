/**
 * Извлечение читаемого текста из DOM: обход дерева, выбор лучшего контейнера
 * контента, заголовок страницы, безопасное выделение.
 *
 * Перенесено из `content.js` (readableFromElement / walk / shouldSkipElement /
 * scoreElement / findBestContentSource / getPageTitle / getSafeSelection) при
 * декомпозиции на M3. DOM → без юнит-тестов (дизайн §6).
 */
import { STATE, TNE_HOST_ID } from "../state";
import { isReadableElement, isInsideExtension } from "../dom-utils";
import { deepQueryAll } from "./roots";
import { describeField } from "./collectors";
import { normalizeText, isUsefulText } from "../../shared/text";

export interface ReadOptions {
  skipLayout?: boolean;
  maxLines?: number;
}

/** Собирает построчно читаемый текст из поддерева элемента. */
export function readableFromElement(root: Node, options: ReadOptions = {}): string {
  const lines: string[] = [];
  const limit = Number(options.maxLines) || 2500;
  walk(root, lines, options);
  return lines
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .slice(0, limit)
    .join("\n");
}

function walk(node: Node | null, lines: string[], options: ReadOptions): void {
  if (!node || lines.length > (Number(options.maxLines) || 2500)) return;

  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || !isReadableElement(parent) || isInsideExtension(parent)) return;
    const text = normalizeText(node.nodeValue || "");
    if (isUsefulText(text)) lines.push(text);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as Element;
  if (!isReadableElement(el) || isInsideExtension(el)) return;

  const tag = el.tagName.toLowerCase();

  // Same-origin iframe (1.14): спускаемся в его документ; cross-origin недоступен.
  if (tag === "iframe") {
    let frameDoc: Document | null = null;
    try {
      frameDoc = (el as HTMLIFrameElement).contentDocument;
    } catch {
      frameDoc = null;
    }
    if (frameDoc?.body && !isInsideExtension(el)) walk(frameDoc.body, lines, options);
    return;
  }

  if (shouldSkipElement(el, options)) return;

  if (tag === "br") {
    lines.push("\n");
    return;
  }

  if (/^h[1-6]$/.test(tag)) {
    const text = normalizeText((el as HTMLElement).innerText || el.textContent || "");
    if (text) lines.push(`## ${text}`);
    return;
  }

  if (tag === "li") {
    const text = normalizeText((el as HTMLElement).innerText || el.textContent || "");
    if (text) lines.push(`- ${text}`);
    return;
  }

  if (tag === "tr") {
    const cells = [...el.children]
      .filter((child) => ["td", "th"].includes(child.tagName.toLowerCase()))
      .map((cell) => normalizeText((cell as HTMLElement).innerText || cell.textContent || ""))
      .filter(Boolean);
    if (cells.length) lines.push(cells.join(" | "));
    return;
  }

  if (["input", "textarea", "select"].includes(tag)) {
    const field = describeField(el);
    if (field) lines.push(field);
    return;
  }

  if (tag === "button") {
    const text = normalizeText(
      (el as HTMLElement).innerText || el.textContent || el.getAttribute("aria-label") || (el as HTMLElement).title || ""
    );
    if (text) lines.push(`Кнопка: ${text}`);
    return;
  }

  if (tag === "a") {
    const text = normalizeText((el as HTMLElement).innerText || el.textContent || el.getAttribute("aria-label") || "");
    const href = el.getAttribute("href") || "";
    if (text && text.length > 1) {
      const url = href && !href.startsWith("#") ? ` — ${href}` : "";
      lines.push(`Ссылка: ${text}${url}`);
    }
    return;
  }

  if (tag === "img") {
    const alt = normalizeText(el.getAttribute("alt") || el.getAttribute("title") || "");
    if (alt) lines.push(`Изображение: ${alt}`);
    return;
  }

  // Открытый shadow root веб-компонента (1.14) — его содержимое тоже читаем.
  if (el.shadowRoot && el.shadowRoot !== STATE.shadow && !isInsideExtension(el)) {
    for (const child of el.shadowRoot.childNodes) walk(child, lines, options);
  }

  for (const child of el.childNodes) walk(child, lines, options);
}

function shouldSkipElement(el: Element, options: ReadOptions = {}): boolean {
  const tag = el.tagName.toLowerCase();
  if (["script", "style", "noscript", "template", "svg", "canvas", "iframe", "object", "embed", "link", "meta"].includes(tag)) return true;
  if (options.skipLayout && ["nav", "footer", "aside"].includes(tag)) return true;

  const skipSelectors = [
    `#${TNE_HOST_ID}`,
    "[hidden]",
    ".cookie", ".cookies", ".cookie-banner",
    ".advert", ".advertisement", ".ads", ".ad",
    ".breadcrumb",
  ];
  if (skipSelectors.some((selector) => el.matches?.(selector))) return true;
  return false;
}

function scoreElement(el: Element): number {
  const text = readableFromElement(el, { skipLayout: true, maxLines: 900 });
  const structureBonus = el.querySelectorAll("h1,h2,h3,p,li,td,th,input,textarea,select,button").length * 45;
  return text.length + structureBonus;
}

/** Выбирает контейнер с наибольшей «плотностью» контента (main/article/...). */
export function findBestContentSource(): Element {
  const selectors = [
    "main", "article", "[role='main']", "#content", ".content", "#main", ".main",
    ".page-content", ".wiki-content", ".markdown-body", ".document", ".article", "#app",
  ];

  const candidates = selectors
    .flatMap((selector) => deepQueryAll(selector))
    .filter((el) => isReadableElement(el) && !isInsideExtension(el));

  let best: Element = document.body;
  let bestScore = scoreElement(document.body);

  for (const candidate of candidates) {
    const score = scoreElement(candidate);
    if (score > bestScore * 0.55 && score > 250) {
      best = candidate;
      bestScore = score;
    }
  }

  return best || document.body || document.documentElement;
}

/** Заголовок страницы: document.title или первый видимый h1. */
export function getPageTitle(): string {
  const visibleH1 = [...document.querySelectorAll("h1")].find((el) => isReadableElement(el) && !isInsideExtension(el));
  return normalizeText(document.title || visibleH1?.innerText || visibleH1?.textContent || "");
}

/** Текущее выделение пользователя, если оно не внутри панели расширения. */
export function getSafeSelection(): string {
  const selection = window.getSelection?.();
  if (!selection || !selection.rangeCount) return "";
  if (isInsideExtension(selection.anchorNode) || isInsideExtension(selection.focusNode)) return "";
  return normalizeText(String(selection).slice(0, 6000));
}
