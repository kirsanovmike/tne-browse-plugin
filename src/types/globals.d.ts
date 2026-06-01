/**
 * M5: глобальный `browser` убран. В Chromium его нет (есть только `chrome`),
 * поэтому API берётся через ре-экспорт полифилла из `src/shared/browser.ts`
 * (`import { browser } from ".../shared/browser"`). Типы — из
 * `@types/webextension-polyfill`. Файл оставлен под будущие глобальные .d.ts.
 */
export {};
