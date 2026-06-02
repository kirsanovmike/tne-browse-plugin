import { describe, it, expect } from "vitest";
import { looksLikeScan } from "../../../src/content/pdf/scan-detect";

describe("looksLikeScan", () => {
  it("много текста на страницу → не скан", () => {
    expect(looksLikeScan(["a".repeat(300), "b".repeat(300)], 100)).toBe(false);
  });
  it("мало текста на страницу → скан", () => {
    expect(looksLikeScan(["", "  ", "x"], 100)).toBe(true);
  });
  it("пустой список страниц → скан (нет текстового слоя)", () => {
    expect(looksLikeScan([], 100)).toBe(true);
  });
  it("ровно на пороге не считается сканом", () => {
    expect(looksLikeScan(["a".repeat(100)], 100)).toBe(false);
  });
  it("учитывает только непробельные символы", () => {
    expect(looksLikeScan(["   \n\t   "], 5)).toBe(true);
  });
});
