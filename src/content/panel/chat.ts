/**
 * Лента чата: рендер сообщений, отправка вопроса, лоадер/стоп/повтор, warning-bar
 * по чувствительным данным. Перенесено из `content.js` на M3. DOM → без
 * юнит-тестов (§6); скан и рендер покрыты отдельно (scan.test / render-модуль).
 */
import { browser } from "../../shared/browser";
import { STATE, $ } from "../state";
import type { AskModelResponse } from "../../shared/messages";
import { refreshContext } from "../context/refresh";
import { scanSensitive } from "../security/scan";
import { renderMarkdownInto, copyToClipboard } from "../render/markdown";
import { SEND_ICON } from "./icons";
import { openImageLightbox } from "./lightbox";
import { readSettings } from "../../shared/settings";
import { attachmentImages, clearAttachments, captureAndAttachScreen } from "../vision/attachments";
import { clearPdf } from "../pdf/pdf-attachments";
import { resolveSlashCommand } from "../chat/slash-commands";

interface AssistantOptions {
  light?: boolean;
  latencyMs?: number;
}

export function renderWelcomeMessage(): void {
  const messages = $("#tne-chat-messages");
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

export function clearChat(): void {
  STATE.history = [];
  clearPdf();
  clearAttachments();
  renderWelcomeMessage();
  hideWarningBar();
  const input = $("#tne-chat-input") as HTMLTextAreaElement | null;
  if (input) {
    input.value = "";
    input.style.height = "auto";
    input.focus();
  }
}

export async function sendQuestion(force = false): Promise<void> {
  if (!STATE.panel || STATE.isSending) return;

  const input = $("#tne-chat-input") as HTMLTextAreaElement | null;
  if (!input) return;
  // 4.5: развернуть slash-команду, набранную и отправленную минуя автокомплит
  // (включая аргумент, например «/translate en»); иначе — обычный текст.
  const resolved = resolveSlashCommand(input.value);
  const question = resolved ? resolved.prompt : input.value.trim();
  if (!question) return;

  // 5.R2-10: перед каждой отправкой безусловно пересобираем контекст —
  // страховка от устаревшего контекста (DOM мог измениться без MutationObserver).
  await refreshContext(false, "before-send");

  // Проверка чувствительных данных перед отправкой (карты/токены/ключи).
  if (!force) {
    const findings = scanSensitive(`${question}\n${STATE.page?.text || ""}`);
    if (findings.length) {
      showWarningBar(findings, question);
      return;
    }
  }
  hideWarningBar();

  // 2.5: автоскриншот — только если включён и нет ручных вложений. По умолчанию выкл.
  const settings = await readSettings();
  if (settings.autoScreenshot && STATE.attachments.length === 0) {
    await captureAndAttachScreen();
  }
  const images = attachmentImages();
  STATE.lastRequestHadImages = images.length > 0;

  // HF2: показываем в пузыре, что реально ушло с вопросом (картинки + документ).
  const bubbleImages = STATE.attachments.map((a) => a.dataUrl);
  const bubbleDoc = STATE.pdf?.name || "";

  input.value = "";
  input.style.height = "auto";
  addUserMessage(question, { images: bubbleImages, docName: bubbleDoc });
  STATE.lastQuestion = question;
  // Замечание 3: картинка уже продублирована в пузыре сообщения — сразу очищаем
  // нижнюю ленту вложений (картинки/bubbleImages уже сняты в локальные переменные
  // выше, поэтому запрос уйдёт с ними). keepPdf — PDF-чип не трогаем.
  clearAttachments({ keepPdf: true });

  const requestId = `tne-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  STATE.currentRequestId = requestId;
  const loaderId = addLoader(requestId);
  setSending(true);

  try {
    const response = (await browser.runtime.sendMessage({
      type: "TNE_ASK_MODEL",
      requestId,
      // 5.R2-2: только последние 2 обмена (чистые вопрос/ответ, без контекста страницы).
      payload: { question, page: STATE.page, history: STATE.history.slice(-4), images },
    })) as (AskModelResponse & { data?: { content?: string; latencyMs?: number } }) | undefined;

    removeLoader(loaderId);

    if (!response?.ok) {
      if (response?.aborted) {
        addAssistantMessage("Запрос остановлен.", { light: true });
      } else {
        addErrorMessage(response?.error || "Не удалось получить ответ от модели.", question);
      }
      return;
    }

    const answer = response.data?.content || "Пустой ответ модели.";
    STATE.history.push({ role: "user", content: question }, { role: "assistant", content: answer });
    addAssistantMessage(answer, { latencyMs: response.data?.latencyMs });
  } catch (error) {
    removeLoader(loaderId);
    addErrorMessage((error as Error)?.message || String(error), question);
  } finally {
    STATE.currentRequestId = null;
    setSending(false);
  }
}

/** Повторяет последний вопрос (без повторного гейта — он уже проверен). */
function repeatLast(): void {
  if (STATE.isSending || !STATE.lastQuestion) return;
  const input = $("#tne-chat-input") as HTMLTextAreaElement | null;
  if (input) input.value = STATE.lastQuestion;
  void sendQuestion(true);
}

/** Повторяет последний вопрос со снятыми вложениями («без картинок»). */
function resendWithoutImages(): void {
  if (STATE.isSending || !STATE.lastQuestion) return;
  clearAttachments();
  const input = $("#tne-chat-input") as HTMLTextAreaElement | null;
  if (input) input.value = STATE.lastQuestion;
  void sendQuestion(true);
}

function showWarningBar(findings: string[], question: string): void {
  const bar = $("#tne-warning-bar");
  const text = $("#tne-warning-text");
  if (!bar || !text) return;
  text.textContent = `В контексте обнаружены потенциально чувствительные данные: ${findings.join(", ")}. Отправить запрос всё равно?`;
  bar.hidden = false;

  const sendBtn = $("#tne-warning-send");
  const cancelBtn = $("#tne-warning-cancel");
  if (sendBtn) {
    sendBtn.onclick = () => {
      hideWarningBar();
      const input = $("#tne-chat-input") as HTMLTextAreaElement | null;
      if (input && !input.value.trim()) input.value = question;
      sendQuestion(true);
    };
  }
  if (cancelBtn) cancelBtn.onclick = () => hideWarningBar();
}

function hideWarningBar(): void {
  const bar = $("#tne-warning-bar");
  if (bar) bar.hidden = true;
}

function setSending(value: boolean): void {
  STATE.isSending = value;
  const send = $("#tne-chat-send") as HTMLButtonElement | null;
  if (send) {
    send.disabled = value;
    send.classList.toggle("tne-send-button--loading", value);
    send.innerHTML = value ? `<span class="tne-spinner" aria-hidden="true"></span>` : SEND_ICON;
  }
}

interface UserMessageMedia {
  images?: string[]; // dataUrl-превью реально отправленных картинок
  docName?: string; // имя приложенного документа (PDF/DOCX/XLSX), если есть
}

function addUserMessage(text: string, media: UserMessageMedia = {}): void {
  const messages = $("#tne-chat-messages");
  if (!messages) return;

  // 5.R2-7: вложения рисуем НАД текстом — сначала картинки/чип документа, потом вопрос.
  const images = media.images ?? [];
  if (images.length || media.docName) {
    const tray = document.createElement("div");
    tray.className = "tne-bubble-attachments";

    if (media.docName) {
      const doc = document.createElement("div");
      doc.className = "tne-bubble-doc";
      const icon = document.createElement("span");
      icon.textContent = "📄";
      icon.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "tne-bubble-doc-name";
      name.textContent = media.docName;
      doc.append(icon, name);
      tray.appendChild(doc);
    }

    for (const dataUrl of images) {
      const img = document.createElement("img");
      img.className = "tne-bubble-thumb";
      img.src = dataUrl;
      img.alt = "отправленное изображение";
      img.title = "Открыть на весь экран";
      img.addEventListener("click", () => openImageLightbox(dataUrl)); // 5.R3-5
      tray.appendChild(img);
    }

    messages.appendChild(tray);
  }

  if (text) {
    const node = document.createElement("div");
    node.className = "tne-user-bubble";
    node.textContent = text;
    messages.appendChild(node);
  }

  scrollMessages();
}

export function addAssistantMessage(text: string, options: AssistantOptions = {}): void {
  const messages = $("#tne-chat-messages");
  if (!messages) return;
  const node = document.createElement("div");
  node.className = options.light ? "tne-assistant-card tne-assistant-card--light" : "tne-assistant-card";

  const meta = document.createElement("div");
  meta.className = "tne-message-meta";
  const seconds = Number(options.latencyMs) ? `${(Number(options.latencyMs) / 1000).toFixed(1)} c` : "";
  meta.textContent = seconds ? `ТНЭ чат · ${seconds}` : "ТНЭ чат";

  const body = document.createElement("div");
  body.className = "tne-message-content";
  renderMarkdownInto(body, text, { linkSources: true });

  node.append(meta, body);

  if (!options.light) {
    const actions = document.createElement("div");
    actions.className = "tne-message-actions";

    const mkBtn = (label: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", onClick);
      return b;
    };

    // 5.R2-3: минимальный набор — «Повторить» (+ условная «Без картинок»);
    // «Копировать ответ» добавляется ниже. «Подробнее/Короче/Продолжить» убраны:
    // с историей диалога (5.R2-2) это обычные уточняющие вопросы.
    actions.append(mkBtn("Повторить", () => repeatLast()));

    if (STATE.lastRequestHadImages) {
      actions.append(mkBtn("Без картинок", () => resendWithoutImages()));
    }

    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Копировать ответ";
    copy.addEventListener("click", async () => {
      await copyToClipboard(text);
      copy.textContent = "Скопировано";
      setTimeout(() => (copy.textContent = "Копировать ответ"), 1200);
    });
    actions.appendChild(copy);
    node.appendChild(actions);
  }

  messages.appendChild(node);
  scrollMessages();
}

function addErrorMessage(text: string, question: string): void {
  const messages = $("#tne-chat-messages");
  if (!messages) return;
  const node = document.createElement("div");
  node.className = "tne-error-card";
  const msg = document.createElement("div");
  msg.textContent = `Ошибка: ${text}`;
  node.appendChild(msg);

  if (question) {
    const actions = document.createElement("div");
    actions.className = "tne-message-actions";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Повторить";
    retry.addEventListener("click", () => {
      const input = $("#tne-chat-input") as HTMLTextAreaElement | null;
      if (input) input.value = question;
      sendQuestion(true);
    });
    actions.appendChild(retry);
    node.appendChild(actions);
  }

  messages.appendChild(node);
  scrollMessages();
}

function addLoader(requestId: string): string {
  const id = `tne-loader-${Date.now()}`;
  const messages = $("#tne-chat-messages");
  if (!messages) return id;
  const node = document.createElement("div");
  node.id = id;
  node.className = "tne-assistant-card tne-loader-card";
  node.innerHTML = `
      <div class="tne-message-meta">ТНЭ чат</div>
      <div class="tne-loader-row">
        <div class="tne-dots"><span></span><span></span><span></span></div>
        <button class="tne-stop-button" type="button">Остановить</button>
      </div>`;
  node.querySelector(".tne-stop-button")?.addEventListener("click", () => {
    browser.runtime.sendMessage({ type: "TNE_ABORT", requestId });
  });
  messages.appendChild(node);
  scrollMessages();
  return id;
}

function removeLoader(id: string): void {
  STATE.shadow?.getElementById?.(id)?.remove();
  $(`#${id}`)?.remove();
}

function scrollMessages(): void {
  const messages = $("#tne-chat-messages");
  if (messages) messages.scrollTop = messages.scrollHeight;
}
