/**
 * Каркас панели: host + shadow root, разметка UI, переключение, blocked-состояние,
 * scope-переключатели, хоткеи. CSS инлайнится в shadow root через `?inline`
 * (дизайн §4: уходим от web_accessible_resources для CSS).
 *
 * Перенесено из `content.js` на M3. DOM → без юнит-тестов (§6).
 */
import { browser } from "../../shared/browser";
import panelCss from "./panel.css?inline";
import hljsCss from "highlight.js/styles/github-dark.css?inline";
import {
  STATE,
  TNE_HOST_ID,
  PANEL_ROOT_ID,
  SCOPES,
  $,
  type ScopeId,
} from "../state";
import { readSettings, writeSettings } from "../../shared/settings";
import { ROLE_PRESETS, DEFAULT_ROLE_ID } from "../../shared/roles";
import { isHostAllowed } from "../../shared/whitelist";
import { escapeHtml } from "../../shared/text";
import {
  LOGO_IMG,
  SEND_ICON,
  ERASER_ICON,
  GEAR_ICON,
  CLOSE_ICON,
  FONT_ICON,
  THEME_ICON,
  CAMERA_ICON,
  REGION_ICON,
  ATTACH_ICON,
  EXPORT_ICON,
  TABLE_EXPORT_ICON,
  ROLE_ICON,
  CARET_ICON,
} from "./icons";
import { initFontControls, initThemeControl, initResizeHandle, toggleTheme } from "./controls";
import { initSettingsMenu, isSettingsMenuOpen, closeSettingsMenu } from "./settings-menu";
import { renderWelcomeMessage, clearChat, sendQuestion, addAssistantMessage } from "./chat";
import { exportDialog } from "../chat/export-md";
import { initAttachments } from "../vision/attachments";
import { initPdf, setDetectedTabPdf } from "../pdf/pdf-attachments";
import { initOffice } from "../office/office";
import { refreshContext, updatePayloadPreview } from "../context/refresh";
import { startUrlWatcher, startDomWatcher } from "../spa-keeper";
import { getSafeSelection } from "../context/text-extract";
import { highlightBlock } from "../render/source-highlight";
import {
  resolveSlashCommand,
  matchSlashCommands,
  type SlashCommand,
} from "../chat/slash-commands";
import { initPromptPanel } from "./prompt-panel";
import { HELP_ICON } from "../onboarding/icons";
import { maybeStartOnboarding, startWelcome } from "../onboarding";

/** Основной веб-ассистент (доработки п. 1). UTM-метку сохраняем как есть. */
const TNE_CHAT_URL = "https://tne-chat.tne.tn.corp?utm_source=TneBrowsePlugin";

async function computeAllowed(): Promise<boolean> {
  const settings = await readSettings();
  return isHostAllowed(location.hostname || "", settings);
}

export async function togglePanel(): Promise<void> {
  ensureHost();

  // Пересчитываем при каждом открытии — настройки доступа могли измениться.
  if (!STATE.opened) STATE.allowed = await computeAllowed();

  if (!STATE.allowed) {
    renderBlockedPanel();
    STATE.opened = !STATE.opened;
    STATE.panel?.classList.toggle("tne-page-chat-root--open", STATE.opened);
    return;
  }

  STATE.opened = !STATE.opened;
  STATE.panel?.classList.toggle("tne-page-chat-root--open", STATE.opened);

  if (STATE.opened) {
    startUrlWatcher();
    startDomWatcher();
    refreshContext(false, "manual-open");
    if (!STATE.pdf && /\.pdf($|[?#])/i.test(location.href)) {
      setDetectedTabPdf(location.href);
    }
    const input = $("#tne-chat-input");
    setTimeout(() => input?.focus(), 80);
    void maybeStartOnboarding();
  }
}

// Открыть панель и задать вопрос с переданным промптом по выделению.
// Базис для хоткея «спросить по выделению» и действий по выделению (4.4).
// Замечание 6: режим «Только выделенное» убран из UI — используем scope "all",
// выделение всё равно приходит приоритетным блоком [SELECTED] (build-context:64).
export async function askWithSelectionPrompt(prompt: string): Promise<void> {
  ensureHost();
  STATE.allowed = await computeAllowed();

  if (!STATE.allowed) {
    renderBlockedPanel();
    STATE.opened = true;
    STATE.panel?.classList.add("tne-page-chat-root--open");
    return;
  }

  if (!STATE.opened) {
    STATE.opened = true;
    STATE.panel?.classList.add("tne-page-chat-root--open");
    startUrlWatcher();
    startDomWatcher();
  }

  setScope("all");
  await refreshContext(false, "ask-selection");

  const input = $("#tne-chat-input") as HTMLTextAreaElement | null;
  const selection = STATE.page?.selection || getSafeSelection();
  if (!selection) {
    addAssistantMessage("Выделите фрагмент на странице и повторите — отвечу строго по выделению.", { light: true });
    setTimeout(() => input?.focus(), 80);
    return;
  }

  if (input && !input.value.trim()) input.value = prompt;
  sendQuestion();
}

// Хоткей «спросить по выделению» (1.15) — действие по умолчанию «объяснить».
export async function askBySelection(): Promise<void> {
  return askWithSelectionPrompt("Объясни выделенный фрагмент");
}

function ensureHost(): HTMLElement {
  let host = document.getElementById(TNE_HOST_ID);
  if (host && STATE.shadow) return host;

  host = document.createElement("div");
  host.id = TNE_HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  STATE.shadow = shadow;

  // CSS инлайнится в shadow root (без <link>/web_accessible_resources).
  const panelStyle = document.createElement("style");
  panelStyle.textContent = panelCss;
  const themeStyle = document.createElement("style");
  themeStyle.textContent = hljsCss;

  const root = document.createElement("div");
  root.id = PANEL_ROOT_ID;

  shadow.append(panelStyle, themeStyle, root);
  document.documentElement.appendChild(host);

  STATE.panel = root;
  buildPanelUI(root);
  return host;
}

function renderBlockedPanel(): void {
  const root = STATE.panel;
  if (!root) return;
  root.innerHTML = `
      <section class="tne-chat-panel" aria-label="ТНЭ чат по странице">
        <header class="tne-chat-header">
          <div class="tne-chat-brand">
            <div class="tne-chat-logo" title="ТНЭ чат">${LOGO_IMG}</div>
            <div class="tne-chat-heading">
              <div class="tne-chat-title">ТНЭ чат · Браузер</div>
              <div class="tne-chat-subtitle">Домен не разрешён</div>
            </div>
          </div>
          <div class="tne-chat-header-actions">
            <button class="tne-icon-button" id="tne-blocked-close" title="Закрыть" type="button" aria-label="Закрыть">${CLOSE_ICON}</button>
          </div>
        </header>
        <main class="tne-chat-messages">
          <div class="tne-assistant-card">
            <div class="tne-message-meta">ТНЭ чат</div>
            <div class="tne-message-content">
              Расширение не активно на домене <strong>${escapeHtml(location.hostname)}</strong>, потому что он не входит в список разрешённых.
              <br><br>Добавьте домен в whitelist или включите работу на внешних сайтах в настройках расширения.
            </div>
            <div class="tne-message-actions">
              <button id="tne-blocked-settings" type="button">Открыть настройки</button>
            </div>
          </div>
        </main>
      </section>
    `;
  root.querySelector("#tne-blocked-close")?.addEventListener("click", () => togglePanel());
  root.querySelector("#tne-blocked-settings")?.addEventListener("click", () => browser.runtime.sendMessage({ type: "TNE_OPEN_OPTIONS" }));
}

interface SlashMenuController {
  isOpen(): boolean;
  update(): void;
  move(dir: number): void;
  confirm(): void;
  close(): void;
}

function createSlashMenu(root: HTMLElement, input: HTMLTextAreaElement): SlashMenuController {
  const menu = root.querySelector("#tne-slash-menu") as HTMLElement;
  let matches: SlashCommand[] = [];
  let active = 0;

  function render(): void {
    menu.innerHTML = "";
    matches.forEach((cmd, i) => {
      const item = document.createElement("div");
      item.className = "tne-slash-item" + (i === active ? " tne-slash-item--active" : "");
      item.setAttribute("role", "option");
      const name = document.createElement("span");
      name.className = "tne-slash-name";
      name.textContent = cmd.name;
      const hint = document.createElement("span");
      hint.className = "tne-slash-hint";
      hint.textContent = cmd.hint;
      item.append(name, hint);
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        active = i;
        confirm();
      });
      menu.appendChild(item);
    });
    menu.hidden = matches.length === 0;
    // Замечание 4: держим активный пункт во вьюпорте при листании стрелками.
    (menu.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }

  function update(): void {
    matches = matchSlashCommands(input.value);
    if (active >= matches.length) active = 0;
    render();
  }

  function move(dir: number): void {
    if (!matches.length) return;
    active = (active + dir + matches.length) % matches.length;
    render();
  }

  function confirm(): void {
    const cmd = matches[active];
    if (cmd) {
      const resolved = resolveSlashCommand(cmd.name);
      if (resolved) {
        input.value = resolved.prompt;
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
      }
    }
    close();
    input.focus();
  }

  function close(): void {
    matches = [];
    menu.hidden = true;
  }

  return {
    isOpen: () => !menu.hidden && matches.length > 0,
    update,
    move,
    confirm,
    close,
  };
}

function buildPanelUI(root: HTMLElement): void {
  root.innerHTML = `
      <section class="tne-chat-panel" aria-label="ТНЭ чат по странице">
        <header class="tne-chat-header">
          <div class="tne-chat-brand">
            <div class="tne-chat-logo" title="ТНЭ чат">${LOGO_IMG}</div>
            <div class="tne-chat-heading">
              <div class="tne-chat-title">ТНЭ чат · Браузер</div>
              <div class="tne-chat-subtitle">Анализ текущей страницы</div>
              <a class="tne-chat-link" id="tne-chat-link" href="${TNE_CHAT_URL}" target="_blank" rel="noopener" title="ТНЭ-чат — ИИ-ассистент">Открыть ТНЭ-чат →</a>
            </div>
          </div>
          <div class="tne-chat-header-actions">
            <button class="tne-icon-button" id="tne-chat-clear" title="Очистить чат" type="button" aria-label="Очистить чат">${ERASER_ICON}</button>
            <button class="tne-icon-button" id="tne-chat-menu" title="Меню" type="button" aria-label="Меню настроек" aria-haspopup="true" aria-expanded="false">${GEAR_ICON}</button>
            <button class="tne-icon-button" id="tne-chat-close" title="Закрыть (Esc)" type="button" aria-label="Закрыть">${CLOSE_ICON}</button>
            <div class="tne-settings-menu" id="tne-settings-menu" role="menu" aria-label="Меню настроек">
              <div class="tne-menu-item tne-menu-item--control" role="group" aria-label="Собеседник">
                <span class="tne-menu-ic">${ROLE_ICON}</span>
                <span class="tne-menu-label">Собеседник</span>
                <select class="tne-role-select" id="tne-role-select" title="Роль ассистента" aria-label="Роль ассистента"></select>
              </div>
              <div class="tne-menu-item tne-menu-item--control" id="tne-font-menu-wrap" role="group" aria-label="Размер текста">
                <span class="tne-menu-ic">${FONT_ICON}</span>
                <span class="tne-menu-label">Размер текста</span>
                <span class="tne-menu-stepper">
                  <button id="tne-font-minus" type="button" title="Уменьшить текст">−</button>
                  <span id="tne-font-size-label">12</span>
                  <button id="tne-font-plus" type="button" title="Увеличить текст">+</button>
                </span>
              </div>
              <button class="tne-menu-item" id="tne-theme-toggle" role="menuitem" type="button" title="Тема оформления">
                <span class="tne-menu-ic">${THEME_ICON}</span>
                <span class="tne-menu-label">Тема оформления</span>
              </button>
              <button class="tne-menu-item" id="tne-chat-export" role="menuitem" type="button" title="Экспортировать диалог в .md">
                <span class="tne-menu-ic">${EXPORT_ICON}</span>
                <span class="tne-menu-label">Скачать диалог</span>
              </button>
              <button class="tne-menu-item" id="tne-chat-help" role="menuitem" type="button" title="Обучение / помощь">
                <span class="tne-menu-ic">${HELP_ICON}</span>
                <span class="tne-menu-label">Обучение</span>
              </button>
              <button class="tne-menu-item" id="tne-chat-settings" role="menuitem" type="button" title="Настройки расширения">
                <span class="tne-menu-ic">${GEAR_ICON}</span>
                <span class="tne-menu-label">Настройки расширения</span>
              </button>
            </div>
          </div>
        </header>

        <section class="tne-context-card" aria-label="Контекст страницы">
          <div class="tne-scope-row" id="tne-scope-row"></div>
          <div class="tne-scope-hint" id="tne-scope-hint"></div>
          <details class="tne-context-collapse">
            <summary class="tne-context-top">
              <div class="tne-context-main">
                <div class="tne-context-label">Контекст страницы</div>
                <div class="tne-context-title" id="tne-page-title">Подготовка контекста…</div>
                <div class="tne-context-meta" id="tne-context-meta">—</div>
              </div>
              <span class="tne-context-caret" aria-hidden="true">${CARET_ICON}</span>
            </summary>
            <div class="tne-context-body">
              <div class="tne-context-previews">
                <details class="tne-context-details">
                  <summary>Показать извлечённый текст</summary>
                  <pre id="tne-context-preview"></pre>
                </details>
                <details class="tne-context-details" id="tne-payload-details">
                  <summary>Показать, что уйдёт в модель (без токена)</summary>
                  <pre id="tne-payload-preview">Откройте этот блок, чтобы собрать тело запроса…</pre>
                </details>
              </div>
            </div>
          </details>
        </section>

        <div class="tne-warning-bar" id="tne-warning-bar" hidden>
          <div class="tne-warning-text" id="tne-warning-text"></div>
          <div class="tne-warning-actions">
            <button id="tne-warning-send" type="button">Отправить всё равно</button>
            <button id="tne-warning-cancel" type="button">Отмена</button>
          </div>
        </div>

        <main class="tne-chat-messages elegant-scroll" id="tne-chat-messages"></main>

        <div class="tne-prompt-panel" id="tne-quick-actions"></div>

        <div class="tne-attach-bar">
          <div class="tne-pdf-bar" id="tne-pdf-bar" hidden></div>
          <div class="tne-tables-bar" id="tne-tables-bar" hidden></div>
          <div class="tne-attachments" id="tne-attachments" hidden></div>
          <div class="tne-attach-buttons">
            <button class="tne-attach-button" id="tne-attach-screen" type="button" title="Снимок видимой области" aria-label="Снимок видимой области">${CAMERA_ICON}</button>
            <button class="tne-attach-button" id="tne-attach-region" type="button" title="Снимок области рамкой" aria-label="Снимок области рамкой">${REGION_ICON}</button>
            <button class="tne-attach-button" id="tne-attach-file" type="button" title="Приложить изображение или PDF" aria-label="Приложить изображение или PDF">${ATTACH_ICON}</button>
            <button class="tne-attach-button" id="tne-tables-export" type="button" title="Экспорт таблиц страницы в Excel" aria-label="Экспорт таблиц в Excel">${TABLE_EXPORT_ICON}</button>
            <input id="tne-attach-input" type="file" accept="image/*,application/pdf" multiple hidden />
          </div>
        </div>

        <div class="tne-slash-menu" id="tne-slash-menu" role="listbox" hidden></div>

        <footer class="tne-chat-footer">
          <textarea id="tne-chat-input" rows="1" placeholder="Спросите по содержимому страницы (Ctrl+Enter — отправить)"></textarea>
          <button id="tne-chat-send" class="tne-send-button" type="button" title="Отправить" aria-label="Отправить">${SEND_ICON}</button>
        </footer>

        <div class="tne-resize-handle" id="tne-resize-handle" title="Потяните, чтобы изменить ширину" aria-hidden="true"></div>
      </section>
    `;

  initFontControls(root);
  initThemeControl(root);
  initResizeHandle(root);
  buildScopeRow(root);
  void initRoleSelect(root);
  initAttachments(root);
  initPdf();
  initOffice(root);
  initSettingsMenu(root);

  root.querySelector("#tne-chat-close")?.addEventListener("click", () => togglePanel());
  root.querySelector("#tne-chat-help")?.addEventListener("click", () => startWelcome());
  root.querySelector("#tne-theme-toggle")?.addEventListener("click", () => toggleTheme());
  root.querySelector("#tne-chat-settings")?.addEventListener("click", () => browser.runtime.sendMessage({ type: "TNE_OPEN_OPTIONS" }));
  root.querySelector("#tne-chat-export")?.addEventListener("click", () => exportDialog());
  root.querySelector("#tne-chat-clear")?.addEventListener("click", () => clearChat());

  // Ссылка на основной веб-ассистент (п. 1). href даёт нативное открытие (в т.ч.
  // средней кнопкой), а клик роутим через background — надёжнее из shadow root
  // content-script в закрытой сети (TNE_OPEN_URL → browser.tabs.create).
  root.querySelector("#tne-chat-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    void browser.runtime.sendMessage({ type: "TNE_OPEN_URL", url: TNE_CHAT_URL });
  });
  root.querySelector("#tne-chat-send")?.addEventListener("click", () => sendQuestion());

  const payloadDetails = root.querySelector("#tne-payload-details") as HTMLDetailsElement | null;
  payloadDetails?.addEventListener("toggle", () => {
    if (payloadDetails.open) updatePayloadPreview();
  });

  const input = root.querySelector("#tne-chat-input") as HTMLTextAreaElement;
  const slash = createSlashMenu(root, input);

  input.addEventListener("keydown", (event) => {
    if (slash.isOpen()) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        slash.move(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        slash.move(-1);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        slash.confirm();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        slash.close();
        return;
      }
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendQuestion();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendQuestion();
    }
  });

  // Esc — сначала закрыть открытое меню настроек, потом панель (п. 2). Во время
  // тура меню под замком: тур перехватывает Esc раньше (stopPropagation), сюда
  // событие не доходит.
  STATE.shadow?.addEventListener("keydown", (event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== "Escape" || !STATE.opened) return;
    if (isSettingsMenuOpen()) {
      keyEvent.preventDefault();
      closeSettingsMenu();
      return;
    }
    keyEvent.preventDefault();
    togglePanel();
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    slash.update();
  });

  // Замечание 5: единая редактируемая панель готовых промптов (хранится в
  // storage.local, синхронна с настройками через storage.onChanged).
  void initPromptPanel(root);

  renderWelcomeMessage();

  const messagesEl = root.querySelector("#tne-chat-messages");
  messagesEl?.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement | null)?.closest?.(".tne-source-link") as HTMLElement | null;
    const id = link?.dataset.blockId;
    if (id) highlightBlock(id);
  });
  messagesEl?.addEventListener("keydown", (event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
    const link = (keyEvent.target as HTMLElement | null)?.closest?.(".tne-source-link") as HTMLElement | null;
    const id = link?.dataset.blockId;
    if (!id) return;
    keyEvent.preventDefault();
    highlightBlock(id);
  });
}

async function initRoleSelect(root: HTMLElement): Promise<void> {
  const select = root.querySelector("#tne-role-select") as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = "";
  for (const role of ROLE_PRESETS) {
    const opt = document.createElement("option");
    opt.value = role.id;
    opt.textContent = role.label;
    select.appendChild(opt);
  }
  const settings = await readSettings();
  select.value = settings.roleId || DEFAULT_ROLE_ID;
  select.addEventListener("change", () => {
    // 5.R2-10: пишем роль и СРАЗУ пересобираем предпросмотр тела (системная
    // добавка роли видна без ручного обновления). Скоуп это уже делает сам.
    void writeSettings({ roleId: select.value }).then(() => {
      const details = root.querySelector("#tne-payload-details") as HTMLDetailsElement | null;
      if (details?.open) void updatePayloadPreview();
    });
  });
}

function buildScopeRow(root: HTMLElement): void {
  const row = root.querySelector("#tne-scope-row");
  if (!row) return;
  SCOPES.forEach((scope) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tne-scope-button";
    button.dataset.scope = scope.id;
    button.textContent = scope.label;
    button.title = scope.hint; // 5.R2-11: пояснение режима тултипом
    button.setAttribute("aria-label", `${scope.label}: ${scope.hint}`);
    if (scope.id === STATE.scope) button.classList.add("tne-scope-button--active");
    button.addEventListener("click", () => {
      setScope(scope.id);
      refreshContext(false, "scope-change");
      const details = root.querySelector("#tne-payload-details") as HTMLDetailsElement | null;
      if (details?.open) updatePayloadPreview();
    });
    row.appendChild(button);
  });
  // Замечание 6: нормализуем возможный легаси-scope к "all" и заполняем подсказку.
  setScope(SCOPES.some((s) => s.id === STATE.scope) ? STATE.scope : "all");
}

function setScope(scopeId: ScopeId): void {
  STATE.scope = scopeId;
  const row = $("#tne-scope-row");
  row?.querySelectorAll<HTMLElement>(".tne-scope-button").forEach((b) =>
    b.classList.toggle("tne-scope-button--active", b.dataset.scope === scopeId)
  );
  // Замечание 6: подсказка под кнопками отражает активный режим.
  const hint = $("#tne-scope-hint");
  if (hint) hint.textContent = SCOPES.find((s) => s.id === scopeId)?.hint || "";

  // «Без контекста» (scope "none"): страницу не собираем — скрываем раскрывающийся
  // блок «Контекст страницы», оставляем только подпись-подсказку. «Вся страница» —
  // показываем блок.
  const collapse = $(".tne-context-collapse") as HTMLDetailsElement | null;
  if (collapse) {
    const hide = scopeId === "none";
    collapse.hidden = hide;
    if (hide) collapse.open = false;
  }

  // Пока чат пустой — приветствие должно отражать выбранный режим (без контекста
  // не обещаем разбор страницы). После начала диалога ленту не трогаем.
  if (STATE.history.length === 0 && $(".tne-assistant-card--welcome")) {
    renderWelcomeMessage();
  }
}
