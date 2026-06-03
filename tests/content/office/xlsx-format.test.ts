import { describe, it, expect } from "vitest";
import { sheetsToContextText } from "../../../src/content/office/xlsx-format";

describe("sheetsToContextText", () => {
  it("renders one sheet as [SHEET «name»] + markdown table", () => {
    expect(
      sheetsToContextText([{ name: "Лист1", matrix: [["A", "B"], ["1", "2"]] }])
    ).toBe("[SHEET «Лист1»]\n| A | B |\n| --- | --- |\n| 1 | 2 |");
  });

  it("joins multiple sheets with a blank line", () => {
    expect(
      sheetsToContextText([
        { name: "S1", matrix: [["a"]] },
        { name: "S2", matrix: [["b"]] },
      ])
    ).toBe("[SHEET «S1»]\n| a |\n| --- |\n\n[SHEET «S2»]\n| b |\n| --- |");
  });

  it("skips sheets with no cells", () => {
    expect(
      sheetsToContextText([
        { name: "Empty", matrix: [] },
        { name: "S2", matrix: [["b"]] },
      ])
    ).toBe("[SHEET «S2»]\n| b |\n| --- |");
  });

  it("returns empty string when all sheets are empty", () => {
    expect(sheetsToContextText([{ name: "E", matrix: [] }])).toBe("");
  });
});
