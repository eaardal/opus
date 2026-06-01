import "./GroupProgressBar.css";
import { useAnimatedNumber } from "../../../hooks/useAnimatedNumber";

interface GroupProgressBarProps {
  /** Fraction (0..1) of the group's tasks that are done. */
  donePct: number;
  /** Fraction (0..1) of the group's tasks that are in progress. */
  inProgressPct: number;
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
 * The per-group progress bar. The completed and in-progress fills animate smoothly
 * whenever the group's task statuses change, and a glowing "lead bulb" rides the
 * completed edge while it moves — in either direction, so a regression (a task
 * going from done back to in progress) is just as visible as progress.
 */
export function GroupProgressBar({
  donePct,
  inProgressPct,
  barWidth,
  x,
  y,
  height,
  completedFill,
  inProgressFill,
}: GroupProgressBarProps) {
  const done = useAnimatedNumber(donePct);
  const inProgressEnd = useAnimatedNumber(donePct + inProgressPct);

  const doneWidth = barWidth * done.value;
  const inProgressWidth = barWidth * inProgressEnd.value;

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
        className="group-progress-bulb"
        cx={x + doneWidth}
        cy={y + height / 2}
        r={BULB_RADIUS}
        style={{ fill: completedFill, opacity: done.animating ? 1 : 0 }}
      />
    </g>
  );
}
