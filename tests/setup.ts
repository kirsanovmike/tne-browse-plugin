/**
 * Vitest setup (M5). `webextension-polyfill` при импорте требует контекст
 * расширения — проверяет `globalThis.chrome.runtime.id` и бросает вне него
 * (см. src/shared/browser.ts). Юнит-тесты гоняют чистую логику в node, но
 * импортируемые модули тянут `shared/browser` транзитивно, поэтому подсовываем
 * минимальный stub `chrome`, чтобы импорт полифилла не падал. Сами `browser.*`
 * вызовы в покрытых тестах не выполняются (только чистые функции).
 *
 * 4.4: `src/content/state.ts` обращается к `location.href` на уровне модуля
 * (инициализация STATE.lastUrl). В node-окружении `location` не определён,
 * поэтому подсовываем минимальный stub — по аналогии со stub-ом `chrome`.
 */
(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    id: "vitest",
    getURL: (path: string) => `chrome-extension://vitest/${path}`,
  },
};

if (typeof globalThis.location === "undefined") {
  (globalThis as unknown as { location: unknown }).location = {
    href: "http://localhost/",
    hostname: "localhost",
  };
}
