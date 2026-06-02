/**
 * Манифест как функция (browser, mode) → манифест расширения.
 *
 * M4: переход на **MV3**, per-browser. Фон отдаётся разным блоком:
 *   • Firefox — event page (`background.scripts`, non-persistent по умолчанию в MV3);
 *   • Chromium — service worker (`background.service_worker`, `type: module`).
 * M5: добавлен Chromium-таргет (см. TARGET_BROWSER в vite.config.ts);
 * `browser_specific_settings.gecko` уходит только в Firefox-манифест.
 * `browser_action` → `action`; команда `_execute_browser_action` → `_execute_action`;
 * права разделены на `permissions` + `host_permissions`; инъекция — через
 * `scripting.executeScript` (см. injector.ts); WAR — MV3-формат (массив объектов).
 *
 * Content-скрипт НЕ объявлен в манифесте — он инжектится динамически из
 * background через `scripting.executeScript` (M3: единый файл
 * src/content/index.js, собранный Vite). Иконки доставляются статическим
 * копированием (vite.config.ts).
 */

export type TargetBrowser = "firefox" | "chrome";

interface BuildEnv {
  browser: TargetBrowser;
  mode: string;
}

/**
 * Фон per-browser: Chromium MV3 требует service worker, Firefox MV3 — event page
 * (background.scripts). Vite-плагин бандлит entry и переписывает путь в манифесте.
 */
function backgroundFor(browser: TargetBrowser): Record<string, unknown> {
  if (browser === "chrome") {
    return { service_worker: "src/background/index.ts", type: "module" };
  }
  // Firefox MV3: event page (non-persistent по умолчанию, ключ persistent в MV3 не используется).
  return { scripts: ["src/background/index.ts"] };
}

export function getManifest({ browser }: BuildEnv): Record<string, unknown> {
  // browser_specific_settings.gecko — только Firefox (id + strict_min_version);
  // Chromium этот ключ не использует, поэтому в chrome-манифест его не кладём.
  const geckoSettings =
    browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "tne-page-chat@tne.tn.corp",
              // MV3 + event pages + scripting + storage.session требуют Firefox 115+.
              strict_min_version: "115.0",
            },
          },
        }
      : {};
  return {
    manifest_version: 3,
    name: "ТНЭ чат · Браузер",
    description:
      "ТНЭ чат: анализ и вопросы по содержимому текущей страницы через корпоративную языковую модель.",
    version: "0.9.0",
    icons: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
    // MV3: browser_action → action.
    action: {
      default_title: "Спросить ТНЭ чат по странице",
      default_icon: {
        "16": "icons/icon16.png",
        "32": "icons/icon32.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
      },
    },
    background: backgroundFor(browser),
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
    commands: {
      // MV3: зарезервированная команда переименована _execute_browser_action → _execute_action.
      _execute_action: {
        suggested_key: { default: "Ctrl+Shift+U" },
        description: "Открыть или закрыть панель ТНЭ чат",
      },
      "tne-ask-selection": {
        suggested_key: { default: "Ctrl+Shift+Y" },
        description: "Спросить ТНЭ чат по выделенному фрагменту",
      },
    },
    // MV3: хосты вынесены из permissions в host_permissions. scripting — для
    // динамической инъекции content-скрипта (см. injector.ts).
    permissions: ["activeTab", "storage", "scripting", "tabs", "contextMenus"],
    host_permissions: ["<all_urls>"],
    ...geckoSettings,
    // M3: panel.css и тема highlight.js инлайнятся в shadow root → не WAR.
    // M4: MV3-формат WAR — массив объектов { resources, matches }.
    web_accessible_resources: [
      {
        resources: [
          "icons/icon128.png",
          "icons/tne-browser-chat-logo.png",
          // PDF.js worker — грузится в page-контексте через getURL (Phase 3).
          "pdf.worker.min.mjs",
        ],
        matches: ["<all_urls>"],
      },
    ],
  };
}
