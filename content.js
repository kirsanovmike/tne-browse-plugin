(() => {
  if (window.__TNE_PAGE_CHAT_LOADED__) return;
  window.__TNE_PAGE_CHAT_LOADED__ = true;

  const EXT_ROOT_ID = "tne-page-chat-root";
  const MAX_CONTEXT_HARD_LIMIT = 15000;

  const LOGO_SRC = browser.runtime.getURL("icons/icon128.png");
  const LOGO_IMG = `<img class="tne-logo-img" src="${LOGO_SRC}" alt="ТНЭ чат по странице" />`;

  const SEND_ICON = `
    <svg class="tne-send-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.8 20.2L21 12 3.8 3.8 5.5 10.4 13.2 12 5.5 13.6 3.8 20.2Z" fill="currentColor"/>
    </svg>`;

  const ERASER_ICON = `
    <svg class="tne-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M16.9 3.8a2.2 2.2 0 0 1 3.1 0l.2.2a2.2 2.2 0 0 1 0 3.1l-8.5 8.5a3 3 0 0 1-2.1.9H6.5l-3-3 9.4-9.7Z" fill="currentColor" opacity="0.92"/>
      <path d="M3 19.2h18v1.7H3v-1.7Z" fill="currentColor" opacity="0.65"/>
      <path d="M5.2 13.5l3.3 3.3" stroke="rgba(255,255,255,.62)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;

  const GEAR_ICON = `
    <svg class="tne-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 15.3A3.3 3.3 0 1 0 12 8.7a3.3 3.3 0 0 0 0 6.6Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M19.1 13.2c.1-.4.1-.8.1-1.2s0-.8-.1-1.2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2-1.2L14.4 3h-4.8l-.4 2.6a8 8 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5c-.1.4-.1.8-.1 1.2s0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2 1.2l.4 2.6h4.8l.4-2.6a8 8 0 0 0 2-1.2l2.4 1 2-3.5-2.1-1.5Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>
    </svg>`;

  const CLOSE_ICON = `
    <svg class="tne-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.7 6.7 17.3 17.3M17.3 6.7 6.7 17.3" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    </svg>`;

  const FONT_ICON = `
    <svg class="tne-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 19 9.1 5h2.3l5.1 14h-2.4l-1.1-3.2H7.4L6.3 19H4Zm4.1-5.1h4.2l-2.1-6-2.1 6Z" fill="currentColor"/>
      <path d="M16.6 19v-7.8h1.8v.9c.5-.7 1.2-1.1 2.1-1.1 1.5 0 2.5 1 2.5 2.8V19h-1.9v-4.8c0-1-.5-1.5-1.3-1.5s-1.4.6-1.4 1.6V19h-1.8Z" fill="currentColor" opacity="0.78"/>
    </svg>`;

  const FONT_SIZE_KEY = "panelFontSize";
  const MIN_PANEL_FONT_SIZE = 12;
  const MAX_PANEL_FONT_SIZE = 14;

  const STATE = {
    opened: false,
    page: null,
    history: [],
    isSending: false,
    lastUrl: location.href,
    urlWatchStarted: false,
    domWatchStarted: false,
    domObserver: null,
    domInputHandler: null,
    contextDirty: false,
    lastContextRefreshAt: 0,
    refreshTimer: null
  };

  const QUICK_ACTIONS = [
    "Сформируй краткое резюме",
    "Найди важные действия для пользователя"
  ];

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "TNE_TOGGLE_PANEL") togglePanel();
  });

  function togglePanel() {
    let root = document.getElementById(EXT_ROOT_ID);
    if (!root) root = createPanel();

    STATE.opened = !STATE.opened;
    root.classList.toggle("tne-page-chat-root--open", STATE.opened);
    if (STATE.opened) {
      startUrlWatcher();
      startDomWatcher();
      refreshContext(false, "manual-open");
      const input = root.querySelector("#tne-chat-input");
      setTimeout(() => input?.focus(), 80);
    }
  }

  function createPanel() {
    const root = document.createElement("div");
    root.id = EXT_ROOT_ID;
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
            <button class="tne-icon-button" id="tne-chat-clear" title="Очистить чат" type="button" aria-label="Очистить чат">${ERASER_ICON}</button>
            <button class="tne-icon-button" id="tne-chat-settings" title="Настройки" type="button" aria-label="Настройки">${GEAR_ICON}</button>
            <button class="tne-icon-button" id="tne-chat-close" title="Закрыть" type="button" aria-label="Закрыть">${CLOSE_ICON}</button>
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
          <details class="tne-context-details">
            <summary>Показать извлечённый текст</summary>
            <pre id="tne-context-preview"></pre>
          </details>
        </section>

        <main class="tne-chat-messages elegant-scroll" id="tne-chat-messages"></main>

        <div class="tne-quick-actions" id="tne-quick-actions"></div>

        <footer class="tne-chat-footer">
          <textarea id="tne-chat-input" rows="1" placeholder="Спросите по содержимому страницы"></textarea>
          <button id="tne-chat-send" class="tne-send-button" type="button" title="Отправить" aria-label="Отправить">${SEND_ICON}</button>
        </footer>
      </section>
    `;

    document.documentElement.appendChild(root);
    initFontControls(root);

    root.querySelector("#tne-chat-close").addEventListener("click", () => togglePanel());
    root.querySelector("#tne-chat-settings").addEventListener("click", () => browser.runtime.sendMessage({ type: "TNE_OPEN_OPTIONS" }));
    root.querySelector("#tne-chat-clear").addEventListener("click", () => clearChat());
    root.querySelector("#tne-refresh-context").addEventListener("click", () => refreshContext(true, "button"));
    root.querySelector("#tne-chat-send").addEventListener("click", () => sendQuestion());

    const input = root.querySelector("#tne-chat-input");
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendQuestion();
      }
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
      quick.appendChild(button);
    });

    renderWelcomeMessage();
    return root;
  }

  async function initFontControls(root) {
    const saved = await browser.storage.local.get([FONT_SIZE_KEY]);
    const initial = clampFontSize(saved[FONT_SIZE_KEY]);
    applyPanelFontSize(root, initial);

    const wrap = root.querySelector("#tne-font-menu-wrap");
    const trigger = root.querySelector("#tne-font-trigger");
    const minus = root.querySelector("#tne-font-minus");
    const plus = root.querySelector("#tne-font-plus");

    trigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      wrap?.classList.toggle("tne-font-menu-wrap--open");
    });

    minus?.addEventListener("click", () => changePanelFontSize(-1));
    plus?.addEventListener("click", () => changePanelFontSize(1));

    document.addEventListener("click", (event) => {
      if (!wrap || wrap.contains(event.target)) return;
      wrap.classList.remove("tne-font-menu-wrap--open");
    }, true);
  }

  function clampFontSize(value) {
    const numeric = Number(value) || MIN_PANEL_FONT_SIZE;
    return Math.max(MIN_PANEL_FONT_SIZE, Math.min(MAX_PANEL_FONT_SIZE, numeric));
  }

  function getCurrentPanelFontSize() {
    const root = document.getElementById(EXT_ROOT_ID);
    const raw = root?.style.getPropertyValue("--tne-content-font-size") || `${MIN_PANEL_FONT_SIZE}px`;
    return clampFontSize(parseInt(raw, 10));
  }

  async function changePanelFontSize(delta) {
    const root = document.getElementById(EXT_ROOT_ID);
    if (!root) return;
    const next = clampFontSize(getCurrentPanelFontSize() + delta);
    applyPanelFontSize(root, next);
    await browser.storage.local.set({ [FONT_SIZE_KEY]: next });
  }

  function applyPanelFontSize(root, size) {
    const value = clampFontSize(size);
    root.style.setProperty("--tne-content-font-size", `${value}px`);
    const label = root.querySelector("#tne-font-size-label");
    if (label) label.textContent = String(value);
  }

  function renderWelcomeMessage() {
    const messages = document.getElementById("tne-chat-messages");
    if (!messages) return;
    messages.innerHTML = "";
    const node = document.createElement("div");
    node.className = "tne-assistant-card tne-assistant-card--welcome";
    node.innerHTML = `
      <div class="tne-message-meta">ТНЭ чат · контекст страницы</div>
      <div class="tne-message-content">Я взял контекст текущей страницы. Спросите, что здесь важно, где что находится или что нужно сделать дальше.</div>
    `;
    messages.appendChild(node);
    scrollMessages();
  }

  function clearChat() {
    STATE.history = [];
    renderWelcomeMessage();
    const input = document.getElementById("tne-chat-input");
    if (input) {
      input.value = "";
      input.style.height = "auto";
      input.focus();
    }
  }

  function startUrlWatcher() {
    if (STATE.urlWatchStarted) return;
    STATE.urlWatchStarted = true;

    const refreshIfUrlChanged = () => {
      if (location.href === STATE.lastUrl) return;
      STATE.lastUrl = location.href;
      STATE.page = null;
      if (STATE.opened) scheduleContextRefresh("url-change");
    };

    const patchHistoryMethod = (name) => {
      const original = history[name];
      if (typeof original !== "function" || original.__tnePatched) return;
      const patched = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        window.setTimeout(refreshIfUrlChanged, 0);
        return result;
      };
      patched.__tnePatched = true;
      history[name] = patched;
    };

    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");
    window.addEventListener("popstate", refreshIfUrlChanged);
    window.addEventListener("hashchange", refreshIfUrlChanged);
    window.setInterval(refreshIfUrlChanged, 800);
  }

  function scheduleContextRefresh(reason, delayMs = 300) {
    STATE.contextDirty = true;
    window.clearTimeout(STATE.refreshTimer);

    const elapsed = Date.now() - STATE.lastContextRefreshAt;
    const throttleDelay = reason === "dom-change" && elapsed < 1400 ? 1400 - elapsed : 0;
    const delay = Math.max(delayMs, throttleDelay);

    STATE.refreshTimer = window.setTimeout(() => {
      if (!STATE.opened) return;
      refreshContext(false, reason);
    }, delay);
  }

  function startDomWatcher() {
    if (STATE.domWatchStarted) return;
    const target = document.body || document.documentElement;
    if (!target || typeof MutationObserver === "undefined") return;

    STATE.domWatchStarted = true;

    const markDirty = (reason = "dom-change") => {
      if (!STATE.opened || STATE.isSending) return;
      scheduleContextRefresh(reason, 850);
    };

    const isMeaningfulMutation = (mutation) => {
      if (isInsideExtension(mutation.target)) return false;

      if (mutation.type === "characterData") {
        const parent = mutation.target?.parentElement;
        return Boolean(parent && isReadableElement(parent) && !isInsideExtension(parent));
      }

      if (mutation.type === "childList") {
        const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
        return nodes.some((node) => {
          if (isInsideExtension(node)) return false;
          if (node.nodeType === Node.TEXT_NODE) return isUsefulText(normalizeText(node.nodeValue || ""));
          if (node.nodeType !== Node.ELEMENT_NODE) return false;
          const tag = node.tagName?.toLowerCase?.() || "";
          if (["script", "style", "noscript", "template", "svg", "canvas"].includes(tag)) return false;
          return true;
        });
      }

      if (mutation.type === "attributes") {
        const attr = mutation.attributeName || "";
        if (!["value", "placeholder", "title", "aria-label", "aria-labelledby", "class", "style", "hidden", "aria-hidden"].includes(attr)) return false;
        const el = toElement(mutation.target);
        return Boolean(el && !isInsideExtension(el));
      }

      return false;
    };

    STATE.domObserver = new MutationObserver((mutations) => {
      if (mutations.some(isMeaningfulMutation)) markDirty("dom-change");
    });

    STATE.domObserver.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["value", "placeholder", "title", "aria-label", "aria-labelledby", "class", "style", "hidden", "aria-hidden"]
    });

    STATE.domInputHandler = (event) => {
      if (isInsideExtension(event.target)) return;
      markDirty("form-change");
    };

    document.addEventListener("input", STATE.domInputHandler, true);
    document.addEventListener("change", STATE.domInputHandler, true);
    window.addEventListener("load", () => markDirty("window-load"));
  }

  async function refreshContext(showToast = false, reason = "manual") {
    const root = document.getElementById(EXT_ROOT_ID);
    if (!root) return null;

    const settings = await browser.storage.local.get(["maxContextChars"]);
    const requestedMax = Number(settings.maxContextChars) || MAX_CONTEXT_HARD_LIMIT;
    const maxChars = Math.min(requestedMax, MAX_CONTEXT_HARD_LIMIT);
    STATE.page = extractPageContext(maxChars);
    STATE.contextDirty = false;
    STATE.lastContextRefreshAt = Date.now();

    const titleNode = root.querySelector("#tne-page-title");
    const metaNode = root.querySelector("#tne-context-meta");
    const previewNode = root.querySelector("#tne-context-preview");

    if (titleNode) titleNode.textContent = STATE.page.title || "Без заголовка";
    if (metaNode) {
      const reasonText = reason === "url-change"
        ? " · обновлено после перехода"
        : ["dom-change", "form-change", "window-load"].includes(reason)
          ? " · автообновлено"
          : reason === "before-send"
            ? " · обновлено перед запросом"
            : "";
      metaNode.textContent = `${STATE.page.text.length.toLocaleString("ru-RU")} символов${reasonText}`;
      metaNode.title = STATE.page.url;
    }
    if (previewNode) previewNode.textContent = STATE.page.text || "Не удалось извлечь текст страницы.";

    if (showToast) addAssistantMessage("Контекст страницы обновлён.", { light: true });
    return STATE.page;
  }

  async function sendQuestion() {
    const root = document.getElementById(EXT_ROOT_ID);
    if (!root || STATE.isSending) return;

    const input = root.querySelector("#tne-chat-input");
    const question = input.value.trim();
    if (!question) return;

    await refreshContext(false, "before-send");

    input.value = "";
    input.style.height = "auto";
    addUserMessage(question);
    const loaderId = addLoader();
    setSending(true);

    try {
      const response = await browser.runtime.sendMessage({
        type: "TNE_ASK_MODEL",
        payload: {
          question,
          page: STATE.page,
          history: STATE.history.slice(-6)
        }
      });

      removeLoader(loaderId);

      if (!response?.ok) {
        addErrorMessage(response?.error || "Не удалось получить ответ от модели.");
        return;
      }

      const answer = response.data?.content || "Пустой ответ модели.";
      STATE.history.push({ role: "user", content: question }, { role: "assistant", content: answer });
      addAssistantMessage(answer, { latencyMs: response.data?.latencyMs });
    } catch (error) {
      removeLoader(loaderId);
      addErrorMessage(error?.message || String(error));
    } finally {
      setSending(false);
    }
  }

  function setSending(value) {
    STATE.isSending = value;
    const root = document.getElementById(EXT_ROOT_ID);
    const send = root?.querySelector("#tne-chat-send");
    if (send) {
      send.disabled = value;
      send.classList.toggle("tne-send-button--loading", value);
      send.innerHTML = value ? `<span class="tne-spinner" aria-hidden="true"></span>` : SEND_ICON;
    }
  }

  function addUserMessage(text) {
    const messages = document.getElementById("tne-chat-messages");
    const node = document.createElement("div");
    node.className = "tne-user-bubble";
    node.textContent = text;
    messages.appendChild(node);
    scrollMessages();
  }

  function addAssistantMessage(text, options = {}) {
    const messages = document.getElementById("tne-chat-messages");
    const node = document.createElement("div");
    node.className = options.light ? "tne-assistant-card tne-assistant-card--light" : "tne-assistant-card";

    const meta = document.createElement("div");
    meta.className = "tne-message-meta";
    const seconds = Number(options.latencyMs) ? `${(Number(options.latencyMs) / 1000).toFixed(1)} c` : "";
    meta.textContent = seconds ? `ТНЭ чат · ${seconds}` : "ТНЭ чат";

    const body = document.createElement("div");
    body.className = "tne-message-content";
    body.innerHTML = renderMarkdownLite(text);

    const actions = document.createElement("div");
    actions.className = "tne-message-actions";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Копировать";
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(text);
      copy.textContent = "Скопировано";
      setTimeout(() => (copy.textContent = "Копировать"), 1200);
    });
    actions.appendChild(copy);

    node.append(meta, body, actions);
    messages.appendChild(node);
    scrollMessages();
  }

  function addErrorMessage(text) {
    const messages = document.getElementById("tne-chat-messages");
    const node = document.createElement("div");
    node.className = "tne-error-card";
    node.textContent = `Ошибка: ${text}`;
    messages.appendChild(node);
    scrollMessages();
  }

  function addLoader() {
    const id = `tne-loader-${Date.now()}`;
    const messages = document.getElementById("tne-chat-messages");
    const node = document.createElement("div");
    node.id = id;
    node.className = "tne-assistant-card tne-loader-card";
    node.innerHTML = `<div class="tne-message-meta">ТНЭ чат</div><div class="tne-dots"><span></span><span></span><span></span></div>`;
    messages.appendChild(node);
    scrollMessages();
    return id;
  }

  function removeLoader(id) {
    document.getElementById(id)?.remove();
  }

  function scrollMessages() {
    const messages = document.getElementById("tne-chat-messages");
    if (messages) messages.scrollTop = messages.scrollHeight;
  }

  function extractPageContext(maxChars) {
    const selection = getSafeSelection();
    const title = getPageTitle();
    const metaDescription = document.querySelector("meta[name='description']")?.content || "";
    const source = findBestContentSource();

    const headings = collectHeadings(source).slice(0, 30);
    const mainText = removeDuplicateLines(readableFromElement(source, { skipLayout: true }));
    const modalText = collectSpecialBlocks(
      "Модальные окна и всплывающие панели",
      "dialog, [role='dialog'], [aria-modal='true'], .modal, .popup, .v-dialog, .v-overlay__content, .ant-modal, .el-dialog, .MuiDialog-root, .modal-content"
    );
    const formsText = collectFormsText(source);
    const interactiveText = collectInteractiveText();

    const blocks = [
      title ? `Название страницы: ${title}` : "",
      metaDescription ? `Описание страницы: ${normalizeText(metaDescription)}` : "",
      `URL страницы: ${location.href}`,
      selection ? `Выделенный пользователем текст: ${selection}` : "",
      headings.length ? `Заголовки страницы: ${headings.join(" | ")}` : "",
      mainText ? `Основное содержимое:\n${mainText}` : "",
      modalText,
      formsText,
      interactiveText
    ].filter(Boolean);

    const text = smartTrim(removeDuplicateLines(blocks.join("\n\n")), maxChars);

    return {
      title,
      url: location.href,
      selection: selection ? smartTrim(selection, 4000) : "",
      text
    };
  }

  function getSafeSelection() {
    const selection = window.getSelection?.();
    if (!selection || !selection.rangeCount) return "";

    const anchorElement = toElement(selection.anchorNode);
    const focusElement = toElement(selection.focusNode);
    if (anchorElement?.closest?.(`#${EXT_ROOT_ID}`) || focusElement?.closest?.(`#${EXT_ROOT_ID}`)) return "";

    return normalizeText(String(selection).slice(0, 6000));
  }

  function getPageTitle() {
    const visibleH1 = [...document.querySelectorAll("h1")]
      .find((el) => isReadableElement(el) && !isInsideExtension(el));
    return normalizeText(document.title || visibleH1?.innerText || visibleH1?.textContent || "");
  }

  function findBestContentSource() {
    const selectors = [
      "main", "article", "[role='main']", "#content", ".content", "#main", ".main",
      ".page-content", ".wiki-content", ".markdown-body", ".document", ".article", "#app"
    ];

    const candidates = selectors
      .flatMap((selector) => [...document.querySelectorAll(selector)])
      .filter((el) => isReadableElement(el) && !isInsideExtension(el));

    let best = document.body;
    let bestScore = scoreElement(document.body);

    for (const candidate of candidates) {
      const score = scoreElement(candidate);
      if (score > bestScore * 0.55 && score > 250) {
        best = candidate;
        bestScore = score;
      }
    }

    return best || document.body || document.documentElement;
  }

  function scoreElement(el) {
    const text = readableFromElement(el, { skipLayout: true, maxLines: 900 });
    const structureBonus = el.querySelectorAll("h1,h2,h3,p,li,td,th,input,textarea,select,button").length * 45;
    return text.length + structureBonus;
  }

  function collectHeadings(root) {
    return [...root.querySelectorAll("h1,h2,h3")]
      .filter((h) => isReadableElement(h) && !isInsideExtension(h))
      .map((h) => normalizeText(h.innerText || h.textContent || ""))
      .filter(Boolean);
  }

  function collectSpecialBlocks(title, selector) {
    const lines = [];
    const seen = new Set();

    for (const el of document.querySelectorAll(selector)) {
      if (!isReadableElement(el) || isInsideExtension(el)) continue;
      const text = removeDuplicateLines(readableFromElement(el, { skipLayout: false }));
      if (!text || text.length < 5) continue;
      const key = text.slice(0, 300).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(text);
    }

    return lines.length ? `${title}:\n${lines.join("\n\n")}` : "";
  }

  function collectFormsText(root) {
    const formContainers = [
      ...root.querySelectorAll("form, [role='form'], .v-form"),
      ...document.querySelectorAll("form, [role='form'], .v-form")
    ].filter((el) => isReadableElement(el) && !isInsideExtension(el));

    const standaloneFields = [...document.querySelectorAll("input, textarea, select")]
      .filter((el) => isReadableElement(el) && !isInsideExtension(el) && !el.closest("form, [role='form'], .v-form"));

    const blocks = [];
    const seen = new Set();

    for (const form of formContainers) {
      const fields = collectFields(form);
      if (!fields.length) continue;
      const text = fields.join("\n");
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push(text);
    }

    const standaloneText = standaloneFields.map((el) => describeField(el)).filter(Boolean);
    if (standaloneText.length) blocks.push(standaloneText.join("\n"));

    if (!blocks.length) return "";
    return `Поля и формы страницы:\n${blocks.join("\n\n")}`;
  }

  function collectInteractiveText() {
    const selectors = [
      "[contenteditable='true']",
      "[role='textbox']",
      "[role='button']",
      "button",
      "[aria-label]",
      "[title]"
    ].join(",");

    const lines = [];
    const seen = new Set();

    for (const el of document.querySelectorAll(selectors)) {
      if (!isReadableElement(el) || isInsideExtension(el)) continue;
      const tag = el.tagName.toLowerCase();
      let text = "";

      if (tag === "button" || el.getAttribute("role") === "button") {
        text = normalizeText(el.innerText || el.textContent || el.getAttribute("aria-label") || el.title || "");
        if (text) text = `Кнопка: ${text}`;
      } else if (el.getAttribute("contenteditable") === "true" || el.getAttribute("role") === "textbox") {
        const label = normalizeText(el.getAttribute("aria-label") || el.title || "Редактируемый блок");
        const value = normalizeText(el.innerText || el.textContent || "");
        text = value ? `${label}: ${value}` : "";
      } else {
        const label = normalizeText(el.getAttribute("aria-label") || el.title || "");
        if (label && !["input", "textarea", "select"].includes(tag)) text = `Элемент интерфейса: ${label}`;
      }

      if (!text || text.length < 3) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(text);
      if (lines.length >= 80) break;
    }

    return lines.length ? `Видимые элементы интерфейса:\n${lines.join("\n")}` : "";
  }

  function readableFromElement(root, options = {}) {
    const lines = [];
    const limit = Number(options.maxLines) || 2500;

    walk(root, lines, options);

    return lines
      .map((line) => normalizeText(line))
      .filter(Boolean)
      .slice(0, limit)
      .join("\n");
  }

  function walk(node, lines, options) {
    if (!node || lines.length > (Number(options.maxLines) || 2500)) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (!parent || !isReadableElement(parent) || isInsideExtension(parent)) return;
      const text = normalizeText(node.nodeValue || "");
      if (isUsefulText(text)) lines.push(text);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node;
    if (!isReadableElement(el) || isInsideExtension(el)) return;

    const tag = el.tagName.toLowerCase();
    if (shouldSkipElement(el, options)) return;

    if (tag === "br") {
      lines.push("\n");
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      const text = normalizeText(el.innerText || el.textContent || "");
      if (text) lines.push(`## ${text}`);
      return;
    }

    if (tag === "li") {
      const text = normalizeText(el.innerText || el.textContent || "");
      if (text) lines.push(`- ${text}`);
      return;
    }

    if (tag === "tr") {
      const cells = [...el.children]
        .filter((child) => ["td", "th"].includes(child.tagName.toLowerCase()))
        .map((cell) => normalizeText(cell.innerText || cell.textContent || ""))
        .filter(Boolean);
      if (cells.length) lines.push(cells.join(" | "));
      return;
    }

    if (["input", "textarea", "select"].includes(tag)) {
      const field = describeField(el);
      if (field) lines.push(field);
      return;
    }

    if (tag === "button") {
      const text = normalizeText(el.innerText || el.textContent || el.getAttribute("aria-label") || el.title || "");
      if (text) lines.push(`Кнопка: ${text}`);
      return;
    }

    if (tag === "a") {
      const text = normalizeText(el.innerText || el.textContent || el.getAttribute("aria-label") || "");
      const href = el.getAttribute("href") || "";
      if (text && text.length > 1) {
        const url = href && !href.startsWith("#") ? ` — ${href}` : "";
        lines.push(`Ссылка: ${text}${url}`);
      }
      return;
    }

    if (tag === "img") {
      const alt = normalizeText(el.getAttribute("alt") || el.getAttribute("title") || "");
      if (alt) lines.push(`Изображение: ${alt}`);
      return;
    }

    for (const child of el.childNodes) walk(child, lines, options);
  }

  function collectFields(root) {
    return [...root.querySelectorAll("input, textarea, select")]
      .filter((el) => isReadableElement(el) && !isInsideExtension(el))
      .map((el) => describeField(el))
      .filter(Boolean);
  }

  function describeField(el) {
    const tag = el.tagName.toLowerCase();
    const type = String(el.getAttribute("type") || tag).toLowerCase();
    if (type === "hidden" || type === "submit" || type === "button") return "";

    const label = getFieldLabel(el);
    let value = "";

    if (type === "password") {
      value = el.value ? "[пароль скрыт]" : "";
    } else if (tag === "select") {
      value = [...el.selectedOptions].map((option) => normalizeText(option.textContent || option.value || "")).filter(Boolean).join(", ");
    } else if (type === "checkbox" || type === "radio") {
      value = el.checked ? "выбрано" : "не выбрано";
    } else {
      value = normalizeText(el.value || el.getAttribute("value") || "");
    }

    const placeholder = normalizeText(el.getAttribute("placeholder") || "");
    const state = value || (placeholder ? `плейсхолдер: ${placeholder}` : "пусто");
    return `Поле: ${label || type} — ${state}`;
  }

  function getFieldLabel(el) {
    const id = el.id;
    const explicit = id ? document.querySelector(`label[for="${cssEscape(id)}"]`) : null;
    const wrapping = el.closest("label");
    const ariaLabelledBy = el.getAttribute("aria-labelledby");
    const ariaLabel = normalizeText(el.getAttribute("aria-label") || "");
    const title = normalizeText(el.getAttribute("title") || "");
    const name = normalizeText(el.getAttribute("name") || el.id || "");

    if (explicit) return normalizeText(explicit.innerText || explicit.textContent || "");
    if (wrapping) return normalizeText(wrapping.innerText || wrapping.textContent || "");
    if (ariaLabelledBy) {
      const text = ariaLabelledBy
        .split(/\s+/)
        .map((ref) => document.getElementById(ref))
        .filter(Boolean)
        .map((node) => normalizeText(node.innerText || node.textContent || ""))
        .filter(Boolean)
        .join(" ");
      if (text) return text;
    }
    return ariaLabel || title || name;
  }

  function shouldSkipElement(el, options = {}) {
    const tag = el.tagName.toLowerCase();
    if (["script", "style", "noscript", "template", "svg", "canvas", "iframe", "object", "embed", "link", "meta"].includes(tag)) return true;

    if (options.skipLayout && ["nav", "footer", "aside"].includes(tag)) return true;

    const skipSelectors = [
      `#${EXT_ROOT_ID}`,
      "[hidden]",
      ".cookie", ".cookies", ".cookie-banner",
      ".advert", ".advertisement", ".ads", ".ad",
      ".breadcrumb"
    ];

    if (skipSelectors.some((selector) => el.matches?.(selector))) return true;
    return false;
  }

  function isReadableElement(el) {
    if (!el || !el.tagName || isInsideExtension(el)) return false;
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;

    try {
      const style = window.getComputedStyle(el);
      if (!style || style.display === "none" || style.visibility === "hidden") return false;
    } catch (_) {
      return true;
    }

    return true;
  }

  function isInsideExtension(node) {
    const el = toElement(node);
    return Boolean(el?.closest?.(`#${EXT_ROOT_ID}`));
  }

  function toElement(node) {
    if (!node) return null;
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  }

  function isUsefulText(text) {
    if (!text || text.length < 2) return false;
    if (/^[\s\-–—•|:;,.]+$/.test(text)) return false;
    return true;
  }

  function normalizeText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\r\f]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function removeDuplicateLines(text) {
    const seen = new Set();
    const result = [];

    for (const line of String(text || "").split(/\n+/)) {
      const normalized = normalizeText(line);
      if (!isUsefulText(normalized)) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(normalized);
    }

    return result.join("\n");
  }

  function smartTrim(text, maxChars) {
    const value = String(text || "").trim();
    const limit = Math.min(Number(maxChars) || MAX_CONTEXT_HARD_LIMIT, MAX_CONTEXT_HARD_LIMIT);
    if (value.length <= limit) return value;

    const head = Math.floor(limit * 0.72);
    const tail = Math.max(0, limit - head - 120);
    return `${value.slice(0, head)}\n\n[...середина страницы сокращена расширением...]\n\n${value.slice(-tail)}`;
  }

  function renderMarkdownLite(text) {
    const escaped = escapeHtml(String(text || ""));
    return escaped
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      .replace(/^### (.*)$/gm, "<h4>$1</h4>")
      .replace(/^## (.*)$/gm, "<h3>$1</h3>")
      .replace(/^# (.*)$/gm, "<h2>$1</h2>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/(["\\])/g, "\\$1");
  }
})();
