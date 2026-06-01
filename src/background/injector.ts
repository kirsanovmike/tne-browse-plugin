/**
 * Инъекция content-скрипта (дизайн §3). M3: content-скрипт собран в единый файл
 * (libs из npm забандлены внутрь, CSS инлайн) — инъекция одной командой, без
 * предварительной загрузки `lib/*.js`. M4: MV3 — `scripting.executeScript`
 * (`tabs.executeScript` в MV3 удалён).
 */
import { browser } from "../shared/browser";
import type { TneRequest } from "../shared/messages";

// Путь к собранному content-скрипту внутри сборки (см. additionalInputs в
// vite.config.ts: src/content/index.ts → dist/firefox/src/content/index.js).
const CONTENT_SCRIPT = "src/content/index.js";

/**
 * Доставляет сообщение в content-скрипт; если он ещё не внедрён — внедряет
 * `content` и повторяет отправку.
 */
export async function sendOrInject(tabId: number, message: TneRequest): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch {
    await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] });
    await browser.tabs.sendMessage(tabId, message);
  }
}
