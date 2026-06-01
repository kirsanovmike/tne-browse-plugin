/**
 * Обёртка над Mozilla Readability (дизайн §3, §5): главный контент с фолбэком на
 * эвристику. Библиотека теперь из npm (`@mozilla/readability`), бандлится Vite
 * локально — без CDN (закрытый контур).
 *
 * Перенесено из `content.js` (readabilityMainContent / extractMainContent) на M3.
 * DOM → без юнит-тестов (дизайн §6).
 */
import { Readability } from "@mozilla/readability";
import { normalizeText, removeDuplicateLines } from "../../shared/text";
import { readableFromElement } from "./text-extract";

/** [MAIN CONTENT]: Readability, при провале — эвристический фолбэк по поддереву. */
export function extractMainContent(source: Element): string {
  const viaReadability = readabilityMainContent();
  if (viaReadability && viaReadability.length > 200) return viaReadability;
  return removeDuplicateLines(readableFromElement(source, { skipLayout: true }));
}

function readabilityMainContent(): string {
  try {
    const docClone = document.cloneNode(true) as Document;
    const article = new Readability(docClone, { charThreshold: 200, keepClasses: false }).parse();
    if (!article || !article.textContent) return "";
    return removeDuplicateLines(normalizeText(article.textContent));
  } catch {
    return "";
  }
}
