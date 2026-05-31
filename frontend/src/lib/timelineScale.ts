export interface TimeRange {
  start: number;
  end: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// "Nice" step sizes (ms) the time axis snaps its tick spacing to.
const NICE_STEPS = [
  MIN,
  2 * MIN,
  5 * MIN,
  10 * MIN,
  15 * MIN,
  30 * MIN,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  90 * DAY,
  365 * DAY,
];

/** Position of a timestamp within a range, 0 at the start and 1 at the end. */
export function timeToFraction(t: number, range: TimeRange): number {
  const span = range.end - range.start;
  if (span <= 0) return 0;
  return (t - range.start) / span;
}

/** The timestamp at a given 0..1 position within a range. */
export function fractionToTime(fraction: number, range: TimeRange): number {
  return range.start + fraction * (range.end - range.start);
}

/**
 * The smallest "nice" tick step (ms) for which the range spans no more than
 * `maxTicks` ticks. Falls back to the largest step for very wide ranges.
 */
export function chooseTickStep(spanMs: number, maxTicks: number): number {
  for (const step of NICE_STEPS) {
    if (spanMs / step <= maxTicks) return step;
  }
  return NICE_STEPS[NICE_STEPS.length - 1];
}

/** Tick timestamps aligned to `step`, covering [start, end] inclusive. */
export function generateTicks(range: TimeRange, step: number): number[] {
  const ticks: number[] = [];
  const first = Math.ceil(range.start / step) * step;
  for (let t = first; t <= range.end; t += step) {
    ticks.push(t);
  }
  return ticks;
}

/**
 * Zoom a range around an anchor (0..1 position) by `factor`: the span is
 * multiplied by `factor` (>1 zooms out, <1 zooms in) while the time under the
 * anchor stays put.
 */
export function zoomTimeRange(range: TimeRange, anchorFraction: number, factor: number): TimeRange {
  const anchorTime = fractionToTime(anchorFraction, range);
  const newSpan = (range.end - range.start) * factor;
  const start = anchorTime - anchorFraction * newSpan;
  return { start, end: start + newSpan };
}

/** Shift a range by a fraction of its span (positive moves forward in time). */
export function panTimeRange(range: TimeRange, deltaFraction: number): TimeRange {
  const shift = (range.end - range.start) * deltaFraction;
  return { start: range.start + shift, end: range.end + shift };
}
