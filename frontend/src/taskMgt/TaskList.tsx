import { useRef, useEffect } from "react";
import "./TaskList.css";
import { Task, TaskStatus } from "./Sidebar";
import { TaskItem } from "./TaskItem";
import { CategoryConfig, StatusConfig } from "./theme";
import { Person } from "../teamMgt/types";

interface TaskListProps {
  tasks: Task[];
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  highlightedTaskId: string | null;
  openMenuId: string | null;
  menuPosition: { top: number; left: number } | null;
  focusTaskId: string | null;
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
  people: Person[];
  onAssignPeople: (taskId: string, personIds: string[]) => void;
}

export function TaskList({
  tasks,
  categories,
  statuses,
  highlightedTaskId,
  openMenuId,
  menuPosition,
  focusTaskId,
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
  people,
  onAssignPeople,
}: TaskListProps) {
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

  const handleOpenMenu = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (openMenuId === taskId) {
      onSetOpenMenuId(null);
      onSetMenuPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      onSetMenuPosition({ top: rect.bottom + 4, left: rect.left });
      onSetOpenMenuId(taskId);
    }
  };

  const handleCloseMenu = () => {
    onSetOpenMenuId(null);
    onSetMenuPosition(null);
  };

  return (
    <div className="task-list">
      {tasks.map((task, index) => (
        <TaskItem
          key={task.id}
          task={task}
          index={index}
          categories={categories}
          statuses={statuses}
          isHighlighted={highlightedTaskId === task.id}
          isMenuOpen={openMenuId === task.id}
          menuPosition={menuPosition}
          onUpdateText={(text) => onUpdateTaskText(task.id, text)}
          onSetCategory={(category) => onSetTaskCategory(task.id, category)}
          onSetStatus={(status) => onSetTaskStatus(task.id, status)}
          onDelete={() => onDeleteTask(task.id)}
          onSetHighlighted={(highlighted) =>
            onSetHighlightedTaskId(highlighted ? task.id : null)
          }
          onToggleMenu={(e) => handleOpenMenu(task.id, e)}
          onCloseMenu={handleCloseMenu}
          onKeyDown={onTaskKeyDown}
          registerRef={(el) => registerTaskItemRef(task.id, el)}
          registerInputRef={(el) => {
            if (el) inputRefs.current.set(task.id, el);
            else inputRefs.current.delete(task.id);
          }}
          people={people}
          onAssignPeople={(ids) => onAssignPeople(task.id, ids)}
        />
      ))}
    </div>
  );
}
