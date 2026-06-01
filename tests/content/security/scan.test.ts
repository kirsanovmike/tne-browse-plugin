import { describe, it, expect } from "vitest";
import { scanSensitive, luhnValid, hasLuhnCardNumber } from "../../../src/content/security/scan";

describe("scanSensitive", () => {
  it("flags a JWT-shaped token", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N";
    expect(scanSensitive(`token=${jwt}`)).toContain("токен (JWT)");
  });

  it("flags a provider-style API key", () => {
    expect(scanSensitive("key sk-ABCDEFGHIJKLMNOP12 end")).toContain("API-ключ");
  });

  it("flags a long hex string as key/hash", () => {
    expect(scanSensitive("a".repeat(40))).toContain("ключ/хеш");
  });

  it("flags a Luhn-valid card number", () => {
    expect(scanSensitive("карта 4111 1111 1111 1111")).toContain("номер карты");
  });

  it("returns an empty array for clean text", () => {
    expect(scanSensitive("обычный текст без секретов")).toEqual([]);
  });

  it("de-duplicates findings into a flat list", () => {
    const out = scanSensitive("4111 1111 1111 1111 и ещё 5500 0000 0000 0004");
    expect(out).toEqual(["номер карты"]);
  });
});

describe("luhnValid", () => {
  it("accepts a known-valid card number", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
  });

  it("rejects a number that fails the checksum", () => {
    expect(luhnValid("4111111111111112")).toBe(false);
  });
});

describe("hasLuhnCardNumber", () => {
  it("detects a spaced card number inside surrounding text", () => {
    expect(hasLuhnCardNumber("оплата 4111-1111-1111-1111 прошла")).toBe(true);
  });

  it("ignores short digit runs", () => {
    expect(hasLuhnCardNumber("код 1234")).toBe(false);
  });
});
