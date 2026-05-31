import { describe, expect, test } from "vitest";
import {
  chooseTickStep,
  fractionToTime,
  generateTicks,
  panTimeRange,
  timeToFraction,
  zoomTimeRange,
} from "./timelineScale";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("timeToFraction / fractionToTime", () => {
  const range = { start: 1000, end: 3000 };

  test("maps the range ends to 0 and 1", () => {
    expect(timeToFraction(1000, range)).toBe(0);
    expect(timeToFraction(3000, range)).toBe(1);
  });

  test("maps the midpoint to 0.5 and back", () => {
    expect(timeToFraction(2000, range)).toBe(0.5);
    expect(fractionToTime(0.5, range)).toBe(2000);
  });

  test("returns 0 for a zero-width range instead of dividing by zero", () => {
    expect(timeToFraction(5, { start: 5, end: 5 })).toBe(0);
  });
});

describe("chooseTickStep", () => {
  test("picks a step that keeps the tick count at or below the target", () => {
    expect(chooseTickStep(10 * HOUR, 6)).toBe(2 * HOUR);
    expect(chooseTickStep(50 * MIN, 6)).toBe(10 * MIN);
    expect(chooseTickStep(3 * DAY, 6)).toBe(12 * HOUR);
  });

  test("never returns a step larger than needed (small spans use small steps)", () => {
    expect(chooseTickStep(4 * MIN, 6)).toBe(MIN);
  });
});

describe("generateTicks", () => {
  test("emits aligned ticks across the range, inclusive of the ends", () => {
    expect(generateTicks({ start: 0, end: 10 * HOUR }, 2 * HOUR)).toEqual([
      0,
      2 * HOUR,
      4 * HOUR,
      6 * HOUR,
      8 * HOUR,
      10 * HOUR,
    ]);
  });

  test("starts at the first step boundary inside the range", () => {
    expect(generateTicks({ start: HOUR, end: 9 * HOUR }, 2 * HOUR)).toEqual([
      2 * HOUR,
      4 * HOUR,
      6 * HOUR,
      8 * HOUR,
    ]);
  });
});

describe("zoomTimeRange", () => {
  test("zooms in around the anchor, keeping the anchored time fixed", () => {
    const result = zoomTimeRange({ start: 0, end: 10 }, 0.5, 0.5);
    expect(result).toEqual({ start: 2.5, end: 7.5 });
  });

  test("keeps the left edge fixed when anchored at 0", () => {
    expect(zoomTimeRange({ start: 0, end: 10 }, 0, 0.5)).toEqual({ start: 0, end: 5 });
  });

  test("zooms out when the factor is greater than 1", () => {
    expect(zoomTimeRange({ start: 0, end: 10 }, 0.5, 2)).toEqual({ start: -5, end: 15 });
  });
});

describe("panTimeRange", () => {
  test("shifts the range by a fraction of its span without changing the span", () => {
    expect(panTimeRange({ start: 0, end: 10 }, 0.1)).toEqual({ start: 1, end: 11 });
    expect(panTimeRange({ start: 0, end: 10 }, -0.2)).toEqual({ start: -2, end: 8 });
  });
});
