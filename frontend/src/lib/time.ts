const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Format a duration as a compact "7d 3h 2m" string. Leading and trailing zero
 * units are dropped (interior zeros are kept, e.g. "7d 0h 2m"); anything under
 * a minute is shown as "<1m".
 */
export function formatDurationShort(ms: number): string {
  if (ms < MINUTE_MS) return "<1m";

  const units: [number, string][] = [
    [Math.floor(ms / DAY_MS), "d"],
    [Math.floor(ms / HOUR_MS) % 24, "h"],
    [Math.floor(ms / MINUTE_MS) % 60, "m"],
  ];

  const firstIndex = units.findIndex(([value]) => value > 0);
  if (firstIndex === -1) return "<1m";

  let lastIndex = units.length - 1;
  while (lastIndex > firstIndex && units[lastIndex][0] === 0) lastIndex--;

  return units
    .slice(firstIndex, lastIndex + 1)
    .map(([value, unit]) => `${value}${unit}`)
    .join(" ");
}
