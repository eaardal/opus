import { useRef, useEffect } from "react";
import "./TaskList.css";
import type { Task, Group, TaskStatus } from "../../../domain/tasks/types";
import { TaskItem } from "./TaskItem";
import type { CategoryConfig, StatusConfig } from "../theme";
import type { Person } from "../../../domain/teams/types";
import { useWorkspaceRole } from "../../workspace/WorkspaceRoleContext";

interface TaskListProps {
  tasks: Task[];
  groups: Group[];
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  peekedTaskId: string | null;
  selectedTaskIds: ReadonlySet<string>;
  selectedGroupIds: ReadonlySet<string>;
  openMenuId: string | null;
  menuPosition: { top: number; left: number } | null;
  focusTaskId: string | null;
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
  people: Person[];
  onAssignPeople: (taskId: string, personIds: string[]) => void;
  /** Zoom the canvas to focus a group when its sidebar header is clicked. */
  onZoomToGroup: (groupId: string) => void;
  /** Zoom the canvas to focus a task when its sequence number is clicked. */
  onZoomToTask: (taskId: string) => void;
  /** Add a new task placed inside the given group's top-left corner. */
  onAddTaskToGroup: (groupId: string) => void;
}

export function TaskList({
  tasks,
  groups,
  categories,
  statuses,
  peekedTaskId,
  selectedTaskIds,
  selectedGroupIds,
  openMenuId,
  menuPosition,
  focusTaskId,
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
  people,
  onAssignPeople,
  onZoomToGroup,
  onZoomToTask,
  onAddTaskToGroup,
}: TaskListProps) {
  const { canEdit } = useWorkspaceRole();
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (!focusTaskId) return;
    const input = inputRefs.current.get(focusTaskId);
    if (input) {
      input.focus();
      onFocusTaskId(null);
    }
  }, [focusTaskId, onFocusTaskId]);

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

  const findGroup = (task: Task): Group | null =>
    groups.find(
      (g) => task.x >= g.x && task.x <= g.x + g.width && task.y >= g.y && task.y <= g.y + g.height,
    ) ?? null;

  const grouped = new Map<string | null, Task[]>();
  for (const task of tasks) {
    const group = findGroup(task);
    const key = group ? group.id : null;
    const existing = grouped.get(key);
    if (existing) existing.push(task);
    else grouped.set(key, [task]);
  }

  const ungroupedTasks = grouped.get(null) ?? [];
  const groupedSections = groups
    .filter((g) => grouped.has(g.id))
    .map((g) => ({ group: g, groupTasks: grouped.get(g.id) ?? [] }));

  const renderTask = (task: Task) => {
    return (
      <TaskItem
        key={task.id}
        task={task}
        categories={categories}
        statuses={statuses}
        isSelected={selectedTaskIds.has(task.id)}
        isPeeked={peekedTaskId === task.id}
        isMenuOpen={openMenuId === task.id}
        menuPosition={menuPosition}
        onUpdateText={(text) => onUpdateTaskText(task.id, text)}
        onSetCategory={(category) => onSetTaskCategory(task.id, category)}
        onSetStatus={(status) => onSetTaskStatus(task.id, status)}
        onDuplicate={() => onDuplicateTask(task.id)}
        onCopy={() => onCopyTask(task.id)}
        onDelete={() => onDeleteTask(task.id)}
        onLinkTo={() => onLinkToTask(task.id)}
        onGoToLinkDestination={() => onGoToLinkDestination(task.id)}
        onRemoveLink={() => onRemoveLink(task.id)}
        onSetPeeked={(peeked) => onSetPeekedTaskId(peeked ? task.id : null)}
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
        onZoomTo={() => onZoomToTask(task.id)}
      />
    );
  };

  return (
    <div className="task-list">
      {/* Ungrouped tasks (e.g. ones just created via Add Task) get their own
          labelled section at the top, kept clearly apart from the groups below. */}
      <div className="task-list-group">
        <div className="task-list-group-header">Ungrouped</div>
        {ungroupedTasks.length > 0 ? (
          ungroupedTasks.map(renderTask)
        ) : (
          <div className="task-list-empty">No ungrouped tasks</div>
        )}
      </div>

      {groupedSections.length > 0 && <div className="task-list-divider" />}

      {groupedSections.map(({ group, groupTasks }) => (
        <div key={group.id} className="task-list-group">
          <button
            type="button"
            className={`task-list-group-header task-list-group-link ${selectedGroupIds.has(group.id) ? "selected" : ""}`}
            onClick={() => onZoomToGroup(group.id)}
            title="Zoom to group"
          >
            {group.title || "(unnamed group)"}
          </button>
          {groupTasks.map(renderTask)}
          <button
            type="button"
            className="task-list-add-task"
            onClick={() => onAddTaskToGroup(group.id)}
            disabled={!canEdit}
            title={canEdit ? "Add a task to this group" : "View-only access"}
          >
            + Add Task
          </button>
        </div>
      ))}
    </div>
  );
}
