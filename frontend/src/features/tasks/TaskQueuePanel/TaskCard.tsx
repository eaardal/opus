import type { Task, TaskStatus } from "../../../domain/tasks/types";
import type { CategoryConfig, StatusConfig } from "../theme";

interface TaskCardProps {
  task: Task;
  seqNum: number;
  groupTitle: string | null;
  isHighlighted: boolean;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onRemove: () => void;
  onClick: () => void;
}

export function TaskCard({
  task,
  seqNum,
  groupTitle,
  isHighlighted,
  categories,
  statuses,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onRemove,
  onClick,
}: TaskCardProps) {
  const statusConfig = statuses[task.status] ?? statuses.pending;
  const categoryConfig = task.category ? categories[task.category] : null;
  const accentColor = categoryConfig?.color ?? statusConfig.color;

  return (
    <div
      className={`tq-task-card${isHighlighted ? " tq-task-card--highlighted" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      style={{ borderLeftColor: accentColor }}
    >
      <div className="tq-card-badge">
        <span className="tq-card-seq">#{seqNum}</span>
        <span className="tq-card-emoji" title={statusConfig.label}>
          {statusConfig.emoji}
        </span>
      </div>
      <button
        className="tq-task-remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        tabIndex={-1}
      >
        ×
      </button>
      {groupTitle && (
        <span className="tq-card-group" title={groupTitle}>
          {groupTitle}
        </span>
      )}
      <div className="tq-card-main">
        <span className="tq-task-text">{task.text || "(unnamed)"}</span>
      </div>
    </div>
  );
}
