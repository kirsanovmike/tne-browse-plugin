/**
 * Пересбор контекста и обновление UI карточки контекста + предпросмотр тела
 * запроса (без токена). Перенесено из `content.js` (refreshContext /
 * updateContextMeta / updatePayloadPreview) на M3. DOM → без юнит-тестов (§6).
 */
import { browser } from "../../shared/browser";
import { STATE, SCOPES, $ } from "../state";
import { readSettings, MAX_CONTEXT_HARD_LIMIT } from "../../shared/settings";
import type { BuildPayloadResponse } from "../../shared/messages";
import { buildStructuredContext, DEFAULT_MAX_CONTEXT, type PageContext } from "./build-context";
import { addAssistantMessage } from "../panel/chat";
import { attachmentImages } from "../vision/attachments";

/** Пересобирает контекст под текущий scope, обновляет карточку и (если открыт) payload. */
export async function refreshContext(showToast = false, reason = "manual"): Promise<PageContext | null> {
  if (!STATE.panel) return null;

  const settings = await readSettings();
  const requestedMax = Number(settings.maxContextChars) || DEFAULT_MAX_CONTEXT;
  const maxChars = Math.min(requestedMax, MAX_CONTEXT_HARD_LIMIT);

  STATE.page = buildStructuredContext(maxChars, STATE.scope);
  STATE.contextDirty = false;
  STATE.lastContextRefreshAt = Date.now();

  const titleNode = $("#tne-page-title");
  const previewNode = $("#tne-context-preview");
  if (titleNode) titleNode.textContent = STATE.page.title || "Без заголовка";
  if (previewNode) previewNode.textContent = STATE.page.text || "Не удалось извлечь текст страницы.";

  updateContextMeta(reason);

  const payloadDetails = $("#tne-payload-details") as HTMLDetailsElement | null;
  if (payloadDetails?.open) updatePayloadPreview();

  if (showToast) addAssistantMessage("Контекст страницы обновлён.", { light: true });
  return STATE.page;
}

export function updateContextMeta(_reason?: string): void {
  const metaNode = $("#tne-context-meta");
  if (!metaNode || !STATE.page) return;
  const scopeLabel = SCOPES.find((s) => s.id === STATE.scope)?.label || "страница";
  const chars = STATE.page.text.length.toLocaleString("ru-RU");
  const freshness = STATE.contextDirty ? "устаревший" : "свежий";
  metaNode.textContent = `${scopeLabel} · ${chars} симв. · ${freshness}`;
  metaNode.title = STATE.page.url || location.href;
}

export async function updatePayloadPreview(): Promise<void> {
  const pre = $("#tne-payload-preview");
  if (!pre) return;
  if (STATE.contextDirty || !STATE.page) await refreshContext(false, "payload-preview");
  try {
    const input = $("#tne-chat-input") as HTMLTextAreaElement | null;
    const response = (await browser.runtime.sendMessage({
      type: "TNE_BUILD_PAYLOAD",
      payload: { question: input?.value?.trim() || "", page: STATE.page, images: attachmentImages() },
    })) as BuildPayloadResponse | undefined;
    if (response?.ok) {
      pre.textContent = JSON.stringify(response.body, null, 2);
    } else {
      pre.textContent = "Не удалось собрать тело запроса.";
    }
  } catch (error) {
    pre.textContent = `Ошибка предпросмотра: ${(error as Error)?.message || error}`;
  }
}
