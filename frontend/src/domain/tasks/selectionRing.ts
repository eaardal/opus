import type { NodeShape } from "./types";

// The base node geometries, mirroring the shapes drawn in TaskNode.
const CIRCLE_RADIUS = 25;
const DIAMOND_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, -30],
  [30, 0],
  [0, 30],
  [-30, 0],
];
const TRIANGLE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, -30],
  [26, 20],
  [-26, 20],
];

export type NodeRingGeometry = { kind: "circle"; r: number } | { kind: "polygon"; points: string };

/**
 * Geometry for a selection/peek ring drawn around a task node, sitting `gap`
 * units outside the node's own shape. Pure so it can be unit-tested without a
 * DOM — TaskNode renders the returned shape as a stroked, fill-less SVG element.
 */
export function nodeSelectionRing(shape: NodeShape, gap: number): NodeRingGeometry {
  if (shape === "circle") return { kind: "circle", r: CIRCLE_RADIUS + gap };
  const base = shape === "diamond" ? DIAMOND_POINTS : TRIANGLE_POINTS;
  return { kind: "polygon", points: expandFromCentroid(base, gap) };
}

/** Move each vertex `gap` units away from the polygon's centroid. */
function expandFromCentroid(points: ReadonlyArray<readonly [number, number]>, gap: number): string {
  const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  return points
    .map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      const length = Math.hypot(dx, dy) || 1;
      const factor = (length + gap) / length;
      return `${round(cx + dx * factor)},${round(cy + dy * factor)}`;
    })
    .join(" ");
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
