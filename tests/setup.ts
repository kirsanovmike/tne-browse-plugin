/**
 * Vitest setup (M5). `webextension-polyfill` при импорте требует контекст
 * расширения — проверяет `globalThis.chrome.runtime.id` и бросает вне него
 * (см. src/shared/browser.ts). Юнит-тесты гоняют чистую логику в node, но
 * импортируемые модули тянут `shared/browser` транзитивно, поэтому подсовываем
 * минимальный stub `chrome`, чтобы импорт полифилла не падал. Сами `browser.*`
 * вызовы в покрытых тестах не выполняются (только чистые функции).
 */
(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: { id: "vitest" },
};
