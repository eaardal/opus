import { describe, expect, test } from "vitest";
import { easeInOutCubic } from "./easing";

describe("easeInOutCubic", () => {
  test("is pinned at the endpoints", () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0, 10);
    expect(easeInOutCubic(1)).toBeCloseTo(1, 10);
  });

  test("passes through the midpoint", () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  test("eases in slowly (below linear in the first half)", () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
  });

  test("eases out slowly (above linear in the second half)", () => {
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });
});
