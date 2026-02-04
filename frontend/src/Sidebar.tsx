import { useRef, useEffect } from "react";

export type TaskStatus = "pending" | "in_progress" | "completed" | "archived";

export interface Task {
  id: string;
  text: string;
  x: number;
  y: number;
  category?: string;
  status: TaskStatus;
}

export const CATEGORIES: Record<string, { label: string; color: string }> = {
  backend: { label: "Backend", color: "#f97316" },
  frontend: { label: "Frontend", color: "#60a5fa" },
  ux: { label: "UX", color: "#f472b6" },
};

export const STATUSES: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#3a3a5a" },
  in_progress: { label: "In Progress", color: "#3737af" },
  completed: { label: "Completed", color: "#2ea058" },
  archived: { label: "Archived", color: "#5e5e5e" },
};

interface SidebarProps {
  width: number;
  tasks: Task[];
  currentFilePath: string | null;
  hasUnsavedChanges: boolean;
  highlightedTaskId: string | null;
  openMenuId: string | null;
  menuPosition: { top: number; left: number } | null;
  focusTaskId: string | null;
  onOpen: () => void;
  onSave: () => void;
  onAddTask: () => void;
  onUpdateTaskText: (id: string, text: string) => void;
  onSetTaskCategory: (id: string, category: string | undefined) => void;
  onSetTaskStatus: (id: string, status: TaskStatus) => void;
  onDeleteTask: (id: string) => void;
  onSetHighlightedTaskId: (id: string | null) => void;
  onSetOpenMenuId: (id: string | null) => void;
  onSetMenuPosition: (position: { top: number; left: number } | null) => void;
  onTaskKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocusTaskId: (id: string | null) => void;
  registerTaskItemRef: (id: string, el: HTMLDivElement | null) => void;
}

export function Sidebar({
  width,
  tasks,
  currentFilePath,
  hasUnsavedChanges,
  highlightedTaskId,
  openMenuId,
  menuPosition,
  focusTaskId,
  onOpen,
  onSave,
  onAddTask,
  onUpdateTaskText,
  onSetTaskCategory,
  onSetTaskStatus,
  onDeleteTask,
  onSetHighlightedTaskId,
  onSetOpenMenuId,
  onSetMenuPosition,
  onTaskKeyDown,
  onFocusTaskId,
  registerTaskItemRef,
}: SidebarProps) {
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (focusTaskId) {
      const input = inputRefs.current.get(focusTaskId);
      if (input) {
        input.focus();
        onFocusTaskId(null);
      }
    }
  }, [focusTaskId, tasks, onFocusTaskId]);

  useEffect(() => {
    const handleClickOutside = () => {
      onSetOpenMenuId(null);
      onSetMenuPosition(null);
    };
    if (openMenuId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openMenuId, onSetOpenMenuId, onSetMenuPosition]);

  return (
    <div className="sidebar" style={{ width, minWidth: width }}>
      <div className="top-section">
        <div className="actionbar">
          <button className="action-btn" onClick={onOpen}>
            Open
          </button>
          <button className="action-btn" onClick={onSave}>
            Save
          </button>
        </div>

        {currentFilePath && (
          <div className="file-info">
            <span className="file-name">
              {currentFilePath.split("/").pop()}
            </span>
            {hasUnsavedChanges && (
              <span className="unsaved-indicator">●</span>
            )}
          </div>
        )}
      </div>
      <h2>Tasks</h2>
      <button className="add-btn" onClick={onAddTask}>
        + Add Task
      </button>
      <div className="task-list">
        {tasks.map((task, index) => (
          <div
            key={task.id}
            ref={(el) => registerTaskItemRef(task.id, el)}
            className={`task-item ${highlightedTaskId === task.id ? "highlighted" : ""}`}
            onMouseEnter={() => onSetHighlightedTaskId(task.id)}
            onMouseLeave={() => onSetHighlightedTaskId(null)}
          >
            <span
              className="task-number"
              style={
                task.category
                  ? { background: CATEGORIES[task.category]?.color }
                  : undefined
              }
            >
              {index + 1}
            </span>
            <input
              ref={(el) => {
                if (el) inputRefs.current.set(task.id, el);
                else inputRefs.current.delete(task.id);
              }}
              type="text"
              value={task.text}
              onChange={(e) => onUpdateTaskText(task.id, e.target.value)}
              onKeyDown={onTaskKeyDown}
              onFocus={() => onSetHighlightedTaskId(task.id)}
              onBlur={() => onSetHighlightedTaskId(null)}
              placeholder="Enter task..."
            />
            <div className="task-menu-container">
              <button
                className="menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (openMenuId === task.id) {
                    onSetOpenMenuId(null);
                    onSetMenuPosition(null);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onSetMenuPosition({ top: rect.bottom + 4, left: rect.right });
                    onSetOpenMenuId(task.id);
                  }
                }}
              >
                ⋯
              </button>
              {openMenuId === task.id && menuPosition && (
                <div
                  className="task-menu"
                  style={{ top: menuPosition.top, left: menuPosition.left }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="menu-section-label">Status</div>
                  {(
                    Object.entries(STATUSES) as [
                      TaskStatus,
                      { label: string; color: string },
                    ][]
                  ).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      className={`menu-item ${task.status === key ? "active" : ""}`}
                      onClick={() => onSetTaskStatus(task.id, key)}
                    >
                      <span
                        className="status-dot"
                        style={{ background: color }}
                      />
                      {label}
                    </button>
                  ))}
                  <div className="menu-section-label">Category</div>
                  {Object.entries(CATEGORIES).map(
                    ([key, { label, color }]) => (
                      <button
                        key={key}
                        className={`menu-item ${task.category === key ? "active" : ""}`}
                        onClick={() => onSetTaskCategory(task.id, key)}
                      >
                        <span
                          className="category-dot"
                          style={{ background: color }}
                        />
                        {label}
                      </button>
                    ),
                  )}
                  {task.category && (
                    <button
                      className="menu-item clear-category"
                      onClick={() => onSetTaskCategory(task.id, undefined)}
                    >
                      Clear category
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              className="delete-btn"
              onClick={() => onDeleteTask(task.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="help-text">
        <p>Cmd/Ctrl+S to save</p>
        <p>Cmd/Ctrl+Enter to add new task</p>
        <p>Shift+drag between nodes to connect</p>
        <p>Shift+click connection to remove</p>
      </div>
    </div>
  );
}
