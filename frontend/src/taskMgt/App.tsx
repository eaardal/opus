import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";
import { ConfirmDialog } from "../../wailsjs/go/main/App";
import { Sidebar, Task, TaskStatus, Group } from "./Sidebar";
import { Canvas, CanvasHandle, Connection, ViewBox } from "./Canvas";
import { getCategories, getStatuses } from "./theme";
import { useHistory } from "./useHistory";
import { ProjectData, ProjectState, createDefaultProject, PersonTaskQueue } from "../workspace/types";
import { Person } from "../teamMgt/types";

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

function App({
  initialProject = _defaultProject,
  onStateChange = () => {},
  projects = [_defaultProject],
  activeProjectId = _defaultProject.id,
  onSwitchProject = () => {},
  onOpenProjectAdmin = () => {},
  people = [],
}: AppProps) {
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
  const [taskQueues, setTaskQueues] = useState<PersonTaskQueue[]>(initialProject.taskQueues ?? []);

  // Report live state to workspace owner (skip first render to avoid marking dirty on mount)
  const isFirstRender = useRef(true);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
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
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(
    null,
  );
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

  // Apply initial theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

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
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.shiftKey ? e.key === "z" : e.key === "y")
      ) {
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

      const confirmed = await ConfirmDialog(
        "Delete Selected",
        `Delete the following?\n\n${lines}${selectedTaskList.length > 0 ? "\n\nConnections to deleted tasks will also be removed." : ""}`,
      );

      if (confirmed) {
        const deletedTaskIds = new Set(selectedTaskList.map((t) => t.id));
        const deletedGroupIds = new Set(selectedGroupList.map((g) => g.id));
        push({
          tasks: tasks.filter((t) => !deletedTaskIds.has(t.id)),
          connections: connections.filter((c) => !deletedTaskIds.has(c.from) && !deletedTaskIds.has(c.to)),
          groups: groups.filter((g) => !deletedGroupIds.has(g.id)),
        });
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

  const addTask = () => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: "",
      x: viewBox.x + 50,
      y: viewBox.y + 50,
      status: "pending",
    };
    push({ tasks: [...present.tasks, newTask], connections, groups });
    setFocusTaskId(newTask.id);
  };

  const addTaskAt = (x: number, y: number) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: "",
      x,
      y,
      status: "pending",
    };
    push({ tasks: [...present.tasks, newTask], connections, groups });
    setFocusTaskId(newTask.id);
  };

  const addGroupAt = (x: number, y: number) => {
    const newGroup: Group = {
      id: crypto.randomUUID(),
      title: "New Group",
      x,
      y,
      width: 200,
      height: 150,
    };
    push({ tasks, connections, groups: [...groups, newGroup] });
  };

  const handleTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      addTask();
    }
  };

  const updateTaskText = (id: string, text: string) => {
    push({
      tasks: tasks.map((t) => (t.id === id ? { ...t, text } : t)),
      connections,
      groups,
    });
  };

  const setTaskCategory = (id: string, category: string | undefined) => {
    push({
      tasks: tasks.map((t) => (t.id === id ? { ...t, category } : t)),
      connections,
      groups,
    });
    setOpenMenuId(null);
  };

  const setTaskStatus = (id: string, status: TaskStatus) => {
    push({
      tasks: tasks.map((t) => (t.id === id ? { ...t, status } : t)),
      connections,
      groups,
    });
    setOpenMenuId(null);
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    const taskName = task?.text || "this task";
    const confirmed = await ConfirmDialog(
      "Delete Task",
      `Delete "${taskName}"?`,
    );
    if (confirmed) {
      push({
        tasks: tasks.filter((t) => t.id !== id),
        connections: connections.filter((c) => c.from !== id && c.to !== id),
        groups,
      });
    }
  };

  const addGroup = () => {
    const newGroup: Group = {
      id: crypto.randomUUID(),
      title: "New Group",
      x: viewBox.x + 20,
      y: viewBox.y + 20,
      width: 200,
      height: 150,
    };
    push({ tasks, connections, groups: [...groups, newGroup] });
  };

  const handleGroupMoveStart = useCallback(() => {
    push(presentRef.current);
  }, [push]);

  const handleGroupResizeStart = useCallback(() => {
    push(presentRef.current);
  }, [push]);

  const moveGroup = useCallback((id: string, x: number, y: number) => {
    const { tasks: t, connections: c, groups: g } = presentRef.current;
    replace({
      tasks: t,
      connections: c,
      groups: g.map((gr) => (gr.id === id ? { ...gr, x, y } : gr)),
    });
  }, [replace]);

  const resizeGroup = useCallback((id: string, x: number, y: number, width: number, height: number) => {
    const { tasks: t, connections: c, groups: g } = presentRef.current;
    replace({
      tasks: t,
      connections: c,
      groups: g.map((gr) => (gr.id === id ? { ...gr, x, y, width, height } : gr)),
    });
  }, [replace]);

  const deleteGroup = async (id: string) => {
    const group = groups.find((g) => g.id === id);
    const groupName = group?.title || "this group";
    const confirmed = await ConfirmDialog(
      "Delete Group",
      `Delete "${groupName}"? The tasks inside will not be deleted.`,
    );
    if (confirmed) {
      push({
        tasks,
        connections,
        groups: groups.filter((g) => g.id !== id),
      });
    }
  };

  const toggleGroupLock = (id: string) => {
    push({
      tasks,
      connections,
      groups: groups.map((g) => (g.id === id ? { ...g, locked: !g.locked } : g)),
    });
  };

  const assignPeople = (taskId: string, personIds: string[]) => {
    push({
      tasks: tasks.map(t => t.id === taskId ? { ...t, assignedPersonIds: personIds } : t),
      connections,
      groups,
    });
  };

  const assignPersonAndSetInProgress = (taskId: string, personId: string) => {
    push({
      tasks: tasks.map(t => {
        if (t.id !== taskId) return t;
        const existing = t.assignedPersonIds ?? [];
        const assignedPersonIds = existing.includes(personId) ? existing : [...existing, personId];
        return { ...t, assignedPersonIds, status: "in_progress" as const };
      }),
      connections,
      groups,
    });
  };

  const updateGroupTitle = (id: string, title: string) => {
    push({
      tasks,
      connections,
      groups: groups.map((g) => (g.id === id ? { ...g, title } : g)),
    });
  };

  const zoomToGroup = (id: string) => {
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    const svg = canvasRef.current?.getSvgElement();
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const padding = 80;
    const contentW = group.width + padding * 2;
    const contentH = group.height + padding * 2;
    const scaleX = rect.width / contentW;
    const scaleY = rect.height / contentH;
    const scale = Math.min(scaleX, scaleY);
    const fitW = rect.width / scale;
    const fitH = rect.height / scale;
    const cx = group.x + group.width / 2;
    const cy = group.y + group.height / 2;
    setViewBox({
      x: cx - fitW / 2,
      y: cy - fitH / 2,
      width: fitW,
      height: fitH,
    });
  };

  const handleCanvasMouseDown = (
    e: React.MouseEvent,
    svgElement: SVGSVGElement | null,
  ) => {
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
      const { tasks: currentTasks, connections: currentConnections, groups: currentGroups } = presentRef.current;
      if (draggingNode) {
        replace({
          tasks: currentTasks.map((t) =>
            t.id === draggingNode ? { ...t, x: coords.x, y: coords.y } : t,
          ),
          connections: currentConnections,
          groups: currentGroups,
        });
      } else if (connecting) {
        setConnecting({ ...connecting, mouseX: coords.x, mouseY: coords.y });
      } else if (selection) {
        setSelection({ ...selection, currentX: coords.x, currentY: coords.y });
      } else if (draggingSelection) {
        const dx = coords.x - draggingSelection.startX;
        const dy = coords.y - draggingSelection.startY;
        replace({
          tasks: currentTasks.map((t) => {
            const originalPos = draggingSelection.nodePositions.get(t.id);
            return originalPos ? { ...t, x: originalPos.x + dx, y: originalPos.y + dy } : t;
          }),
          connections: currentConnections,
          groups: currentGroups.map((g) => {
            const originalPos = draggingSelection.groupPositions.get(g.id);
            return originalPos ? { ...g, x: originalPos.x + dx, y: originalPos.y + dy } : g;
          }),
        });
      }
    },
    [draggingNode, connecting, selection, draggingSelection, replace],
  );

  const handleCanvasMouseUp = (
    _e: React.MouseEvent,
    coords: { x: number; y: number },
  ) => {
    if (connecting) {
      const targetTask = tasks.find((t) => {
        const dx = t.x - coords.x;
        const dy = t.y - coords.y;
        return Math.sqrt(dx * dx + dy * dy) < 30;
      });

      if (targetTask && targetTask.id !== connecting.from) {
        const exists = connections.some(
          (c) => c.from === connecting.from && c.to === targetTask.id,
        );
        if (!exists) {
          push({
            tasks,
            connections: [...connections, { from: connecting.from, to: targetTask.id }],
            groups,
          });
        }
      }
    }

    if (selection) {
      const minX = Math.min(selection.startX, selection.currentX);
      const maxX = Math.max(selection.startX, selection.currentX);
      const minY = Math.min(selection.startY, selection.currentY);
      const maxY = Math.max(selection.startY, selection.currentY);
      const nodeRadius = 25;

      const newSelectedNodes = new Set<string>();
      tasks.forEach((t) => {
        if (
          t.x - nodeRadius >= minX &&
          t.x + nodeRadius <= maxX &&
          t.y - nodeRadius >= minY &&
          t.y + nodeRadius <= maxY
        ) {
          newSelectedNodes.add(t.id);
        }
      });
      setSelectedNodes(newSelectedNodes);

      const newSelectedGroups = new Set<string>();
      groups.forEach((g) => {
        if (
          !g.locked &&
          g.x >= minX &&
          g.x + g.width <= maxX &&
          g.y >= minY &&
          g.y + g.height <= maxY
        ) {
          newSelectedGroups.add(g.id);
        }
      });
      setSelectedGroups(newSelectedGroups);
    }

    setDraggingNode(null);
    setConnecting(null);
    setSelection(null);
    setDraggingSelection(null);
  };

  const handleRemoveConnection = (
    e: React.MouseEvent,
    from: string,
    to: string,
  ) => {
    if (e.shiftKey) {
      push({
        tasks,
        connections: connections.filter((c) => !(c.from === from && c.to === to)),
        groups,
      });
    }
  };

  const registerTaskItemRef = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (el) taskItemRefs.current.set(id, el);
      else taskItemRefs.current.delete(id);
    },
    [],
  );

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
        onToggleTheme={() => {
          const next = theme === "dark" ? "light" : "dark";
          setTheme(next);
          document.documentElement.setAttribute("data-theme", next);
        }}
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
}

export default App;
