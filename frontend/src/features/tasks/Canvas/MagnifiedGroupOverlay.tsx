import "./MagnifiedTaskOverlay.css";

interface MagnifiedGroupOverlayProps {
  title: string;
  /**
   * The anchor point in pixels, relative to the canvas container — the trailing
   * cursor while magnifying, or the group centre as a fallback. The card floats
   * above and to the right of this point (see `.magnifier-overlay` in CSS).
   */
  left: number;
  top: number;
}

/**
 * The group counterpart to the task magnifier: a read-only card showing just the
 * group's title, trailing the cursor while magnifying.
 */
export function MagnifiedGroupOverlay({ title, left, top }: MagnifiedGroupOverlayProps) {
  return (
    <div className="magnifier-overlay magnifier-group-overlay" style={{ left, top }}>
      <span className="magnifier-group-text">{title || "Untitled Group"}</span>
    </div>
  );
}
