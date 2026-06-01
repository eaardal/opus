import { useEffect, useRef } from "react";
import "./ProgressBar.css";
import type { Task, TaskStatus } from "../../../domain/tasks/types";
import type { GroupBoxConfig, StatusConfig } from "../theme";
import { rainConfettiFromTop } from "./confetti";

interface ProgressBarProps {
  tasks: Task[];
  statuses: Record<TaskStatus, StatusConfig>;
  groupBox: GroupBoxConfig;
}

// Matches the CSS width transition on the fills, so confetti erupts as the bar
// finishes filling rather than the instant the data hits 100%.
const BAR_FILL_MS = 300;

export function ProgressBar({ tasks, statuses, groupBox }: ProgressBarProps) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "completed" || t.status === "archived").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
  const inProgressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;

  // Celebrate when the whole canvas reaches 100%: confetti erupts across the bar
  // to fill the canvas. Only on a genuine transition to 100% (armed when it
  // crosses), so it never fires for a board that is already complete on load.
  const containerRef = useRef<HTMLDivElement>(null);
  const prevDonePctRef = useRef(donePct);
  useEffect(() => {
    const reached = prevDonePctRef.current < 100 && donePct >= 100 && total > 0;
    prevDonePctRef.current = donePct;
    if (!reached) return;
    const timer = setTimeout(() => {
      // The bar's positioned ancestor is the canvas area; rain from its top.
      const canvas = containerRef.current?.offsetParent;
      if (canvas) rainConfettiFromTop(canvas.getBoundingClientRect());
    }, BAR_FILL_MS);
    return () => clearTimeout(timer);
  }, [donePct, total]);

  if (total === 0) return null;

  return (
    <div className="progress-bar-container" ref={containerRef}>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill-in-progress"
          style={{
            width: `${donePct + inProgressPct}%`,
            background: statuses.in_progress.color,
          }}
        />
        <div
          className="progress-bar-fill"
          style={{ width: `${donePct}%`, background: groupBox.progressCompletedFill }}
        />
      </div>
      <span className="progress-bar-label">
        {done}/{total} ({donePct}%)
      </span>
    </div>
  );
}
