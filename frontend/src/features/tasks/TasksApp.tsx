import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import "./TasksApp.css";
import { confirm } from "../../ui/ConfirmModal";
import { Sidebar } from "./Sidebar/Sidebar";
import type { Group, Task, TaskStatus } from "../../domain/tasks/types";
import { Canvas, type CanvasHandle } from "./Canvas/Canvas";
import type { ViewBox } from "../../domain/tasks/types";
import { zoomViewBoxToGroup } from "../../domain/tasks/viewport";
import { useWorkspaceRole } from "../workspace/WorkspaceRoleContext";
import {
  addGroup as addGroupOp,
  addTask as addTaskOp,
  assignPersonInProgress,
  deleteEntities,
  deleteGroup as deleteGroupOp,
  deleteTaskCascading,
  moveGroupWithTasks as moveGroupWithTasksOp,
  removeConnection as removeConnectionOp,
  toggleGroupLock as toggleGroupLockOp,
  updateGroup as updateGroupOp,
  updateTask as updateTaskOp,
} from "../../domain/tasks/operations";
import {
  applyPaste,
  deserializeClipboard,
  duplicateElements,
  serializeSelection,
} from "../../domain/tasks/clipboard";
import { getCategories, getStatuses } from "./theme";
import { useHistory, type CanvasState } from "../../hooks/useHistory";
import { useDragSelection } from "../../hooks/useDragSelection";
import { useGlobalKeyboardShortcuts } from "../../hooks/useGlobalKeyboardShortcuts";
import { useResizableSidebar } from "../../hooks/useResizableSidebar";
import type { Person } from "../../domain/teams/types";
import { workspaceService } from "../../services/container";
import { loadViewBox, saveViewBox } from "../../lib/viewBox";
import type { ProjectSummary } from "../../services/workspace.types";

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

  const history = useHistory({ tasks: [], connections: [], groups: [] });
  const push: typeof history.push = canEdit ? history.push : () => {};
  const replace: typeof history.replace = canEdit ? history.replace : () => {};
  const undo: typeof history.undo = canEdit ? history.undo : () => {};
  const redo: typeof history.redo = canEdit ? history.redo : () => {};
  const { present, canUndo, canRedo } = history;
  const { tasks, connections, groups } = present;
  const presentRef = useRef(present);
  presentRef.current = present;

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [viewBox, setViewBox] = useState<ViewBox>(loadViewBox(projectId) ?? DEFAULT_VIEW_BOX);

  // Ref to detect whether an undo/redo just happened so we can batch-write.
  const pendingUndoRedoRef = useRef<CanvasState | null>(null);

  // ── Remote reconciliation ──────────────────────────────────────────────────

  // Use a ref for isDragging so it can be read from the subscription callback
  // without being listed as an effect dependency.
  const isDraggingRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: component is key-remounted on workspaceId/projectId change; subscription is intentionally bound once
  useEffect(() => {
    const unsub = workspaceService.subscribeProjectContent(
      workspaceId,
      projectId,
      (content, hasPendingWrites) => {
        if (!content) return;

        if (loadStatus === "loading") {
          history.reset({
            tasks: content.tasks,
            connections: content.projectDoc.connections,
            groups: content.groups,
          });
          setTheme(content.projectDoc.theme);
          setLoadStatus("ready");
          return;
        }

        // Remote update from another client — apply only when safe.
        // TODO: also guard against mid-typing edge case (blur-on-write means
        // the user's in-progress text isn't in Firestore yet, so hasPendingWrites
        // won't cover it — accepted risk for now, see architecture session notes).
        if (hasPendingWrites || isDraggingRef.current) return;

        history.replace({
          tasks: content.tasks,
          connections: content.projectDoc.connections,
          groups: content.groups,
        });
        setTheme(content.projectDoc.theme);
      },
    );
    return unsub;
    // workspaceId and projectId are stable for the lifetime of this component
    // (key-based remount on change), so we intentionally exclude them here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Undo / redo Firestore batch sync ──────────────────────────────────────

  const wrappedUndo = useCallback(() => {
    pendingUndoRedoRef.current = presentRef.current;
    undo();
  }, [undo]);

  const wrappedRedo = useCallback(() => {
    pendingUndoRedoRef.current = presentRef.current;
    redo();
  }, [redo]);

  useEffect(() => {
    if (!pendingUndoRedoRef.current) return;
    const before = pendingUndoRedoRef.current;
    pendingUndoRedoRef.current = null;
    const after = present;

    const deletedTaskIds = before.tasks
      .filter((t) => !after.tasks.some((nt) => nt.id === t.id))
      .map((t) => t.id);
    const deletedGroupIds = before.groups
      .filter((g) => !after.groups.some((ng) => ng.id === g.id))
      .map((g) => g.id);

    workspaceService
      .syncProjectState(workspaceId, projectId, after, deletedTaskIds, deletedGroupIds)
      .catch(console.error);
  }, [present, workspaceId, projectId]);

  // ── ViewBox persistence (localStorage) ────────────────────────────────────

  const handleViewBoxChange = useCallback(
    (vb: ViewBox) => {
      setViewBox(vb);
      saveViewBox(projectId, vb);
    },
    [projectId],
  );

  const categories = getCategories();
  const statuses = getStatuses();

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  const canvasRef = useRef<CanvasHandle>(null);
  const taskItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  const handlePaste = useCallback(async () => {
    try {
      const raw = await navigator.clipboard.readText();
      const clipboard = deserializeClipboard(raw);
      if (!clipboard) return;
      const result = applyPaste({ clipboard, currentWorkspaceId: workspaceId, viewBox });
      push({
        tasks: [...tasks, ...result.tasks],
        connections: [...connections, ...result.connections],
        groups: [...groups, ...result.groups],
      });
      selectElements(
        new Set(result.tasks.map((t) => t.id)),
        new Set(result.groups.map((g) => g.id)),
      );
    } catch {
      console.warn("[canvas] Paste failed — clipboard may be empty or access denied");
    }
  }, [tasks, connections, groups, viewBox, workspaceId, push, selectElements]);

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
  }, [selectedNodes, selectedGroups, tasks, groups, connections, push, selectElements]);

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
    },
    [tasks, groups, connections, push, selectElements],
  );

  const { shiftPressed } = useGlobalKeyboardShortcuts({
    onUndo: wrappedUndo,
    onRedo: wrappedRedo,
    onEscape: clearSelection,
    onDelete: handleDeleteSelected,
    onCopy: handleCopy,
    onPaste: handlePaste,
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
    setFocusTaskId(newTask.id);
    workspaceService.addTask(workspaceId, projectId, newTask).catch(console.error);
  };

  const addGroupAt = (x: number, y: number) => {
    const newGroup = buildNewGroup(x, y);
    push({ tasks, connections, groups: addGroupOp(groups, newGroup) });
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
    push({ tasks: updateTaskOp(tasks, id, { status }), connections, groups });
    setOpenMenuId(null);
    workspaceService.updateTask(workspaceId, projectId, id, { status }).catch(console.error);
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
    push({
      tasks: updateTaskOp(tasks, taskId, { assignedPersonIds: personIds }),
      connections,
      groups,
    });
    workspaceService
      .updateTask(workspaceId, projectId, taskId, { assignedPersonIds: personIds })
      .catch(console.error);
  };

  const assignPersonAndSetInProgress = (taskId: string, personId: string) => {
    const nextTasks = assignPersonInProgress(tasks, taskId, personId);
    push({ tasks: nextTasks, connections, groups });
    const updated = nextTasks.find((t) => t.id === taskId);
    if (updated) {
      workspaceService
        .updateTask(workspaceId, projectId, taskId, {
          assignedPersonIds: updated.assignedPersonIds,
          status: updated.status,
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
    handleViewBoxChange(newVb);
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
        selectedNodes={selectedNodes}
        selection={selection}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onNodeMouseDown={handleNodeMouseDown}
        onNodeClick={handleNodeClick}
        onNodeHover={setHoveredNode}
        onRemoveConnection={handleRemoveConnection}
        groups={groups}
        selectedGroups={selectedGroups}
        onGroupMouseDown={handleGroupMouseDown}
        onGroupMove={moveGroup}
        onGroupMoveWithTasks={moveGroupAndTasks}
        onGroupMoveStart={handleGroupMoveStart}
        onGroupMoveEnd={handleGroupMoveEnd}
        onGroupResize={resizeGroup}
        onGroupResizeStart={handleGroupResizeStart}
        onGroupResizeEnd={handleGroupResizeEnd}
        onGroupTitleChange={updateGroupTitle}
        onGroupZoomTo={zoomToGroup}
        onGroupToggleLock={toggleGroupLock}
        onGroupDelete={deleteGroup}
        people={people}
        onAssignPeople={assignPeople}
        onAssignPersonAndSetInProgress={assignPersonAndSetInProgress}
        viewBox={viewBox}
        onViewBoxChange={handleViewBoxChange}
        onSetTaskStatus={setTaskStatus}
        onSetTaskCategory={setTaskCategory}
        onDuplicateTask={handleDuplicateTask}
        onDeleteTask={deleteTask}
        onDeleteSelected={handleDeleteSelected}
        onUpdateTaskText={updateTaskText}
        onCreateTaskAt={addTaskAt}
        onCreateGroupAt={addGroupAt}
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
