import { describe, it, expect } from "vitest";
import { computeScaledSize, dataUrlToBase64 } from "../../../src/content/vision/image-compressor";

describe("computeScaledSize", () => {
  it("does not upscale smaller images", () => {
    expect(computeScaledSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("scales by the longer side", () => {
    expect(computeScaledSize(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
  });

  it("scales a tall image by height", () => {
    expect(computeScaledSize(1000, 4000, 1600)).toEqual({ width: 400, height: 1600 });
  });

  it("rounds fractional sizes", () => {
    expect(computeScaledSize(1500, 1000, 1000)).toEqual({ width: 1000, height: 667 });
  });

  it("returns zeros for a zero-sized image", () => {
    expect(computeScaledSize(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });
});

describe("dataUrlToBase64", () => {
  it("strips the data: prefix", () => {
    expect(dataUrlToBase64("data:image/jpeg;base64,AAAB")).toBe("AAAB");
  });

  it("passes through already-clean base64", () => {
    expect(dataUrlToBase64("AAAB")).toBe("AAAB");
  });

  it("returns empty string for a trailing comma", () => {
    expect(dataUrlToBase64("data:image/png;base64,")).toBe("");
  });
});
