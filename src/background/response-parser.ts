/**
 * Разбор ответа модели (дизайн §3, тестируется).
 *
 * Чистые функции без сетевых/extension-зависимостей: вытащены из `background.js`
 * один-в-один как страховочная сетка перед декомпозицией. `extractContent`
 * поддерживает несколько форм ответа прода (см. OPEN QUESTIONS в PROGRESS.md).
 */

interface AssistantMessage {
  role?: unknown;
  content?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAssistant(message: unknown): message is AssistantMessage {
  if (!isRecord(message)) return false;
  return message.role === 2 || message.role === "assistant";
}

/** Достаёт текст ответа из одной из поддерживаемых форм JSON; иначе — rawText. */
export function extractContent(json: unknown, rawText: string): string {
  if (!json) return rawText || "";
  if (typeof json === "string") return json;

  if (isRecord(json)) {
    if (typeof json.content === "string") return json.content;
    if (typeof json.response === "string") return json.response;
    if (typeof json.answer === "string") return json.answer;
    if (isRecord(json.response) && typeof json.response.content === "string") {
      return json.response.content;
    }
    if (Array.isArray(json.messages)) {
      const lastAssistant = [...json.messages].reverse().find(isAssistant);
      if (lastAssistant?.content !== undefined && lastAssistant.content !== null) {
        return String(lastAssistant.content);
      }
    }
  }

  return rawText || JSON.stringify(json, null, 2);
}

/** Убирает служебные рассуждения и префикс «Ответ:», тримит. */
export function cleanModelAnswer(text: unknown): string {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/^\s*Ответ:\s*/i, "")
    .trim();
}
