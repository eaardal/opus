import "./ProgressBar.css";
import { Task } from "./Sidebar";

interface ProgressBarProps {
  tasks: Task[];
}

export function ProgressBar({ tasks }: ProgressBarProps) {
  if (tasks.length === 0) return null;

  const done = tasks.filter(
    (t) => t.status === "completed" || t.status === "archived",
  ).length;
  const pct = Math.round((done / tasks.length) * 100);

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-bar-label">
        {done}/{tasks.length} ({pct}%)
      </span>
    </div>
  );
}
