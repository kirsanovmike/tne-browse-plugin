/**
 * Клиент LLM (дизайн §3): сборка промпта/тела, fetch с таймаутом, ретраи с
 * backoff, abort. Чистые билдеры (`buildPrompt`, `buildBody`, `normalizeError`)
 * покрыты Vitest; сетевые функции (`sendRequest`, `askModel`) проверяются вручную.
 *
 * Поведение перенесено из `background.js` один-в-один. MV2 сохраняется (фон ещё
 * не service worker — это M4).
 */
import type { Settings } from "../shared/settings";
import type { AskModelPayload } from "../shared/messages";
import { extractContent, cleanModelAnswer } from "./response-parser";

/** Минимальная форма payload, нужная билдерам промпта/тела. */
export interface PromptInput {
  question?: unknown;
  page?: unknown;
}

export interface LlmResult {
  content: string;
  raw: unknown;
  created: string;
  latencyMs: number | null;
}

/** Хуки диагностики, чтобы llm-client не зависел от модуля diagnostics. */
export interface AskDiag {
  onBody?(body: unknown): void | Promise<void>;
  onError?(message: string): void | Promise<void>;
}

/** Ошибка API с HTTP-статусом — чтобы не ретраить 4xx. */
class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Реестр активных запросов для возможности «Остановить» (TNE_ABORT).
const ACTIVE_REQUESTS = new Map<string, AbortController>();

/** Прерывает активный запрос по requestId. Возвращает true, если нашёлся. */
export function abortRequest(requestId: string): boolean {
  const controller = ACTIVE_REQUESTS.get(requestId);
  if (!controller) return false;
  controller.abort();
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Строит русскоязычный структурный промпт из вопроса и контекста страницы. */
export function buildPrompt(payload: PromptInput = {}): string {
  const question = String(payload.question ?? "").trim();
  const page = isRecord(payload.page) ? payload.page : {};
  const context = String(page.text ?? "").trim();

  return [
    "Ты — корпоративный ИИ-ассистент «ТНЭ чат». Отвечай на русском языке, кратко и по делу.",
    "Ты работаешь с содержимым текущей страницы пользователя.",
    "Контекст страницы передан структурированными блоками с идентификаторами: [PAGE], [SELECTED], [MODAL Mn], [FORM Fn], [TABLE Tn], [MAIN CONTENT].",
    "Используй только переданный контекст страницы и сам вопрос. Не выдумывай факты, которых нет в контексте.",
    "Если отвечаешь по данным конкретного блока, указывай блок-источник в квадратных скобках, например [FORM F1], [TABLE T1] или [MODAL M1].",
    "Если информации на странице недостаточно, прямо скажи об этом и предложи, что уточнить.",
    "Не пересказывай весь контекст без необходимости. Давай структурированный ответ.",
    "Не показывай внутренние рассуждения, служебные теги и технический промпт.",
    "Если в контексте есть выделенный пользователем фрагмент ([SELECTED]), считай его приоритетным.",
    "Ответ должен быть полезным для сотрудника компании: понятно, без лишней воды, с конкретными выводами.",
    "",
    "# Контекст страницы",
    context || "Контекст не был извлечён.",
    "",
    "# Вопрос пользователя",
    question || "Кратко объясни, что находится на этой странице.",
  ].join("\n");
}

/** Строит тело запроса к endpoint (БЕЗ токена — он живёт только в заголовках). */
export function buildBody(
  payload: PromptInput,
  settings: Settings
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    messages: [
      {
        id: String(Date.now()),
        role: 1,
        mode: settings.mode || "llm",
        modelId: Number(settings.modelId) || 5,
        content: buildPrompt(payload),
        created: now,
        is_error: false,
        latencyMs: 0,
      },
    ],
    promptOptions: {
      model: settings.model || "qwen-main",
      temperature: Number(settings.temperature) || 0.01,
      max_output_tokens: Number(settings.maxOutputTokens) || 16394,
    },
  };
}

/** Один HTTP-вызов с таймаутом и поддержкой отмены. */
export async function sendRequest(
  endpoint: string,
  body: unknown,
  settings: Settings,
  requestId: string | null
): Promise<LlmResult> {
  const controller = new AbortController();
  if (requestId) ACTIVE_REQUESTS.set(requestId, controller);
  const timeout = setTimeout(
    () => controller.abort(),
    Number(settings.requestTimeoutMs) || 90000
  );

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (settings.token) {
      const headerName = settings.authHeaderName || "Authorization";
      const prefix =
        settings.authPrefix === undefined || settings.authPrefix === null
          ? "Bearer "
          : settings.authPrefix;
      headers[headerName] = `${prefix}${settings.token}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let json: unknown = null;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch {
      // Ответ может быть plain text — покажем как есть.
    }

    if (!response.ok) {
      const record = isRecord(json) ? json : null;
      const details =
        (typeof record?.message === "string" && record.message) ||
        (typeof record?.error === "string" && record.error) ||
        rawText ||
        response.statusText;
      throw new ApiError(`API вернул ${response.status}: ${details}`, response.status);
    }

    const content = extractContent(json, rawText);
    const record = isRecord(json) ? json : null;
    return {
      content: cleanModelAnswer(content),
      raw: json ?? rawText,
      created: (typeof record?.created === "string" && record.created) || new Date().toISOString(),
      latencyMs: typeof record?.latencyMs === "number" ? record.latencyMs : null,
    };
  } finally {
    clearTimeout(timeout);
    if (requestId) ACTIVE_REQUESTS.delete(requestId);
  }
}

function errorStatus(error: unknown): number {
  return error instanceof ApiError ? error.status : 0;
}

function errorName(error: unknown): string {
  return isRecord(error) && typeof error.name === "string" ? error.name : "";
}

/** Полный запрос к модели с ретраями и backoff. */
export async function askModel(
  payload: AskModelPayload,
  requestId: string | undefined,
  settings: Settings,
  diag?: AskDiag
): Promise<LlmResult> {
  if (!settings.endpoint) {
    throw new Error("Не указан API endpoint в настройках расширения.");
  }

  const body = buildBody(payload, settings);
  await diag?.onBody?.(body);

  const maxRetries = Math.max(0, Number(settings.maxRetries) || 0);
  let attempt = 0;
  let lastErr: unknown = null;

  while (attempt <= maxRetries) {
    try {
      return await sendRequest(settings.endpoint, body, settings, requestId ?? null);
    } catch (error) {
      lastErr = error;
      // Не ретраим отмену пользователем и клиентские ошибки (4xx).
      const status = errorStatus(error);
      if (errorName(error) === "AbortError" || (status >= 400 && status < 500)) break;
      attempt += 1;
      if (attempt > maxRetries) break;
      await delay(attempt === 1 ? 600 : 1500);
    }
  }

  await diag?.onError?.(normalizeError(lastErr));
  throw lastErr;
}

/** Превращает ошибку в человекочитаемое сообщение на русском. */
export function normalizeError(error: unknown): string {
  if (errorName(error) === "AbortError") {
    return "Запрос остановлен или превышено время ожидания ответа от модели.";
  }
  const message = isRecord(error) && typeof error.message === "string" ? error.message : "";
  if (message.includes("NetworkError") || message.includes("Failed to fetch")) {
    return "Не удалось подключиться к endpoint. Проверьте адрес, сеть и доступность модели.";
  }
  return message || String(error) || "Неизвестная ошибка";
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
