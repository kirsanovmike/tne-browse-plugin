/**
 * 5.4/5.6: одноразовый «plain»-запрос к модели (без обвязки промпта). Используется
 * заполнением форм и переводом на месте. Не зависит от панели/shadow — работает и
 * при закрытой панели. DOM-обвязка тонкая, без юнит-тестов (§6).
 */
import { browser } from "../../shared/browser";
import type { AskModelResponse } from "../../shared/messages";

export interface PlainAnswer {
  ok: boolean;
  content: string;
  error?: string;
}

/** Шлёт вопрос в plain-режиме и возвращает ответ модели как строку. */
export async function requestPlainAnswer(prompt: string): Promise<PlainAnswer> {
  const requestId = `tne-plain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const response = (await browser.runtime.sendMessage({
      type: "TNE_ASK_MODEL",
      requestId,
      payload: { question: prompt, page: null, plain: true },
    })) as (AskModelResponse & { data?: { content?: string } }) | undefined;

    if (!response?.ok) {
      if (response?.aborted) return { ok: false, content: "", error: "Запрос остановлен." };
      return { ok: false, content: "", error: response?.error || "Не удалось получить ответ модели." };
    }
    return { ok: true, content: response.data?.content || "" };
  } catch (error) {
    return { ok: false, content: "", error: (error as Error)?.message || String(error) };
  }
}
