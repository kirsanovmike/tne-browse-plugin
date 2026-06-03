/**
 * Скачивание файла из background через `browser.downloads` (HF3). Надёжнее, чем
 * клик по <a download> из content-скрипта: не зависит от CSP страницы и работает
 * одинаково в Firefox (event page) и Chromium (service worker). Content шлёт
 * data-URL + имя файла; здесь — реальная загрузка. Ручная проверка (§6).
 */
import { browser } from "../shared/browser";

/** Запускает скачивание data-URL под заданным именем. Бросает при ошибке. */
export async function downloadFile(dataUrl: string, filename: string): Promise<void> {
  if (!dataUrl) throw new Error("Пустые данные для скачивания.");
  await browser.downloads.download({
    url: dataUrl,
    filename: filename || "download",
    saveAs: false,
  });
}
