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
