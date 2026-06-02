import { describe, it, expect } from "vitest";
import { parsePageRange } from "../../../src/content/pdf/page-range";

describe("parsePageRange", () => {
  it("разбирает простой диапазон", () => {
    expect(parsePageRange("1-3", 10)).toEqual([1, 2, 3]);
  });
  it("разбирает список", () => {
    expect(parsePageRange("1,3,5", 10)).toEqual([1, 3, 5]);
  });
  it("комбинирует диапазоны и одиночные, сортирует", () => {
    expect(parsePageRange("7,2-4", 10)).toEqual([2, 3, 4, 7]);
  });
  it("игнорирует пробелы", () => {
    expect(parsePageRange(" 1 , 2 ", 10)).toEqual([1, 2]);
  });
  it("дедуплицирует", () => {
    expect(parsePageRange("1,1,2", 10)).toEqual([1, 2]);
  });
  it("клампит к числу страниц", () => {
    expect(parsePageRange("8-12", 10)).toEqual([8, 9, 10]);
  });
  it("отбрасывает страницу 0 и отрицательные", () => {
    expect(parsePageRange("0,5", 10)).toEqual([5]);
  });
  it("нормализует обратный диапазон", () => {
    expect(parsePageRange("3-1", 10)).toEqual([1, 2, 3]);
  });
  it("пустой ввод → []", () => {
    expect(parsePageRange("", 10)).toEqual([]);
  });
  it("мусор → []", () => {
    expect(parsePageRange("abc", 10)).toEqual([]);
  });
  it("страница вне диапазона → []", () => {
    expect(parsePageRange("5", 3)).toEqual([]);
  });
});
