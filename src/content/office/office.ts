/**
 * Оркестратор офисных документов (Phase 5): загрузка DOCX/XLSX в [DOCUMENT D1]
 * (взаимоисключение с PDF), бар управления документом и бар экспорта таблиц
 * страницы в .xlsx. UI/состояние/IO — ручная проверка, без юнит-тестов (§6).
 */
import { STATE, $ } from "../state";
import { escapeHtml } from "../../shared/text";
import { collectTables, type CollectedTable } from "../context/collectors";
import { highlightBlock, showPanelToast } from "../render/source-highlight";
import { refreshContext } from "../context/refresh";
import { addAssistantMessage } from "../panel/chat";
import { clearPdf } from "../pdf/pdf-attachments";
import { downloadBlob } from "../render/download";
import { readDocx, readXlsx, matrixToWorkbookBuffer } from "./io";
import { sheetsToContextText } from "./xlsx-format";
import { buildTableFilename } from "./table-filename";

let tablesBarOpen = false;
let lastTables: CollectedTable[] = [];

function sheetCount(text: string): number {
  return (text.match(/\[SHEET «/g) || []).length;
}

/** Сбрасывает загруженный DOCX/XLSX и обновляет контекст. */
export function clearDocFile(): void {
  STATE.docFile = null;
  renderDocBar();
  void refreshContext(false, "docfile");
}

/** Загружает DOCX или XLSX по выбранному файлу (роутинг по расширению). */
export async function loadDocFile(file: File): Promise<void> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith(".docx")) {
      const text = await readDocx(file);
      if (!text) {
        addAssistantMessage("В документе .docx не найден текст.", { light: true });
        return;
      }
      clearPdf();
      STATE.docFile = { kind: "docx", name: file.name, documentText: text };
    } else if (name.endsWith(".xlsx")) {
      const text = sheetsToContextText(await readXlsx(file));
      if (!text) {
        addAssistantMessage("В книге .xlsx не найдено данных.", { light: true });
        return;
      }
      clearPdf();
      STATE.docFile = { kind: "xlsx", name: file.name, documentText: text };
    } else {
      addAssistantMessage("Поддерживаются только .docx и .xlsx.", { light: true });
      return;
    }
    renderDocBar();
    await refreshContext(false, "docfile");
  } catch (error) {
    addAssistantMessage(`Не удалось открыть документ: ${(error as Error)?.message || error}`, { light: true });
  }
}

/** Рисует бар загруженного документа (имя/тип/удалить). */
export function renderDocBar(): void {
  const bar = $("#tne-doc-bar");
  if (!bar) return;
  const doc = STATE.docFile;
  if (!doc) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }
  const meta =
    doc.kind === "docx"
      ? `DOCX · ${doc.documentText.length} симв.`
      : `XLSX · листов: ${sheetCount(doc.documentText)}`;
  bar.hidden = false;
  bar.innerHTML = `
    <div class="tne-doc-head">
      <span class="tne-doc-name" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</span>
      <span class="tne-doc-meta">${escapeHtml(meta)}</span>
      <button class="tne-icon-button" id="tne-doc-remove" type="button" title="Убрать документ" aria-label="Убрать документ">×</button>
    </div>`;
  bar.querySelector("#tne-doc-remove")?.addEventListener("click", () => clearDocFile());
}

/** Переключает видимость бара экспорта таблиц. */
export function toggleTablesBar(): void {
  tablesBarOpen = !tablesBarOpen;
  renderTablesBar();
}

/** Рисует список таблиц страницы с кнопками экспорта и подсветкой. */
export function renderTablesBar(): void {
  const bar = $("#tne-tables-bar");
  if (!bar) return;
  if (!tablesBarOpen) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }
  lastTables = collectTables();
  if (!lastTables.length) {
    tablesBarOpen = false;
    bar.hidden = true;
    bar.innerHTML = "";
    showPanelToast("На странице не найдено таблиц для экспорта.");
    return;
  }
  // Кладём элементы в blockMap под T1..Tn, чтобы подсветка работала при любом scope.
  lastTables.forEach((t, i) => {
    STATE.blockMap[`T${i + 1}`] = t.element;
  });

  bar.hidden = false;
  bar.innerHTML =
    `<div class="tne-tables-head">Таблицы страницы (${lastTables.length})</div>` +
    lastTables
      .map((t, i) => {
        const id = `T${i + 1}`;
        const preview = (t.matrix[0] || []).slice(0, 3).join(" · ").slice(0, 60) || "таблица";
        return `<div class="tne-table-row" data-block="${id}">
          <span class="tne-table-label">[${id}] ${escapeHtml(preview)}</span>
          <button class="tne-small-button tne-table-export" data-index="${i}" type="button">↓ Excel</button>
        </div>`;
      })
      .join("");

  bar.querySelectorAll<HTMLElement>(".tne-table-row").forEach((row) => {
    const id = row.getAttribute("data-block");
    if (id) row.addEventListener("mouseenter", () => highlightBlock(id));
  });
  bar.querySelectorAll<HTMLButtonElement>(".tne-table-export").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      void exportTableAt(Number(btn.getAttribute("data-index")));
    });
  });
}

async function exportTableAt(index: number): Promise<void> {
  const table = lastTables[index];
  if (!table || !table.matrix.length) {
    showPanelToast("Таблица пуста — нечего экспортировать.");
    return;
  }
  try {
    const buffer = await matrixToWorkbookBuffer(table.matrix, "Лист1");
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, buildTableFilename(STATE.page?.title || document.title, index + 1, new Date()));
  } catch (error) {
    addAssistantMessage(`Не удалось сформировать .xlsx: ${(error as Error)?.message || error}`, { light: true });
  }
}

/** Привязывает кнопки документа и экспорта таблиц. */
export function initOffice(root: HTMLElement): void {
  const input = root.querySelector("#tne-doc-input") as HTMLInputElement | null;
  root.querySelector("#tne-attach-doc")?.addEventListener("click", () => input?.click());
  input?.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) void loadDocFile(file).finally(() => (input.value = ""));
  });
  root.querySelector("#tne-tables-export")?.addEventListener("click", () => toggleTablesBar());
  renderDocBar();
}
