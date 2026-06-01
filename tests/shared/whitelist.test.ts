import { describe, it, expect } from "vitest";
import { matchPattern, matchList, isHostAllowed } from "../../src/shared/whitelist";

describe("matchPattern", () => {
  it("matches a subdomain against a wildcard pattern", () => {
    expect(matchPattern("app.tn.corp", "*.tn.corp")).toBe(true);
  });

  it("does NOT match the bare apex against a *.domain wildcard", () => {
    // "*.tn.corp" требует хотя бы точку перед tn.corp.
    expect(matchPattern("tn.corp", "*.tn.corp")).toBe(false);
  });

  it("matches an exact non-wildcard host", () => {
    expect(matchPattern("tn.corp", "tn.corp")).toBe(true);
  });

  it("matches a subdomain against a non-wildcard apex (endsWith '.'+pattern)", () => {
    expect(matchPattern("app.tn.corp", "tn.corp")).toBe(true);
  });

  it("does not treat a suffix collision as a match", () => {
    expect(matchPattern("nottn.corp", "tn.corp")).toBe(false);
  });

  it("is case-insensitive on both host and pattern", () => {
    expect(matchPattern("APP.TN.CORP", "*.TN.corp")).toBe(true);
  });

  it("returns false for an empty pattern", () => {
    expect(matchPattern("app.tn.corp", "")).toBe(false);
    expect(matchPattern("app.tn.corp", "   ")).toBe(false);
  });

  it("returns false for an unrelated host", () => {
    expect(matchPattern("evil.com", "*.tn.corp")).toBe(false);
  });
});

describe("matchList", () => {
  it("returns true if any pattern in the list matches", () => {
    expect(matchList("app.transneftenergo.ru", ["*.tn.corp", "*.transneftenergo.ru"])).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchList("evil.com", ["*.tn.corp"])).toBe(false);
  });

  it("returns false for a non-array list", () => {
    expect(matchList("app.tn.corp", undefined as unknown as string[])).toBe(false);
  });
});

describe("isHostAllowed", () => {
  const base = { allowExternal: false, whitelist: ["*.tn.corp"], denylist: [] as string[] };

  it("blocks a denylisted host even when allowExternal is true and it is whitelisted", () => {
    expect(
      isHostAllowed("secret.tn.corp", {
        allowExternal: true,
        whitelist: ["*.tn.corp"],
        denylist: ["secret.tn.corp"],
      })
    ).toBe(false);
  });

  it("allows any non-denied host when allowExternal is true", () => {
    expect(isHostAllowed("evil.com", { ...base, allowExternal: true })).toBe(true);
  });

  it("allows a whitelisted host when allowExternal is false", () => {
    expect(isHostAllowed("app.tn.corp", base)).toBe(true);
  });

  it("blocks a non-whitelisted host when allowExternal is false", () => {
    expect(isHostAllowed("evil.com", base)).toBe(false);
  });
});
