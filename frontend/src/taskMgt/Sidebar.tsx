import { useState } from "react";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import "./Sidebar.css";
import { TaskList } from "./TaskList";
import { CategoryConfig, StatusConfig } from "./theme";
import { ProjectData } from "../workspace/types";
import { ProjectSelector } from "../workspace/ProjectSelector";

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
  locked?: boolean;
}

export type NodeShape = "circle" | "diamond";

interface SidebarProps {
  width: number;
  tasks: Task[];
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  projects: ProjectData[];
  activeProjectId: string;
  onSwitchProject: (id: string) => void;
  onOpenProjectAdmin: () => void;
  highlightedTaskId: string | null;
  openMenuId: string | null;
  menuPosition: { top: number; left: number } | null;
  focusTaskId: string | null;
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
  categories,
  statuses,
  projects,
  activeProjectId,
  onSwitchProject,
  onOpenProjectAdmin,
  highlightedTaskId,
  openMenuId,
  menuPosition,
  focusTaskId,
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
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="sidebar sidebar-collapsed">
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar" style={{ width, minWidth: width }}>
      <div className="sidebar-header">
        <ProjectSelector
          projects={projects}
          activeProjectId={activeProjectId}
          onSwitch={onSwitchProject}
          onOpenAdmin={onOpenProjectAdmin}
        />
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>
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
        categories={categories}
        statuses={statuses}
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
    </div>
  );
}
