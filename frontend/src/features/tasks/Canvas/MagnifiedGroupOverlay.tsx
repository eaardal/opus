import { useLayoutEffect, useRef, useState } from "react";
import "./MagnifiedTaskOverlay.css";
import { magnifierPanelPosition } from "../../../lib/magnifierPanelPosition";

interface MagnifiedGroupOverlayProps {
  title: string;
  /**
   * The anchor point in pixels, relative to the canvas container — the trailing
   * cursor while magnifying, or the group centre as a fallback. The card floats
   * above and to the right of this point, flipping/clamping near an edge.
   */
  left: number;
  top: number;
  /** Canvas container size in pixels, used to keep the card within view. */
  bounds: { width: number; height: number };
}

/**
 * The group counterpart to the task magnifier: a read-only card showing just the
 * group's title, trailing the cursor while magnifying. Its size is content-driven,
 * so it measures itself and then places the card near the cursor but within the
 * canvas bounds (see `magnifierPanelPosition`).
 */
export function MagnifiedGroupOverlay({ title, left, top, bounds }: MagnifiedGroupOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    setSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    );
  });

  const position = size ? magnifierPanelPosition({ left, top }, size, bounds) : null;

  return (
    <div
      ref={ref}
      className="magnifier-overlay magnifier-group-overlay"
      style={{
        left: position?.left ?? left,
        top: position?.top ?? top,
        visibility: position ? "visible" : "hidden",
      }}
    >
      <span className="magnifier-group-text">{title || "Untitled Group"}</span>
    </div>
  );
}
