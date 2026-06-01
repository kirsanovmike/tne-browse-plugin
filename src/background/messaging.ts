/**
 * Роутер сообщений background (дизайн §3). Принимает `TNE_*` от content/options и
 * делегирует в llm-client / diagnostics. Регистрация слушателей — в `index.ts`.
 *
 * Возвращает `false` для неизвестных сообщений (чтобы их могли обработать другие
 * слушатели) или Promise с ответом — контракт `browser.runtime.onMessage`.
 *
 * NB: `TNE_TOGGLE_PANEL` и `TNE_ASK_SELECTION` шлются В content-скрипт и здесь не
 * обрабатываются (как и в исходном `background.js`).
 */
import { browser } from "../shared/browser";
import { readSettings } from "../shared/settings";
import type {
  TneRequest,
  AskModelResponse,
  BuildPayloadResponse,
  DiagPingResponse,
  GetDiagResponse,
  OkResponse,
} from "../shared/messages";
import { askModel, buildBody, normalizeError, abortRequest } from "./llm-client";
import { diagSink, diagPing, getDiag } from "./diagnostics";

function isAbort(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function isTneRequest(message: unknown): message is TneRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    typeof (message as { type?: unknown }).type === "string"
  );
}

type RouteResult =
  | AskModelResponse
  | BuildPayloadResponse
  | DiagPingResponse
  | GetDiagResponse
  | OkResponse;

export function routeMessage(message: unknown): false | Promise<RouteResult> {
  if (!isTneRequest(message)) return false;

  switch (message.type) {
    case "TNE_ASK_MODEL": {
      const ask = message;
      return readSettings()
        .then((settings) => askModel(ask.payload, ask.requestId, settings, diagSink))
        .then((data): AskModelResponse => ({ ok: true, data }))
        .catch((error): AskModelResponse => ({
          ok: false,
          error: normalizeError(error),
          aborted: isAbort(error),
        }));
    }

    case "TNE_ABORT":
      abortRequest(message.requestId);
      return Promise.resolve<OkResponse>({ ok: true });

    case "TNE_BUILD_PAYLOAD":
      // Предпросмотр тела запроса — БЕЗ токена (токен живёт только в заголовках).
      return readSettings().then(
        (settings): BuildPayloadResponse => ({ ok: true, body: buildBody(message.payload, settings) })
      );

    case "TNE_DIAG_PING":
      return readSettings()
        .then((settings) => diagPing(message.target, settings))
        .then((result): DiagPingResponse => ({ ok: true, ...result }))
        .catch((error): DiagPingResponse => ({ ok: false, error: normalizeError(error) }));

    case "TNE_GET_DIAG":
      return getDiag().then((diag): GetDiagResponse => ({ ok: true, ...diag }));

    case "TNE_OPEN_OPTIONS":
      void browser.runtime.openOptionsPage();
      return Promise.resolve<OkResponse>({ ok: true });

    default:
      return false;
  }
}
