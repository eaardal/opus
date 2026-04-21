import "./TaskItem.css";
import { Task, TaskStatus } from "./Sidebar";
import { CategoryConfig, StatusConfig } from "./theme";
import { Person } from "../teamMgt/types";
import { TaskContextMenu } from "./TaskContextMenu";

interface TaskItemProps {
  task: Task;
  index: number;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  isHighlighted: boolean;
  isMenuOpen: boolean;
  menuPosition: { top: number; left: number } | null;
  onUpdateText: (text: string) => void;
  onSetCategory: (category: string | undefined) => void;
  onSetStatus: (status: TaskStatus) => void;
  onDelete: () => void;
  onSetHighlighted: (highlighted: boolean) => void;
  onToggleMenu: (e: React.MouseEvent) => void;
  onCloseMenu: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  registerRef: (el: HTMLDivElement | null) => void;
  registerInputRef: (el: HTMLInputElement | null) => void;
  people: Person[];
  onAssignPeople: (personIds: string[]) => void;
}

export function TaskItem({
  task,
  index,
  categories,
  statuses,
  isHighlighted,
  isMenuOpen,
  menuPosition,
  onUpdateText,
  onSetCategory,
  onSetStatus,
  onDelete,
  onSetHighlighted,
  onToggleMenu,
  onCloseMenu,
  onKeyDown,
  registerRef,
  registerInputRef,
  people,
  onAssignPeople,
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
        style={task.category ? { background: categories[task.category]?.color } : undefined}
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
        <button className="menu-btn" onClick={onToggleMenu}>⋯</button>
        {isMenuOpen && menuPosition && (
          <TaskContextMenu
            task={task}
            x={menuPosition.left}
            y={menuPosition.top}
            categories={categories}
            statuses={statuses}
            people={people}
            onSetStatus={onSetStatus}
            onSetCategory={onSetCategory}
            onDelete={onDelete}
            onAssignPeople={onAssignPeople}
            onClose={onCloseMenu}
          />
        )}
      </div>
    </div>
  );
}
