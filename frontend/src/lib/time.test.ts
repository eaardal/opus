import { describe, expect, test } from "vitest";
import { formatDurationShort } from "./time";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatDurationShort", () => {
  test("shows days, hours and minutes together", () => {
    expect(formatDurationShort(7 * DAY + 3 * HOUR + 2 * MIN)).toBe("7d 3h 2m");
  });

  test("keeps an interior zero unit", () => {
    expect(formatDurationShort(7 * DAY + 2 * MIN)).toBe("7d 0h 2m");
  });

  test("drops leading zero units", () => {
    expect(formatDurationShort(3 * HOUR + 2 * MIN)).toBe("3h 2m");
    expect(formatDurationShort(45 * MIN)).toBe("45m");
  });

  test("drops trailing zero units", () => {
    expect(formatDurationShort(2 * DAY)).toBe("2d");
    expect(formatDurationShort(3 * HOUR)).toBe("3h");
  });

  test("shows <1m for anything under a minute", () => {
    expect(formatDurationShort(30_000)).toBe("<1m");
    expect(formatDurationShort(0)).toBe("<1m");
  });

  test("never shows a negative duration", () => {
    expect(formatDurationShort(-5000)).toBe("<1m");
  });
});
