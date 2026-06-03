/**
 * Сборка структурированного контекста страницы (дизайн §3): ID-теггированные
 * блоки [PAGE] [SELECTED] [MODAL Mn] [FORM Fn] [TABLE Tn] [HEADINGS]
 * [VISIBLE TEXT] [MAIN CONTENT] [INTERFACE], обрезка по приоритету, blockMap.
 *
 * Перенесено из `content.js` (buildStructuredContext) при декомпозиции на M3.
 * DOM-оркестратор → без юнит-тестов (дизайн §6); обрезка покрыта в `trim.test.ts`.
 */
import { STATE, type ScopeId } from "../state";
import { DEFAULT_SETTINGS } from "../../shared/settings";
import { normalizeText, removeDuplicateLines, smartTrim } from "../../shared/text";
import { getSearchRoots } from "./roots";
import {
  collectModals,
  collectForms,
  collectTables,
  collectHeadings,
  collectInteractiveText,
} from "./collectors";
import {
  findBestContentSource,
  getPageTitle,
  getSafeSelection,
  readableFromElement,
} from "./text-extract";
import { extractMainContent } from "./readability";
import { trimSectionsByPriority, renderSections, type Section } from "./trim";

/** Готовый контекст страницы, который уходит в payload запроса. */
export interface PageContext {
  title: string;
  url: string;
  selection: string;
  scope: ScopeId;
  text: string;
}

const DEFAULT_MAX_CONTEXT = DEFAULT_SETTINGS.maxContextChars;

/** Строит структурированный контекст под заданный scope, не превышая maxChars. */
export function buildStructuredContext(maxChars: number, scope: ScopeId = "all"): PageContext {
  STATE.blockMap = {};
  STATE.searchRoots = getSearchRoots();

  const selection = getSafeSelection();
  const title = getPageTitle();
  const metaDescription = normalizeText(
    document.querySelector<HTMLMetaElement>("meta[name='description']")?.content || ""
  );
  const source = findBestContentSource();

  const sections: Section[] = [];

  // [PAGE] — всегда первым, минимальный приоритет на обрезку.
  const pageLines = [
    `title: ${title || "не указан"}`,
    `url: ${location.href}`,
    `capturedAt: ${new Date().toISOString()}`,
    metaDescription ? `description: ${metaDescription}` : "",
  ].filter(Boolean);
  sections.push({ tag: "PAGE", header: "[PAGE]", body: pageLines.join("\n"), priority: 0 });

  if (selection && (scope === "all" || scope === "visible" || scope === "selection")) {
    sections.push({ tag: "SELECTED", header: "[SELECTED]", body: selection, priority: 1 });
  }

  // [DOCUMENT] — текст загруженного PDF (Phase 3). Слот один, поэтому всегда D1.
  // Высокий приоритет удержания: загруженный документ — предмет вопроса.
  // 5.R2-8: чтение DOCX/XLSX убрано, источник [DOCUMENT] — только PDF.
  const documentText = STATE.pdf?.documentText;
  if (documentText) {
    sections.push({
      tag: "DOCUMENT",
      header: "[DOCUMENT D1]",
      body: documentText,
      priority: 1,
    });
  }

  if (scope === "all" || scope === "visible") {
    collectModals().forEach((modal, index) => {
      const id = `M${index + 1}`;
      STATE.blockMap[id] = modal.element;
      sections.push({ tag: "MODAL", header: `[MODAL ${id}]`, body: modal.text, priority: 2 });
    });

    collectForms().forEach((form, index) => {
      const id = `F${index + 1}`;
      STATE.blockMap[id] = form.element;
      sections.push({ tag: "FORM", header: `[FORM ${id}]`, body: form.text, priority: 3 });
    });
  }

  if (scope === "all" || scope === "visible" || scope === "tables") {
    collectTables().forEach((table, index) => {
      const id = `T${index + 1}`;
      STATE.blockMap[id] = table.element;
      sections.push({ tag: "TABLE", header: `[TABLE ${id}]`, body: table.markdown, priority: 4 });
    });
  }

  if (scope === "all" || scope === "visible") {
    const headings = collectHeadings().slice(0, 30);
    if (headings.length) {
      sections.push({ tag: "HEADINGS", header: "[HEADINGS]", body: headings.map((h) => `- ${h}`).join("\n"), priority: 6 });
    }
  }

  if (scope === "visible") {
    const visibleText = removeDuplicateLines(readableFromElement(source, { skipLayout: true }));
    if (visibleText) sections.push({ tag: "VISIBLE", header: "[VISIBLE TEXT]", body: visibleText, priority: 5 });
  }

  if (scope === "all") {
    const mainContent = extractMainContent(source);
    if (mainContent) sections.push({ tag: "MAIN", header: "[MAIN CONTENT]", body: mainContent, priority: 7 });

    const interactive = collectInteractiveText();
    if (interactive) sections.push({ tag: "INTERFACE", header: "[INTERFACE]", body: interactive, priority: 8 });
  }

  const trimmed = trimSectionsByPriority(sections, maxChars);
  const text = renderSections(trimmed);

  return {
    title,
    url: location.href,
    selection: selection ? smartTrim(selection, 4000) : "",
    scope,
    text,
  };
}

export { DEFAULT_MAX_CONTEXT };
