import type { Ref } from "react";
import "./GroupProgressBar.css";

interface GroupProgressBarProps {
  /** Ref to the lead bulb, so its on-screen position can be read (for confetti). */
  bulbRef?: Ref<SVGCircleElement>;
  /** Animated completed fraction (0..1). */
  doneValue: number;
  /** Animated combined done + in-progress fraction (0..1) — the in-progress edge. */
  inProgressValue: number;
  /** Whether the completed edge is animating; drives the lead bulb's visibility. */
  doneAnimating: boolean;
  /** Inner width of the bar in canvas units. */
  barWidth: number;
  x: number;
  y: number;
  height: number;
  /** Fill for the completed portion. */
  completedFill: string;
  /** Fill for the in-progress portion. */
  inProgressFill: string;
}

// Radius of the lead bulb; larger than the bar height so it bulges out and draws
// the eye to the moving edge.
const BULB_RADIUS = 4;

/**
 * The per-group progress bar (completed + in-progress fills) with a glowing "lead
 * bulb" that rides the completed edge while it moves — in either direction, so a
 * regression (a task going from done back to in progress) is as visible as
 * progress. Presentational: the parent owns the animation and feeds the animated
 * values, so the bar and the big progress number stay in lockstep.
 */
export function GroupProgressBar({
  bulbRef,
  doneValue,
  inProgressValue,
  doneAnimating,
  barWidth,
  x,
  y,
  height,
  completedFill,
  inProgressFill,
}: GroupProgressBarProps) {
  const doneWidth = barWidth * doneValue;
  const inProgressWidth = barWidth * inProgressValue;

  return (
    <g>
      <rect className="group-progress-track" x={x} y={y} width={barWidth} height={height} rx="2" />
      {inProgressWidth > 0 && (
        <rect
          className="group-progress-in-progress"
          x={x}
          y={y}
          width={inProgressWidth}
          height={height}
          rx="2"
          style={{ fill: inProgressFill }}
        />
      )}
      {doneWidth > 0 && (
        <rect
          className="group-progress-fill"
          x={x}
          y={y}
          width={doneWidth}
          height={height}
          rx="2"
          style={{ fill: completedFill }}
        />
      )}
      <circle
        ref={bulbRef}
        className="group-progress-bulb"
        cx={x + doneWidth}
        cy={y + height / 2}
        r={BULB_RADIUS}
        style={{ fill: completedFill, opacity: doneAnimating ? 1 : 0 }}
      />
    </g>
  );
}
