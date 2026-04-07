import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";
import {
  ConfirmDialog,
  OpenFile,
  SaveFile,
  SaveFileAs,
} from "../wailsjs/go/main/App";
import { Sidebar, Task, TaskStatus, Group } from "./Sidebar";
import { Canvas, CanvasHandle, Connection } from "./Canvas";

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
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
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(
    null
  );
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
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
  } | null>(null);

  const canvasRef = useRef<CanvasHandle>(null);
  const taskItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftPressed(true);
      if (e.key === "Escape") {
        setSelectedNodes(new Set());
        setSelection(null);
        setDraggingSelection(null);
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
  }, []);

  // Track unsaved changes
  useEffect(() => {
    if (tasks.length > 0 || connections.length > 0 || groups.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [tasks, connections, groups]);

  const handleSave = useCallback(async () => {
    const data = JSON.stringify({ tasks, connections, groups }, null, 2);
    try {
      if (currentFilePath) {
        await SaveFile(currentFilePath, data);
        setHasUnsavedChanges(false);
      } else {
        const filePath = await SaveFileAs(data);
        if (filePath) {
          setCurrentFilePath(filePath);
          setHasUnsavedChanges(false);
        }
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
  }, [tasks, connections, groups, currentFilePath]);

  // Keyboard shortcut for save (Cmd+S / Ctrl+S)
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [handleSave]);

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
      x: 60,
      y: 60,
      status: "pending",
    };
    setTasks([...tasks, newTask]);
    setFocusTaskId(newTask.id);
  };

  const handleTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      addTask();
    }
  };

  const updateTaskText = (id: string, text: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, text } : t)));
  };

  const setTaskCategory = (id: string, category: string | undefined) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, category } : t)));
    setOpenMenuId(null);
  };

  const setTaskStatus = (id: string, status: TaskStatus) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status } : t)));
    setOpenMenuId(null);
  };

  const handleOpen = async () => {
    try {
      const result = await OpenFile();
      if (result) {
        const parsed = JSON.parse(result.content);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.connections) setConnections(parsed.connections);
        if (parsed.groups) setGroups(parsed.groups);
        setCurrentFilePath(result.filePath);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error("Open failed:", err);
    }
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    const taskName = task?.text || "this task";
    const confirmed = await ConfirmDialog(
      "Delete Task",
      `Delete "${taskName}"?`
    );
    if (confirmed) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setConnections((prev) =>
        prev.filter((c) => c.from !== id && c.to !== id)
      );
    }
  };

  const addGroup = () => {
    const newGroup: Group = {
      id: crypto.randomUUID(),
      title: "New Group",
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    };
    setGroups([...groups, newGroup]);
  };

  const moveGroup = (id: string, x: number, y: number) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, x, y } : g)));
  };

  const resizeGroup = (id: string, width: number, height: number) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, width, height } : g))
    );
  };

  const updateGroupTitle = (id: string, title: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, title } : g))
    );
  };

  const handleCanvasMouseDown = (
    e: React.MouseEvent,
    svgElement: SVGSVGElement | null
  ) => {
    if (e.target === svgElement) {
      const coords = canvasRef.current?.getSvgCoords(e) || { x: 0, y: 0 };
      if (selectedNodes.size > 0) {
        const clickedOnSelected = tasks.some((t) => {
          if (!selectedNodes.has(t.id)) return false;
          const dx = t.x - coords.x;
          const dy = t.y - coords.y;
          return Math.sqrt(dx * dx + dy * dy) < 25;
        });
        if (!clickedOnSelected) {
          setSelectedNodes(new Set());
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

  const handleNodeMouseDown = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const coords = canvasRef.current?.getSvgCoords(e) || { x: 0, y: 0 };
    if (e.shiftKey) {
      setConnecting({ from: taskId, mouseX: coords.x, mouseY: coords.y });
    } else if (selectedNodes.has(taskId)) {
      const nodePositions = new Map<string, { x: number; y: number }>();
      tasks.forEach((t) => {
        if (selectedNodes.has(t.id)) {
          nodePositions.set(t.id, { x: t.x, y: t.y });
        }
      });
      setDraggingSelection({
        startX: coords.x,
        startY: coords.y,
        nodePositions,
      });
    } else {
      setSelectedNodes(new Set());
      setDraggingNode(taskId);
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
      if (draggingNode) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === draggingNode ? { ...t, x: coords.x, y: coords.y } : t
          )
        );
      } else if (connecting) {
        setConnecting({ ...connecting, mouseX: coords.x, mouseY: coords.y });
      } else if (selection) {
        setSelection({ ...selection, currentX: coords.x, currentY: coords.y });
      } else if (draggingSelection) {
        const dx = coords.x - draggingSelection.startX;
        const dy = coords.y - draggingSelection.startY;
        setTasks((prev) =>
          prev.map((t) => {
            const originalPos = draggingSelection.nodePositions.get(t.id);
            if (originalPos) {
              return { ...t, x: originalPos.x + dx, y: originalPos.y + dy };
            }
            return t;
          })
        );
      }
    },
    [draggingNode, connecting, selection, draggingSelection]
  );

  const handleCanvasMouseUp = (
    _e: React.MouseEvent,
    coords: { x: number; y: number }
  ) => {
    if (connecting) {
      const targetTask = tasks.find((t) => {
        const dx = t.x - coords.x;
        const dy = t.y - coords.y;
        return Math.sqrt(dx * dx + dy * dy) < 30;
      });

      if (targetTask && targetTask.id !== connecting.from) {
        const exists = connections.some(
          (c) => c.from === connecting.from && c.to === targetTask.id
        );
        if (!exists) {
          setConnections([
            ...connections,
            { from: connecting.from, to: targetTask.id },
          ]);
        }
      }
    }

    if (selection) {
      const minX = Math.min(selection.startX, selection.currentX);
      const maxX = Math.max(selection.startX, selection.currentX);
      const minY = Math.min(selection.startY, selection.currentY);
      const maxY = Math.max(selection.startY, selection.currentY);
      const nodeRadius = 25;

      const newSelected = new Set<string>();
      tasks.forEach((t) => {
        if (
          t.x - nodeRadius >= minX &&
          t.x + nodeRadius <= maxX &&
          t.y - nodeRadius >= minY &&
          t.y + nodeRadius <= maxY
        ) {
          newSelected.add(t.id);
        }
      });
      setSelectedNodes(newSelected);
    }

    setDraggingNode(null);
    setConnecting(null);
    setSelection(null);
    setDraggingSelection(null);
  };

  const handleRemoveConnection = (
    e: React.MouseEvent,
    from: string,
    to: string
  ) => {
    if (e.shiftKey) {
      setConnections(connections.filter((c) => !(c.from === from && c.to === to)));
    }
  };

  const registerTaskItemRef = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (el) taskItemRefs.current.set(id, el);
      else taskItemRefs.current.delete(id);
    },
    []
  );

  return (
    <div id="App" className={isResizing ? "resizing" : ""}>
      <Sidebar
        width={sidebarWidth}
        tasks={tasks}
        currentFilePath={currentFilePath}
        hasUnsavedChanges={hasUnsavedChanges}
        highlightedTaskId={highlightedTaskId}
        openMenuId={openMenuId}
        menuPosition={menuPosition}
        focusTaskId={focusTaskId}
        onOpen={handleOpen}
        onSave={handleSave}
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
      />

      <div
        className={`sidebar-resize-handle ${isResizing ? "active" : ""}`}
        onMouseDown={handleResizeMouseDown}
      />

      <Canvas
        ref={canvasRef}
        tasks={tasks}
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
        onGroupMove={moveGroup}
        onGroupResize={resizeGroup}
        onGroupTitleChange={updateGroupTitle}
      />
    </div>
  );
}

export default App;
