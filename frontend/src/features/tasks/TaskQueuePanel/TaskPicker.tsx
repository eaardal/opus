import { useState } from "react";
import type { Task, TaskStatus } from "../../../domain/tasks/types";
import type { CategoryConfig, StatusConfig } from "../theme";

interface TaskPickerProps {
  tasks: Task[];
  excludeIds: Set<string>;
  position: { x: number; y: number };
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  onSelect: (taskId: string) => void;
  onClose: () => void;
}

function matchesFilter(task: Task, seqNum: number, raw: string): boolean {
  const lower = raw.toLowerCase().trim();
  if (!lower) return true;
  const numQuery = lower.startsWith("#") ? lower.slice(1) : lower;
  if (/^\d+$/.test(numQuery) && String(seqNum).includes(numQuery)) return true;
  return (task.text || "").toLowerCase().includes(lower);
}

export function TaskPicker({
  tasks,
  excludeIds,
  position,
  categories,
  statuses,
  onSelect,
  onClose,
}: TaskPickerProps) {
  const [filter, setFilter] = useState("");
  const filtered = tasks
    .map((t, i) => ({ task: t, seq: i + 1 }))
    .filter(({ task, seq }) => !excludeIds.has(task.id) && matchesFilter(task, seq, filter));

  return (
    <>
      <div className="tq-picker-backdrop" onClick={onClose} />
      <div
        className="tq-task-picker"
        style={{ position: "fixed", left: position.x, top: position.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="tq-picker-filter"
          placeholder="Filter by name or #number..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            e.stopPropagation();
          }}
        />
        <div className="tq-picker-list">
          {filtered.length === 0 ? (
            <div className="tq-picker-empty">No tasks found</div>
          ) : (
            filtered.map(({ task, seq }) => {
              const statusConfig = statuses[task.status];
              const categoryConfig = task.category ? categories[task.category] : null;
              return (
                <button
                  key={task.id}
                  className="tq-picker-item tq-picker-task-item"
                  onClick={() => {
                    onSelect(task.id);
                    onClose();
                  }}
                >
                  <span className="tq-picker-seq">#{seq}</span>
                  <span className="tq-picker-task-text">{task.text || "(unnamed task)"}</span>
                  <span className="tq-picker-badges">
                    {categoryConfig && (
                      <span
                        className="tq-picker-dot"
                        style={{ background: categoryConfig.color }}
                        title={categoryConfig.label}
                      />
                    )}
                    <span
                      className="tq-picker-dot"
                      style={{
                        background: statusConfig.color,
                        outline: "1px solid rgba(0,0,0,0.15)",
                      }}
                      title={statusConfig.label}
                    />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
