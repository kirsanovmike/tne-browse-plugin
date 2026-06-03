/**
 * Оркестратор PDF (Phase 3): загрузка файла / из вкладки, выбор страниц,
 * извлечение текста в [DOCUMENT], рендер страниц в картинки-вложения (для сканов
 * или по тогглу), прогресс, очистка. UI — бар над лентой вложений. Ручная проверка.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";
import { STATE, $, type PdfState } from "../state";
import { MAX_IMAGES, PDF_DEFAULT_PAGES } from "../../shared/limits";
import { loadPdfDocument, withTimeout } from "./pdf-loader";
import { extractPageText } from "./pdf-text";
import { renderPageToDataUrl } from "./pdf-render";
import { parsePageRange } from "./page-range";
import { looksLikeScan } from "./scan-detect";
import { compressDataUrl } from "../vision/image-compressor";
import { addAttachment, renderAttachments } from "../vision/attachments";
import { addAssistantMessage } from "../panel/chat";
import { refreshContext } from "../context/refresh";
import { escapeHtml } from "../../shared/text";

// PDFDocumentProxy не сериализуется → держим вне STATE, на уровне модуля.
let currentDoc: PDFDocumentProxy | null = null;
// 5.R2-9: таймауты на шаги, чтобы статус не «висел» вечно при сбое PDF.js.
const PAGE_TEXT_TIMEOUT_MS = 15000;
const PAGE_RENDER_TIMEOUT_MS = 20000;
// URL открытого во вкладке PDF, обнаруженный автодетектом (Task 12).
let detectedTabPdfUrl: string | null = null;

function makeId(): string {
  return `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Парсит «#page=N» из URL PDF-вьюера браузера. */
function currentPageFromHash(): number | null {
  const m = location.hash.match(/page=(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** Полностью сбрасывает PDF-состояние и его вложения. */
export function clearPdf(): void {
  currentDoc = null;
  STATE.pdf = null;
  STATE.attachments = STATE.attachments.filter((a) => a.source !== "pdf");
  renderAttachments();
  renderPdfBar();
}

/** Загрузка из выбранного файла. */
export async function loadPdfFromFile(file: File): Promise<void> {
  try {
    const buf = await file.arrayBuffer();
    await openPdf(buf, file.name, null);
  } catch (error) {
    addAssistantMessage(`Не удалось открыть PDF: ${(error as Error)?.message || error}`, { light: true });
  }
}

/** Загрузка из открытого во вкладке PDF (best-effort, Task 12). */
export async function loadPdfFromTab(): Promise<void> {
  if (!detectedTabPdfUrl) return;
  try {
    const res = await fetch(detectedTabPdfUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const name = decodeURIComponent(detectedTabPdfUrl.split("/").pop() || "документ.pdf");
    await openPdf(buf, name, currentPageFromHash());
  } catch (error) {
    addAssistantMessage(
      `Не удалось получить PDF из вкладки (${(error as Error)?.message || error}). Откройте его через загрузку файла.`,
      { light: true }
    );
  }
}

async function openPdf(buf: ArrayBuffer, name: string, currentPage: number | null): Promise<void> {
  currentDoc = await loadPdfDocument(buf);
  STATE.pdf = {
    name,
    numPages: currentDoc.numPages,
    selectionMode: currentPage ? "current" : "first5",
    selectionInput: "",
    pages: [],
    currentPage,
    hasTextLayer: true,
    // 5.R2-9: по умолчанию прикладываем страницы картинками (текст + изображения).
    withImages: true,
    documentText: "",
  };
  detectedTabPdfUrl = null;
  renderPdfBar();
  await applyPdfSelection();
}

/** Читает выбор страниц из UI/состояния, извлекает текст и (при необходимости) картинки. */
export async function applyPdfSelection(): Promise<void> {
  const pdf = STATE.pdf;
  const doc = currentDoc;
  if (!pdf || !doc) return;

  const pages = resolveSelectedPages(pdf);
  if (pages.length === 0) {
    setPdfStatus("Не удалось определить страницы — проверьте ввод (например, 1-3,12).");
    return;
  }
  pdf.pages = pages;

  try {
    // 1) Текстовый слой выбранных страниц (с таймаутом на страницу).
    setPdfStatus("Извлекаю текст…");
    const pageTexts: string[] = [];
    for (const p of pages) {
      pageTexts.push(
        await withTimeout(
          extractPageText(doc, p),
          PAGE_TEXT_TIMEOUT_MS,
          `PDF.js не ответил при извлечении текста страницы ${p}.`
        )
      );
    }
    pdf.documentText = pages
      .map((p, i) => `[PDF P${p}]\n${pageTexts[i] || "(текст не извлечён)"}`)
      .join("\n\n");
    pdf.hasTextLayer = !looksLikeScan(pageTexts);

    // 2) Страницы всегда прикладываем картинками (до лимита), если тоггл включён
    //    или это скан без текстового слоя. По умолчанию тоггл включён (5.R2-9).
    const wantImages = pdf.withImages || !pdf.hasTextLayer;
    STATE.attachments = STATE.attachments.filter((a) => a.source !== "pdf");
    const budget = wantImages ? Math.max(0, MAX_IMAGES - STATE.attachments.length) : 0;
    if (wantImages && budget > 0) {
      const toRender = pages.slice(0, budget);
      for (let i = 0; i < toRender.length; i++) {
        const p = toRender[i]!;
        setPdfStatus(`Рендер страницы ${i + 1} из ${toRender.length}…`);
        const dataUrl = await withTimeout(
          renderPageToDataUrl(doc, p),
          PAGE_RENDER_TIMEOUT_MS,
          `PDF.js не ответил при отрисовке страницы ${p}.`
        );
        const img = await compressDataUrl(dataUrl);
        const ok = addAttachment({ id: makeId(), dataUrl: img.dataUrl, base64: img.base64, source: "pdf", bytes: img.bytes, page: p });
        if (!ok) break;
      }
    }

    // 3) Обновить контекст (вставит [DOCUMENT]) и UI.
    await refreshContext(false, "pdf");
    renderAttachments();
    renderPdfBar();

    // 4) Сообщить пользователю, что уйдёт (по фактически приложенным страницам).
    const sent = STATE.attachments
      .filter((a) => a.source === "pdf")
      .map((a) => a.page)
      .filter((p): p is number => typeof p === "number");
    if (!wantImages) {
      setPdfStatus(`Готово: текст ${pages.length} стр. (картинки выключены).`);
    } else if (sent.length === 0) {
      setPdfStatus(`Лимит картинок исчерпан вложениями — отправлю только текст ${pages.length} стр.`);
    } else if (sent.length < pages.length) {
      setPdfStatus(`Отправлю текст выбранных страниц + изображения стр. ${sent.join(", ")} (лимит ${MAX_IMAGES} картинок).`);
    } else {
      setPdfStatus(`Готово: текст + изображения стр. ${sent.join(", ")}.`);
    }
  } catch (error) {
    // 5.R2-9: явная ошибка вместо зависшего «Извлекаю текст…».
    renderPdfBar();
    setPdfStatus("Ошибка обработки PDF — см. сообщение в чате.");
    addAssistantMessage(
      `Не удалось обработать PDF: ${(error as Error)?.message || error}. Попробуйте ещё раз или другой файл.`,
      { light: true }
    );
  }
}

function resolveSelectedPages(pdf: PdfState): number[] {
  if (pdf.selectionMode === "current" && pdf.currentPage) {
    return parsePageRange(String(pdf.currentPage), pdf.numPages);
  }
  if (pdf.selectionMode === "choose") {
    return parsePageRange(pdf.selectionInput, pdf.numPages);
  }
  // first5
  return parsePageRange(`1-${PDF_DEFAULT_PAGES}`, pdf.numPages);
}

function setPdfStatus(text: string): void {
  const node = $("#tne-pdf-status");
  if (node) node.textContent = text;
}

/** Объявляет, что во вкладке открыт PDF (Task 12 вызывает это). */
export function setDetectedTabPdf(url: string): void {
  if (STATE.pdf) return; // уже загружен — не предлагаем
  detectedTabPdfUrl = url;
  renderPdfBar();
}

/** Рисует PDF-бар: предложение загрузить из вкладки ИЛИ управление загруженным PDF. */
export function renderPdfBar(): void {
  const bar = $("#tne-pdf-bar");
  if (!bar) return;

  if (!STATE.pdf && detectedTabPdfUrl) {
    bar.hidden = false;
    bar.innerHTML = `
      <div class="tne-pdf-detected">
        <span>В этой вкладке открыт PDF.</span>
        <button class="tne-small-button" id="tne-pdf-load-tab" type="button">Загрузить из вкладки</button>
      </div>`;
    bar.querySelector("#tne-pdf-load-tab")?.addEventListener("click", () => {
      setPdfStatus("Загружаю PDF из вкладки…");
      void loadPdfFromTab();
    });
    return;
  }

  const pdf = STATE.pdf;
  if (!pdf) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }

  bar.hidden = false;
  const cur = pdf.currentPage
    ? `<label><input type="radio" name="tne-pdf-mode" value="current" ${pdf.selectionMode === "current" ? "checked" : ""}/> Текущая (${pdf.currentPage})</label>`
    : "";
  bar.innerHTML = `
    <div class="tne-pdf-head">
      <span class="tne-pdf-name" title="${escapeHtml(pdf.name)}">${escapeHtml(pdf.name)}</span>
      <span class="tne-pdf-pages">${pdf.numPages} стр.</span>
      <button class="tne-icon-button" id="tne-pdf-remove" type="button" title="Убрать PDF" aria-label="Убрать PDF">×</button>
    </div>
    <div class="tne-pdf-modes">
      <label><input type="radio" name="tne-pdf-mode" value="first5" ${pdf.selectionMode === "first5" ? "checked" : ""}/> Первые ${PDF_DEFAULT_PAGES}</label>
      <label><input type="radio" name="tne-pdf-mode" value="choose" ${pdf.selectionMode === "choose" ? "checked" : ""}/> Выбрать</label>
      ${cur}
      <input class="tne-pdf-range" id="tne-pdf-range" type="text" placeholder="1-3,12" value="${escapeHtml(pdf.selectionInput)}" ${pdf.selectionMode === "choose" ? "" : "disabled"} />
    </div>
    <label class="tne-pdf-images"><input type="checkbox" id="tne-pdf-toggle-images" ${pdf.withImages ? "checked" : ""}/> Приложить страницы картинками</label>
    <div class="tne-pdf-status" id="tne-pdf-status"></div>`;

  bar.querySelector("#tne-pdf-remove")?.addEventListener("click", () => clearPdf());

  bar.querySelectorAll<HTMLInputElement>('input[name="tne-pdf-mode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!STATE.pdf) return;
      STATE.pdf.selectionMode = radio.value as PdfState["selectionMode"];
      const range = $("#tne-pdf-range") as HTMLInputElement | null;
      if (range) range.disabled = STATE.pdf.selectionMode !== "choose";
      void applyPdfSelection();
    });
  });

  const range = bar.querySelector("#tne-pdf-range") as HTMLInputElement | null;
  range?.addEventListener("change", () => {
    if (!STATE.pdf) return;
    STATE.pdf.selectionInput = range.value;
    if (STATE.pdf.selectionMode === "choose") void applyPdfSelection();
  });

  bar.querySelector("#tne-pdf-toggle-images")?.addEventListener("change", (e) => {
    if (!STATE.pdf) return;
    STATE.pdf.withImages = (e.target as HTMLInputElement).checked;
    void applyPdfSelection();
  });
}

/**
 * Инициализация PDF-бара. 5.R2-8: отдельной кнопки/инпута PDF больше нет — файлы
 * приходят через единую кнопку «Приложить» (см. vision/attachments → loadPdfFromFile);
 * здесь только рендер бара управления и предложение загрузить PDF из вкладки.
 */
export function initPdf(): void {
  renderPdfBar();
}
