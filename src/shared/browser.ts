/**
 * Единая точка ре-экспорта WebExtensions API (дизайн §5, шаг M5 — кросс-браузер).
 *
 * В рантайме тянем `webextension-polyfill`: в Chromium он даёт Promise-API
 * `browser.*` поверх callback-API `chrome.*`, в Firefox — пропускает нативный
 * `browser`. Vite бандлит полифилл локально внутрь каждого entry (фон / контент /
 * настройки) — без CDN в рантайме (требование закрытой сети сохраняется).
 *
 * Все модули обращаются к API только через этот ре-экспорт (`import { browser }
 * from ".../shared/browser"`), а не через глобал — иначе в Chromium глобального
 * `browser` нет. Типы берутся из `@types/webextension-polyfill`.
 *
 * NB: полифилл при импорте проверяет контекст расширения (`chrome.runtime.id`) и
 * бросает вне него. В Vitest (node) этот контекст подсовывает `tests/setup.ts`.
 */
import browserPolyfill from "webextension-polyfill";

export const browser = browserPolyfill;
