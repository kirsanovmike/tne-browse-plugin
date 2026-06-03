/**
 * Скачивание Blob. Основной путь (HF3) — через background `browser.downloads`
 * (надёжен против CSP страницы и ограничений content-скрипта); фолбэк — клик по
 * временной <a download>. Общая для экспорта диалога (.md) и таблиц (.xlsx).
 * DOM/мессендж-обвязка — без юнит-тестов (§6).
 */
import { browser } from "../../shared/browser";
import type { DownloadFileResponse } from "../../shared/messages";

/** Скачивает Blob под именем filename. Бросает, если оба пути не сработали. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  // Основной путь: отдать data-URL в background и скачать через downloads API.
  try {
    const dataUrl = await blobToDataUrl(blob);
    const res = (await browser.runtime.sendMessage({
      type: "TNE_DOWNLOAD_FILE",
      dataUrl,
      filename,
    })) as DownloadFileResponse | undefined;
    if (res?.ok) return;
    throw new Error(res?.error || "downloads API недоступен");
  } catch {
    // Фолбэк: клик по временной ссылке в DOM страницы.
    anchorDownload(blob, filename);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл для скачивания."));
    reader.readAsDataURL(blob);
  });
}

function anchorDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
