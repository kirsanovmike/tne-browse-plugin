import { describe, it, expect } from "vitest";
import {
  DEFAULT_ONBOARDING_STATE,
  ONBOARDING_VERSION,
  shouldAutoStart,
  isHintSeen,
  withHintSeen,
} from "../../../src/content/onboarding/state";

describe("shouldAutoStart", () => {
  it("показывает карусель, когда онбординг ещё не виден (seenVersion null)", () => {
    expect(shouldAutoStart(DEFAULT_ONBOARDING_STATE)).toBe(true);
  });

  it("не показывает, когда онбординг уже отмечен виденным", () => {
    expect(shouldAutoStart({ seenVersion: ONBOARDING_VERSION, hintsSeen: [] })).toBe(false);
  });
});

describe("isHintSeen / withHintSeen", () => {
  it("isHintSeen ложь для невиденной подсказки", () => {
    expect(isHintSeen(DEFAULT_ONBOARDING_STATE, "role")).toBe(false);
  });

  it("withHintSeen добавляет id без дублей и не мутирует исходное состояние", () => {
    const a = withHintSeen(DEFAULT_ONBOARDING_STATE, "role");
    const b = withHintSeen(a, "role");
    expect(a.hintsSeen).toEqual(["role"]);
    expect(b).toBe(a); // дубль → то же состояние
    expect(DEFAULT_ONBOARDING_STATE.hintsSeen).toEqual([]); // без мутации
    expect(isHintSeen(a, "role")).toBe(true);
  });
});
