import { describe, it, expect } from "vitest";
import { findSourceLabels } from "../../../src/content/render/source-links";

describe("findSourceLabels", () => {
  it("finds a single FORM label and parses its block id", () => {
    const out = findSourceLabels("Смотри [FORM F1] внимательно.");
    expect(out).toHaveLength(1);
    expect(out[0]!.label).toBe("[FORM F1]");
    expect(out[0]!.blockId).toBe("F1");
    expect(out[0]!.index).toBe(7);
    expect(out[0]!.length).toBe("[FORM F1]".length);
  });

  it("finds TABLE, MODAL and DOCUMENT labels", () => {
    const out = findSourceLabels("[TABLE T2] и [MODAL M1] и [DOCUMENT D1]");
    expect(out.map((l) => l.blockId)).toEqual(["T2", "M1", "D1"]);
  });

  it("recognizes bracket-only labels SELECTED / PAGE / MAIN CONTENT", () => {
    const out = findSourceLabels("[SELECTED] [PAGE] [MAIN CONTENT]");
    expect(out.map((l) => l.blockId)).toEqual(["SELECTED", "PAGE", "MAIN CONTENT"]);
  });

  it("returns empty for text without labels", () => {
    expect(findSourceLabels("обычный текст без меток")).toEqual([]);
  });

  it("does not match unknown bracket tokens", () => {
    expect(findSourceLabels("[FOO B1] [NOTE]")).toEqual([]);
  });

  it("finds multiple labels with correct indices", () => {
    const text = "[FORM F1] then [TABLE T1]";
    const out = findSourceLabels(text);
    expect(out).toHaveLength(2);
    expect(text.slice(out[0]!.index, out[0]!.index + out[0]!.length)).toBe("[FORM F1]");
    expect(text.slice(out[1]!.index, out[1]!.index + out[1]!.length)).toBe("[TABLE T1]");
  });
});
