import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import "./TasksApp.css";
import { confirm } from "../../ui/ConfirmModal";
import { Sidebar } from "./Sidebar/Sidebar";
import type { Group, Task, TaskStatus } from "../../domain/tasks/types";
import { Canvas, type CanvasHandle } from "./Canvas/Canvas";
import type { ViewBox } from "../../domain/tasks/types";
import { zoomViewBoxToGroup } from "../../domain/tasks/viewport";
import {
  addConnectionIfNew,
  addGroup as addGroupOp,
  addTask as addTaskOp,
  assignPersonInProgress,
  deleteEntities,
  deleteGroup as deleteGroupOp,
  deleteTaskCascading,
  removeConnection,
  selectEntitiesInRect,
  toggleGroupLock as toggleGroupLockOp,
  translateEntities,
  updateGroup as updateGroupOp,
  updateTask as updateTaskOp,
} from "../../domain/tasks/operations";
import { getCategories, getStatuses } from "./theme";
import { useHistory } from "../../hooks/useHistory";
import type { PersonTaskQueue, ProjectData, ProjectState } from "../../domain/workspace/types";
import { createDefaultProject } from "../../domain/workspace/projectState";
import type { Person } from "../../domain/teams/types";

const _defaultProject = createDefaultProject();

interface AppProps {
  initialProject?: ProjectData;
  onStateChange?: (state: ProjectState) => void;
  projects?: ProjectData[];
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
    initialProject = _defaultProject,
    onStateChange = () => {},
    projects = [_defaultProject],
    activeProjectId = _defaultProject.id,
    onSwitchProject = () => {},
    onOpenProjectAdmin = () => {},
    people = [],
  },
  ref,
) {
  const { present, push, replace, undo, redo, canUndo, canRedo } = useHistory({
    tasks: initialProject.tasks,
    connections: initialProject.connections,
    groups: initialProject.groups,
  });
  const { tasks, connections, groups } = present;
  const presentRef = useRef(present);
  presentRef.current = present;

  const [theme, setTheme] = useState<"dark" | "light">(initialProject.theme);
  const [viewBox, setViewBox] = useState<ViewBox>(initialProject.viewBox);
  const [taskQueues] = useState<PersonTaskQueue[]>(initialProject.taskQueues ?? []);

  // Report live state to workspace owner (skip first render to avoid marking dirty on mount)
  const isFirstRender = useRef(true);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onStateChangeRef.current({ tasks, connections, groups, viewBox, theme, taskQueues });
  }, [tasks, connections, groups, viewBox, theme, taskQueues]);
  const categories = getCategories(theme);
  const statuses = getStatuses(theme);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{
    from: string;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [draggingSelection, setDraggingSelection] = useState<{
    startX: number;
    startY: number;
    nodePositions: Map<string, { x: number; y: number }>;
    groupPositions: Map<string, { x: number; y: number }>;
  } | null>(null);

  const canvasRef = useRef<CanvasHandle>(null);
  const taskItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useImperativeHandle(ref, () => ({
    exportAsPng: () => canvasRef.current?.exportAsPng(),
    openSettings: () => canvasRef.current?.openSettings(),
    openHelp: () => canvasRef.current?.openHelp(),
  }));

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Shift") setShiftPressed(true);
      if (e.key === "Escape") {
        setSelectedNodes(new Set());
        setSelectedGroups(new Set());
        setSelection(null);
        setDraggingSelection(null);
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.shiftKey ? e.key === "z" : e.key === "y")) {
        e.preventDefault();
        redo();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [undo, redo]);

  useEffect(() => {
    const handleDeleteSelected = async (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
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
        push(
          deleteEntities(
            { tasks, connections, groups },
            new Set(selectedTaskList.map((t) => t.id)),
            new Set(selectedGroupList.map((g) => g.id)),
          ),
        );
        setSelectedNodes(new Set());
        setSelectedGroups(new Set());
      }
    };

    window.addEventListener("keydown", handleDeleteSelected);
    return () => window.removeEventListener("keydown", handleDeleteSelected);
  }, [selectedNodes, selectedGroups, tasks, groups, connections, push]);

  // Sidebar resize handlers
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

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
  };

  const addTaskAt = (x: number, y: number) => {
    const newTask = buildNewTask(x, y);
    push({ tasks: addTaskOp(present.tasks, newTask), connections, groups });
    setFocusTaskId(newTask.id);
  };

  const addGroupAt = (x: number, y: number) => {
    push({ tasks, connections, groups: addGroupOp(groups, buildNewGroup(x, y)) });
  };

  const handleTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      addTask();
    }
  };

  const updateTaskText = (id: string, text: string) => {
    push({ tasks: updateTaskOp(tasks, id, { text }), connections, groups });
  };

  const setTaskCategory = (id: string, category: string | undefined) => {
    push({ tasks: updateTaskOp(tasks, id, { category }), connections, groups });
    setOpenMenuId(null);
  };

  const setTaskStatus = (id: string, status: TaskStatus) => {
    push({ tasks: updateTaskOp(tasks, id, { status }), connections, groups });
    setOpenMenuId(null);
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
    }
  };

  const addGroup = () => {
    push({
      tasks,
      connections,
      groups: addGroupOp(groups, buildNewGroup(viewBox.x + 20, viewBox.y + 20)),
    });
  };

  const handleGroupMoveStart = useCallback(() => {
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

  const resizeGroup = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      const { tasks: t, connections: c, groups: g } = presentRef.current;
      replace({
        tasks: t,
        connections: c,
        groups: updateGroupOp(g, id, { x, y, width, height }),
      });
    },
    [replace],
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
    }
  };

  const toggleGroupLock = (id: string) => {
    push({ tasks, connections, groups: toggleGroupLockOp(groups, id) });
  };

  const assignPeople = (taskId: string, personIds: string[]) => {
    push({
      tasks: updateTaskOp(tasks, taskId, { assignedPersonIds: personIds }),
      connections,
      groups,
    });
  };

  const assignPersonAndSetInProgress = (taskId: string, personId: string) => {
    push({
      tasks: assignPersonInProgress(tasks, taskId, personId),
      connections,
      groups,
    });
  };

  const updateGroupTitle = (id: string, title: string) => {
    push({ tasks, connections, groups: updateGroupOp(groups, id, { title }) });
  };

  const zoomToGroup = (id: string) => {
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    const svg = canvasRef.current?.getSvgElement();
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setViewBox(zoomViewBoxToGroup(group, { width: rect.width, height: rect.height }, 80));
  };

  const handleCanvasMouseDown = (e: React.MouseEvent, svgElement: SVGSVGElement | null) => {
    if (e.target === svgElement) {
      const coords = canvasRef.current?.getSvgCoords(e) || { x: 0, y: 0 };
      setHighlightedTaskId(null);
      if (selectedNodes.size > 0 || selectedGroups.size > 0) {
        const clickedOnSelected = tasks.some((t) => {
          if (!selectedNodes.has(t.id)) return false;
          const dx = t.x - coords.x;
          const dy = t.y - coords.y;
          return Math.sqrt(dx * dx + dy * dy) < 25;
        });
        if (!clickedOnSelected) {
          setSelectedNodes(new Set());
          setSelectedGroups(new Set());
        }
      }
      setSelection({
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
      });
    }
  };

  const startSelectionDrag = (coords: { x: number; y: number }) => {
    const nodePositions = new Map<string, { x: number; y: number }>();
    tasks.forEach((t) => {
      if (selectedNodes.has(t.id)) {
        nodePositions.set(t.id, { x: t.x, y: t.y });
      }
    });
    const groupPositions = new Map<string, { x: number; y: number }>();
    groups.forEach((g) => {
      if (selectedGroups.has(g.id)) {
        groupPositions.set(g.id, { x: g.x, y: g.y });
      }
    });
    setDraggingSelection({
      startX: coords.x,
      startY: coords.y,
      nodePositions,
      groupPositions,
    });
  };

  const handleNodeMouseDown = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const coords = canvasRef.current?.getSvgCoords(e) || { x: 0, y: 0 };
    if (e.shiftKey) {
      setConnecting({ from: taskId, mouseX: coords.x, mouseY: coords.y });
    } else if (selectedNodes.has(taskId)) {
      push(present);
      startSelectionDrag(coords);
    } else {
      setSelectedNodes(new Set());
      push(present);
      setDraggingNode(taskId);
    }
  };

  const handleGroupMouseDown = (e: React.MouseEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const coords = canvasRef.current?.getSvgCoords(e) || { x: 0, y: 0 };
    if (selectedGroups.has(groupId)) {
      push(present);
      startSelectionDrag(coords);
    }
  };

  const handleNodeClick = (taskId: string) => {
    setHighlightedTaskId(taskId);
    const taskItem = taskItemRefs.current.get(taskId);
    if (taskItem) {
      taskItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handleCanvasMouseMove = useCallback(
    (_e: React.MouseEvent, coords: { x: number; y: number }) => {
      const {
        tasks: currentTasks,
        connections: currentConnections,
        groups: currentGroups,
      } = presentRef.current;
      if (draggingNode) {
        replace({
          tasks: updateTaskOp(currentTasks, draggingNode, { x: coords.x, y: coords.y }),
          connections: currentConnections,
          groups: currentGroups,
        });
      } else if (connecting) {
        setConnecting({ ...connecting, mouseX: coords.x, mouseY: coords.y });
      } else if (selection) {
        setSelection({ ...selection, currentX: coords.x, currentY: coords.y });
      } else if (draggingSelection) {
        const { tasks: nextTasks, groups: nextGroups } = translateEntities({
          tasks: currentTasks,
          groups: currentGroups,
          taskOrigins: draggingSelection.nodePositions,
          groupOrigins: draggingSelection.groupPositions,
          dx: coords.x - draggingSelection.startX,
          dy: coords.y - draggingSelection.startY,
        });
        replace({ tasks: nextTasks, connections: currentConnections, groups: nextGroups });
      }
    },
    [draggingNode, connecting, selection, draggingSelection, replace],
  );

  const handleCanvasMouseUp = (_e: React.MouseEvent, coords: { x: number; y: number }) => {
    if (connecting) {
      const targetTask = tasks.find((t) => {
        const dx = t.x - coords.x;
        const dy = t.y - coords.y;
        return Math.sqrt(dx * dx + dy * dy) < 30;
      });

      if (targetTask && targetTask.id !== connecting.from) {
        const nextConnections = addConnectionIfNew(connections, {
          from: connecting.from,
          to: targetTask.id,
        });
        if (nextConnections !== connections) {
          push({ tasks, connections: nextConnections, groups });
        }
      }
    }

    if (selection) {
      const { taskIds, groupIds } = selectEntitiesInRect({
        rect: selection,
        tasks,
        groups,
        nodeRadius: 25,
      });
      setSelectedNodes(taskIds);
      setSelectedGroups(groupIds);
    }

    setDraggingNode(null);
    setConnecting(null);
    setSelection(null);
    setDraggingSelection(null);
  };

  const handleRemoveConnection = (e: React.MouseEvent, from: string, to: string) => {
    if (e.shiftKey) {
      push({ tasks, connections: removeConnection(connections, from, to), groups });
    }
  };

  const registerTaskItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) taskItemRefs.current.set(id, el);
    else taskItemRefs.current.delete(id);
  }, []);

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
        onGroupMoveStart={handleGroupMoveStart}
        onGroupResize={resizeGroup}
        onGroupResizeStart={handleGroupResizeStart}
        onGroupTitleChange={updateGroupTitle}
        onGroupZoomTo={zoomToGroup}
        onGroupToggleLock={toggleGroupLock}
        onGroupDelete={deleteGroup}
        people={people}
        onAssignPeople={assignPeople}
        onAssignPersonAndSetInProgress={assignPersonAndSetInProgress}
        viewBox={viewBox}
        onViewBoxChange={setViewBox}
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        onSetTaskStatus={setTaskStatus}
        onSetTaskCategory={setTaskCategory}
        onDeleteTask={deleteTask}
        onUpdateTaskText={updateTaskText}
        onCreateTaskAt={addTaskAt}
        onCreateGroupAt={addGroupAt}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onHighlightTask={setHighlightedTaskId}
      />
    </div>
  );
});

export default App;
