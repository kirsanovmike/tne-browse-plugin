import { describe, it, expect } from "vitest";
import {
  MAX_IMAGES,
  IMAGE_MAX_SIDE,
  IMAGE_QUALITY,
  VISION_TIMEOUT_MS,
  CAPTURE_MIN_INTERVAL_MS,
} from "../../src/shared/limits";

describe("limits", () => {
  it("holds the Phase 2 vision limits", () => {
    expect(MAX_IMAGES).toBe(5);
    expect(IMAGE_MAX_SIDE).toBe(1600);
    expect(IMAGE_QUALITY).toBeCloseTo(0.8);
    expect(VISION_TIMEOUT_MS).toBe(120000);
    expect(CAPTURE_MIN_INTERVAL_MS).toBe(500);
  });
});
