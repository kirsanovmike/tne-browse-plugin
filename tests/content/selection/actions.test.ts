import { describe, it, expect } from "vitest";
import { selectionPromptFor } from "../../../src/content/selection/actions";

describe("selectionPromptFor", () => {
  it("returns the explain prompt for a known id", () => {
    expect(selectionPromptFor("explain")).toContain("Объясни");
  });

  it("returns distinct prompts per known action", () => {
    const prompts = ["explain", "summarize", "translate", "simplify"].map(selectionPromptFor);
    expect(new Set(prompts).size).toBe(4);
  });

  it("falls back to the explain prompt for an unknown id", () => {
    expect(selectionPromptFor("nope")).toBe(selectionPromptFor("explain"));
  });
});
