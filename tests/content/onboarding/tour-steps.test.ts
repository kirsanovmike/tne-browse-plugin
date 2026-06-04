import { describe, it, expect } from "vitest";
import { TOUR_STEPS } from "../../../src/content/onboarding/tour-steps";
import { ONBOARDING_ICONS } from "../../../src/content/onboarding/icons";

describe("TOUR_STEPS", () => {
  it("содержит ровно 8 шагов", () => {
    expect(TOUR_STEPS).toHaveLength(8);
  });

  it("у всех шагов уникальный id", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("у каждого шага непустые title/body и валидный placement", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(0);
      expect(["top", "bottom", "auto"]).toContain(step.placement);
    }
  });

  it("icon каждого шага существует в ONBOARDING_ICONS", () => {
    for (const step of TOUR_STEPS) {
      expect(ONBOARDING_ICONS[step.icon]).toBeTruthy();
    }
  });

  it("anchor — непустая строка или непустой массив строк", () => {
    for (const step of TOUR_STEPS) {
      const anchors = Array.isArray(step.anchor) ? step.anchor : [step.anchor];
      expect(anchors.length).toBeGreaterThan(0);
      for (const a of anchors) expect(a.trim().length).toBeGreaterThan(0);
    }
  });
});
