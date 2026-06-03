import { describe, it, expect } from "vitest";
import { normalizeDocxText } from "../../../src/content/office/docx-text";

describe("normalizeDocxText", () => {
  it("collapses 3+ blank lines into one blank line", () => {
    expect(normalizeDocxText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("normalizes CRLF to LF and trims trailing spaces", () => {
    expect(normalizeDocxText("a  \r\nb\t\r\n")).toBe("a\nb");
  });

  it("trims leading and trailing blank lines", () => {
    expect(normalizeDocxText("\n\n  text  \n\n")).toBe("text");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeDocxText("  \n\n\t")).toBe("");
  });
});
