import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  MAX_CONTEXT_HARD_LIMIT,
  coerceModelSettings,
  parseDomainList,
} from "../../src/shared/settings";

describe("DEFAULT_SETTINGS", () => {
  it("keeps the documented defaults", () => {
    expect(DEFAULT_SETTINGS.endpoint).toBe(
      "https://llm-prod.tne.tn.corp:13600/api/v1/chat/generate"
    );
    expect(DEFAULT_SETTINGS.model).toBe("qwen-main");
    expect(DEFAULT_SETTINGS.modelId).toBe(5);
    expect(DEFAULT_SETTINGS.temperature).toBe(0.01);
    expect(DEFAULT_SETTINGS.maxOutputTokens).toBe(16394);
    expect(DEFAULT_SETTINGS.maxContextChars).toBe(20000);
    expect(DEFAULT_SETTINGS.requestTimeoutMs).toBe(90000);
    expect(DEFAULT_SETTINGS.maxRetries).toBe(1);
    expect(DEFAULT_SETTINGS.allowExternal).toBe(true);
    expect(DEFAULT_SETTINGS.visionEndpoint).toBe(
      "https://llm-prod.tne.tn.corp:13600/api/v1/chat/generate"
    );
    expect(DEFAULT_SETTINGS.token).not.toBe("");
    expect(DEFAULT_SETTINGS.whitelist).toEqual(["*.tn.corp", "*.transneftenergo.ru"]);
    expect(DEFAULT_SETTINGS.denylist).toEqual([]);
  });

  it("hard-caps context length at 25000", () => {
    expect(MAX_CONTEXT_HARD_LIMIT).toBe(25000);
  });

  it("defaults the assistant role to general and templates to empty", () => {
    expect(DEFAULT_SETTINGS.roleId).toBe("general");
    expect(DEFAULT_SETTINGS.promptTemplates).toEqual([]);
  });
});

describe("coerceModelSettings", () => {
  it("trims string fields and coerces numbers", () => {
    const result = coerceModelSettings({
      endpoint: "  https://x/api  ",
      token: "  tok  ",
      authHeaderName: "  X-Key  ",
      model: "  qwen  ",
      modelId: "7",
      temperature: "0.5",
      maxOutputTokens: "2048",
      requestTimeoutMs: "30000",
    });
    expect(result.endpoint).toBe("https://x/api");
    expect(result.token).toBe("tok");
    expect(result.authHeaderName).toBe("X-Key");
    expect(result.model).toBe("qwen");
    expect(result.modelId).toBe(7);
    expect(result.temperature).toBe(0.5);
    expect(result.maxOutputTokens).toBe(2048);
    expect(result.requestTimeoutMs).toBe(30000);
    expect(result.mode).toBe("llm");
  });

  it("clamps maxContextChars to the hard limit", () => {
    expect(coerceModelSettings({ maxContextChars: "999999" }).maxContextChars).toBe(25000);
    expect(coerceModelSettings({ maxContextChars: "12000" }).maxContextChars).toBe(12000);
  });

  it("floors maxRetries at 0", () => {
    expect(coerceModelSettings({ maxRetries: "-3" }).maxRetries).toBe(0);
    expect(coerceModelSettings({ maxRetries: "2" }).maxRetries).toBe(2);
  });

  it("falls back to defaults on empty values", () => {
    const result = coerceModelSettings({});
    expect(result.authHeaderName).toBe("Authorization");
    expect(result.authPrefix).toBe("Bearer ");
    expect(result.model).toBe("qwen-main");
    expect(result.modelId).toBe(5);
    expect(result.maxContextChars).toBe(20000);
    expect(result.maxRetries).toBe(0);
  });
});

describe("parseDomainList", () => {
  it("splits on newlines, trims, and drops empty lines", () => {
    expect(parseDomainList("*.tn.corp\n  *.foo.ru  \n\n")).toEqual([
      "*.tn.corp",
      "*.foo.ru",
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseDomainList("a.corp\r\nb.corp")).toEqual(["a.corp", "b.corp"]);
  });

  it("returns an empty array for null/empty input", () => {
    expect(parseDomainList(null)).toEqual([]);
    expect(parseDomainList("")).toEqual([]);
  });
});
