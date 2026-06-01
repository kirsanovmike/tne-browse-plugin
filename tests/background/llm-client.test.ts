import { describe, it, expect } from "vitest";
import { buildPrompt, buildBody, normalizeError } from "../../src/background/llm-client";
import { DEFAULT_SETTINGS } from "../../src/shared/settings";

describe("buildPrompt", () => {
  it("embeds the question and page context", () => {
    const prompt = buildPrompt({
      question: "  Что тут?  ",
      page: { text: "  содержимое страницы  " },
    });
    expect(prompt).toContain("# Вопрос пользователя\nЧто тут?");
    expect(prompt).toContain("# Контекст страницы\nсодержимое страницы");
  });

  it("uses fallbacks when question/context are missing", () => {
    const prompt = buildPrompt({});
    expect(prompt).toContain("Контекст не был извлечён.");
    expect(prompt).toContain("Кратко объясни, что находится на этой странице.");
  });

  it("tolerates a non-object page", () => {
    const prompt = buildPrompt({ question: "q", page: null });
    expect(prompt).toContain("Контекст не был извлечён.");
  });
});

describe("buildBody", () => {
  it("builds messages + promptOptions from settings", () => {
    const body = buildBody({ question: "q", page: { text: "ctx" } }, DEFAULT_SETTINGS) as {
      messages: Array<Record<string, unknown>>;
      promptOptions: Record<string, unknown>;
    };
    expect(body.messages).toHaveLength(1);
    const msg = body.messages[0]!;
    expect(msg.role).toBe(1);
    expect(msg.mode).toBe("llm");
    expect(msg.modelId).toBe(5);
    expect(typeof msg.content).toBe("string");
    expect(body.promptOptions).toEqual({
      model: "qwen-main",
      temperature: 0.01,
      max_output_tokens: 16394,
    });
  });

  it("never leaks the token into the body", () => {
    const body = buildBody({ question: "q", page: {} }, { ...DEFAULT_SETTINGS, token: "SECRET" });
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });
});

describe("normalizeError", () => {
  it("maps AbortError to a stop/timeout message", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(normalizeError(err)).toMatch(/остановлен/);
  });

  it("maps network failures to a connection message", () => {
    expect(normalizeError(new Error("Failed to fetch"))).toMatch(/подключиться/);
    expect(normalizeError(new TypeError("NetworkError when attempting"))).toMatch(/подключиться/);
  });

  it("passes through a plain error message", () => {
    expect(normalizeError(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-error values (current behavior)", () => {
    expect(normalizeError(null)).toBe("null");
    expect(normalizeError({ message: "" })).toBe("[object Object]");
  });
});
