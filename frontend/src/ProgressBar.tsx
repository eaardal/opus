import "./ProgressBar.css";
import { Task, TaskStatus } from "./Sidebar";
import { StatusConfig } from "./theme";

interface ProgressBarProps {
  tasks: Task[];
  statuses: Record<TaskStatus, StatusConfig>;
}

export function ProgressBar({ tasks, statuses }: ProgressBarProps) {
  if (tasks.length === 0) return null;

  const done = tasks.filter(
    (t) => t.status === "completed" || t.status === "archived",
  ).length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const donePct = Math.round((done / tasks.length) * 100);
  const inProgressPct = Math.round((inProgress / tasks.length) * 100);

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill-in-progress"
          style={{
            width: `${donePct + inProgressPct}%`,
            background: statuses.in_progress.color,
          }}
        />
        <div className="progress-bar-fill" style={{ width: `${donePct}%` }} />
      </div>
      <span className="progress-bar-label">
        {done}/{tasks.length} ({donePct}%)
      </span>
    </div>
  );
}
