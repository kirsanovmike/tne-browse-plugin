import { describe, it, expect } from "vitest";
import { detectTargetLang } from "../../../src/content/translate/lang-detect";

describe("detectTargetLang", () => {
  it("returns en for Cyrillic-heavy text", () => {
    expect(detectTargetLang("Это договор поставки оборудования")).toBe("en");
  });

  it("returns ru for Latin text", () => {
    expect(detectTargetLang("This is a supply agreement")).toBe("ru");
  });

  it("returns ru for mostly-Latin mixed text", () => {
    expect(detectTargetLang("Total cost: 100 USD за единицу")).toBe("ru");
  });

  it("returns en for mostly-Cyrillic mixed text", () => {
    expect(detectTargetLang("Стоимость 100 USD за единицу товара")).toBe("en");
  });

  it("defaults to ru for digits/punctuation only", () => {
    expect(detectTargetLang("12345 ---")).toBe("ru");
  });
});
