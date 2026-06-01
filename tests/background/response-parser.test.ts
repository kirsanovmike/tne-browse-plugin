import { describe, it, expect } from "vitest";
import { extractContent, cleanModelAnswer } from "../../src/background/response-parser";

describe("extractContent", () => {
  it("returns rawText when json is null/empty", () => {
    expect(extractContent(null, "plain text")).toBe("plain text");
    expect(extractContent(null, "")).toBe("");
    expect(extractContent(undefined, "fallback")).toBe("fallback");
  });

  it("returns the json itself when it is a string", () => {
    expect(extractContent("just a string", "raw")).toBe("just a string");
  });

  it("prefers top-level content over response/answer", () => {
    expect(
      extractContent({ content: "c", response: "r", answer: "a" }, "raw")
    ).toBe("c");
  });

  it("falls back to response, then answer", () => {
    expect(extractContent({ response: "r", answer: "a" }, "raw")).toBe("r");
    expect(extractContent({ answer: "a" }, "raw")).toBe("a");
  });

  it("reads nested response.content", () => {
    expect(extractContent({ response: { content: "nested" } }, "raw")).toBe("nested");
  });

  it("reads the last assistant message (role 2 or 'assistant')", () => {
    expect(
      extractContent(
        {
          messages: [
            { role: 1, content: "user q" },
            { role: 2, content: "assistant a" },
          ],
        },
        "raw"
      )
    ).toBe("assistant a");
    expect(
      extractContent(
        { messages: [{ role: "assistant", content: "by-name" }] },
        "raw"
      )
    ).toBe("by-name");
  });

  it("returns the LAST matching assistant message", () => {
    expect(
      extractContent(
        {
          messages: [
            { role: 2, content: "first" },
            { role: 2, content: "second" },
          ],
        },
        "raw"
      )
    ).toBe("second");
  });

  it("coerces non-string assistant content to string", () => {
    expect(
      extractContent({ messages: [{ role: 2, content: 42 }] }, "raw")
    ).toBe("42");
  });

  it("falls back to rawText when nothing matches", () => {
    expect(extractContent({ foo: "bar" }, "raw text")).toBe("raw text");
  });

  it("falls back to pretty JSON when no rawText and nothing matches", () => {
    expect(extractContent({ foo: "bar" }, "")).toBe(
      JSON.stringify({ foo: "bar" }, null, 2)
    );
  });
});

describe("cleanModelAnswer", () => {
  it("strips <think> blocks", () => {
    expect(cleanModelAnswer("<think>secret</think>Ответ тут")).toBe("Ответ тут");
  });

  it("strips <thinking> blocks (case-insensitive)", () => {
    expect(cleanModelAnswer("<THINKING>x</THINKING>visible")).toBe("visible");
  });

  it("strips a leading 'Ответ:' prefix", () => {
    expect(cleanModelAnswer("Ответ: hello")).toBe("hello");
  });

  it("trims surrounding whitespace", () => {
    expect(cleanModelAnswer("  spaced  ")).toBe("spaced");
  });

  it("returns an empty string for null/undefined", () => {
    expect(cleanModelAnswer(null)).toBe("");
    expect(cleanModelAnswer(undefined)).toBe("");
  });
});
