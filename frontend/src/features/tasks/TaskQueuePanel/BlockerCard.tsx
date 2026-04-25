import type { Task, TaskStatus } from "../../../domain/tasks/types";
import type { Person } from "../../../domain/teams/types";
import type { CategoryConfig, StatusConfig } from "../theme";
import { PersonAvatar } from "./PersonAvatar";

interface BlockerCardProps {
  task: Task;
  seqNum: number;
  groupTitle: string | null;
  assignedPeople: Person[];
  isHighlighted: boolean;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  onClick: () => void;
}

export function BlockerCard({
  task,
  seqNum,
  groupTitle,
  assignedPeople,
  isHighlighted,
  categories,
  statuses,
  onClick,
}: BlockerCardProps) {
  const statusConfig = statuses[task.status] ?? statuses.pending;
  const categoryConfig = task.category ? categories[task.category] : null;
  const accentColor = categoryConfig?.color ?? statusConfig.color;

  return (
    <div
      className={`tq-task-card tq-blocker-card${isHighlighted ? " tq-task-card--highlighted" : ""}`}
      onClick={onClick}
      style={{ borderLeftColor: accentColor }}
    >
      <div className="tq-card-badge">
        <span className="tq-card-seq">#{seqNum}</span>
        <span className="tq-card-emoji" title={statusConfig.label}>
          {statusConfig.emoji}
        </span>
      </div>
      {groupTitle && (
        <span className="tq-card-group" title={groupTitle}>
          {groupTitle}
        </span>
      )}
      <div className="tq-card-main">
        <span className="tq-task-text">{task.text || "(unnamed)"}</span>
      </div>
      {assignedPeople.length > 0 && (
        <div className="tq-blocker-assignees">
          {assignedPeople.map((p) => (
            <PersonAvatar key={p.id} person={p} size={14} />
          ))}
          <span className="tq-blocker-assignee-names">
            {assignedPeople.map((p) => p.name || "?").join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
