import { defineConfig } from "vitest/config";

// Отдельный конфиг для Vitest: НЕ подключаем vite-plugin-web-extension (он читает
// манифест и собирает расширение — для юнит-тестов чистой логики это лишнее).
// Покрываем только модули без DOM / extension API (см. дизайн, §6).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // M5: модули тянут shared/browser (webextension-polyfill), который при
    // импорте требует контекст расширения — stub-аем его перед загрузкой тестов.
    setupFiles: ["tests/setup.ts"],
  },
});
