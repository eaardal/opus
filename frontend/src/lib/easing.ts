/**
 * Cubic ease-in-out: starts slow, speeds up through the middle, and slows to a
 * stop. `t` runs 0→1 and the result runs 0→1. Gives animated motion a natural,
 * non-jarring feel compared with a linear ramp.
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
