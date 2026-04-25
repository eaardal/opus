import { describe, expect, test, vi } from "vitest";
import { toSvgCoords } from "./svgCoords";

/**
 * jsdom does not implement SVGSVGElement.createSVGPoint / getScreenCTM, so we
 * mock the SVG-level API with stand-ins that do enough matrix math to verify
 * the function multiplies by the inverse CTM and returns the resulting point.
 */
function makeSvgWithCtm(
  ctm: { a: number; b: number; c: number; d: number; e: number; f: number } | null,
) {
  const pt = { x: 0, y: 0, matrixTransform: vi.fn() };
  pt.matrixTransform = vi.fn((m: { e: number; f: number }) => ({ x: pt.x + m.e, y: pt.y + m.f }));
  return {
    createSVGPoint: () => pt,
    getScreenCTM: () =>
      ctm
        ? {
            inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: -ctm.e, f: -ctm.f }),
          }
        : null,
  } as unknown as SVGSVGElement;
}

describe("toSvgCoords", () => {
  test("returns the origin when the SVG has no screen CTM yet", () => {
    const svg = makeSvgWithCtm(null);
    expect(toSvgCoords(svg, 100, 200)).toEqual({ x: 0, y: 0 });
  });

  test("subtracts the SVG screen offset from client coordinates", () => {
    // SVG positioned at (50, 30) on screen, no scale.
    const svg = makeSvgWithCtm({ a: 1, b: 0, c: 0, d: 1, e: 50, f: 30 });
    expect(toSvgCoords(svg, 200, 130)).toEqual({ x: 150, y: 100 });
  });
});
