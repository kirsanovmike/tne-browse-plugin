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
import { readSettings } from "../../shared/settings";
import { attachmentImages, clearAttachments, captureAndAttachScreen } from "../vision/attachments";
import { clearPdf } from "../pdf/pdf-attachments";

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
  const question = input.value.trim();
  if (!question) return;

  if (STATE.contextDirty || !STATE.page) await refreshContext(false, "before-send");

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

  input.value = "";
  input.style.height = "auto";
  addUserMessage(question);
  STATE.lastQuestion = question;

  const requestId = `tne-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  STATE.currentRequestId = requestId;
  const loaderId = addLoader(requestId);
  setSending(true);

  try {
    const response = (await browser.runtime.sendMessage({
      type: "TNE_ASK_MODEL",
      requestId,
      payload: { question, page: STATE.page, history: STATE.history.slice(-6), images },
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
    clearAttachments({ keepPdf: true });
  } catch (error) {
    removeLoader(loaderId);
    addErrorMessage((error as Error)?.message || String(error), question);
  } finally {
    STATE.currentRequestId = null;
    setSending(false);
  }
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

function addUserMessage(text: string): void {
  const messages = $("#tne-chat-messages");
  if (!messages) return;
  const node = document.createElement("div");
  node.className = "tne-user-bubble";
  node.textContent = text;
  messages.appendChild(node);
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
