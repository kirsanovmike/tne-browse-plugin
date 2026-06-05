import { describe, it, expect } from "vitest";
import {
  DEFAULT_ONBOARDING_STATE,
  ONBOARDING_VERSION,
  shouldAutoStart,
} from "../../../src/content/onboarding/state";

describe("shouldAutoStart", () => {
  it("показывает карусель, когда онбординг ещё не виден (seenVersion null)", () => {
    expect(shouldAutoStart(DEFAULT_ONBOARDING_STATE)).toBe(true);
  });

  it("не показывает, когда онбординг уже отмечен виденным", () => {
    expect(shouldAutoStart({ seenVersion: ONBOARDING_VERSION, hintsSeen: [] })).toBe(false);
  });
});
