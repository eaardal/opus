import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import "./TasksApp.css";
import {
  applyPaste,
  deserializeClipboard,
  duplicateElements,
  serializeSelection,
} from "../../domain/tasks/clipboard";
import {
  addGroup as addGroupOp,
  addTask as addTaskOp,
  deleteEntities,
  deleteGroup as deleteGroupOp,
  deleteTaskCascading,
  moveGroupWithTasks as moveGroupWithTasksOp,
  removeConnection as removeConnectionOp,
  toggleGroupLock as toggleGroupLockOp,
  updateGroup as updateGroupOp,
  updateTask as updateTaskOp,
} from "../../domain/tasks/operations";
import { backfillUpdate, recordAssignment, recordStatusChange } from "../../domain/tasks/timeline";
import type { Group, Task, TaskStatus, ViewBox } from "../../domain/tasks/types";
import { zoomViewBoxToGroup } from "../../domain/tasks/viewport";
import type { Person } from "../../domain/teams/types";
import { useDragSelection } from "../../hooks/useDragSelection";
import { useGlobalKeyboardShortcuts } from "../../hooks/useGlobalKeyboardShortcuts";
import { type HistoryStep, useHistory } from "../../hooks/useHistory";
import { useResizableSidebar } from "../../hooks/useResizableSidebar";
import { useViewBoxAnimation } from "../../hooks/useViewBoxAnimation";
import { loadViewBox, saveViewBox } from "../../lib/viewBox";
import { workspaceService } from "../../services/container";
import type { ProjectSummary } from "../../services/workspace.types";
import { confirm } from "../../ui/ConfirmModal";
import { useWorkspaceRole } from "../workspace/WorkspaceRoleContext";
import { Canvas, type CanvasHandle } from "./Canvas/Canvas";
import { Sidebar } from "./Sidebar/Sidebar";
import { getCategories, getStatuses } from "./theme";

const DEFAULT_VIEW_BOX: ViewBox = { x: 0, y: 0, width: 1200, height: 800 };

interface AppProps {
  workspaceId: string;
  projectId: string;
  projects?: ProjectSummary[];
  activeProjectId?: string;
  onSwitchProject?: (id: string) => void;
  onOpenProjectAdmin?: () => void;
  people?: Person[];
}

export interface TaskMgtAppHandle {
  exportAsPng: () => void;
  openSettings: () => void;
  openHelp: () => void;
}

const App = forwardRef<TaskMgtAppHandle, AppProps>(function App(
  {
    workspaceId,
    projectId,
    projects = [],
    activeProjectId = "",
    onSwitchProject = () => {},
    onOpenProjectAdmin = () => {},
    people = [],
  },
  ref,
) {
  const { canEdit } = useWorkspaceRole();

  const [loadStatus, setLoadStatus] = useState<"loading" | "ready">("loading");
  // Ref so the once-bound subscribeProjectContent callback always reads the current value.
  const loadStatusRef = useRef<"loading" | "ready">("loading");
  loadStatusRef.current = loadStatus;

  const history = useHistory({ tasks: [], connections: [], groups: [] });
  const push: typeof history.push = canEdit ? history.push : () => {};
  const replace: typeof history.replace = canEdit ? history.replace : () => {};
  const undo: typeof history.undo = canEdit ? history.undo : () => null;
  const redo: typeof history.redo = canEdit ? history.redo : () => null;
  const { present, canUndo, canRedo, reconcileRemote, reset: resetHistory } = history;
  const { tasks, connections, groups } = present;
  const presentRef = useRef(present);
  presentRef.current = present;

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [viewBox, setViewBox] = useState<ViewBox>(loadViewBox(projectId) ?? DEFAULT_VIEW_BOX);
  // True only on the first-ever open of this project (no viewBox persisted yet),
  // letting the canvas fit-to-screen once instead of showing the default view.
  const [autoFitOnLoad] = useState(() => loadViewBox(projectId) === null);

  // ── Remote reconciliation ──────────────────────────────────────────────────

  // Use a ref for isDragging so it can be read from the subscription callback
  // without being listed as an effect dependency.
  const isDraggingRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: component is key-remounted on workspaceId/projectId change; subscription is intentionally bound once
  useEffect(() => {
    const unsub = workspaceService.subscribeProjectContent(workspaceId, projectId, (content) => {
      if (!content) return;

      if (loadStatusRef.current === "loading") {
        resetHistory({
          tasks: content.tasks,
          connections: content.projectDoc.connections,
          groups: content.groups,
        });
        setTheme(content.projectDoc.theme);
        setLoadStatus("ready");
        return;
      }

      if (isDraggingRef.current) return;

      // reconcileRemote updates the live view without touching historical
      // entries, so an in-flight remote echo cannot corrupt the slot that
      // a pending undo/redo is about to navigate to.
      reconcileRemote({
        tasks: content.tasks,
        connections: content.projectDoc.connections,
        groups: content.groups,
      });
      setTheme(content.projectDoc.theme);
    });
    return unsub;
    // workspaceId and projectId are stable for the lifetime of this component
    // (key-based remount on change), so we intentionally exclude them here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Backfill in-progress tracking for tasks created before this feature ──────
  // Any in_progress task missing an open interval (or assigned person missing an
  // assignment time) gets one written starting "now" — so it shows up in the
  // timeline without the user toggling its status. Persist-only: the live
  // subscription echoes the change back into local state, which avoids racing
  // the reconcile. The id set stops us re-writing a task before its echo
  // arrives, which would keep resetting its start time.
  const backfilledIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!canEdit) return;
    const now = Date.now();
    for (const task of tasks) {
      if (backfilledIdsRef.current.has(task.id)) continue;
      const update = backfillUpdate(task, now);
      if (!update) continue;
      backfilledIdsRef.current.add(task.id);
      workspaceService.updateTask(workspaceId, projectId, task.id, update).catch((err) => {
        backfilledIdsRef.current.delete(task.id); // allow a retry on a later update
        console.error(err);
      });
    }
  }, [tasks, canEdit, workspaceId, projectId]);

  // ── Undo / redo Firestore batch sync ──────────────────────────────────────

  const syncHistoryStep = useCallback(
    (step: HistoryStep) => {
      const deletedTaskIds = step.before.tasks
        .filter((t) => !step.after.tasks.some((nt) => nt.id === t.id))
        .map((t) => t.id);
      const deletedGroupIds = step.before.groups
        .filter((g) => !step.after.groups.some((ng) => ng.id === g.id))
        .map((g) => g.id);
      workspaceService
        .syncProjectState(workspaceId, projectId, step.after, deletedTaskIds, deletedGroupIds)
        .catch(console.error);
    },
    [workspaceId, projectId],
  );

  const wrappedUndo = useCallback(() => {
    const step = undo();
    if (step) syncHistoryStep(step);
  }, [undo, syncHistoryStep]);

  const wrappedRedo = useCallback(() => {
    const step = redo();
    if (step) syncHistoryStep(step);
  }, [redo, syncHistoryStep]);

  // ── ViewBox persistence (localStorage) ────────────────────────────────────

  const handleViewBoxChange = useCallback(
    (vb: ViewBox) => {
      setViewBox(vb);
      saveViewBox(projectId, vb);
    },
    [projectId],
  );

  // Glide to a target viewport (e.g. "zoom to group") with an eased ~500 ms
  // transition instead of jumping there.
  const animateViewBoxTo = useViewBoxAnimation(viewBox, handleViewBoxChange, 500);

  const categories = getCategories();
  const statuses = getStatuses();

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  // The task whose inline title editor is open on the canvas. Set when a task
  // is created via the canvas so the user can type its title immediately.
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  // The group whose title editor is open on the canvas. Set when a group is
  // created via the canvas so the user can type its title immediately.
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const canvasRef = useRef<CanvasHandle>(null);
  const taskItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Latest pointer position (client coords) so Cmd/Ctrl+V can paste under the
  // cursor rather than at the viewport centre.
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const {
    width: sidebarWidth,
    isResizing,
    startResize: handleResizeMouseDown,
  } = useResizableSidebar({ initialWidth: 350, minWidth: 200, maxWidth: 600 });

  // ── Drag-complete and connection callbacks (Firestore writes) ────────────────

  const handleConnectionAdded = useCallback(
    (from: string, to: string) => {
      workspaceService.addConnection(workspaceId, projectId, { from, to }).catch(console.error);
    },
    [workspaceId, projectId],
  );

  const handleDragComplete = useCallback(
    (movedTaskIds: string[], movedGroupIds: string[]) => {
      isDraggingRef.current = false;
      const state = presentRef.current;
      movedTaskIds.forEach((id) => {
        const task = state.tasks.find((t) => t.id === id);
        if (task) {
          workspaceService
            .updateTask(workspaceId, projectId, id, { x: task.x, y: task.y })
            .catch(console.error);
        }
      });
      movedGroupIds.forEach((id) => {
        const group = state.groups.find((g) => g.id === id);
        if (group) {
          workspaceService
            .updateGroup(workspaceId, projectId, id, {
              x: group.x,
              y: group.y,
              width: group.width,
              height: group.height,
            })
            .catch(console.error);
        }
      });
    },
    [workspaceId, projectId],
  );

  const dragSelection = useDragSelection({
    present,
    push,
    replace,
    getSvgCoords: (e) => canvasRef.current?.getSvgCoords(e) ?? { x: 0, y: 0 },
    onClearHighlight: () => setHighlightedTaskId(null),
    onDragComplete: handleDragComplete,
    onConnectionAdded: handleConnectionAdded,
  });

  const {
    draggingNode,
    connecting,
    selection,
    selectedNodes,
    selectedGroups,
    isDragging,
    handleNodeMouseDown,
    handleGroupMouseDown,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    clearSelection,
    selectElements,
  } = dragSelection;

  // Keep the ref in sync for the subscription callback to read.
  isDraggingRef.current = isDragging;

  useImperativeHandle(ref, () => ({
    exportAsPng: () => canvasRef.current?.exportAsPng(),
    openSettings: () => canvasRef.current?.openSettings(),
    openHelp: () => canvasRef.current?.openHelp(),
  }));

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const handleDeleteSelected = useCallback(async () => {
    if (selectedNodes.size === 0 && selectedGroups.size === 0) return;
    const selectedTaskList = tasks.filter((t) => selectedNodes.has(t.id));
    const selectedGroupList = groups.filter((g) => selectedGroups.has(g.id));

    const lines = [
      ...selectedTaskList.map((t) => `  • Task: "${t.text || "(unnamed)"}"`),
      ...selectedGroupList.map((g) => `  • Group: "${g.title || "(unnamed)"}"`),
    ].join("\n");

    const confirmed = await confirm({
      title: "Delete Selected",
      message: `Delete the following?\n\n${lines}${selectedTaskList.length > 0 ? "\n\nConnections to deleted tasks will also be removed." : ""}`,
      confirmLabel: "Delete",
    });

    if (confirmed) {
      const taskIds = new Set(selectedTaskList.map((t) => t.id));
      const groupIds = new Set(selectedGroupList.map((g) => g.id));
      const next = deleteEntities({ tasks, connections, groups }, taskIds, groupIds);
      push(next);
      clearSelection();
      workspaceService
        .deleteManyEntities(
          workspaceId,
          projectId,
          Array.from(taskIds),
          Array.from(groupIds),
          next.connections,
        )
        .catch(console.error);
    }
  }, [
    selectedNodes,
    selectedGroups,
    tasks,
    groups,
    connections,
    push,
    clearSelection,
    workspaceId,
    projectId,
  ]);

  const handleCopy = useCallback(async () => {
    if (selectedNodes.size === 0 && selectedGroups.size === 0) return;
    const serialized = serializeSelection({
      selectedTaskIds: selectedNodes,
      selectedGroupIds: selectedGroups,
      tasks,
      connections,
      groups,
      workspaceId,
    });
    if (!serialized) return;
    try {
      await navigator.clipboard.writeText(serialized);
    } catch {
      // Clipboard access denied — silent fail
    }
  }, [selectedNodes, selectedGroups, tasks, connections, groups, workspaceId]);

  const handlePaste = useCallback(
    async (targetPoint?: { x: number; y: number }) => {
      try {
        const raw = await navigator.clipboard.readText();
        const clipboard = deserializeClipboard(raw);
        if (!clipboard) return;
        const result = applyPaste({
          clipboard,
          currentWorkspaceId: workspaceId,
          viewBox,
          targetPoint,
        });
        push({
          tasks: [...tasks, ...result.tasks],
          connections: [...connections, ...result.connections],
          groups: [...groups, ...result.groups],
        });
        selectElements(
          new Set(result.tasks.map((t) => t.id)),
          new Set(result.groups.map((g) => g.id)),
        );
        Promise.all([
          ...result.tasks.map((t) => workspaceService.addTask(workspaceId, projectId, t)),
          ...result.groups.map((g) => workspaceService.addGroup(workspaceId, projectId, g)),
          ...result.connections.map((c) =>
            workspaceService.addConnection(workspaceId, projectId, c),
          ),
        ]).catch(console.error);
      } catch {
        console.warn("[canvas] Paste failed — clipboard may be empty or access denied");
      }
    },
    [tasks, connections, groups, viewBox, workspaceId, projectId, push, selectElements],
  );

  useEffect(() => {
    const trackPointer = (e: MouseEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", trackPointer);
    return () => window.removeEventListener("mousemove", trackPointer);
  }, []);

  // Cmd/Ctrl+V entry point: paste under the cursor when it is over the canvas,
  // otherwise fall back to the viewport-centred paste.
  const handlePasteAtPointer = useCallback(() => {
    const handle = canvasRef.current;
    const pointer = lastPointerRef.current;
    const svg = handle?.getSvgElement();
    if (handle && pointer && svg) {
      const elementAtPointer = document.elementFromPoint(pointer.x, pointer.y);
      if (elementAtPointer && svg.contains(elementAtPointer)) {
        void handlePaste(handle.clientToSvgCoords(pointer.x, pointer.y));
        return;
      }
    }
    void handlePaste();
  }, [handlePaste]);

  const checkPasteAvailable = useCallback(async (): Promise<boolean> => {
    try {
      const raw = await navigator.clipboard.readText();
      return deserializeClipboard(raw) !== null;
    } catch {
      return false;
    }
  }, []);

  const handleSelectAll = useCallback(() => {
    selectElements(new Set(tasks.map((t) => t.id)), new Set(groups.map((g) => g.id)));
  }, [tasks, groups, selectElements]);

  const handleDuplicate = useCallback(() => {
    if (selectedNodes.size === 0 && selectedGroups.size === 0) return;
    const result = duplicateElements({
      selectedTaskIds: selectedNodes,
      selectedGroupIds: selectedGroups,
      tasks,
      groups,
    });
    push({
      tasks: [...tasks, ...result.tasks],
      connections,
      groups: [...groups, ...result.groups],
    });
    selectElements(new Set(result.tasks.map((t) => t.id)), new Set(result.groups.map((g) => g.id)));
    Promise.all([
      ...result.tasks.map((t) => workspaceService.addTask(workspaceId, projectId, t)),
      ...result.groups.map((g) => workspaceService.addGroup(workspaceId, projectId, g)),
    ]).catch(console.error);
  }, [
    selectedNodes,
    selectedGroups,
    tasks,
    groups,
    connections,
    push,
    selectElements,
    workspaceId,
    projectId,
  ]);

  const handleDuplicateTask = useCallback(
    (taskId: string) => {
      const result = duplicateElements({
        selectedTaskIds: new Set([taskId]),
        selectedGroupIds: new Set(),
        tasks,
        groups,
      });
      push({
        tasks: [...tasks, ...result.tasks],
        connections,
        groups: [...groups, ...result.groups],
      });
      selectElements(new Set(result.tasks.map((t) => t.id)), new Set());
      Promise.all(
        result.tasks.map((t) => workspaceService.addTask(workspaceId, projectId, t)),
      ).catch(console.error);
    },
    [tasks, groups, connections, push, selectElements, workspaceId, projectId],
  );

  const handleCopyTask = useCallback(
    async (taskId: string) => {
      const serialized = serializeSelection({
        selectedTaskIds: new Set([taskId]),
        selectedGroupIds: new Set(),
        tasks,
        connections,
        groups,
        workspaceId,
      });
      if (!serialized) return;
      try {
        await navigator.clipboard.writeText(serialized);
      } catch {
        // Clipboard access denied — silent fail
      }
    },
    [tasks, connections, groups, workspaceId],
  );

  const { shiftPressed } = useGlobalKeyboardShortcuts({
    onUndo: wrappedUndo,
    onRedo: wrappedRedo,
    onEscape: clearSelection,
    onDelete: handleDeleteSelected,
    onCopy: handleCopy,
    onPaste: handlePasteAtPointer,
    onSelectAll: handleSelectAll,
    onDuplicate: handleDuplicate,
  });

  const buildNewTask = (x: number, y: number): Task => ({
    id: crypto.randomUUID(),
    text: "",
    x,
    y,
    status: "pending",
  });

  const buildNewGroup = (x: number, y: number): Group => ({
    id: crypto.randomUUID(),
    title: "New Group",
    x,
    y,
    width: 200,
    height: 150,
  });

  const addTask = () => {
    const newTask = buildNewTask(viewBox.x + 50, viewBox.y + 50);
    push({ tasks: addTaskOp(present.tasks, newTask), connections, groups });
    setFocusTaskId(newTask.id);
    workspaceService.addTask(workspaceId, projectId, newTask).catch(console.error);
  };

  const addTaskAt = (x: number, y: number) => {
    const newTask = buildNewTask(x, y);
    push({ tasks: addTaskOp(present.tasks, newTask), connections, groups });
    setEditingNodeId(newTask.id);
    workspaceService.addTask(workspaceId, projectId, newTask).catch(console.error);
  };

  const addGroupAt = (x: number, y: number) => {
    const newGroup = buildNewGroup(x, y);
    push({ tasks, connections, groups: addGroupOp(groups, newGroup) });
    setEditingGroupId(newGroup.id);
    workspaceService.addGroup(workspaceId, projectId, newGroup).catch(console.error);
  };

  const handleTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      addTask();
    }
  };

  const updateTaskText = (id: string, text: string) => {
    push({ tasks: updateTaskOp(tasks, id, { text }), connections, groups });
    workspaceService.updateTask(workspaceId, projectId, id, { text }).catch(console.error);
  };

  const setTaskCategory = (id: string, category: string | undefined) => {
    push({ tasks: updateTaskOp(tasks, id, { category }), connections, groups });
    setOpenMenuId(null);
    workspaceService.updateTask(workspaceId, projectId, id, { category }).catch(console.error);
  };

  const setTaskStatus = (id: string, status: TaskStatus) => {
    const now = Date.now();
    const nextTasks = tasks.map((t) => (t.id === id ? recordStatusChange(t, status, now) : t));
    push({ tasks: nextTasks, connections, groups });
    setOpenMenuId(null);
    const updated = nextTasks.find((t) => t.id === id);
    if (updated) {
      workspaceService
        .updateTask(workspaceId, projectId, id, {
          status: updated.status,
          inProgressIntervals: updated.inProgressIntervals ?? [],
        })
        .catch(console.error);
    }
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    const taskName = task?.text || "this task";
    const confirmed = await confirm({
      title: "Delete Task",
      message: `Delete "${taskName}"?`,
      confirmLabel: "Delete",
    });
    if (confirmed) {
      const next = deleteTaskCascading(tasks, connections, id);
      push({ tasks: next.tasks, connections: next.connections, groups });
      workspaceService
        .deleteTask(workspaceId, projectId, id, next.connections)
        .catch(console.error);
    }
  };

  const addGroup = () => {
    const newGroup = buildNewGroup(viewBox.x + 20, viewBox.y + 20);
    push({ tasks, connections, groups: addGroupOp(groups, newGroup) });
    workspaceService.addGroup(workspaceId, projectId, newGroup).catch(console.error);
  };

  const handleGroupMoveStart = useCallback(() => {
    isDraggingRef.current = true;
    push(presentRef.current);
  }, [push]);

  const handleGroupResizeStart = useCallback(() => {
    push(presentRef.current);
  }, [push]);

  const moveGroup = useCallback(
    (id: string, x: number, y: number) => {
      const { tasks: t, connections: c, groups: g } = presentRef.current;
      replace({ tasks: t, connections: c, groups: updateGroupOp(g, id, { x, y }) });
    },
    [replace],
  );

  const moveGroupAndTasks = useCallback(
    (id: string, x: number, y: number, taskIds: ReadonlySet<string>) => {
      const { tasks: t, connections: c, groups: g } = presentRef.current;
      const { tasks: nextTasks, groups: nextGroups } = moveGroupWithTasksOp(
        t,
        g,
        id,
        x,
        y,
        taskIds,
      );
      replace({ tasks: nextTasks, connections: c, groups: nextGroups });
    },
    [replace],
  );

  const handleGroupMoveEnd = useCallback(
    (id: string, movedTaskIds: ReadonlySet<string>) => {
      isDraggingRef.current = false;
      const state = presentRef.current;
      const group = state.groups.find((g) => g.id === id);
      if (group) {
        workspaceService
          .updateGroup(workspaceId, projectId, id, { x: group.x, y: group.y })
          .catch(console.error);
      }
      for (const taskId of movedTaskIds) {
        const task = state.tasks.find((t) => t.id === taskId);
        if (task) {
          workspaceService
            .updateTask(workspaceId, projectId, taskId, { x: task.x, y: task.y })
            .catch(console.error);
        }
      }
    },
    [workspaceId, projectId],
  );

  const resizeGroup = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      const { tasks: t, connections: c, groups: g } = presentRef.current;
      replace({ tasks: t, connections: c, groups: updateGroupOp(g, id, { x, y, width, height }) });
    },
    [replace],
  );

  const handleGroupResizeEnd = useCallback(
    (id: string) => {
      const group = presentRef.current.groups.find((g) => g.id === id);
      if (group) {
        workspaceService
          .updateGroup(workspaceId, projectId, id, {
            x: group.x,
            y: group.y,
            width: group.width,
            height: group.height,
          })
          .catch(console.error);
      }
    },
    [workspaceId, projectId],
  );

  const deleteGroup = async (id: string) => {
    const group = groups.find((g) => g.id === id);
    const groupName = group?.title || "this group";
    const confirmed = await confirm({
      title: "Delete Group",
      message: `Delete "${groupName}"? The tasks inside will not be deleted.`,
      confirmLabel: "Delete",
    });
    if (confirmed) {
      push({ tasks, connections, groups: deleteGroupOp(groups, id) });
      workspaceService.deleteGroup(workspaceId, projectId, id).catch(console.error);
    }
  };

  const toggleGroupLock = (id: string) => {
    const next = toggleGroupLockOp(groups, id);
    push({ tasks, connections, groups: next });
    const group = next.find((g) => g.id === id);
    if (group) {
      workspaceService
        .updateGroup(workspaceId, projectId, id, { locked: group.locked })
        .catch(console.error);
    }
  };

  const assignPeople = (taskId: string, personIds: string[]) => {
    const now = Date.now();
    const nextTasks = tasks.map((t) => (t.id === taskId ? recordAssignment(t, personIds, now) : t));
    push({ tasks: nextTasks, connections, groups });
    const updated = nextTasks.find((t) => t.id === taskId);
    if (updated) {
      workspaceService
        .updateTask(workspaceId, projectId, taskId, {
          assignedPersonIds: updated.assignedPersonIds ?? [],
          assignedAt: updated.assignedAt ?? {},
        })
        .catch(console.error);
    }
  };

  const assignPersonAndSetInProgress = (taskId: string, personId: string) => {
    const now = Date.now();
    const nextTasks = tasks.map((t) => {
      if (t.id !== taskId) return t;
      const existing = t.assignedPersonIds ?? [];
      const personIds = existing.includes(personId) ? existing : [...existing, personId];
      return recordStatusChange(recordAssignment(t, personIds, now), "in_progress", now);
    });
    push({ tasks: nextTasks, connections, groups });
    const updated = nextTasks.find((t) => t.id === taskId);
    if (updated) {
      workspaceService
        .updateTask(workspaceId, projectId, taskId, {
          assignedPersonIds: updated.assignedPersonIds ?? [],
          assignedAt: updated.assignedAt ?? {},
          status: updated.status,
          inProgressIntervals: updated.inProgressIntervals ?? [],
        })
        .catch(console.error);
    }
  };

  const updateGroupTitle = (id: string, title: string) => {
    push({ tasks, connections, groups: updateGroupOp(groups, id, { title }) });
    workspaceService.updateGroup(workspaceId, projectId, id, { title }).catch(console.error);
  };

  const zoomToGroup = (id: string) => {
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    const svg = canvasRef.current?.getSvgElement();
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const newVb = zoomViewBoxToGroup(group, { width: rect.width, height: rect.height }, 80);
    animateViewBoxTo(newVb);
  };

  const handleNodeClick = (taskId: string) => {
    setHighlightedTaskId(taskId);
    const taskItem = taskItemRefs.current.get(taskId);
    if (taskItem) {
      taskItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handleRemoveConnection = (e: React.MouseEvent, from: string, to: string) => {
    if (e.shiftKey) {
      const next = removeConnectionOp(connections, from, to);
      push({ tasks, connections: next, groups });
      workspaceService.removeConnection(workspaceId, projectId, { from, to }).catch(console.error);
    }
  };

  const registerTaskItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) taskItemRefs.current.set(id, el);
    else taskItemRefs.current.delete(id);
  }, []);

  if (loadStatus === "loading") {
    return <div className="canvas-loading">Loading project…</div>;
  }

  return (
    <div id="App" className={isResizing ? "resizing" : ""}>
      <Sidebar
        width={sidebarWidth}
        tasks={tasks}
        groups={groups}
        categories={categories}
        statuses={statuses}
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={onSwitchProject}
        onOpenProjectAdmin={onOpenProjectAdmin}
        highlightedTaskId={highlightedTaskId}
        openMenuId={openMenuId}
        menuPosition={menuPosition}
        focusTaskId={focusTaskId}
        onAddTask={addTask}
        onUpdateTaskText={updateTaskText}
        onSetTaskCategory={setTaskCategory}
        onSetTaskStatus={setTaskStatus}
        onDuplicateTask={handleDuplicateTask}
        onCopyTask={handleCopyTask}
        onDeleteTask={deleteTask}
        onSetHighlightedTaskId={setHighlightedTaskId}
        onSetOpenMenuId={setOpenMenuId}
        onSetMenuPosition={setMenuPosition}
        onTaskKeyDown={handleTaskKeyDown}
        onFocusTaskId={setFocusTaskId}
        registerTaskItemRef={registerTaskItemRef}
        onAddGroup={addGroup}
        people={people}
        onAssignPeople={assignPeople}
        onZoomToGroup={zoomToGroup}
      />

      <div
        className={`sidebar-resize-handle ${isResizing ? "active" : ""}`}
        onMouseDown={handleResizeMouseDown}
      />

      <Canvas
        ref={canvasRef}
        tasks={tasks}
        categories={categories}
        statuses={statuses}
        connections={connections}
        draggingNode={draggingNode}
        connecting={connecting}
        shiftPressed={shiftPressed}
        hoveredNode={hoveredNode}
        highlightedTaskId={highlightedTaskId}
        editingNodeId={editingNodeId}
        selectedNodes={selectedNodes}
        selection={selection}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onNodeMouseDown={handleNodeMouseDown}
        onNodeClick={handleNodeClick}
        onNodeHover={setHoveredNode}
        onEditingNodeChange={setEditingNodeId}
        onRemoveConnection={handleRemoveConnection}
        groups={groups}
        selectedGroups={selectedGroups}
        editingGroupId={editingGroupId}
        onGroupMouseDown={handleGroupMouseDown}
        onGroupMove={moveGroup}
        onGroupMoveWithTasks={moveGroupAndTasks}
        onGroupMoveStart={handleGroupMoveStart}
        onGroupMoveEnd={handleGroupMoveEnd}
        onGroupResize={resizeGroup}
        onGroupResizeStart={handleGroupResizeStart}
        onGroupResizeEnd={handleGroupResizeEnd}
        onGroupTitleChange={updateGroupTitle}
        onEditingGroupChange={setEditingGroupId}
        onGroupZoomTo={zoomToGroup}
        onGroupToggleLock={toggleGroupLock}
        onGroupDelete={deleteGroup}
        people={people}
        onAssignPeople={assignPeople}
        onAssignPersonAndSetInProgress={assignPersonAndSetInProgress}
        viewBox={viewBox}
        onViewBoxChange={handleViewBoxChange}
        autoFitOnLoad={autoFitOnLoad}
        onSetTaskStatus={setTaskStatus}
        onSetTaskCategory={setTaskCategory}
        onDuplicateTask={handleDuplicateTask}
        onCopyTask={handleCopyTask}
        onDeleteTask={deleteTask}
        onDeleteSelected={handleDeleteSelected}
        onCopySelected={handleCopy}
        onUpdateTaskText={updateTaskText}
        onCreateTaskAt={addTaskAt}
        onCreateGroupAt={addGroupAt}
        onPaste={handlePaste}
        onCheckPasteAvailable={checkPasteAvailable}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={wrappedUndo}
        onRedo={wrappedRedo}
        onHighlightTask={setHighlightedTaskId}
      />
    </div>
  );
});

export default App;
