/**
 * Контракт сообщений между content / options и background (TNE_*).
 *
 * M1 — только типы; роутер и хендлеры переезжают в `background/messaging.ts` на
 * M2. `page` в payload пока `unknown` (структурированный контекст типизируется на
 * M3 при декомпозиции content.js).
 */

export interface ChatHistoryItem {
  role: string;
  content: string;
}

export interface AskModelPayload {
  question: string;
  page: unknown;
  history?: ChatHistoryItem[];
  images?: string[];
}

export interface BuildPayloadPayload {
  question: string;
  page: unknown;
  images?: string[];
}

export type DiagTarget = "llm" | "vision";

/** Сообщения-запросы, которые шлют content/options в background. */
export type TneRequest =
  | { type: "TNE_TOGGLE_PANEL" }
  | { type: "TNE_ASK_SELECTION" }
  | { type: "TNE_OPEN_OPTIONS" }
  | { type: "TNE_ABORT"; requestId: string }
  | { type: "TNE_ASK_MODEL"; requestId: string; payload: AskModelPayload }
  | { type: "TNE_BUILD_PAYLOAD"; payload: BuildPayloadPayload }
  | { type: "TNE_DIAG_PING"; target: DiagTarget }
  | { type: "TNE_CAPTURE_TAB" }
  | { type: "TNE_GET_DIAG" };

export type TneRequestType = TneRequest["type"];

// ── Ответы background (формы, как их строит текущий background.js) ──────────

export interface AskModelResponse {
  ok: boolean;
  data?: { content?: string };
  error?: string;
  aborted?: boolean;
}

export interface BuildPayloadResponse {
  ok: boolean;
  body?: unknown;
}

export interface DiagPingResponse {
  ok: boolean;
  reachable?: boolean;
  message?: string;
  error?: string;
}

export interface GetDiagResponse {
  ok: boolean;
  lastPayload?: unknown;
  lastPayloadAt?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
}

export interface OkResponse {
  ok: boolean;
}

export interface CaptureTabResponse {
  ok: boolean;
  dataUrl?: string;
  error?: string;
}
