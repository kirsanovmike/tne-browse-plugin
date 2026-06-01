import { describe, it, expect } from "vitest";
import { matrixToMarkdown } from "../../../src/content/context/tables-to-md";

describe("matrixToMarkdown", () => {
  it("renders a header row, separator and body rows", () => {
    expect(matrixToMarkdown([["A", "B"], ["1", "2"]])).toBe(
      "| A | B |\n| --- | --- |\n| 1 | 2 |"
    );
  });

  it("pads short rows out to the widest column count", () => {
    expect(matrixToMarkdown([["A", "B"], ["1"]])).toBe(
      "| A | B |\n| --- | --- |\n| 1 |  |"
    );
  });

  it("returns an empty string for an empty matrix", () => {
    expect(matrixToMarkdown([])).toBe("");
  });

  it("returns an empty string when no row has any cells", () => {
    expect(matrixToMarkdown([[], []])).toBe("");
  });
});
