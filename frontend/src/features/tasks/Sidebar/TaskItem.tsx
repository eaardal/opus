import "./TaskItem.css";
import type { Task, TaskStatus } from "../../../domain/tasks/types";
import type { CategoryConfig, StatusConfig } from "../theme";
import type { Person } from "../../../domain/teams/types";
import { TaskContextMenu } from "../TaskContextMenu";

interface TaskItemProps {
  task: Task;
  index: number;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  /** Reflects canvas selection (selectedNodes). Draws the blue selection outline. */
  isSelected: boolean;
  /** Transient hover echo (this row or its canvas node is being hovered). */
  isPeeked: boolean;
  isMenuOpen: boolean;
  menuPosition: { top: number; left: number } | null;
  onUpdateText: (text: string) => void;
  onSetCategory: (category: string | undefined) => void;
  onSetStatus: (status: TaskStatus) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onLinkTo: () => void;
  onGoToLinkDestination: () => void;
  onRemoveLink: () => void;
  onSetPeeked: (peeked: boolean) => void;
  onToggleMenu: (e: React.MouseEvent) => void;
  onCloseMenu: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  registerRef: (el: HTMLDivElement | null) => void;
  registerInputRef: (el: HTMLInputElement | null) => void;
  people: Person[];
  onAssignPeople: (personIds: string[]) => void;
  /** Zoom the canvas to focus this task (clicking its sequence number). */
  onZoomTo: () => void;
}

export function TaskItem({
  task,
  index,
  categories,
  statuses,
  isSelected,
  isPeeked,
  isMenuOpen,
  menuPosition,
  onUpdateText,
  onSetCategory,
  onSetStatus,
  onDuplicate,
  onCopy,
  onDelete,
  onLinkTo,
  onGoToLinkDestination,
  onRemoveLink,
  onSetPeeked,
  onToggleMenu,
  onCloseMenu,
  onKeyDown,
  registerRef,
  registerInputRef,
  people,
  onAssignPeople,
  onZoomTo,
}: TaskItemProps) {
  return (
    <div
      ref={registerRef}
      className={`task-item ${isSelected ? "selected" : ""} ${isPeeked ? "peeked" : ""}`}
      onMouseEnter={() => onSetPeeked(true)}
      onMouseLeave={() => onSetPeeked(false)}
    >
      <button
        type="button"
        className="task-number"
        style={task.category ? { background: categories[task.category]?.color } : undefined}
        onClick={onZoomTo}
        title="Zoom to task"
      >
        {index + 1}
      </button>
      <span
        className="task-status-dot"
        style={{ background: statuses[task.status]?.color }}
        title={statuses[task.status]?.label}
      />
      <input
        ref={registerInputRef}
        type="text"
        value={task.text}
        onChange={(e) => onUpdateText(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => onSetPeeked(true)}
        onBlur={() => onSetPeeked(false)}
        placeholder="Enter task..."
      />
      <div className="task-menu-container">
        <button className="menu-btn" onClick={onToggleMenu}>
          ⋯
        </button>
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
            onDuplicate={onDuplicate}
            onCopy={onCopy}
            onDelete={onDelete}
            onAssignPeople={onAssignPeople}
            onLinkTo={onLinkTo}
            onGoToLinkDestination={onGoToLinkDestination}
            onRemoveLink={onRemoveLink}
            onClose={onCloseMenu}
          />
        )}
      </div>
    </div>
  );
}
