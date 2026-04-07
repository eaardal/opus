import "./Sidebar.css";
import { ActionBar } from "./ActionBar";
import { TaskList } from "./TaskList";

export type TaskStatus = "pending" | "in_progress" | "completed" | "archived";

export interface Task {
  id: string;
  text: string;
  x: number;
  y: number;
  category?: string;
  status: TaskStatus;
}

export interface Group {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CATEGORIES: Record<string, { label: string; color: string }> = {
  backend: { label: "Backend", color: "#f6b093" },
  frontend: { label: "Frontend", color: "#a0c4f1" },
  ux: { label: "UX", color: "#f0a6ce" },
};

export const STATUSES: Record<TaskStatus, { label: string; color: string; emoji: string }> = {
  pending: { label: "Pending", color: "#3a3a5a", emoji: "💤" },
  in_progress: { label: "In Progress", color: "#3737af", emoji: "👀" },
  completed: { label: "Completed", color: "#2ea058", emoji: "✅" },
  archived: { label: "Archived", color: "#5e5e5e", emoji: "🪦" },
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
  onAddGroup: () => void;
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
  onAddGroup,
}: SidebarProps) {
  return (
    <div className="sidebar" style={{ width, minWidth: width }}>
      <ActionBar
        currentFilePath={currentFilePath}
        hasUnsavedChanges={hasUnsavedChanges}
        onOpen={onOpen}
        onSave={onSave}
      />
      <h2>Tasks</h2>
      <div className="add-buttons">
        <button className="add-btn" onClick={onAddTask}>
          + Add Task
        </button>
        <button className="add-btn" onClick={onAddGroup}>
          + Add Group
        </button>
      </div>
      <TaskList
        tasks={tasks}
        highlightedTaskId={highlightedTaskId}
        openMenuId={openMenuId}
        menuPosition={menuPosition}
        focusTaskId={focusTaskId}
        onUpdateTaskText={onUpdateTaskText}
        onSetTaskCategory={onSetTaskCategory}
        onSetTaskStatus={onSetTaskStatus}
        onDeleteTask={onDeleteTask}
        onSetHighlightedTaskId={onSetHighlightedTaskId}
        onSetOpenMenuId={onSetOpenMenuId}
        onSetMenuPosition={onSetMenuPosition}
        onTaskKeyDown={onTaskKeyDown}
        onFocusTaskId={onFocusTaskId}
        registerTaskItemRef={registerTaskItemRef}
      />
      <div className="help-text">
        <p>Cmd/Ctrl+S to save</p>
        <p>Cmd/Ctrl+Enter to add new task</p>
        <p>Shift+drag between nodes to connect</p>
        <p>Shift+click connection to remove</p>
      </div>
    </div>
  );
}
