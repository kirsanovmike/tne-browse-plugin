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
  QUICK_ACTIONS,
  $,
  type ScopeId,
} from "../state";
import { readSettings } from "../../shared/settings";
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
} from "./icons";
import { initFontControls, initThemeControl, initResizeHandle, toggleTheme } from "./controls";
import { renderWelcomeMessage, clearChat, sendQuestion, addAssistantMessage } from "./chat";
import { refreshContext, updatePayloadPreview } from "../context/refresh";
import { startUrlWatcher, startDomWatcher } from "../spa-keeper";
import { getSafeSelection } from "../context/text-extract";

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
    const input = $("#tne-chat-input");
    setTimeout(() => input?.focus(), 80);
  }
}

// Хоткей «спросить по выделению»: открыть панель, режим «Выделение», задать вопрос.
export async function askBySelection(): Promise<void> {
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

  setScope("selection");
  await refreshContext(false, "ask-selection");

  const input = $("#tne-chat-input") as HTMLTextAreaElement | null;
  const selection = STATE.page?.selection || getSafeSelection();
  if (!selection) {
    addAssistantMessage("Выделите фрагмент на странице и повторите — отвечу строго по выделению.", { light: true });
    setTimeout(() => input?.focus(), 80);
    return;
  }

  if (input && !input.value.trim()) input.value = "Объясни выделенный фрагмент";
  sendQuestion();
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

function buildPanelUI(root: HTMLElement): void {
  root.innerHTML = `
      <section class="tne-chat-panel" aria-label="ТНЭ чат по странице">
        <header class="tne-chat-header">
          <div class="tne-chat-brand">
            <div class="tne-chat-logo" title="ТНЭ чат">${LOGO_IMG}</div>
            <div class="tne-chat-heading">
              <div class="tne-chat-title">ТНЭ чат · Браузер</div>
              <div class="tne-chat-subtitle">Анализ текущей страницы</div>
            </div>
          </div>
          <div class="tne-chat-header-actions">
            <div class="tne-font-menu-wrap" id="tne-font-menu-wrap">
              <button class="tne-icon-button" id="tne-font-trigger" title="Размер текста" type="button" aria-label="Размер текста">${FONT_ICON}</button>
              <div class="tne-font-menu" id="tne-font-menu" aria-label="Размер текста">
                <button id="tne-font-minus" type="button" title="Уменьшить текст">−</button>
                <span id="tne-font-size-label">12</span>
                <button id="tne-font-plus" type="button" title="Увеличить текст">+</button>
              </div>
            </div>
            <button class="tne-icon-button" id="tne-theme-toggle" title="Тема оформления" type="button" aria-label="Сменить тему">${THEME_ICON}</button>
            <button class="tne-icon-button" id="tne-chat-clear" title="Очистить чат" type="button" aria-label="Очистить чат">${ERASER_ICON}</button>
            <button class="tne-icon-button" id="tne-chat-settings" title="Настройки" type="button" aria-label="Настройки">${GEAR_ICON}</button>
            <button class="tne-icon-button" id="tne-chat-close" title="Закрыть (Esc)" type="button" aria-label="Закрыть">${CLOSE_ICON}</button>
          </div>
        </header>

        <section class="tne-context-card" aria-label="Контекст страницы">
          <div class="tne-context-top">
            <div class="tne-context-main">
              <div class="tne-context-label">Контекст страницы</div>
              <div class="tne-context-title" id="tne-page-title">Подготовка контекста…</div>
              <div class="tne-context-meta" id="tne-context-meta">—</div>
            </div>
            <button class="tne-small-button" id="tne-refresh-context" type="button">Обновить</button>
          </div>
          <div class="tne-scope-row" id="tne-scope-row"></div>
          <details class="tne-context-details">
            <summary>Показать извлечённый текст</summary>
            <pre id="tne-context-preview"></pre>
          </details>
          <details class="tne-context-details" id="tne-payload-details">
            <summary>Показать, что уйдёт в модель (без токена)</summary>
            <pre id="tne-payload-preview">Откройте этот блок, чтобы собрать тело запроса…</pre>
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

        <div class="tne-quick-actions" id="tne-quick-actions"></div>

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

  root.querySelector("#tne-chat-close")?.addEventListener("click", () => togglePanel());
  root.querySelector("#tne-theme-toggle")?.addEventListener("click", () => toggleTheme());
  root.querySelector("#tne-chat-settings")?.addEventListener("click", () => browser.runtime.sendMessage({ type: "TNE_OPEN_OPTIONS" }));
  root.querySelector("#tne-chat-clear")?.addEventListener("click", () => clearChat());
  root.querySelector("#tne-refresh-context")?.addEventListener("click", () => refreshContext(true, "button"));
  root.querySelector("#tne-chat-send")?.addEventListener("click", () => sendQuestion());

  const payloadDetails = root.querySelector("#tne-payload-details") as HTMLDetailsElement | null;
  payloadDetails?.addEventListener("toggle", () => {
    if (payloadDetails.open) updatePayloadPreview();
  });

  const input = root.querySelector("#tne-chat-input") as HTMLTextAreaElement;
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendQuestion();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendQuestion();
    }
  });

  // Esc — закрыть панель (хоткей работает в пределах фокуса панели).
  STATE.shadow?.addEventListener("keydown", (event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== "Escape" || !STATE.opened) return;
    const wrap = root.querySelector("#tne-font-menu-wrap");
    if (wrap?.classList.contains("tne-font-menu-wrap--open")) {
      wrap.classList.remove("tne-font-menu-wrap--open");
      return;
    }
    keyEvent.preventDefault();
    togglePanel();
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  });

  const quick = root.querySelector("#tne-quick-actions");
  QUICK_ACTIONS.forEach((text) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", () => {
      input.value = text;
      sendQuestion();
    });
    quick?.appendChild(button);
  });

  renderWelcomeMessage();
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
    if (scope.id === STATE.scope) button.classList.add("tne-scope-button--active");
    button.addEventListener("click", () => {
      setScope(scope.id);
      refreshContext(false, "scope-change");
      const details = root.querySelector("#tne-payload-details") as HTMLDetailsElement | null;
      if (details?.open) updatePayloadPreview();
    });
    row.appendChild(button);
  });
}

function setScope(scopeId: ScopeId): void {
  STATE.scope = scopeId;
  const row = $("#tne-scope-row");
  row?.querySelectorAll<HTMLElement>(".tne-scope-button").forEach((b) =>
    b.classList.toggle("tne-scope-button--active", b.dataset.scope === scopeId)
  );
}
