/** Gap (px) between the cursor anchor and the panel's nearest edge. */
export const MAGNIFIER_CURSOR_GAP = 16;

interface Anchor {
  left: number;
  top: number;
}

interface PanelSize {
  width: number;
  height: number;
}

interface Bounds {
  width: number;
  height: number;
}

interface Position {
  left: number;
  top: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Places the magnifier panel relative to the cursor `anchor`, preferring its
 * resting spot above and to the right. When that would push the panel past an
 * edge of `bounds` (the canvas container), it flips to the opposite side — left
 * of the cursor near the right edge, below it near the top — and finally clamps
 * so the panel stays fully inside the bounds even when neither side fits.
 *
 * All values are pixels in the container's coordinate space; the result is the
 * panel's top-left corner.
 */
export function magnifierPanelPosition(
  anchor: Anchor,
  panel: PanelSize,
  bounds: Bounds,
  gap: number = MAGNIFIER_CURSOR_GAP,
): Position {
  // Horizontal: rest to the right of the cursor; flip left if it would overflow.
  let left = anchor.left + gap;
  if (left + panel.width > bounds.width) {
    left = anchor.left - gap - panel.width;
  }

  // Vertical: rest above the cursor; flip below if it would overflow the top.
  let top = anchor.top - gap - panel.height;
  if (top < 0) {
    top = anchor.top + gap;
  }

  return {
    left: clamp(left, 0, Math.max(0, bounds.width - panel.width)),
    top: clamp(top, 0, Math.max(0, bounds.height - panel.height)),
  };
}
