import { describe, it, expect } from "vitest";
import {
  normalizeText,
  isUsefulText,
  removeDuplicateLines,
  smartTrim,
  escapeHtml,
} from "../../src/shared/text";

describe("normalizeText", () => {
  it("collapses runs of spaces and tabs into a single space and trims", () => {
    expect(normalizeText("  a \t  b   ")).toBe("a b");
  });

  it("turns non-breaking spaces into regular spaces", () => {
    expect(normalizeText("a  b")).toBe("a b");
  });

  it("collapses 3+ consecutive newlines into exactly two", () => {
    expect(normalizeText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("returns empty string for nullish input", () => {
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(null)).toBe("");
  });
});

describe("isUsefulText", () => {
  it("is false for text shorter than 2 characters", () => {
    expect(isUsefulText("a")).toBe(false);
    expect(isUsefulText("")).toBe(false);
  });

  it("is false for punctuation/separator-only text", () => {
    expect(isUsefulText(" — • | : ")).toBe(false);
    expect(isUsefulText("---")).toBe(false);
  });

  it("is true for real words", () => {
    expect(isUsefulText("привет")).toBe(true);
  });
});

describe("removeDuplicateLines", () => {
  it("drops case-insensitive duplicate lines, keeping first occurrence order", () => {
    expect(removeDuplicateLines("Alpha\nbeta\nALPHA\nBeta\ngamma")).toBe("Alpha\nbeta\ngamma");
  });

  it("drops non-useful lines", () => {
    expect(removeDuplicateLines("real text\n---\n•")).toBe("real text");
  });
});

describe("smartTrim", () => {
  it("returns the value unchanged when within the limit", () => {
    expect(smartTrim("short", 100)).toBe("short");
  });

  it("inserts a middle-cut marker when over the limit", () => {
    const out = smartTrim("x".repeat(5000), 1000);
    expect(out).toContain("[...середина сокращена расширением...]");
    expect(out.length).toBeLessThan(5000);
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x" data='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; data=&#039;y&#039;&gt;&amp;&lt;/a&gt;"
    );
  });
});
