/**
 * Обход открытых shadow root и same-origin iframe (Phase 1.14): сбор корней для
 * поиска контента и глубокий querySelectorAll по ним.
 *
 * Перенесено из `content.js` (getSearchRoots / deepQueryAll) при декомпозиции на
 * M3. Cross-origin iframe недоступен (CORS) — молча пропускается. DOM → без
 * юнит-тестов (дизайн §6).
 */
import { STATE } from "../state";
import { isInsideExtension } from "../dom-utils";

type SearchRoot = Document | ShadowRoot;

/** Собирает document + открытые shadow root + same-origin iframe-документы. */
export function getSearchRoots(): SearchRoot[] {
  const roots: SearchRoot[] = [document];
  const seen = new Set<SearchRoot>([document]);
  const stack: SearchRoot[] = [document];
  let guard = 0;
  const GUARD_LIMIT = 25000;

  while (stack.length && guard < GUARD_LIMIT) {
    const current = stack.pop()!;
    let elements: NodeListOf<Element>;
    try {
      elements = current.querySelectorAll("*");
    } catch {
      continue;
    }

    for (const el of elements) {
      if (++guard > GUARD_LIMIT) break;
      if (isInsideExtension(el)) continue;

      // Открытый shadow root веб-компонента/виджета.
      const shadow = el.shadowRoot;
      if (shadow && shadow !== STATE.shadow && !seen.has(shadow)) {
        seen.add(shadow);
        roots.push(shadow);
        stack.push(shadow);
      }

      // Same-origin iframe — cross-origin недоступен (CORS), молча пропускаем.
      if (el.tagName === "IFRAME") {
        let frameDoc: Document | null = null;
        try {
          frameDoc = (el as HTMLIFrameElement).contentDocument;
        } catch {
          frameDoc = null;
        }
        if (frameDoc && !seen.has(frameDoc)) {
          seen.add(frameDoc);
          roots.push(frameDoc);
          stack.push(frameDoc);
        }
      }
    }
  }

  return roots;
}

/** querySelectorAll по всем найденным корням (document + shadow + iframe). */
export function deepQueryAll(selector: string): Element[] {
  const roots: SearchRoot[] = STATE.searchRoots || [document];
  const out: Element[] = [];
  for (const root of roots) {
    let found: NodeListOf<Element>;
    try {
      found = root.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const el of found) out.push(el);
  }
  return out;
}
