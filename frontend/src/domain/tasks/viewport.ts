import type { ViewBox } from "./types";

interface Bounds {
  width: number;
  height: number;
}

interface TaskPosition {
  x: number;
  y: number;
}

interface GroupBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Tasks render with their dot at (x,y). The bounds extend further below to
// account for the downward-facing tooltip — tested in viewport.test.ts.
const TASK_HALF_WIDTH = 30;
const TASK_HALF_HEIGHT_TOP = 30;
const TASK_HALF_HEIGHT_BOTTOM = 60;

/**
 * Fit a viewBox to the union of task and group bounds, preserving the screen
 * aspect ratio and adding padding around the content. Returns a screen-sized
 * viewBox at the origin if there is nothing to fit.
 */
export function fitViewBoxToContent(
  tasks: TaskPosition[],
  groups: GroupBounds[],
  screen: Bounds,
  padding: number,
): ViewBox {
  if (tasks.length === 0 && groups.length === 0) {
    return { x: 0, y: 0, width: screen.width, height: screen.height };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const t of tasks) {
    minX = Math.min(minX, t.x - TASK_HALF_WIDTH);
    minY = Math.min(minY, t.y - TASK_HALF_HEIGHT_TOP);
    maxX = Math.max(maxX, t.x + TASK_HALF_WIDTH);
    maxY = Math.max(maxY, t.y + TASK_HALF_HEIGHT_BOTTOM);
  }
  for (const g of groups) {
    minX = Math.min(minX, g.x);
    minY = Math.min(minY, g.y);
    maxX = Math.max(maxX, g.x + g.width);
    maxY = Math.max(maxY, g.y + g.height);
  }

  const contentW = maxX - minX + padding * 2;
  const contentH = maxY - minY + padding * 2;
  const scale = Math.min(screen.width / contentW, screen.height / contentH);
  const fitW = screen.width / scale;
  const fitH = screen.height / scale;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { x: cx - fitW / 2, y: cy - fitH / 2, width: fitW, height: fitH };
}

/**
 * Compute the new viewBox after a zoom gesture anchored at a screen-relative
 * point. `mouseFracX` and `mouseFracY` are 0..1 (left→right, top→bottom).
 * `zoomFactor` > 1 zooms out (matches a positive wheel delta); < 1 zooms in.
 * The resulting zoom level is clamped between minZoom and maxZoom.
 */
export function zoomViewBoxAtPoint(args: {
  viewBox: ViewBox;
  screen: Bounds;
  mouseFracX: number;
  mouseFracY: number;
  zoomFactor: number;
  minZoom: number;
  maxZoom: number;
}): ViewBox {
  const { viewBox, screen, mouseFracX, mouseFracY, zoomFactor, minZoom, maxZoom } = args;
  const currentZoom = screen.width / viewBox.width;
  const newZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom / zoomFactor));
  const newWidth = screen.width / newZoom;
  const newHeight = screen.height / newZoom;
  const newX = viewBox.x + (viewBox.width - newWidth) * mouseFracX;
  const newY = viewBox.y + (viewBox.height - newHeight) * mouseFracY;
  return { x: newX, y: newY, width: newWidth, height: newHeight };
}

/** Center a viewBox on a group with padding around it, preserving screen aspect. */
export function zoomViewBoxToGroup(group: GroupBounds, screen: Bounds, padding: number): ViewBox {
  const contentW = group.width + padding * 2;
  const contentH = group.height + padding * 2;
  const scale = Math.min(screen.width / contentW, screen.height / contentH);
  const fitW = screen.width / scale;
  const fitH = screen.height / scale;
  const cx = group.x + group.width / 2;
  const cy = group.y + group.height / 2;
  return { x: cx - fitW / 2, y: cy - fitH / 2, width: fitW, height: fitH };
}
