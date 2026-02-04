import { Task, TaskStatus, CATEGORIES, STATUSES } from "./Sidebar";

interface TaskItemProps {
  task: Task;
  index: number;
  isHighlighted: boolean;
  isMenuOpen: boolean;
  menuPosition: { top: number; left: number } | null;
  onUpdateText: (text: string) => void;
  onSetCategory: (category: string | undefined) => void;
  onSetStatus: (status: TaskStatus) => void;
  onDelete: () => void;
  onSetHighlighted: (highlighted: boolean) => void;
  onToggleMenu: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  registerRef: (el: HTMLDivElement | null) => void;
  registerInputRef: (el: HTMLInputElement | null) => void;
}

export function TaskItem({
  task,
  index,
  isHighlighted,
  isMenuOpen,
  menuPosition,
  onUpdateText,
  onSetCategory,
  onSetStatus,
  onDelete,
  onSetHighlighted,
  onToggleMenu,
  onKeyDown,
  registerRef,
  registerInputRef,
}: TaskItemProps) {
  return (
    <div
      ref={registerRef}
      className={`task-item ${isHighlighted ? "highlighted" : ""}`}
      onMouseEnter={() => onSetHighlighted(true)}
      onMouseLeave={() => onSetHighlighted(false)}
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
        ref={registerInputRef}
        type="text"
        value={task.text}
        onChange={(e) => onUpdateText(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => onSetHighlighted(true)}
        onBlur={() => onSetHighlighted(false)}
        placeholder="Enter task..."
      />
      <div className="task-menu-container">
        <button className="menu-btn" onClick={onToggleMenu}>
          ⋯
        </button>
        {isMenuOpen && menuPosition && (
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
                onClick={() => onSetStatus(key)}
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
                  onClick={() => onSetCategory(key)}
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
                onClick={() => onSetCategory(undefined)}
              >
                Clear category
              </button>
            )}
          </div>
        )}
      </div>
      <button className="delete-btn" onClick={onDelete}>
        ×
      </button>
    </div>
  );
}
