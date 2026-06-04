/**
 * Оркестратор PDF (Phase 3 / Phase 7): загрузка файла / из вкладки, выбор страниц,
 * извлечение текста в [DOCUMENT], рендер страниц в картинки-вложения (для сканов
 * или по тогглу), прогресс, очистка. UI — бар над лентой вложений. Ручная проверка.
 *
 * PHASE 7: PDF.js перенесён в sandbox-iframe; content-скрипт общается через
 * pdf-sandbox-client.ts, не импортирует pdfjs-dist напрямую (Xray-барьер Firefox).
 */
import { STATE, $, type PdfState } from "../state";
import { MAX_IMAGES, PDF_DEFAULT_PAGES, PDF_RENDER_SCALE } from "../../shared/limits";
import { openPdf as sandboxOpen, processPages, destroySandbox } from "./pdf-sandbox-client";
import { parsePageRange } from "./page-range";
import { looksLikeScan } from "./scan-detect";
import { compressDataUrl } from "../vision/image-compressor";
import { addAttachment, renderAttachments } from "../vision/attachments";
import { addAssistantMessage } from "../panel/chat";
import { refreshContext } from "../context/refresh";
import { escapeHtml } from "../../shared/text";

// PHASE 7 — документ живёт в sandbox; в content держим только факт открытия.
let pdfOpen = false;
// URL открытого во вкладке PDF, обнаруженный автодетектом (Task 12).
let detectedTabPdfUrl: string | null = null;

/** Контейнер для скрытого служебного iframe sandbox — гарантированно отрисованный узел страницы. */
function getPanelHost(): HTMLElement | null {
  return document.body ?? document.documentElement;
}

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
  pdfOpen = false;
  destroySandbox();
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
  const host = getPanelHost();
  if (!host) throw new Error("Панель не готова для обработки PDF.");
  const numPages = await sandboxOpen(host, buf); // buf уходит transferable в sandbox
  pdfOpen = true;
  STATE.pdf = {
    name,
    numPages,
    selectionMode: currentPage ? "current" : "first5",
    selectionInput: "",
    pages: [],
    currentPage,
    hasTextLayer: true,
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
  if (!pdf || !pdfOpen) return;

  const pages = resolveSelectedPages(pdf);
  if (pages.length === 0) {
    setPdfStatus("Не удалось определить страницы — проверьте ввод (например, 1-3,12).");
    return;
  }
  pdf.pages = pages;

  try {
    setPdfStatus("Извлекаю текст…");
    // Один проход в sandbox: текст всех страниц + (если тоггл включён) их картинки.
    const first = await processPages(pages, pdf.withImages, PDF_RENDER_SCALE, (stage, index, total) => {
      setPdfStatus(
        stage === "text"
          ? `Извлекаю текст… (${index + 1}/${total})`
          : `Рендер страницы ${index + 1} из ${total}…`
      );
    });

    pdf.documentText = pages
      .map((p, i) => `[PDF P${p}]\n${first.texts[i] || "(текст не извлечён)"}`)
      .join("\n\n");
    pdf.hasTextLayer = !looksLikeScan(first.texts);

    // Скан без текстового слоя, но тоггл картинок был выключен → дорендерим картинки.
    let pageImages = first.images;
    if (!pdf.withImages && !pdf.hasTextLayer) {
      // Sandbox всё равно извлекает текст в этом проходе (нам нужны только картинки),
      // но для сканов текстовый слой почти пуст — накладные расходы малы. Принимаем.
      const extra = await processPages(pages, true, PDF_RENDER_SCALE, (stage, index, total) => {
        setPdfStatus(`Рендер страницы ${index + 1} из ${total}…`);
      });
      pageImages = extra.images;
    }

    // Приложить картинки до лимита MAX_IMAGES.
    const wantImages = pdf.withImages || !pdf.hasTextLayer;
    STATE.attachments = STATE.attachments.filter((a) => a.source !== "pdf");
    if (wantImages && pageImages.length > 0) {
      const budget = Math.max(0, MAX_IMAGES - STATE.attachments.length);
      for (const { page, dataUrl } of pageImages.slice(0, budget)) {
        const img = await compressDataUrl(dataUrl);
        const ok = addAttachment({ id: makeId(), dataUrl: img.dataUrl, base64: img.base64, source: "pdf", bytes: img.bytes, page });
        if (!ok) break;
      }
    }

    // Обновить контекст (вставит [DOCUMENT]) и UI.
    await refreshContext(false, "pdf");
    renderAttachments();
    renderPdfBar();

    // Сообщить пользователю по фактически приложенным страницам.
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
    // PHASE 7: если PDF убрали (clearPdf) во время обработки, sandbox отклоняет
    // запросы — для пользователя это отмена, а не ошибка. Молча выходим.
    if (!STATE.pdf || !pdfOpen) {
      renderPdfBar();
      return;
    }
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
