# PROGRESS

## Фактическая структура проекта

Расширение Firefox, **Manifest V2**, чистый vanilla JS без сборки и без TypeScript
(подтверждено решением на старте — соответствует `CLAUDE.md`). Загрузка через
`about:debugging` → «Загрузить временное дополнение» → `manifest.json`.

| Файл | Контекст | Роль |
|------|----------|------|
| `manifest.json` | — | MV2, `browser_action`, `options_ui`, `web_accessible_resources` |
| `background.js` | Background (non-persistent) | HTTP к LLM, инъекция библиотек + `content.js`, диагностика, ретраи, abort |
| `content.js` | Content script (инъекция по клику) | UI панели в Shadow DOM, сбор структурированного контекста, рендер ответа |
| `options.html/js/css` | Страница настроек | Настройки модели, whitelist/denylist, диагностика |
| `panel.css` | Web-accessible, грузится в shadow root | Стили панели |
| `lib/` | Вендоренные библиотеки (локально, без CDN) | `Readability.js`, `marked.min.js`, `highlight.min.js`, `highlight-theme.css` |

Контекст собирается в `content.js` (`buildStructuredContext`), запрос строится в
`background.js` (`buildPrompt` / `buildBody`) и уходит на endpoint из настроек.

## Решения по стеку/сборке

- **Стек:** оставлен vanilla JS / MV2 (вариант «как сейчас»), без Vite и без TS.
  Целевая модульная структура из плана сымитирована секциями внутри `content.js`.
- **Браузеры:** только Firefox (namespace `browser.*`, MV2). Chromium не добавляли.
- **Объём захода:** Phase 1 закрыта полностью — `P0` (1.1–1.12) и `P1` (1.13–1.15).
- **Библиотеки** вендорятся в `lib/` и инжектятся через `tabs.executeScript` перед
  `content.js`; CSS (`panel.css`, `lib/highlight-theme.css`) грузится в shadow root
  через `<link>` и объявлен в `web_accessible_resources`. Никаких CDN в рантайме.
- Версия поднята до `0.8.0-firefox`.

## Миграция на Vite + TS (дизайн: `docs/superpowers/specs/2026-06-01-vite-ts-migration-design.md`)

- **[M0 — Каркас сборки] выполнено.** Поднят Vite + `vite-plugin-web-extension`
  (v4.5.1) + `vite-plugin-static-copy`; `tsconfig.json` строгий (`strict`,
  `noUncheckedIndexedAccess`, `noImplicitOverride`) с временным `allowJs`
  (`checkJs:false` — старые `.js` пока не тайпчекаем). `manifest.config.ts`
  воспроизводит текущий **MV2**-манифест один-в-один (MV3 — это M4). Код пока
  старый vanilla `.js`, не переписывался.
  - `npm run build` → `dist/firefox`. Плагин сам собирает `background.js` и
    `options.html`, а также `content.js` через `additionalInputs` (это plain-IIFE
    без импортов — бандлинг ничего не ломает, имя файла сохраняется, т.к. он
    инжектится динамически по имени `content.js`).
  - Статическим копированием доставляются файлы, которые плагин не собирает сам:
    `lib/*.js` (вендоренные UMD, инжектятся дословно), `lib/highlight-theme.css` и
    `panel.css` (грузятся через `getURL()` → стабильные пути без хеша),
    `icons/*` (нужны манифесту и `content.js`), `options.js` (классический
    `<script src>`, Vite его не бандлит — копируем рядом с `options.html`).
  - Проверка: `tsc --noEmit` (strict) — зелёный; `web-ext lint dist/firefox` —
    **0 errors**, 8 warnings (все — пред-существующие `innerHTML`-нотисы из
    `marked`/`highlight.js` и санитайзера рендера). Контракты рантайма после
    бандлинга целы: guard `__TNE_PAGE_CHAT_LOADED__`, глобалы
    `Readability/marked/hljs` в `content.js`, пути инъекции в `background.js`.
  - Ручную загрузку в `about:debugging` выполняет владелец (как в Phase 1).
- **[M1 — Shared-ядро] выполнено.** Вынесен единый источник правды настроек и
  доступа в `src/shared/`; `options.*` переведены на него.
  - `src/shared/settings.ts` — тип `Settings`, `DEFAULT_SETTINGS` (полный набор,
    убирает дублирование дефолтов между `options/content/background`),
    `MAX_CONTEXT_HARD_LIMIT`, чистые `coerceModelSettings` (поведение submit-формы
    один-в-один, включая клампы `maxContextChars`≤25000 и `maxRetries`≥0) и
    `parseDomainList`, плюс тонкие `readSettings`/`writeSettings` над `storage.local`.
  - `src/shared/whitelist.ts` — `matchPattern`/`matchList`/`isHostAllowed`
    (извлечено из `content.js` `computeAllowed` без изменения поведения:
    denylist > allowExternal > whitelist).
  - `src/shared/messages.ts` — **только типы** контракта `TNE_*` (запросы +
    формы ответов background); роутер переедет на M2, `page` пока `unknown` (M3).
  - `src/types/globals.d.ts` — глобальный `browser` через
    `@types/webextension-polyfill` (типы; сам polyfill в рантайм — задача M5).
  - **Options:** логика переехала в `src/options/options.ts` (ES-модуль),
    `options.html` теперь грузит `<script type="module" src="./src/options/options.ts">`,
    Vite бандлит его в `dist/firefox/options.js`. Старый корневой `options.js`
    удалён; его статическое копирование убрано из `vite.config.ts`.
  - **Тесты:** добавлен Vitest (`vitest.config.ts`, node-окружение, без
    web-extension-плагина). `tests/shared/whitelist.test.ts` +
    `tests/shared/settings.test.ts` — 24 теста, характеризуют текущее поведение
    (страховочная сетка для декомпозиции на M3). Скрипты `npm test` / `test:watch`.
  - **Проверка:** `npm test` — 24/24 зелёные; `tsc --noEmit` (strict, теперь
    тайпчекает и `src`, и `tests`) — зелёный; `npm run build` → `dist/firefox`
    собирается; `web-ext lint` — **0 errors**, 8 warnings (те же пред-существующие
    `innerHTML`-нотисы). `background.js`/`content.js` пока остаются `.js` (их
    дефолты дублируются — будут переведены на shared на M2/M3).
- **[M2 — Background в TS] выполнено.** Корневой `background.js` (317 строк)
  декомпозирован на типизированные модули `src/background/`; поведение перенесено
  один-в-один, манифест пока **MV2** (service worker / event page — M4).
  - `response-parser.ts` — `extractContent` (несколько форм ответа прода) +
    `cleanModelAnswer`; **чистые**, покрыты `tests/background/response-parser.test.ts`
    (15 характеризационных тестов, включая «последнее assistant-сообщение» и
    фолбэки на rawText / pretty-JSON).
  - `llm-client.ts` — `buildPrompt`/`buildBody` (тело строится БЕЗ токена),
    `sendRequest` (fetch + таймаут + abort), `askModel` (ретраи с backoff, не
    ретраит 4xx/abort), `normalizeError`, реестр `AbortController` +
    `abortRequest(requestId)`. Диагностика инъектится хуками `AskDiag`
    (`onBody`/`onError`) — llm-client НЕ зависит от модуля diagnostics. Чистые
    билдеры покрыты `tests/background/llm-client.test.ts` (9 тестов; в т.ч.
    «токен не утекает в тело»). Кастомный `ApiError{status}` — чтобы отличать 4xx.
  - `diagnostics.ts` — `DIAG_KEYS`, `saveDiag`, `getDiag`, `diagPing(target,
    settings)`, экспорт `diagSink: AskDiag`. Зависит от llm-client в одну сторону
    (`buildBody`/`sendRequest`/`normalizeError`) — цикла нет (хуки приходят как
    тип). Хранилище пока `storage.local` (перенос в `storage.session` — M4).
  - `injector.ts` — `VENDOR_SCRIPTS` + `sendOrInject(tabId, message)` (MV2
    `tabs.executeScript`: библиотеки + `content.js`, затем повтор отправки).
  - `messaging.ts` — `routeMessage(message)`: роутер `TNE_*`
    (`ASK_MODEL`/`ABORT`/`BUILD_PAYLOAD`/`DIAG_PING`/`GET_DIAG`/`OPEN_OPTIONS`),
    возвращает `false` для неизвестных. `TNE_TOGGLE_PANEL`/`TNE_ASK_SELECTION` шлются
    В content и здесь не обрабатываются (как в исходнике).
  - `index.ts` — bootstrap: `onInstalled` (засев дефолтов, token не трогаем),
    `browserAction.onClicked` → toggle, `commands.onCommand` → ask-selection,
    `runtime.onMessage` → `routeMessage`.
  - **Сборка:** `manifest.config.ts` → `background.scripts: ["src/background/index.ts"]`;
    плагин бандлит (7 модулей → `dist/firefox/src/background/index.js`, 9 КБ) и
    переписывает путь в собранном манифесте. Старый корневой `background.js` удалён.
  - **Проверка:** `tsc --noEmit` (strict) — зелёный; `vitest run` — 48/48 зелёные
    (было 24 + новые 24); `npm run build` → `dist/firefox` собирается;
    `web-ext lint` — **0 errors**, 8 warnings (те же пред-существующие `innerHTML`
    из `content.js`). `content.js` пока остаётся `.js` (декомпозиция — M3).
- **[M3 — Декомпозиция content] выполнено.** Корневой `content.js` (1736 строк)
  разобран на TS-модули `src/content/**` по структуре дизайна §3; поведение
  перенесено один-в-один, манифест пока **MV2** (MV3 — M4). Libs → npm (бандлятся
  Vite локально, без CDN), CSS панели → `?inline` в shadow root.
  - **Чистые модули (TDD, характеризационные тесты перед переносом):**
    `src/shared/text.ts` (normalizeText / isUsefulText / removeDuplicateLines /
    smartTrim / escapeHtml), `context/trim.ts` (trimSectionsByPriority /
    renderSections), `context/tables-to-md.ts` (matrixToMarkdown — чистый формат,
    DOM-извлечение строк в collectors), `security/scan.ts` (Luhn / JWT / key-like),
    `security/mask.ts` (formatField — маскирование, чистая часть describeField).
    +40 тестов (`tests/shared/text`, `tests/content/context/{trim,tables-to-md}`,
    `tests/content/security/{scan,mask}`). Vitest — node-окружение, без DOM.
  - **DOM-модули (без юнит-тестов, ручная проверка в браузере — дизайн §6):**
    `state.ts` (STATE + константы + `$`), `dom-utils.ts` (isReadableElement /
    isInsideExtension / toElement / cssEscape), `context/roots.ts`
    (getSearchRoots / deepQueryAll — shadow + same-origin iframe),
    `context/text-extract.ts` (readableFromElement / walk / findBestContentSource /
    getPageTitle / getSafeSelection), `context/collectors.ts` (modals/forms/tables/
    headings/interactive + describeField/getFieldLabel), `context/readability.ts`
    (обёртка над `@mozilla/readability` + фолбэк), `context/build-context.ts`
    (buildStructuredContext + blockMap + `PageContext`), `context/refresh.ts`
    (refreshContext / updateContextMeta / updatePayloadPreview), `spa-keeper.ts`
    (URL/DOM-наблюдатели, ensureHostAttached, reobserve), `render/markdown.ts`
    (`marked` + `highlight.js` + санитайзер + copyToClipboard), `panel/icons.ts`,
    `panel/controls.ts` (шрифт/тема/ширина), `panel/chat.ts` (лента + sendQuestion),
    `panel/panel.ts` (host + shadow + разметка + scope + хоткеи), `content/index.ts`
    (entry: гард + слушатель сообщений).
  - **Библиотеки из npm:** `@mozilla/readability@0.6`, `marked@18` (было vendored
    v12 — мажор; опции `gfm`/`breaks` сохранены), `highlight.js@11`. `lib/` удалён
    (UMD-вендоры и `highlight-theme.css` больше не нужны). Тема подсветки —
    `highlight.js/styles/github-dark.css?inline` (визуальный аналог прежней
    GitHub Dark), инлайнится в shadow root; `panel.css` переехал в
    `src/content/panel/panel.css` и тоже инлайнится через `?inline`. Декларации
    `?inline` — `src/types/assets.d.ts`.
  - **Доступ/настройки:** content больше не дублирует дефолты и whitelist —
    `computeAllowed` → `isHostAllowed` (shared/whitelist), `getSettings` →
    `readSettings` (shared/settings).
  - **Сборка/инъекция:** `vite.config.ts` `additionalInputs` →
    `src/content/index.ts`; плагин бандлит 228 модулей в единый IIFE
    `dist/firefox/src/content/index.js` (1.1 МБ — основной вес highlight.js;
    без top-level import/export → безопасен для `executeScript`). `injector.ts`
    инжектит один файл (предзагрузка `lib/*.js` убрана). `manifest.config.ts`:
    `panel.css` и тема убраны из `web_accessible_resources` (инлайн);
    `viteStaticCopy` копирует только `icons/*`.
  - **Проверка:** `tsc --noEmit` (strict) — зелёный; `vitest run` — **88/88**
    (48 прежних + 40 новых); `npm run build` → `dist/firefox` собирается;
    `web-ext lint` — **0 errors, 8 warnings** (7 пред-существующих `innerHTML` из
    marked/highlight.js/санитайзера + 1 новый `MISSING_DATA_COLLECTION_PERMISSIONS`
    — манифестное правило новой версии web-ext, не связано с декомпозицией).
    Ручную проверку в Firefox на 3 сайтах выполняет владелец (как в Phase 1).
- **[M4 — Переключение на MV3] выполнено.** Манифест переведён на **Manifest V3**
  (per-browser), фон, инъекция, права и диагностика приведены к MV3; целевой
  браузер на этом шаге — Firefox (Chromium-таргет — M5). Поведение рантайма
  сохранено.
  - **`manifest.config.ts`:** `manifest_version: 3`; `browser_action` → `action`;
    команда `_execute_browser_action` → `_execute_action` (зарезервированная —
    браузер сам шлёт `action.onClicked`); права разделены:
    `permissions: [activeTab, storage, scripting, tabs]` +
    `host_permissions: ["<all_urls>"]`; WAR — MV3-формат (массив объектов
    `{ resources, matches }`). Фон отдаётся per-browser функцией `backgroundFor`:
    Firefox — event page (`background.scripts`), Chromium — service worker
    (`background.service_worker` + `type: module`, готово к M5). `strict_min_version`
    поднят до `115.0` (MV3 + event pages + `scripting` + `storage.session`).
  - **Инъекция:** `injector.ts` — `tabs.executeScript` (в MV3 удалён) →
    `scripting.executeScript({ target: { tabId }, files: ["src/content/index.js"] })`.
    Содержимое инъекции не изменилось (единый бандл с M3, один файл).
  - **Экшен:** `index.ts` — `browser.browserAction.onClicked` →
    `browser.action.onClicked`; слушатели регистрируются на верхнем уровне
    (требование краткоживущего фона MV3). Реестр abort-контроллеров в llm-client
    живёт только в рамках запроса — переживать смерть воркера ему не нужно.
  - **Диагностика:** `diagnostics.ts` — `storage.local` → `storage.session`
    (эфемерный last-payload/last-error; доступна доверенным контекстам — фону и
    странице настроек, которая читает её через `TNE_GET_DIAG`). CSS панели уже
    инлайнится с M3 — отдельной работы по WAR-CSS не потребовалось.
  - **Проверка:** `tsc --noEmit` (strict, типы `browser.scripting` / `browser.action`
    / `browser.storage.session` из `@types/webextension-polyfill`) — зелёный;
    `vitest run` — **88/88** (чистая логика не затронута); `npm run build` →
    `dist/firefox/manifest.json` собран как MV3 (путь фона переписан на
    `src/background/index.js`); `web-ext lint` — **0 errors, 8 warnings** (те же,
    что на M3: 7 пред-существующих `innerHTML` + 1 `MISSING_DATA_COLLECTION_PERMISSIONS`
    — манифестное правило новой версии web-ext, не связано с MV3). Ручную проверку
    в Firefox (открытие панели, сбор контекста, запрос к LLM, рендер) выполняет
    владелец (как в Phase 1).
- **[M5 — Chromium-таргет] выполнено.** Добавлена сборка `dist/chrome` рядом с
  `dist/firefox`; в рантайм подключён `webextension-polyfill`, чтобы `browser.*`
  работал и в Chromium (там нативного `browser` нет — только `chrome`). Поведение
  и манифесты per-browser сохранены.
  - **Полифилл:** добавлена рантайм-зависимость `webextension-polyfill@^0.12`
    (мажор совпал с `@types/...@0.12`). `src/shared/browser.ts` — **единая точка
    ре-экспорта** (`export const browser = browserPolyfill`); Vite бандлит
    полифилл локально внутрь каждого entry (фон/контент/настройки) — без CDN
    (проверено: в `dist/**` нет внешнего `from "webextension-polyfill"`, guard
    полифилла присутствует во всех 4 бандлах: ff/chrome × bg/content).
  - **Глобал убран:** ambient `const browser` из `src/types/globals.d.ts` удалён —
    все 12 модулей, дёргавших API, переведены на `import { browser } from
    ".../shared/browser"` (settings, фон ×4, options, content/index, panel ×3
    [panel/chat/controls/icons], context/refresh). Отсутствие глобала — страховка:
    strict `tsc` поймает любой неперенесённый вызов.
  - **Сборка:** `vite.config.ts` берёт целевой браузер из `process.env.TARGET_BROWSER`
    (`firefox` | `chrome`, дефолт firefox) → `dist/<browser>`. Скрипты:
    `build:firefox` / `build:chrome` (задают переменную), `npm run build` гоняет
    оба; `dev:chrome` — dev под Chromium. `manifest.config.ts` уже отдавал фон
    per-browser (Firefox event page / Chromium service worker `type: module`);
    добавлено: `browser_specific_settings.gecko` уходит **только** в Firefox-манифест
    (Chromium его не использует).
  - **Тесты:** модули тянут `shared/browser` (→ полифилл, который при импорте
    требует контекст расширения и бросает вне него). Добавлен `tests/setup.ts`
    (stub `globalThis.chrome = { runtime: { id } }`) + `setupFiles` в
    `vitest.config.ts`; покрытые тесты гоняют только чистую логику, реальные
    `browser.*` не вызываются.
  - **Проверка:** `tsc --noEmit` (strict) — зелёный; `vitest run` — **88/88**;
    `npm run build` → собраны и `dist/firefox` (event page + gecko 115.0), и
    `dist/chrome` (service worker module, без gecko); `web-ext lint dist/firefox` —
    **0 errors, 8 warnings** (те же пред-существующие `innerHTML` / манифестное
    правило). Smoke в Chrome (загрузка распакованного `dist/chrome` через
    `chrome://extensions` → «Загрузить распакованное») и ручную проверку в обоих
    браузерах выполняет владелец (как в Phase 1).
- **[M6 — Чистка] выполнено.** Закрыт strangler-режим миграции; репозиторий
  больше не содержит ни одного не-мигрированного файла. Достигнут Definition of
  Done дизайна §9.
  - **`allowJs` отключён.** Из `tsconfig.json` убраны `allowJs: true` /
    `checkJs: false` и strangler-комментарий — весь код только TS, `tsc --noEmit`
    проходит со strict без послаблений. Стрэй-`.js` в `src/`/`tests/` нет
    (проверено `find`).
  - **Старый код удалён.** Корневые `background.js` / `content.js` / `options.js`
    и каталог `lib/` (вендоренные UMD + `highlight-theme.css`) уже отсутствуют на
    диске с M2/M3; их удаление зафиксировано в этом коммите. Библиотеки идут из
    npm и бандлятся Vite локально — CDN в рантайме нет.
  - **CI-скрипт.** Добавлен `npm run ci` = `tsc --noEmit && vitest run &&
    npm run build` (тайпчек → тесты → сборка обоих таргетов одной командой).
  - **Версия поднята** `0.8.0` → `0.9.0` в `package.json` и `manifest.config.ts`
    (в собранных `dist/firefox/manifest.json` и `dist/chrome/manifest.json` —
    `"version":"0.9.0"`).
  - **Проверка:** `npm run ci` зелёный — `tsc --noEmit` (strict, без `allowJs`)
    чист; `vitest run` — **88/88**; `npm run build` собирает рабочие `dist/firefox`
    (MV3 event page + gecko 115.0) и `dist/chrome` (MV3 service worker module).
- **Скрипты:** `npm run build` (= `build:firefox` + `build:chrome`),
  `npm run build:firefox` / `npm run build:chrome` (через `TARGET_BROWSER`),
  `npm run typecheck`, `npm test` / `npm run test:watch` (Vitest),
  `npm run ci` (typecheck + tests + build обоих таргетов),
  `npm run dev` / `npm run dev:chrome` (vite + web-ext).

## OPEN QUESTIONS

- **Точный URL endpoint.** В `docs/api doc.md` основной путь `/api/v1/generate`, но в
  настройках по умолчанию используется `/api/v1/chat/generate` (как в исходной версии).
  Оставлено как настраиваемое поле; уточнить у владельца актуальный путь.
- **Формат ответа модели.** Парсер `extractContent` поддерживает несколько форм
  (`content` / `response` / `messages[].content` с `role: 2`). Подтвердить enum
  `AuthorRole` и фактическую форму ответа на проде.
- **Vision endpoint.** Поле `visionEndpoint` теперь используется (Phase 2): запрос с
  изображениями уходит на `visionEndpoint`, если он задан, иначе на основной `endpoint`.
- **Vision `modelId`/`mode`.** Неизвестно, нужны ли для запроса с изображениями
  другие `modelId`/`mode`, чем для текста. Пока шлём те же (тело с `files` по
  `api doc.md` работает на основном endpoint). Уточнить у владельца, если
  vision-ответы окажутся пустыми/некорректными.
- **CSP воркера PDF.js (Phase 3).** Worker грузится из расширения
  (`runtime.getURL("pdf.worker.min.mjs")`) в page-контексте; на сайтах со строгим
  `worker-src`/`script-src` создание воркера может блокироваться CSP страницы.
  Fallback — загрузка PDF файлом (всегда работает). Подтвердить на реальных
  корпоративных доменах.
- **Автодетект PDF во вкладке (Phase 3).** В штатном PDF-просмотрщике браузера
  content-скрипт часто не внедряется → автодетект best-effort (по `*.pdf` в URL +
  `fetch` байтов вкладки); надёжный путь — загрузка файла.

## Лог по задачам

- [Phase 1.1] Shadow DOM — панель рендерится в `attachShadow({mode:"open"})` хоста
  `#tne-page-chat-host`; внутренний `#tne-page-chat-root` стилизуется `panel.css`,
  загруженным в shadow root. Контент панели вне document tree → автоматически
  исключён из сбора контекста. `content.js`, `panel.css`, `manifest.json`.
- [Phase 1.2] Структурированный builder — `buildStructuredContext` выдаёт блоки
  `[PAGE] [SELECTED] [MODAL Mn] [FORM Fn] [TABLE Tn] [HEADINGS] [MAIN CONTENT]
  [VISIBLE TEXT] [INTERFACE]`; таблицы → markdown, формы → «label: value».
  Ведётся `STATE.blockMap` (id блока → DOM-элемент) для будущей подсветки. `content.js`.
- [Phase 1.3] Базовый extractor — title, location, meta description, h1–h3,
  main/article/[role=main], видимый текст, модалки, таблицы, формы, выделение. `content.js`.
- [Phase 1.4] Readability — локальная `lib/Readability.js`, парсит клон документа в
  `[MAIN CONTENT]`, с фолбэком на эвристику. `content.js`, `lib/Readability.js`.
- [Phase 1.5] Dirty-flag — MutationObserver только помечает `contextDirty`, не парсит;
  пересбор перед отправкой и по кнопке. Смена URL и удаление хоста → dirty. `content.js`.
- [Phase 1.6] Обрезка по приоритету — `trimSectionsByPriority` режет по приоритету
  (выделение>модалка>формы>таблицы>видимый текст>заголовки>основной контент>остальное).
  Лимит из настроек (дефолт 20000, потолок 25000). `content.js`.
- [Phase 1.7] Предпросмотр — блок «Показать, что уйдёт в модель (без токена)» строит
  тело через `TNE_BUILD_PAYLOAD`; индикатор «scope · N симв. · свежий/устаревший»;
  переключатели объёма (вся страница / видимое / выделение / таблицы). `content.js`, `background.js`.
- [Phase 1.8] Whitelist — `whitelist`/`denylist`/`allowExternal` в настройках; на
  не-whitelisted домене (при выключенном чекбоксе) показывается «домен не разрешён».
  Glob-паттерны (`*.tn.corp`). `content.js`, `options.*`, `background.js`.
- [Phase 1.9] Диагностика — в настройках: проверка соединения, проверка vision,
  показать последний payload (без токена), показать последнюю ошибку. `options.*`, `background.js`.
- [Phase 1.10] Ошибки/таймауты — таймаут по настройке, ретраи с backoff (не для 4xx/abort),
  кнопки «Остановить» (через `TNE_ABORT`) и «Повторить». `background.js`, `content.js`.
- [Phase 1.11] Маскирование — `input[type=password]` не читается, token/secret-like поля
  маскируются `[скрыто]`, `hidden` не отправляется; скан контекста на карты (Luhn)/
  JWT/ключи → предупреждение перед отправкой. `content.js`.
- [Phase 1.12] Markdown — `marked` + `highlight.js` локально, санитайзер на инертном
  `<template>`, кнопки «Копировать код» и «Копировать ответ». `content.js`, `lib/`, `panel.css`.
- [Phase 1.13] SPA-keeper — re-attach хоста вынесен в `ensureHostAttached()` и
  вызывается и из MutationObserver, и из 800-мс тика. `reobserveIfBodyReplaced()`
  переподключает observer к новому `<body>`, если SPA заменила его целиком
  (общие опции вынесены в `OBSERVER_OPTIONS`). Смена URL/DOM → dirty, пересбор —
  перед запросом. `content.js`.
- [Phase 1.14] iframe + open Shadow DOM — `getSearchRoots()` рекурсивно собирает
  document + открытые shadow root + same-origin iframe-документы (со своим shadow
  панели исключённым); `deepQueryAll()` ищет по всем корням. Коллекторы
  (modals/forms/tables/headings/interactive/findBestContentSource) и `walk()`
  спускаются в shadow root и same-origin iframe. `isReadableElement` использует
  `ownerDocument.defaultView` для корректного `getComputedStyle` в iframe. `content.js`.
- [Phase 1.15] Хоткеи + UX-база — в манифест добавлены `commands`:
  `_execute_browser_action` (Ctrl+Shift+U — открыть/закрыть) и `tne-ask-selection`
  (Ctrl+Shift+Y — спросить по выделению, обрабатывается в `background.js` →
  `TNE_ASK_SELECTION` → `askBySelection()`). `Ctrl+Enter`/`Enter` — отправка,
  `Esc` — закрыть панель. Добавлены: переключатель тёмной/светлой темы (кнопка в
  шапке, ключ `panelTheme`, светлая тема в `panel.css`), drag-ручка изменения
  ширины (ключ `panelWidth`, dbl-click — сброс), сохранение между сессиями.
  Размер шрифта (`panelFontSize`) был реализован ранее. `manifest.json`,
  `background.js`, `content.js`, `panel.css`.

## PHASE 2 — Vision (2.1–2.5)

Дизайн: `docs/superpowers/specs/2026-06-02-phase2-vision-p0-design.md`; план:
`docs/superpowers/plans/2026-06-02-phase2-vision.md`. Выполнено субагентами
(subagent-driven), ветка `phase2-vision`. Весь Phase 2 (P0 2.1–2.3 + P1 2.4–2.5).

**Ключевой вывод (из `docs/api doc.md`):** изображения — не отдельный API, а поле
`messages[0].files` (чистый base64, без префикса `data:...`) в том же запросе.
Поэтому Phase 2 = «приложить картинки к существующему потоку `TNE_ASK_MODEL`», без
отдельного vision-флоу.

- **Единый конфиг лимитов** — `src/shared/limits.ts` (§3 плана): `MAX_IMAGES=5`,
  `IMAGE_MAX_SIDE=1600`, `IMAGE_QUALITY=0.8`, `VISION_TIMEOUT_MS=120000`,
  `CAPTURE_MIN_INTERVAL_MS=500` (≤2 захвата/сек). Покрыт смоук-тестом.
- **Сжатие — в content, не в фоне.** Chromium MV3 background — service worker (нет
  DOM/canvas). `captureVisibleTab` (привилегированная часть) — в `src/background/
  capture.ts` с троттлингом ≥500 мс; сжатие/кроп/декод файла — в content
  (`src/content/vision/image-compressor.ts`, detached canvas).
- **[2.1] Снимок видимой области** — кнопка 📷 → content прячет хост
  `#tne-page-chat-host` (`visibility:hidden`) → `TNE_CAPTURE_TAB` → background
  `captureActiveTab` → data URL → восстановление хоста (в `finally`) → сжатие →
  вложение. `attachments.ts:captureAndAttachScreen`.
- **[2.2] До 5 изображений + сжатие** — лента накапливает до `MAX_IMAGES`; лимит
  enforced в `addAttachment`/`attachFromFiles` и защитно в `buildBody`
  (`.slice(0, MAX_IMAGES)`). Сжатие jpeg q0.8, ресайз ≤1600px по большей стороне.
- **[2.3] Ручная загрузка** — `<input type=file accept=image/png,jpeg,webp multiple>`
  → `fileToDataUrl` → `compressDataUrl` → вложение; не-изображения отклоняются.
- **[2.4] Скриншот области рамкой** — `src/content/vision/region-capture.ts`:
  полноэкранный overlay в page DOM (инлайн-стили — он вне shadow root!), drag →
  rect; на mouseup overlay убирается → снимок вкладки → кроп к области
  (`scale = image.naturalWidth / window.innerWidth`, самокоррекция под
  devicePixelRatio). Esc / рамка <6px — отмена.
- **[2.5] Опциональный автоскриншот** — настройка `autoScreenshot` (дефолт **false**),
  чекбокс в `options.html`/`options.ts`. В `chat.ts:sendQuestion` срабатывает только
  если включён И нет ручных вложений, и только после прохождения warning-gate
  чувствительных данных.
- **Маршрутизация/таймаут** — `pickEndpoint(settings, hasImages)` (vision если задан,
  иначе основной), `pickTimeout` (120с для запросов с картинками). Юнит-тесты.
- **Приватность** — токен только в заголовках (тест «не утекает с картинками»);
  base64 редактируется в плейсхолдеры `[изображение N · ~K КБ]` ПЕРЕД сохранением в
  диагностику (`diag.onBody → storage.session`) и в предпросмотр payload
  (`redactImagesForPreview`, возвращает копию — оригинал не мутируется). CDN не
  добавлены (проверено `grep` по `dist/`).
- **Файлы:** new `src/shared/limits.ts`, `src/background/capture.ts`,
  `src/content/vision/{image-compressor,attachments,region-capture}.ts`; правки
  `messages.ts`, `settings.ts`, `llm-client.ts`, `messaging.ts`, `state.ts`,
  `panel/{icons,panel}.ts`, `panel.css`, `chat.ts`, `context/refresh.ts`,
  `options.html`, `options/options.ts`. Тесты: `limits.test.ts`,
  `content/vision/image-compressor.test.ts`, +10 в `background/llm-client.test.ts`.
- **Проверка:** `npm run ci` зелёный — `tsc --noEmit` (strict) чист; `vitest run` —
  **106/106** (88 прежних + 18 новых: 1 limits + 8 image-compressor + ... всего +18);
  `npm run build` собирает `dist/firefox` и `dist/chrome` (MV3). Финальное
  код-ревью — APPROVED (без Critical/Important). Ручную проверку в Firefox+Chromium
  (захват/область/загрузка/автоскриншот/самоскрытие панели) выполняет владелец
  (как в Phase 1).

### Решения по объёму P1

- **1.14 — `all_frames: true` сознательно НЕ включали.** Content-скрипт внедряется
  по клику через `tabs.executeScript` и содержит всю UI-логику панели; внедрение во
  все фреймы создавало бы панель в каждом фрейме и требовало бы межфреймовой
  агрегации контекста. Вместо этого реализован обход open shadow root и
  **same-origin** iframe из основного фрейма. Cross-origin iframe недоступен из-за
  CORS (ограничение чистого frontend) — это задокументированный предел.
- **Хоткеи — это suggested_key.** Firefox может сообщить о конфликте; пользователь
  перевешивает их в `about:addons` → «Управление сочетаниями».

### Проверка

- `node --check` для `background.js`, `content.js`, `options.js` — без ошибок
  (включая правки P1).
- `manifest.json` — валидный JSON (с секцией `commands`).
- Смоук-тест в `vm`: `marked`, `hljs`, `Readability` корректно экспортируются как
  глобалы при изоляции, аналогичной content-script sandbox; `marked.parse` рендерит.
- Ручную проверку в Firefox на 3 сайтах выполняет владелец (см. «Проверка» в плане).

## PHASE 3 — Документ (PDF) (3.1–3.4)

Дизайн: `docs/superpowers/specs/2026-06-02-phase3-pdf-design.md`; план:
`docs/superpowers/plans/2026-06-02-phase3-pdf.md`. Выполнено subagent-driven на
ветке `phase3-pdf`. Все P0 (3.1–3.4).

**Ключевой вывод:** изображения страниц PDF переиспользуют существующий поток
вложений Phase 2 (`messages[].files`, общий лимит 5 картинок), а текстовый слой
вставляется в структурированный контекст как блок `[DOCUMENT D1]` (под обрезку по
приоритету и под `scanSensitive`-гейт). Отдельного vision-флоу не вводилось.

- **PDF.js локально** — `pdfjs-dist@4.10.38` из npm, бандлится Vite в content-IIFE.
  Worker `pdf.worker.min.mjs` копируется `viteStaticCopy` в корень `dist/<browser>`
  и объявлен в `web_accessible_resources`; в рантайме
  `GlobalWorkerOptions.workerSrc = runtime.getURL(...)`. CDN нет (проверено `grep`
  по `dist/`). Обработка PDF — в content (нужен canvas; в Chromium SW его нет).
- **[3.1] Загрузка + автодетект** — кнопка 📄 + `input[accept=application/pdf]`
  (надёжный путь); автодетект по `*.pdf` в URL при открытии панели → предложение
  «Загрузить из вкладки» (`fetch` байтов same-origin). `pdf-attachments.ts`.
- **[3.2] Текстовый слой** — `pdf-text.ts:extractPageText` (склейка элементов,
  переносы по `hasEOL`) → блок `[DOCUMENT D1]` с под-страницами `[PDF Pn]`.
- **[3.3] Слой картинок** — `pdf-render.ts:renderPageToDataUrl` (detached canvas,
  scale 2.0) → `compressDataUrl` → вложения `source:"pdf"`. Включается
  автоматически для сканов (`scan-detect.ts:looksLikeScan`, порог 100 симв/стр)
  или вручную тогглом. До 5 картинок (общий бюджет со скриншотами).
- **[3.4] Выбор страниц** — UI-режимы «Первые 5» / «Выбрать» (поле «1-3,12»,
  парсер `page-range.ts`) / «Текущая» (если PDF во вкладке и `#page=N` известен);
  прогресс рендера статус-строкой; сообщение про лимит картинок. Текст — для всех
  выбранных страниц; картинки — для первых ≤5.
- **Файлы:** new `src/content/pdf/{page-range,scan-detect,pdf-loader,pdf-text,
  pdf-render,pdf-attachments}.ts`; правки `src/shared/limits.ts`,
  `src/content/state.ts` (`PdfState`, `Attachment.source:"pdf"`),
  `src/content/context/build-context.ts` (блок `[DOCUMENT]`),
  `src/background/llm-client.ts` (перечень блоков в промпте),
  `src/content/vision/attachments.ts` (`addAttachment` экспорт,
  `clearAttachments({keepPdf})`), `src/content/panel/{chat,panel,icons}.ts`,
  `src/content/panel/panel.css`, `manifest.config.ts` (worker в WAR),
  `vite.config.ts` (копирование worker), `package.json`. Тесты:
  `tests/content/pdf/{page-range,scan-detect}.test.ts` (+16).
- **Проверка:** `npm run ci` зелёный — `tsc --noEmit` (strict) чист; `vitest run` —
  **122/122** (106 прежних + 16 новых: 11 page-range + 5 scan-detect);
  `npm run build` собирает `dist/firefox` и `dist/chrome` (MV3) с worker в корне;
  CDN-ссылок в `dist/` нет. Ручную проверку в Firefox+Chromium (текстовый PDF,
  скан, выбор страниц «1-3,12», большой PDF с прогрессом, автодетект, очистка)
  выполняет владелец (как в Phase 1/2).

## PHASE 4 — Продуктовый UX (P0 4.1–4.4)

Дизайн: `docs/superpowers/specs/2026-06-02-phase4-ux-p0-design.md`; план:
`docs/superpowers/plans/2026-06-02-phase4-ux-p0.md`. Выполнено subagent-driven на
ветке `phase4-ux`. Все P0 (4.1–4.4).

- **[4.1] Кликабельные метки-источники** — `src/content/render/source-links.ts`
  (`findSourceLabels` — чистая, покрыта Vitest; `linkifySources` — DOM-обход с
  пропуском `pre`/`code`). `renderMarkdownInto(..., { linkSources: true })`
  вызывается из `addAssistantMessage`. Распознаются `[FORM Fn] [TABLE Tn]
  [MODAL Mn] [DOCUMENT Dn]` и `[SELECTED] [PAGE] [MAIN CONTENT]`. Системный промпт
  (`background/llm-client.ts`) уже требовал метки-источники с Phase 1 — менять не
  потребовалось.
- **[4.2] Подсветка источника** — `src/content/render/source-highlight.ts`:
  `highlightBlock` (scrollIntoView + overlay-бокс в page DOM, учёт same-origin
  iframe через `viewportRect`); если блок не в `STATE.blockMap` (PDF
  `[DOCUMENT D1]`, `[SELECTED]`/`[PAGE]`/`[MAIN CONTENT]` или устаревший маппинг)
  → `showPanelToast`. Делегат кликов/Enter — на `#tne-chat-messages`. Стили
  `.tne-source-link`/`.tne-toast` — в `panel.css`.
- **[4.3] Быстрые действия** — 6 пресетов (`QuickAction{label,prompt}`) в
  `state.ts` (`QUICK_ACTIONS`); рендер в `panel.ts` подставляет `prompt` и
  отправляет (было 2 строки).
- **[4.4] Выделение → действие** — плавающая кнопка
  (`src/content/selection/floating-button.ts`, собственный shadow root,
  whitelist-gated, мини-меню из `SELECTION_ACTION_META`, инициализация в
  `content/index.ts`) + контекстное меню (`background/index.ts`, право
  `contextMenus`, пункты из shared-meta → `TNE_SELECTION_ACTION` → content
  `runSelectionAction`). Общая машинерия — `askWithSelectionPrompt` (рефактор
  `askBySelection`). Промпты — в `src/content/selection/actions.ts`
  (`selectionPromptFor` покрыта Vitest); meta (id+label) — в
  `src/shared/selection-actions.ts`. Контекст = только выделение (scope
  `selection`, через гейт `scanSensitive`).
- **Файлы:** new `src/content/render/{source-links,source-highlight}.ts`,
  `src/shared/selection-actions.ts`, `src/content/selection/{actions,
  floating-button}.ts`; правки `src/content/state.ts`,
  `src/content/panel/{panel.ts,panel.css,chat.ts}`,
  `src/content/render/markdown.ts`, `src/content/index.ts`,
  `src/shared/messages.ts`, `src/background/index.ts`, `manifest.config.ts`.
  Тесты: `tests/content/render/source-links.test.ts`,
  `tests/content/selection/actions.test.ts` (+9); `tests/setup.ts` дополнен
  stub-ами `location` и `runtime.getURL` (импорт-граф panel.ts в node).
- **Проверка:** `npm run ci` зелёный — `tsc --noEmit` (strict) чист; `vitest run`
  — **131/131** (122 прежних + 9 новых: 6 source-links + 3 actions);
  `npm run build` собирает `dist/firefox` и `dist/chrome` (MV3) с правом
  `contextMenus` в обоих манифестах; CDN-ссылок в `dist/` нет. Ручную проверку в
  Firefox+Chromium (метка→подсветка form/table/modal, тост для PDF
  `[DOCUMENT D1]`, 6 быстрых кнопок, плавающая кнопка/контекстное меню на
  выделении, неактивность кнопки вне whitelist) выполняет владелец (как в Phase
  1–3).

## PHASE 4 — Продуктовый UX (P1 4.5–4.8)

Дизайн: `docs/superpowers/specs/2026-06-02-phase4-ux-p1-design.md`; план:
`docs/superpowers/plans/2026-06-02-phase4-ux-p1.md`. Выполнено subagent-driven на
ветке `phase4-ux-p1`. Все P1 (4.5–4.8). Контракт сообщений (`src/shared/messages.ts`)
и манифест (`manifest.config.ts`) НЕ менялись (проверено `git diff` vs master):
роль применяется на стороне фона из `settings.roleId`, slash/шаблоны/кнопки —
целиком в content.

- **[4.5] Slash-команды** — `src/content/chat/slash-commands.ts` (чистый, Vitest):
  `SLASH_COMMANDS` (6 команд), `resolveSlashCommand` («команда → промпт», аргумент
  для `/translate ru|en`), `matchSlashCommands` (префиксный матчер). UI —
  автокомплит-поповер `#tne-slash-menu` в `panel.ts` (`createSlashMenu`):
  интегрирован в ЕДИНЫЙ keydown инпута (ArrowUp/Down/Enter/Tab/Esc только при
  открытом меню; на Esc — `stopPropagation`, чтобы не закрыть панель), `input` →
  `slash.update()`. Выбор подставляет промпт в textarea (редактируемо, без
  авто-отправки).
- **[4.6] Роли системного промпта** — `src/shared/roles.ts` (чистый, Vitest):
  `ROLE_PRESETS` = «Базовый» (нейтральный дефолт, пустая добавка) + аналитик/
  поддержка/разработчик/комплаенс; `resolveRolePrompt`. `settings.roleId`
  (дефолт `general`). `buildPrompt(payload, rolePrompt)` вставляет добавку в intro;
  `buildBody` берёт `resolveRolePrompt(settings.roleId)` — без изменения payload.
  UI — `<select id="tne-role-select">` в шапке (`initRoleSelect`, читает/пишет
  `roleId` в storage.local, тема dark/light).
- **[4.7] Библиотека шаблонов** — `src/shared/templates.ts` (чистый, Vitest):
  `PromptTemplate`, `applyTemplateVariables` (`{{выделение}}/{{url}}/{{таблица}}`,
  терпим к пробелам/регистру), `firstTableBlock` (первый `[TABLE Tn]` из контекста),
  `parseImportedTemplates` (валидация импорта), `newTemplateId`, `TEMPLATES_KEY`.
  `settings.promptTemplates` (дефолт `[]`). Options — карточка «Библиотека промптов»
  (CRUD: add/save/удалить + Экспорт скачиванием JSON + Импорт файлом с догенерацией
  id; импорт ДОПИСЫВАЕТ и требует явного «Сохранить»). Панель — ряд
  `#tne-template-actions` (`initTemplateButtons`): клик собирает vars из контекста
  (selection/url/первая таблица) и подставляет тело в input (без авто-отправки);
  ряд скрыт без шаблонов.
- **[4.8] Кнопки под ответом** — `chat.ts` `addAssistantMessage`: «Продолжить» /
  «Короче» / «Подробнее» (`sendFollowUp` — преднастроенная доработка, история едет
  в payload, БЕЗ force → проходит гейт чувствительных данных), «Повторить»
  (`repeatLast`, `sendQuestion(true)`), «Без картинок» (`resendWithoutImages` —
  условно, только если последний запрос нёс картинки; флаг
  `STATE.lastRequestHadImages` ставится в `sendQuestion`), «Копировать ответ»
  (сохранено). **👍/👎 НЕ реализованы** (Phase 6.3, требует продуктового решения;
  нон-цель «телеметрия»); две кнопки про картинки сведены к одной «Без картинок»
  (в text-first пайплайне это одна операция).
- **Файлы:** new `src/shared/roles.ts`, `src/shared/templates.ts`,
  `src/content/chat/slash-commands.ts`; правки `src/shared/settings.ts`
  (`roleId`/`promptTemplates`), `src/background/llm-client.ts` (роль в промпте),
  `src/content/state.ts` (`lastRequestHadImages`),
  `src/content/panel/{panel.ts,panel.css,chat.ts}`, `options.html`,
  `src/options/options.ts`, `options.css`. Тесты: `tests/shared/{roles,templates}.test.ts`,
  `tests/content/chat/slash-commands.test.ts`, +1 в `tests/shared/settings.test.ts`,
  +3 в `tests/background/llm-client.test.ts`.
- **Проверка:** `npm run ci` зелёный — `tsc --noEmit` (strict) чист; `vitest run`
  — **155/155** (131 прежних + 24 новых: roles 5 + templates 8 + slash 7 + settings 1
  + llm-client 3); `npm run build` собирает `dist/firefox` и `dist/chrome` (MV3);
  CDN-ссылок в `dist/` нет; `messages.ts`/`manifest.config.ts` не изменены.
  Выполнено subagent-driven (имплементер + независимое ревью на каждую задачу).
  Ручную проверку в Firefox+Chromium (slash-автокомплит и подстановка; смена роли →
  тон ответа и предпросмотр payload; шаблон с переменными + экспорт/импорт;
  кнопки под ответом, «Без картинок» после запроса с картинкой) выполняет владелец
  (как в Phase 1–4 P0).

## PHASE 4 — Продуктовый UX (P2 4.9)

Закрыта последняя задача Phase 4 — `P2 4.9 Экспорт диалога в .md`. Контракт
сообщений (`messages.ts`) и манифест НЕ менялись: экспорт целиком в content, без
обращения к фону и без новых прав.

- **[4.9] Экспорт диалога в .md** — `src/content/chat/export-md.ts`:
  - **Чистая часть (Vitest):** `dialogToMarkdown(history, meta)` сериализует
    `STATE.history` (пары вопрос/ответ) в markdown — заголовок «ТНЭ чат — экспорт
    диалога», опциональный блок метаданных (страница/URL/дата), затем секции
    `## Вопрос` / `## Ответ` через `---`; схлопывает лишние пустые строки, гарантирует
    финальный `\n`. `buildExportFilename(title, date)` — имя `tne-chat-<slug>-<YYYY-MM-DD-HHMM>.md`
    (slug из заголовка, фолбэк без slug; обрезка длинных заголовков до 48 симв.).
  - **DOM-обвязка (без юнит-тестов, §6):** `exportDialog()` — собирает markdown из
    `STATE.history` + `STATE.page` (title/url/`toLocaleString("ru-RU")`), формирует
    `Blob` (`text/markdown`), скачивает через временную `<a download>` +
    `URL.createObjectURL`/`revokeObjectURL`. Пустой диалог → `showPanelToast`
    («нечего экспортировать»), без скачивания.
  - **UI:** кнопка-иконка `#tne-chat-export` (`EXPORT_ICON` — лист со стрелкой вниз,
    `icons.ts`) в шапке слева от «Очистить чат»; класс `tne-icon-button`
    переиспользован — CSS не трогали. Контракт/манифест без изменений.
- **Файлы:** new `src/content/chat/export-md.ts`,
  `tests/content/chat/export-md.test.ts` (+8); правки `src/content/panel/icons.ts`
  (`EXPORT_ICON`), `src/content/panel/panel.ts` (импорт, кнопка в шапке, обработчик).
- **Проверка:** `npm run ci` зелёный — `tsc --noEmit` (strict) чист; `vitest run` —
  **163/163** (155 прежних + 8 новых: dialogToMarkdown 5 + buildExportFilename 3);
  `npm run build` собирает `dist/firefox` и `dist/chrome` (MV3). Ручную проверку в
  Firefox+Chromium (кнопка экспорта после диалога → корректный .md с метаданными;
  тост на пустом диалоге) выполняет владелец (как в Phase 1–4).

## PHASE 5 — Расширенные документы и инструменты (P1 5.1–5.3)

Дизайн: `docs/superpowers/specs/2026-06-03-phase5-office-p1-design.md`; план:
`docs/superpowers/plans/2026-06-03-phase5-office-p1.md`. Выполнено subagent-driven
(имплементер + спец-ревью + код-ревью на задачу) на ветке `phase5-office`. Все P1
(5.1–5.3). Контракт сообщений (`src/shared/messages.ts`) и манифест
(`manifest.config.ts`) НЕ менялись (проверено `git diff` vs master) — всё в content,
без обращений к фону и без новых прав.

**Ключевое решение:** один общий слот документа. DOCX/XLSX живут в новом
`STATE.docFile` (`{kind, name, documentText}`), который **взаимоисключается** с
`STATE.pdf`: загрузка office-дока зовёт `clearPdf()`, загрузка PDF (`openPdf`) чистит
`docFile`. Оба рисуются как единственный блок `[DOCUMENT D1]`
(`build-context.ts`: `STATE.pdf?.documentText || STATE.docFile?.documentText`).
Библиотеки — из npm, бандлятся Vite локально (без CDN): `mammoth` (DOCX), `exceljs`
(чтение/запись XLSX; выбран вместо SheetJS 0.18.5 — у того CVE в пути парсинга).

- **Рефактор matrix (под 5.3).** `|`-экранирование перенесено в чистую
  `matrixToMarkdown` (`tables-to-md.ts`), а из коллектора выделена
  format-нейтральная `tableToMatrix` (`collectors.ts`); `CollectedTable` получил
  поле `matrix: string[][]`. Это убрало двойное экранирование и дало сырую матрицу
  для экспорта.
- **[5.1] DOCX-чтение (Mammoth).** `office/io.ts:readDocx` →
  `mammoth.extractRawText({arrayBuffer})`; чистая `office/docx-text.ts:normalizeDocxText`
  (CRLF→LF, трим хвостов, схлопывание пустых строк) под Vitest. Текст → `[DOCUMENT D1]`.
- **[5.2] XLSX-чтение (ExcelJS).** `office/io.ts:readXlsx` (листы → матрицы, кап 500×50,
  `cellToText` приводит string/number/bool/Date/richText/hyperlink/formula-result/
  sharedFormula/error к тексту); чистая `office/xlsx-format.ts:sheetsToContextText`
  (каждый лист → `[SHEET «имя»]` + `matrixToMarkdown`) под Vitest → `[DOCUMENT D1]`.
- **[5.3] Экспорт таблиц в .xlsx (ExcelJS).** `office/io.ts:matrixToWorkbookBuffer`
  (addWorksheet+addRows→writeBuffer); чистая `office/table-filename.ts:buildTableFilename`
  (`tne-table-<slug>-<N>-<стамп>.xlsx`) под Vitest. UI — бар `#tne-tables-bar`
  (`office.ts:renderTablesBar`): из `collectTables()` рисует список `[TABLE Tn]` с
  кнопкой «↓ Excel» у каждой; наведение → `highlightBlock` (элемент переназначается в
  `STATE.blockMap` в обработчике `mouseenter` — устойчиво к сбросу blockMap при
  `refreshContext`). Пустой список → тост.
- **Общий UI документа.** Кнопка «Документ» (`#tne-attach-doc`, `DOC_ICON`) +
  `#tne-doc-input` (`accept=.docx,.xlsx` + OOXML-MIME) с роутингом по расширению;
  кнопка «Таблицы → Excel» (`#tne-tables-export`, `TABLE_EXPORT_ICON`); бар
  `#tne-doc-bar` (имя/тип/«N симв.»/«листов: N»/×). `office.ts:initOffice`
  привязан рядом с `initPdf` в `panel.ts`. Скачивание вынесено в общий
  `render/download.ts:downloadBlob` (DRY с `export-md.ts`).
- **Файлы:** new `src/content/office/{docx-text,xlsx-format,table-filename,io,office}.ts`,
  `src/content/render/download.ts`; правки `src/content/context/{tables-to-md,
  collectors,build-context}.ts`, `src/content/state.ts` (`DocFileState`/`docFile`),
  `src/content/pdf/pdf-attachments.ts` (`openPdf` чистит docFile),
  `src/content/panel/{icons,panel,panel.css}.ts`, `src/content/chat/export-md.ts`
  (→ `downloadBlob`), `package.json` (exceljs, mammoth). Тесты:
  `tests/content/office/{docx-text,xlsx-format,table-filename}.test.ts` +
  `tests/content/context/tables-to-md.test.ts` (+1 экранирование).
- **Проверка:** `npm run ci` зелёный — `tsc --noEmit` (strict) чист; `vitest run` —
  **175/175** (163 прежних + 12 новых: docx-text 4 + xlsx-format 4 + table-filename 3 +
  tables-to-md 1); `npm run build` собирает `dist/firefox` и `dist/chrome` (MV3);
  CDN-ссылок в `dist/` нет (`grep`); `messages.ts`/`manifest.config.ts` не изменены.
  io.ts (Mammoth/ExcelJS) и office.ts (DOM/UI) — без юнит-тестов (§6), ручная проверка.
  Каждая задача прошла спец-ревью + код-ревью (исправлены: shared-formula→"" в
  cellToText; устойчивость подсветки к сбросу blockMap; тост вместо чат-сообщения на
  ошибке экспорта). Ручную проверку в Firefox+Chromium (загрузка .docx → текст в
  предпросмотре; .xlsx → листы/значения; экспорт таблицы → корректный .xlsx;
  взаимное вытеснение PDF↔документ; подсветка таблицы при наведении) выполняет
  владелец (как в Phase 1–4).

**Открытый пункт (P2, не делалось):** 5.4 заполнение форм, 5.5 сравнение вкладок,
5.6 перевод in-place, 5.7 OCR.

## Хотфикс-блок Phase 5 (5.HF1–5.HF4)

Найдено при ручной проверке после 5.1–5.3; план — в `docs/step by step.md`
(блок между 5.3 и 5.4).

- **[5.HF1] Светлая тема — консистентные цвета.** Корень: `.tne-attach-button` и
  `.tne-attachment` были захардкожены тёмным `rgba(30,41,59,.78)` без светлых
  правил, а бары PDF/таблиц ссылались на несуществующую в светлой палитре
  `--tne-surface-2` (был только `--tne-surface-variant`) → блёклый фолбэк. Введена
  переменная `--tne-surface-2` в обе палитры; кнопки/чипы вложений переведены на
  переменные; добавлены светлые override'ы для баров PDF/документа/таблиц,
  hover кнопок вложений и warning-bar (читаемый контраст). Файл:
  `src/content/panel/panel.css`.
- **[5.HF2] Вложения видны в чате.** Сверено с `docs/api doc.md`: изображения уходят
  на ОСНОВНОЙ endpoint полем `messages[0].files` (чистый base64) — формат в коде
  уже корректен, отдельный vision-endpoint не нужен. Реальная проблема —
  отправленные картинки/документ не отображались в ленте, поэтому казалось, что
  «не уходят». Теперь `addUserMessage` рисует превью картинок и чип документа
  (PDF/DOCX/XLSX) прямо в пузыре вопроса; после ответа лента очищается как раньше.
  Файлы: `src/content/panel/chat.ts`, CSS `.tne-bubble-*`.
- **[5.HF3] Скачивание .xlsx/.md.** Корень: клик по `<a download>` из
  content-скрипта ненадёжен (CSP страницы). `downloadBlob` стал async и сначала
  шлёт data-URL в background (`TNE_DOWNLOAD_FILE` → `browser.downloads.download`),
  фолбэк — прежний клик по ссылке. Ошибки экспорта таблиц теперь видны сообщением
  в ленте чата, а не только тостом. Добавлено право `downloads` в манифест.
  Файлы: `src/shared/messages.ts`, `manifest.config.ts`,
  `src/background/{download.ts,messaging.ts}`, `src/content/render/download.ts`,
  `src/content/office/office.ts`, `src/content/chat/export-md.ts`.
- **[5.HF4] Чистота панели — бары не висят.** `toggleTablesBar`: одна таблица —
  сразу скачивается (без бара), несколько — компактный список, который сам
  закрывается после экспорта; нет таблиц — тост. Пустые бары PDF/документа/таблиц
  и так `hidden` (места не занимают). Файл: `src/content/office/office.ts`.

- **Проверка:** `tsc --noEmit` чист; `vitest run` — **175/175**; `npm run build`
  собирает `dist/firefox` и `dist/chrome`, право `downloads` присутствует в обоих
  манифестах. Браузерная Проверка (визуальная тема в обеих темах, реальное
  скачивание .xlsx в Firefox/Chromium, превью вложений в пузыре, отсутствие
  «висящих» баров) — за владельцем, как в Phase 1–4.

## Хотфикс-блок Phase 5 — раунд 2 (5.R2-1 … 5.R2-11)

Найдено при ручной проверке после раунда 1; план — в `docs/step by step.md`
(блок между 5.3 и 5.4). Один пункт = один коммит `fix(phase5): 5.R2-N …`.

- **[5.R2-1] Светлая тема — верхняя область/контролы.** Введена переменная
  `--tne-placeholder` (обе палитры), плейсхолдер поля ввода через неё; `<summary>`
  блоков-сворачивалок получили «кнопочную» подложку (`--tne-surface-2` + бордер);
  светлые override'ы для `.tne-context-label/.tne-context-meta/.tne-context-title`
  и summary. Файл: `src/content/panel/panel.css`.
- **[5.R2-2] История диалога в промпте.** `buildPrompt` добавляет блок
  «# Предыдущие сообщения» из последних 2 обменов (`slice(-4)`, обрезка 1500 симв.),
  контекст страницы — один блок выше (без дубля). `chat.ts` шлёт чистые пары
  (slice(-4)), предпросмотр тела тоже несёт историю. Тесты на `buildPrompt`.
  Файлы: `src/background/llm-client.ts`, `src/content/panel/chat.ts`,
  `src/shared/messages.ts`, `src/content/context/refresh.ts`.
- **[5.R2-3] Кнопки под ответом.** Оставлены «Повторить», условная «Без картинок»,
  «Копировать ответ»; follow-up «Продолжить/Короче/Подробнее» убраны (с историей —
  это обычные вопросы). Удалён `sendFollowUp`. Файл: `src/content/panel/chat.ts`.
- **[5.R2-4] Быстрые действия — 3 кнопки.** `QUICK_ACTIONS` = «Что здесь важно?»,
  «Кратко объясни», «Найди ошибки»; `.tne-quick-actions` на flex c flex-wrap и
  `flex: 1 1 0` — ряд из трёх, перенос/стопка при сужении. Файлы:
  `src/content/state.ts`, `src/content/panel/panel.css`.
- **[5.R2-5] Экспорт таблиц — починить.** Корень: запись через ExcelJS «вис»/
  раздувала бандл. Введён собственный `matrixToXlsxBuffer` (store-ZIP + CRC32,
  inlineStr) без зависимостей; добавлен фолбэк `collectTablesLoose()` по сырому
  `querySelectorAll` и логирование числа таблиц; любой исход — сообщение в ленте.
  Юнит-тесты CRC32/columnName/структуры пакета. Файлы:
  `src/content/office/xlsx-write.ts` (new), `office/office.ts`, `office/io.ts`,
  `src/content/context/collectors.ts`.
- **[5.R2-6] Бары вложений только при использовании.** Бары объявлены
  `display:flex` и перебивали UA `[hidden]` → пустые box'ы висели полосками.
  Добавлено `.tne-attach-bar [hidden]{display:none}` и `:has()`-схлопывание
  padding/gap. Файл: `src/content/panel/panel.css`.
- **[5.R2-7] Вложения в пузыре — над текстом.** `addUserMessage` рисует ленту
  вложений перед текстовым пузырём; CSS прижимает её снизу. Файлы:
  `src/content/panel/chat.ts`, `panel.css`.
- **[5.R2-8] Убрать DOCX/XLSX-чтение; «Приложить» = картинки + PDF.** Единая кнопка
  «Приложить» (`accept image/*,application/pdf`): картинки → image-флоу, PDF →
  `loadPdfFromFile`. Удалены кнопки/инпуты PDF и документа, бар документа, иконки
  `PDF_ICON/DOC_ICON`, модули `office/{io,docx-text,xlsx-format}.ts` и их тесты,
  зависимости `mammoth`/`exceljs`, `STATE.docFile`/`DocFileState` и ветки `docFile`.
  Сборка — 256 модулей, без exceljs/mammoth в бандле. *(package-lock.json не
  пересобран — npm недоступен в песочнице; сборка/тесты от него не зависят,
  владельцу — `npm install` при случае.)*
- **[5.R2-9] PDF — надёжный текст + всегда картинки.** Таймауты на открытие
  документа и на каждый шаг текста/рендера (понятная ошибка вместо вечного
  «Извлекаю текст…»); `applyPdfSelection` в try/catch с сообщением в чате. Дефолт
  «прикладывать страницы картинками» включён (`withImages=true`) — текст + до 5
  страниц-картинок и для текстовых PDF. `workerSrc` из WAR (копируется в dist —
  проверено). Файлы: `src/content/pdf/{pdf-loader,pdf-attachments}.ts`.
- **[5.R2-10] Роли — авто-обновление + «Юрист».** Роль `compliance` переименована
  «Комплаенс» → «Юрист» с юридическим systemPrompt; смена роли сразу пересобирает
  предпросмотр тела (как смена режима); `sendQuestion` безусловно делает
  `refreshContext` перед отправкой. Файлы: `src/shared/roles.ts`,
  `src/content/panel/{panel,chat}.ts`.
- **[5.R2-11] Режимы контекста — пояснения и упрощение.** Каждому режиму добавлен
  hint → тултип (`title`) и aria-label. Набор упрощён до «Вся страница» (по
  умолчанию) и «Выделение»; «Видимое»/«Таблицы» убраны из UI (экспорт таблиц —
  отдельная кнопка). `ScopeId` сохраняет старые значения для совместимости логики.
  Файлы: `src/content/state.ts`, `src/content/panel/panel.ts`.

- **Проверка:** `tsc --noEmit` чист; `vitest run` — **176/176** (21 файл: −2
  office-теста, +1 `xlsx-write`); `npm run build` собирает `dist/firefox` и
  `dist/chrome` без exceljs/mammoth, `pdf.worker.min.mjs` присутствует в обоих
  dist. Браузерная проверка (читаемость светлой темы, связность диалога с
  историей, экспорт .xlsx, схлопывание баров, порядок вложений в пузыре,
  стабильность PDF с текстом+картинками, мгновенный предпросмотр при смене
  роли/режима) — за владельцем, как в Phase 1–4.

## Хотфикс-блок Phase 5 — раунд 3 (5.R3-1 … 5.R3-6)

Найдено при ручной проверке после раунда 2; план — в `docs/step by step.md`
(блок между 5.3 и 5.4). Один пункт = один коммит `fix(phase5): 5.R3-N …`.

- **[5.R3-1] Читаемость ошибки в чате и кнопки «Остановить».** Светлая тема:
  override'ы `.tne-error-card` (тёмно-красный `#b91c1c` на светло-красном фоне с
  читаемым бордером) и `.tne-stop-button` (заметная подложка + тёмный текст).
  Базовая `.tne-stop-button` усилена (плотнее фон/бордер, `font-weight:700`) —
  видна и в тёмной теме. Файл: `src/content/panel/panel.css`.
- **[5.R3-2] Метки-источники — кликабельны только локализуемые.** `build-context`
  кладёт `blockMap["MAIN CONTENT"]` = source-элемент и `blockMap["SELECTED"]` =
  контейнер выделения (новый `getSelectionElement` в `text-extract`). В
  `source-links` убран `[PAGE]` из распознавания (метаданные не подсвечиваются);
  `<span class=tne-source-link>` создаётся только для блоков, реально присутствующих
  в `blockMap` на момент рендера — остальные метки остаются обычным текстом. Нет
  «мёртвых» ссылок/тостов «не найден» при ответе только по картинке/PDF. Тест
  `source-links` обновлён (PAGE не распознаётся). Файлы:
  `src/content/context/{build-context,text-extract}.ts`,
  `src/content/render/source-links.ts`, `tests/content/render/source-links.test.ts`.
- **[5.R3-3] Блоки предпросмотра в один ряд.** Две `<details>` обёрнуты в
  `.tne-context-previews` (`flex`, `gap`, `flex-wrap`); закрытые `<summary>` стоят
  в одну строку, открытый `details` получает `flex: 1 1 100%` → его `<pre>`
  разворачивается во всю ширину под рядом кнопок. Файлы:
  `src/content/panel/panel.ts`, `panel.css`.
- **[5.R3-4] Понятные названия режимов.** `SCOPES`: «Выделение» → «Только
  выделенное» с тултипом «Отвечаю строго по выделенному…»; «Вся страница» — тултип
  «Беру весь значимый текст страницы…». Под рядом режимов добавлена короткая подпись
  `.tne-scope-hint` (+override светлой темы). Файлы: `src/content/state.ts`,
  `src/content/panel/{panel.ts,panel.css}`.
- **[5.R3-5] Просмотр приложенного изображения на весь экран.** Новый модуль
  `panel/lightbox.ts`: оверлей в shadow root панели, закрытие по клику по фону,
  кнопке-крестику и `Esc`, возврат фокуса на источник. Клик по превью в пузыре
  (`.tne-bubble-thumb`) и по чипу в ленте вложений (`.tne-attachment-thumb`)
  открывает картинку целиком (`object-fit: contain`). Файлы:
  `src/content/panel/lightbox.ts` (new), `panel/chat.ts`, `vision/attachments.ts`,
  `panel.css`.
- **[5.R3-6] Автопроверка соединения (LLM + Vision) и статус-строка.** При открытии
  настроек после загрузки автоматически пингуем основной и (если задан) vision
  endpoint через `TNE_DIAG_PING` и показываем статус-пилюли с цветовой индикацией
  (доступен / ошибка / не задан). Форма не блокируется (fire-and-forget). Ручная
  перепроверка сохранена и синхронизирует пилюли. Файлы: `src/options/options.ts`,
  `options.html`, `options.css`.

- **Проверка:** `tsc --noEmit` чист; `vitest run` — **176/176** (21 файл);
  `npm run build` собирает `dist/firefox` и `dist/chrome` (257 модулей,
  +`lightbox`), `pdf.worker.min.mjs` присутствует в обоих dist. Браузерная проверка
  (читаемость ошибки/кнопки «Остановить» в обеих темах; клик по `[MAIN CONTENT]`
  подсвечивает текст, `[PAGE]` не кликается, нет «мёртвых» ссылок при ответе по
  картинке; ряд предпросмотра; понятность режимов; lightbox по превью/чипу и закрытие
  по фону/Esc; автостатус соединения в настройках) — за владельцем, как в Phase 1–4.
