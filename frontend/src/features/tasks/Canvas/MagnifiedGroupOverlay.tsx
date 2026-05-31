import "./MagnifiedTaskOverlay.css";

interface MagnifiedGroupOverlayProps {
  title: string;
  /** Group centre in pixels, relative to the canvas container. */
  left: number;
  top: number;
}

/**
 * The group counterpart to the task magnifier: a read-only card showing just the
 * group's title, centred over the group while magnifying.
 */
export function MagnifiedGroupOverlay({ title, left, top }: MagnifiedGroupOverlayProps) {
  return (
    <div
      className="magnifier-overlay magnifier-group-overlay"
      style={{ left, top, transform: "translate(-50%, -50%)" }}
    >
      <span className="magnifier-group-text">{title || "Untitled Group"}</span>
    </div>
  );
}
