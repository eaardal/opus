import { describe, expect, test } from "vitest";
import { magnifierPanelPosition } from "./magnifierPanelPosition";

const GAP = 16;
const PANEL = { width: 100, height: 80 };
const BOUNDS = { width: 1000, height: 1000 };

describe("magnifierPanelPosition", () => {
  test("rests above and to the right of the cursor when there is room", () => {
    const pos = magnifierPanelPosition({ left: 200, top: 200 }, PANEL, BOUNDS, GAP);

    expect(pos).toEqual({ left: 216, top: 104 });
  });

  test("flips to the left of the cursor near the right edge", () => {
    const pos = magnifierPanelPosition({ left: 960, top: 500 }, PANEL, BOUNDS, GAP);

    expect(pos).toEqual({ left: 844, top: 404 });
  });

  test("flips below the cursor near the top edge", () => {
    const pos = magnifierPanelPosition({ left: 200, top: 10 }, PANEL, BOUNDS, GAP);

    expect(pos).toEqual({ left: 216, top: 26 });
  });

  test("flips on both axes near the top-right corner", () => {
    const pos = magnifierPanelPosition({ left: 960, top: 10 }, PANEL, BOUNDS, GAP);

    expect(pos).toEqual({ left: 844, top: 26 });
  });

  test("clamps to the origin when the panel is larger than the bounds", () => {
    const pos = magnifierPanelPosition(
      { left: 50, top: 50 },
      { width: 1200, height: 1100 },
      BOUNDS,
      GAP,
    );

    expect(pos).toEqual({ left: 0, top: 0 });
  });
});
