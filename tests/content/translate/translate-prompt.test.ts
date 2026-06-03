import { describe, it, expect } from "vitest";
import { buildTranslatePrompt } from "../../../src/content/translate/translate-prompt";

describe("buildTranslatePrompt", () => {
  it("names Russian as the target and embeds the text", () => {
    const out = buildTranslatePrompt("Hello world", "ru");
    expect(out).toContain("русский");
    expect(out).toContain("Hello world");
  });

  it("names English as the target", () => {
    const out = buildTranslatePrompt("Привет", "en");
    expect(out).toContain("английский");
    expect(out).toContain("Привет");
  });

  it("asks for translation only (no explanations)", () => {
    expect(buildTranslatePrompt("x", "ru")).toMatch(/только перевод/i);
  });
});
