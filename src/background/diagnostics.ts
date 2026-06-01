/**
 * Диагностика (дизайн §3): последний payload (без токена), последняя ошибка,
 * проверка соединения (ping). M4: под MV3 фон краткоживущий, поэтому эфемерная
 * диагностика хранится в `storage.session` (живёт в памяти до перезапуска
 * браузера; доступна только доверенным контекстам — фону и странице настроек,
 * которая читает её через сообщение TNE_GET_DIAG).
 */
import { browser } from "../shared/browser";
import type { Settings } from "../shared/settings";
import type { DiagTarget, GetDiagResponse } from "../shared/messages";
import { buildBody, sendRequest, normalizeError, type AskDiag } from "./llm-client";

// Внутренние ключи для диагностики (payload без токена + последняя ошибка).
const DIAG_KEYS = {
  lastPayload: "tneLastPayload",
  lastPayloadAt: "tneLastPayloadAt",
  lastError: "tneLastError",
  lastErrorAt: "tneLastErrorAt",
} as const;

async function saveDiag(key: string, value: unknown, atKey: string): Promise<void> {
  try {
    await browser.storage.session.set({ [key]: value, [atKey]: new Date().toISOString() });
  } catch {
    // Диагностика не критична — молча игнорируем сбой записи.
  }
}

/** Хуки для askModel: пишут последний payload / последнюю ошибку. */
export const diagSink: AskDiag = {
  onBody: (body) => saveDiag(DIAG_KEYS.lastPayload, body, DIAG_KEYS.lastPayloadAt),
  onError: (message) => saveDiag(DIAG_KEYS.lastError, message, DIAG_KEYS.lastErrorAt),
};

/** Читает сохранённую диагностику для страницы настроек (TNE_GET_DIAG). */
export async function getDiag(): Promise<Omit<GetDiagResponse, "ok">> {
  const data = await browser.storage.session.get([
    DIAG_KEYS.lastPayload,
    DIAG_KEYS.lastPayloadAt,
    DIAG_KEYS.lastError,
    DIAG_KEYS.lastErrorAt,
  ]);
  return {
    lastPayload: data[DIAG_KEYS.lastPayload] ?? null,
    lastPayloadAt: (data[DIAG_KEYS.lastPayloadAt] as string | undefined) ?? null,
    lastError: (data[DIAG_KEYS.lastError] as string | undefined) ?? null,
    lastErrorAt: (data[DIAG_KEYS.lastErrorAt] as string | undefined) ?? null,
  };
}

export interface DiagPingResult {
  reachable: boolean;
  message: string;
}

/** Проверка соединения с LLM/vision endpoint (TNE_DIAG_PING). */
export async function diagPing(target: DiagTarget, settings: Settings): Promise<DiagPingResult> {
  const endpoint = target === "vision" ? settings.visionEndpoint || "" : settings.endpoint || "";

  if (!endpoint) {
    return {
      reachable: false,
      message: target === "vision" ? "Vision endpoint не настроен." : "Endpoint не настроен.",
    };
  }

  const started = Date.now();
  try {
    const body = buildBody(
      { question: "Проверка соединения. Ответь словом «ок».", page: { text: "", url: "", title: "" } },
      settings
    );
    await sendRequest(endpoint, body, { ...settings, requestTimeoutMs: 15000 }, null);
    return { reachable: true, message: `Соединение установлено за ${Date.now() - started} мс.` };
  } catch (error) {
    return { reachable: false, message: normalizeError(error) };
  }
}
