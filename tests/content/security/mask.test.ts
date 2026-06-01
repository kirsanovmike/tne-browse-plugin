import { describe, it, expect } from "vitest";
import { formatField, SENSITIVE_NAME_RE, type FieldInput } from "../../../src/content/security/mask";

const base: FieldInput = {
  tag: "input",
  type: "text",
  label: "",
  nameHint: "",
  value: "",
  hasValue: false,
  selectedText: "",
  checked: false,
  placeholder: "",
};

describe("formatField", () => {
  it("masks a password field that has a value", () => {
    expect(formatField({ ...base, type: "password", label: "Пароль", hasValue: true })).toBe(
      "Пароль: [скрыто]"
    );
  });

  it("masks a field whose name hints at a secret", () => {
    expect(formatField({ ...base, label: "API", nameHint: "api_token", value: "abc", hasValue: true })).toBe(
      "API: [скрыто]"
    );
  });

  it("reports checkbox state", () => {
    expect(formatField({ ...base, type: "checkbox", label: "Согласие", checked: true })).toBe(
      "Согласие: выбрано"
    );
    expect(formatField({ ...base, type: "checkbox", label: "Согласие", checked: false })).toBe(
      "Согласие: не выбрано"
    );
  });

  it("uses joined selected option text for a select", () => {
    expect(formatField({ ...base, tag: "select", type: "select", label: "Город", selectedText: "Москва" })).toBe(
      "Город: Москва"
    );
  });

  it("shows a plain field value", () => {
    expect(formatField({ ...base, label: "Имя", value: "Иван", hasValue: true })).toBe("Имя: Иван");
  });

  it("falls back to placeholder, then to пусто, when no value", () => {
    expect(formatField({ ...base, label: "Имя", placeholder: "введите имя" })).toBe(
      "Имя: плейсхолдер: введите имя"
    );
    expect(formatField({ ...base, label: "Имя" })).toBe("Имя: пусто");
  });

  it("uses the type as label when no label resolved", () => {
    expect(formatField({ ...base, type: "email", value: "a@b.c", hasValue: true })).toBe("email: a@b.c");
  });

  it("returns empty string for hidden, submit and button fields", () => {
    expect(formatField({ ...base, type: "hidden", value: "x", hasValue: true })).toBe("");
    expect(formatField({ ...base, type: "submit", label: "OK" })).toBe("");
    expect(formatField({ ...base, type: "button", label: "OK" })).toBe("");
  });
});

describe("SENSITIVE_NAME_RE", () => {
  it("matches common secret-ish hints (RU/EN)", () => {
    expect(SENSITIVE_NAME_RE.test("password")).toBe(true);
    expect(SENSITIVE_NAME_RE.test("apiKey")).toBe(true);
    expect(SENSITIVE_NAME_RE.test("пароль")).toBe(true);
    expect(SENSITIVE_NAME_RE.test("обычное поле")).toBe(false);
  });
});
