import { describe, it, expect } from "vitest";
import { ROLE_PRESETS, DEFAULT_ROLE_ID, resolveRolePrompt } from "../../src/shared/roles";

describe("ROLE_PRESETS", () => {
  it("includes the neutral default plus 4 role presets", () => {
    const ids = ROLE_PRESETS.map((r) => r.id);
    expect(ids).toEqual(["general", "analyst", "support", "developer", "compliance"]);
  });

  it("default role id exists in presets and has an empty prompt", () => {
    const def = ROLE_PRESETS.find((r) => r.id === DEFAULT_ROLE_ID);
    expect(def).toBeTruthy();
    expect(def!.systemPrompt).toBe("");
  });
});

describe("resolveRolePrompt", () => {
  it("returns the preset prompt for a known role", () => {
    expect(resolveRolePrompt("analyst")).toContain("аналит");
  });

  it("returns empty string for the general role", () => {
    expect(resolveRolePrompt("general")).toBe("");
  });

  it("returns empty string for unknown/undefined ids", () => {
    expect(resolveRolePrompt("nope")).toBe("");
    expect(resolveRolePrompt(undefined)).toBe("");
  });
});
