import { describe, it, expect } from "vitest";
import { buildPrompt, buildBody, normalizeError } from "../../src/background/llm-client";
import { DEFAULT_SETTINGS } from "../../src/shared/settings";
import {
  buildBody as buildBody2,
  pickEndpoint,
  pickTimeout,
  redactImagesForPreview,
} from "../../src/background/llm-client";
import { VISION_TIMEOUT_MS } from "../../src/shared/limits";

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

describe("buildBody with images", () => {
  it("puts clean base64 into messages[0].files", () => {
    const body = buildBody2(
      { question: "q", page: { text: "ctx" }, images: ["AAA", "BBB"] },
      DEFAULT_SETTINGS
    ) as { messages: Array<{ files?: unknown }> };
    expect(body.messages[0]!.files).toEqual(["AAA", "BBB"]);
  });

  it("uses null files when there are no images", () => {
    const body = buildBody2({ question: "q", page: {} }, DEFAULT_SETTINGS) as {
      messages: Array<{ files?: unknown }>;
    };
    expect(body.messages[0]!.files).toBeNull();
  });

  it("never leaks the token even with images", () => {
    const body = buildBody2(
      { question: "q", page: {}, images: ["AAA"] },
      { ...DEFAULT_SETTINGS, token: "SECRET" }
    );
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });

  it("caps images at 5", () => {
    const body = buildBody2(
      { question: "q", page: {}, images: ["1", "2", "3", "4", "5", "6"] },
      DEFAULT_SETTINGS
    ) as { messages: Array<{ files?: string[] }> };
    expect(body.messages[0]!.files).toHaveLength(5);
  });
});

describe("pickEndpoint", () => {
  it("uses vision endpoint for images when set", () => {
    const s = { ...DEFAULT_SETTINGS, endpoint: "MAIN", visionEndpoint: "VIS" };
    expect(pickEndpoint(s, true)).toBe("VIS");
    expect(pickEndpoint(s, false)).toBe("MAIN");
  });

  it("falls back to main endpoint when vision endpoint is empty", () => {
    const s = { ...DEFAULT_SETTINGS, endpoint: "MAIN", visionEndpoint: "" };
    expect(pickEndpoint(s, true)).toBe("MAIN");
  });
});

describe("pickTimeout", () => {
  it("uses the vision timeout when there are images", () => {
    const s = { ...DEFAULT_SETTINGS, requestTimeoutMs: 90000 };
    expect(pickTimeout(s, true)).toBe(VISION_TIMEOUT_MS);
    expect(pickTimeout(s, false)).toBe(90000);
  });
});

describe("redactImagesForPreview", () => {
  it("replaces base64 files with size placeholders", () => {
    const body = { messages: [{ files: ["QUJDRA==", "WA=="] }] };
    const out = redactImagesForPreview(body) as { messages: Array<{ files: string[] }> };
    expect(out.messages[0]!.files[0]).toMatch(/^\[изображение 1 · ~\d+ КБ\]$/);
    expect(out.messages[0]!.files).toHaveLength(2);
    // original is not mutated
    expect(body.messages[0]!.files[0]).toBe("QUJDRA==");
  });

  it("passes through bodies without files", () => {
    const body = { messages: [{ files: null }] };
    expect(redactImagesForPreview(body)).toEqual(body);
  });
});

describe("role injection", () => {
  it("buildPrompt injects a non-empty role prompt", () => {
    const prompt = buildPrompt({ question: "q", page: { text: "ctx" } }, "РОЛЬ-ТЕКСТ");
    expect(prompt).toContain("РОЛЬ-ТЕКСТ");
  });

  it("buildPrompt without a role is unchanged", () => {
    const withEmpty = buildPrompt({ question: "q", page: { text: "ctx" } }, "");
    const noArg = buildPrompt({ question: "q", page: { text: "ctx" } });
    expect(withEmpty).toBe(noArg);
  });

  it("buildBody resolves the role from settings.roleId", () => {
    const body = buildBody(
      { question: "q", page: { text: "ctx" } },
      { ...DEFAULT_SETTINGS, roleId: "analyst" }
    ) as { messages: Array<{ content: string }> };
    expect(body.messages[0]!.content).toContain("аналит");
  });
});
