/**
 * Привилегированная часть Vision (Phase 2): снимок видимой области активной
 * вкладки. Доступно только в background. Троттлинг ≥CAPTURE_MIN_INTERVAL_MS
 * держит лимит ≤2 вызова/сек (api doc / §3). Сжатие — НЕ здесь (в Chromium SW
 * нет canvas); этим занимается content.
 */
import { browser } from "../shared/browser";
import { CAPTURE_MIN_INTERVAL_MS, IMAGE_QUALITY } from "../shared/limits";

let lastCaptureAt = 0;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Снимает видимую область активной вкладки → data URL (jpeg). Ждёт интервал троттла. */
export async function captureActiveTab(): Promise<string> {
  const since = Date.now() - lastCaptureAt;
  if (since < CAPTURE_MIN_INTERVAL_MS) await wait(CAPTURE_MIN_INTERVAL_MS - since);
  lastCaptureAt = Date.now();

  // windowId не указываем (undefined) — текущее окно. quality сжатия итогового файла — в content.
  const dataUrl = await browser.tabs.captureVisibleTab(undefined, {
    format: "jpeg",
    quality: Math.round(IMAGE_QUALITY * 100),
  });
  if (!dataUrl) throw new Error("Пустой результат захвата экрана.");
  return dataUrl;
}
