import { useState } from "react";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import "./Sidebar.css";
import { TaskList } from "./TaskList";
import type { CategoryConfig, StatusConfig } from "../theme";
import type { ProjectSummary } from "../../../services/workspace.types";
import { ProjectSelector } from "../../workspace/ProjectSelector";
import { useWorkspaceRole } from "../../workspace/WorkspaceRoleContext";
import type { Person } from "../../../domain/teams/types";
import type { Group, Task, TaskStatus } from "../../../domain/tasks/types";

interface SidebarProps {
  width: number;
  tasks: Task[];
  groups: Group[];
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  projects: ProjectSummary[];
  activeProjectId: string;
  onSwitchProject: (id: string) => void;
  onOpenProjectAdmin: () => void;
  peekedTaskId: string | null;
  selectedTaskIds: ReadonlySet<string>;
  selectedGroupIds: ReadonlySet<string>;
  openMenuId: string | null;
  menuPosition: { top: number; left: number } | null;
  focusTaskId: string | null;
  onAddTask: () => void;
  onUpdateTaskText: (id: string, text: string) => void;
  onSetTaskCategory: (id: string, category: string | undefined) => void;
  onSetTaskStatus: (id: string, status: TaskStatus) => void;
  onDuplicateTask: (id: string) => void;
  onCopyTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onLinkToTask: (id: string) => void;
  onGoToLinkDestination: (id: string) => void;
  onRemoveLink: (id: string) => void;
  onSetPeekedTaskId: (id: string | null) => void;
  onSetOpenMenuId: (id: string | null) => void;
  onSetMenuPosition: (position: { top: number; left: number } | null) => void;
  onTaskKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocusTaskId: (id: string | null) => void;
  registerTaskItemRef: (id: string, el: HTMLDivElement | null) => void;
  onAddGroup: () => void;
  /** Add a new task placed inside the given group's top-left corner. */
  onAddTaskToGroup: (groupId: string) => void;
  people: Person[];
  onAssignPeople: (taskId: string, personIds: string[]) => void;
  onZoomToGroup: (groupId: string) => void;
  onZoomToTask: (taskId: string) => void;
}

export function Sidebar({
  width,
  tasks,
  groups,
  categories,
  statuses,
  projects,
  activeProjectId,
  onSwitchProject,
  onOpenProjectAdmin,
  peekedTaskId,
  selectedTaskIds,
  selectedGroupIds,
  openMenuId,
  menuPosition,
  focusTaskId,
  onAddTask,
  onUpdateTaskText,
  onSetTaskCategory,
  onSetTaskStatus,
  onDuplicateTask,
  onCopyTask,
  onDeleteTask,
  onLinkToTask,
  onGoToLinkDestination,
  onRemoveLink,
  onSetPeekedTaskId,
  onSetOpenMenuId,
  onSetMenuPosition,
  onTaskKeyDown,
  onFocusTaskId,
  registerTaskItemRef,
  onAddGroup,
  onAddTaskToGroup,
  people,
  onAssignPeople,
  onZoomToGroup,
  onZoomToTask,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { canEdit } = useWorkspaceRole();

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
        <button
          className="add-btn"
          onClick={onAddTask}
          disabled={!canEdit}
          title={canEdit ? undefined : "View-only access"}
        >
          + Add Task
        </button>
        <button
          className="add-btn"
          onClick={onAddGroup}
          disabled={!canEdit}
          title={canEdit ? undefined : "View-only access"}
        >
          + Add Group
        </button>
      </div>
      <TaskList
        tasks={tasks}
        groups={groups}
        categories={categories}
        statuses={statuses}
        peekedTaskId={peekedTaskId}
        selectedTaskIds={selectedTaskIds}
        selectedGroupIds={selectedGroupIds}
        openMenuId={openMenuId}
        menuPosition={menuPosition}
        focusTaskId={focusTaskId}
        onUpdateTaskText={onUpdateTaskText}
        onSetTaskCategory={onSetTaskCategory}
        onSetTaskStatus={onSetTaskStatus}
        onDuplicateTask={onDuplicateTask}
        onCopyTask={onCopyTask}
        onDeleteTask={onDeleteTask}
        onLinkToTask={onLinkToTask}
        onGoToLinkDestination={onGoToLinkDestination}
        onRemoveLink={onRemoveLink}
        onSetPeekedTaskId={onSetPeekedTaskId}
        onSetOpenMenuId={onSetOpenMenuId}
        onSetMenuPosition={onSetMenuPosition}
        onTaskKeyDown={onTaskKeyDown}
        onFocusTaskId={onFocusTaskId}
        registerTaskItemRef={registerTaskItemRef}
        people={people}
        onAssignPeople={onAssignPeople}
        onAddTaskToGroup={onAddTaskToGroup}
        onZoomToGroup={onZoomToGroup}
        onZoomToTask={onZoomToTask}
      />
    </div>
  );
}
