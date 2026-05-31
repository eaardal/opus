import { describe, expect, test } from "vitest";
import {
  centerViewBoxOnPoint,
  fitViewBoxToContent,
  lerpViewBox,
  wheelZoomFactor,
  zoomViewBoxAtPoint,
  zoomViewBoxToGroup,
} from "./viewport";

describe("fitViewBoxToContent", () => {
  const screen = { width: 800, height: 600 };

  test("returns a screen-sized origin viewBox when there is no content", () => {
    expect(fitViewBoxToContent([], [], screen, 60)).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
  });

  test("frames a single task with padding while preserving the screen aspect ratio", () => {
    // Task at (100,100) → bounds [70,70]→[130,160]; size 60×90.
    // With padding 60 → 180×210; screen aspect 4:3 wins on height; scale=600/210.
    const result = fitViewBoxToContent([{ x: 100, y: 100 }], [], screen, 60);
    expect(result.width).toBeCloseTo(280, 5);
    expect(result.height).toBeCloseTo(210, 5);
    expect(result.x).toBeCloseTo(-40, 5);
    expect(result.y).toBeCloseTo(10, 5);
  });

  test("expands bounds to include groups", () => {
    const result = fitViewBoxToContent(
      [{ x: 0, y: 0 }],
      [{ x: 200, y: 100, width: 100, height: 50 }],
      screen,
      0,
    );
    expect(result.width).toBeCloseTo(330, 5);
    expect(result.height).toBeCloseTo(247.5, 5);
    expect(result.x).toBeCloseTo(-30, 5);
    expect(result.y).toBeCloseTo(-63.75, 5);
  });

  test("works with negative coordinates", () => {
    const result = fitViewBoxToContent([{ x: -100, y: -100 }], [], { width: 200, height: 200 }, 10);
    // Square content 80×110 with padding 10 → fit on height (110)
    expect(result.width).toBeCloseTo(110, 5);
    expect(result.height).toBeCloseTo(110, 5);
  });

  test("uses task asymmetric bounds (extra space below for tooltip)", () => {
    // Task bounds extend further below (60) than above (30) — verify by
    // checking that the centre y is shifted downward from the task's own y.
    const result = fitViewBoxToContent([{ x: 0, y: 0 }], [], { width: 100, height: 100 }, 0);
    // Raw bounds: x ∈ [-30, 30], y ∈ [-30, 60].  centre y = (-30+60)/2 = 15.
    // Square screen + content 60×90 → fit on height: scale 100/90; both
    // viewBox dims become 90 (preserves screen aspect).
    expect(result.width).toBeCloseTo(90, 5);
    expect(result.height).toBeCloseTo(90, 5);
    // x-centre is 0; y-centre is shifted down because of the bottom bias.
    expect(result.x).toBeCloseTo(-45, 5); // 0 - 90/2
    expect(result.y).toBeCloseTo(-30, 5); // 15 - 90/2
  });
});

describe("zoomViewBoxAtPoint", () => {
  const screen = { width: 1000, height: 800 };
  const limits = { minZoom: 0.2, maxZoom: 5 };

  test("zooming keeps the mouse anchor at the same world coordinate", () => {
    // The whole point of mouse-anchored zoom: the world point under the cursor
    // shouldn't move on screen. Verify by computing world(mouseFrac) before/after.
    const viewBox = { x: 0, y: 0, width: 1000, height: 800 };
    const mouseFracX = 0.3;
    const mouseFracY = 0.7;

    const result = zoomViewBoxAtPoint({
      viewBox,
      screen,
      mouseFracX,
      mouseFracY,
      zoomFactor: 0.5,
      ...limits,
    });

    const worldXBefore = viewBox.x + viewBox.width * mouseFracX;
    const worldYBefore = viewBox.y + viewBox.height * mouseFracY;
    const worldXAfter = result.x + result.width * mouseFracX;
    const worldYAfter = result.y + result.height * mouseFracY;
    expect(worldXAfter).toBeCloseTo(worldXBefore, 5);
    expect(worldYAfter).toBeCloseTo(worldYBefore, 5);
  });

  test("zooming out at the top-left corner keeps the world origin in view", () => {
    const viewBox = { x: 0, y: 0, width: 500, height: 400 };
    const result = zoomViewBoxAtPoint({
      viewBox,
      screen,
      mouseFracX: 0,
      mouseFracY: 0,
      zoomFactor: 2,
      ...limits,
    });
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(0, 5);
    // currentZoom = 1000/500 = 2; newZoom = 2/2 = 1 → newWidth = 1000, newHeight = 800
    expect(result.width).toBeCloseTo(1000, 5);
    expect(result.height).toBeCloseTo(800, 5);
  });

  test("clamps to maxZoom when zooming further in is requested", () => {
    // Already at max zoom (5×): currentZoom = 1000/200 = 5.
    const viewBox = { x: 0, y: 0, width: 200, height: 160 };
    const result = zoomViewBoxAtPoint({
      viewBox,
      screen,
      mouseFracX: 0.5,
      mouseFracY: 0.5,
      zoomFactor: 0.5,
      ...limits,
    });
    expect(result.width).toBeCloseTo(200, 5);
    expect(result.height).toBeCloseTo(160, 5);
  });

  test("clamps to minZoom when zooming further out is requested", () => {
    // Already at min zoom (0.2×): currentZoom = 1000/5000 = 0.2.
    const viewBox = { x: 0, y: 0, width: 5000, height: 4000 };
    const result = zoomViewBoxAtPoint({
      viewBox,
      screen,
      mouseFracX: 0.5,
      mouseFracY: 0.5,
      zoomFactor: 2,
      ...limits,
    });
    expect(result.width).toBeCloseTo(5000, 5);
    expect(result.height).toBeCloseTo(4000, 5);
  });
});

describe("wheelZoomFactor", () => {
  test("returns 1 for no scroll", () => {
    expect(wheelZoomFactor(0)).toBeCloseTo(1, 10);
  });

  test("is below 1 when zooming in (negative delta) and above 1 when zooming out", () => {
    expect(wheelZoomFactor(-10)).toBeLessThan(1);
    expect(wheelZoomFactor(10)).toBeGreaterThan(1);
  });

  test("stays strictly positive even for extreme deltas", () => {
    // The old linear `1 + delta * k` went negative here and snapped the zoom to
    // a limit — the reported jump/reset. exp() can never do that.
    expect(wheelZoomFactor(-100000)).toBeGreaterThan(0);
    expect(wheelZoomFactor(100000)).toBeGreaterThan(0);
  });

  test("clamps the per-event step so aggressive scrolling can't overshoot", () => {
    // Beyond the clamp, a bigger delta makes no further difference.
    expect(wheelZoomFactor(-100)).toBeCloseTo(wheelZoomFactor(-100000), 10);
    expect(wheelZoomFactor(100)).toBeCloseTo(wheelZoomFactor(100000), 10);
    // A single event never changes zoom by more than ~25%.
    expect(wheelZoomFactor(-100000)).toBeGreaterThan(0.75);
    expect(wheelZoomFactor(100000)).toBeLessThan(1.35);
  });

  test("normalizes line-mode deltas so mice that report lines still zoom", () => {
    // deltaMode 1 (lines) carries small numbers; treated as pixels it would
    // barely zoom. A line delta should move more than the same pixel delta.
    expect(wheelZoomFactor(-3, 1)).toBeLessThan(wheelZoomFactor(-3, 0));
  });
});

describe("wheelZoomFactor + zoomViewBoxAtPoint (regression: no reset at max zoom)", () => {
  test("an aggressive zoom-in at max zoom stays at max instead of resetting", () => {
    const screen = { width: 1000, height: 800 };
    // Already at max zoom (5×): viewBox.width = 1000 / 5 = 200.
    const viewBox = { x: 0, y: 0, width: 200, height: 160 };
    const result = zoomViewBoxAtPoint({
      viewBox,
      screen,
      mouseFracX: 0.5,
      mouseFracY: 0.5,
      zoomFactor: wheelZoomFactor(-100), // a hard mouse-wheel flick inward
      minZoom: 0.2,
      maxZoom: 5,
    });
    expect(screen.width / result.width).toBeCloseTo(5, 5);
  });
});

describe("centerViewBoxOnPoint", () => {
  test("centers a viewBox of the given width on the point, preserving screen aspect", () => {
    // screen 800×600 → aspect 0.75; viewWidth 600 → height 450.
    const result = centerViewBoxOnPoint({ x: 100, y: 100 }, { width: 800, height: 600 }, 600);
    expect(result.width).toBeCloseTo(600, 5);
    expect(result.height).toBeCloseTo(450, 5);
    // The point sits at the centre of the resulting viewBox.
    expect(result.x + result.width / 2).toBeCloseTo(100, 5);
    expect(result.y + result.height / 2).toBeCloseTo(100, 5);
  });

  test("falls back to a square viewBox when the screen has no width", () => {
    const result = centerViewBoxOnPoint({ x: 0, y: 0 }, { width: 0, height: 0 }, 500);
    expect(result.width).toBeCloseTo(500, 5);
    expect(result.height).toBeCloseTo(500, 5);
    expect(result.x).toBeCloseTo(-250, 5);
    expect(result.y).toBeCloseTo(-250, 5);
  });
});

describe("lerpViewBox", () => {
  const from = { x: 0, y: 0, width: 100, height: 100 };
  const to = { x: 100, y: 200, width: 300, height: 400 };

  test("returns the start viewBox at t=0", () => {
    expect(lerpViewBox(from, to, 0)).toEqual(from);
  });

  test("returns the end viewBox at t=1", () => {
    expect(lerpViewBox(from, to, 1)).toEqual(to);
  });

  test("interpolates each field linearly at t=0.5", () => {
    expect(lerpViewBox(from, to, 0.5)).toEqual({ x: 50, y: 100, width: 200, height: 250 });
  });
});

describe("zoomViewBoxToGroup", () => {
  test("centers viewBox on the group with padding while preserving screen aspect", () => {
    const group = { x: 100, y: 100, width: 200, height: 100 };
    const screen = { width: 800, height: 600 };
    // Content with padding 50: 300×200; screen 4:3, content 3:2 → fit width.
    // scale = 800/300 = 2.667; fitW = 300, fitH = 600/2.667 = 225.
    // center (200, 150); x = 200 - 150 = 50; y = 150 - 112.5 = 37.5.
    const result = zoomViewBoxToGroup(group, screen, 50);
    expect(result.width).toBeCloseTo(300, 5);
    expect(result.height).toBeCloseTo(225, 5);
    expect(result.x).toBeCloseTo(50, 5);
    expect(result.y).toBeCloseTo(37.5, 5);
  });
});
