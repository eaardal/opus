import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";
import {
  ConfirmDialog,
  OpenFile,
  SaveFile,
  SaveFileAs,
} from "../wailsjs/go/main/App";
import { Sidebar, Task, TaskStatus, CATEGORIES, STATUSES } from "./Sidebar";

interface Connection {
  from: string;
  to: string;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
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
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(
    null,
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
  const svgRef = useRef<SVGSVGElement>(null);
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
    if (tasks.length > 0 || connections.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [tasks, connections]);

  const handleSave = useCallback(async () => {
    const data = JSON.stringify({ tasks, connections }, null, 2);
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
  }, [tasks, connections, currentFilePath]);

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
      `Delete "${taskName}"?`,
    );
    if (confirmed) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setConnections((prev) =>
        prev.filter((c) => c.from !== id && c.to !== id),
      );
    }
  };

  const getSvgCoords = (e: React.MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleNodeMouseDown = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      const coords = getSvgCoords(e);
      setConnecting({ from: taskId, mouseX: coords.x, mouseY: coords.y });
    } else if (selectedNodes.has(taskId)) {
      // Start dragging selected nodes
      const coords = getSvgCoords(e);
      const nodePositions = new Map<string, { x: number; y: number }>();
      tasks.forEach((t) => {
        if (selectedNodes.has(t.id)) {
          nodePositions.set(t.id, { x: t.x, y: t.y });
        }
      });
      setDraggingSelection({ startX: coords.x, startY: coords.y, nodePositions });
    } else {
      // Clear selection and drag single node
      setSelectedNodes(new Set());
      setDraggingNode(taskId);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only start selection if clicking directly on the SVG (not on a node)
    if (e.target === svgRef.current) {
      const coords = getSvgCoords(e);
      // Check if clicking outside selected nodes - clear selection
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
      // Start selection rectangle
      setSelection({ startX: coords.x, startY: coords.y, currentX: coords.x, currentY: coords.y });
    }
  };

  const handleNodeClick = (taskId: string) => {
    setHighlightedTaskId(taskId);
    const taskItem = taskItemRefs.current.get(taskId);
    if (taskItem) {
      taskItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const coords = getSvgCoords(e);
      if (draggingNode) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === draggingNode ? { ...t, x: coords.x, y: coords.y } : t,
          ),
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
          }),
        );
      }
    },
    [draggingNode, connecting, selection, draggingSelection],
  );

  const handleMouseUp = (e: React.MouseEvent) => {
    if (connecting) {
      const coords = getSvgCoords(e);
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
          setConnections([
            ...connections,
            { from: connecting.from, to: targetTask.id },
          ]);
        }
      }
    }

    // Finalize selection rectangle
    if (selection) {
      const minX = Math.min(selection.startX, selection.currentX);
      const maxX = Math.max(selection.startX, selection.currentX);
      const minY = Math.min(selection.startY, selection.currentY);
      const maxY = Math.max(selection.startY, selection.currentY);
      const nodeRadius = 25;

      // Select nodes that are 100% inside the rectangle
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

  const removeConnection = (e: React.MouseEvent, from: string, to: string) => {
    if (e.shiftKey) {
      setConnections(
        connections.filter((c) => !(c.from === from && c.to === to)),
      );
    }
  };

  const getArrowPath = (
    fromTask: Task,
    toTask: Task,
  ): { path: string; endX: number; endY: number } => {
    const dx = toTask.x - fromTask.x;
    const dy = toTask.y - fromTask.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { path: "", endX: 0, endY: 0 };

    const nodeRadius = 25;
    const arrowOffset = 8;

    const ux = dx / len;
    const uy = dy / len;

    const startX = fromTask.x + ux * nodeRadius;
    const startY = fromTask.y + uy * nodeRadius;
    const endX = toTask.x - ux * (nodeRadius + arrowOffset);
    const endY = toTask.y - uy * (nodeRadius + arrowOffset);

    return { path: `M ${startX} ${startY} L ${endX} ${endY}`, endX, endY };
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
      />

      <div
        className={`sidebar-resize-handle ${isResizing ? "active" : ""}`}
        onMouseDown={handleResizeMouseDown}
      />

      <div className="canvas-container">
        <svg
          ref={svgRef}
          className="canvas"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
            </marker>
          </defs>

          {connections.map((conn) => {
            const fromTask = tasks.find((t) => t.id === conn.from);
            const toTask = tasks.find((t) => t.id === conn.to);
            if (!fromTask || !toTask) return null;

            const { path, endX, endY } = getArrowPath(fromTask, toTask);

            return (
              <g
                key={`${conn.from}-${conn.to}`}
                className={`connection-group ${shiftPressed ? "shift-active" : ""}`}
              >
                <path
                  d={path}
                  stroke="#666"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className="connection"
                  onClick={(e) => removeConnection(e, conn.from, conn.to)}
                />
                <circle
                  cx={endX}
                  cy={endY}
                  r="12"
                  fill="transparent"
                  className="connection-target"
                  onClick={(e) => removeConnection(e, conn.from, conn.to)}
                />
              </g>
            );
          })}

          {connecting && (
            <line
              x1={tasks.find((t) => t.id === connecting.from)?.x || 0}
              y1={tasks.find((t) => t.id === connecting.from)?.y || 0}
              x2={connecting.mouseX}
              y2={connecting.mouseY}
              stroke="#999"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          )}

          {selection && (
            <rect
              className="selection-rect"
              x={Math.min(selection.startX, selection.currentX)}
              y={Math.min(selection.startY, selection.currentY)}
              width={Math.abs(selection.currentX - selection.startX)}
              height={Math.abs(selection.currentY - selection.startY)}
            />
          )}

          {tasks.map((task, index) => (
            <g
              key={task.id}
              transform={`translate(${task.x}, ${task.y})`}
              onMouseEnter={() => setHoveredNode(task.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <circle
                r="25"
                className={`node ${draggingNode === task.id ? "dragging" : ""} ${highlightedTaskId === task.id ? "highlighted" : ""} ${selectedNodes.has(task.id) ? "selected" : ""}`}
                style={{
                  fill: STATUSES[task.status]?.color || STATUSES.pending.color,
                  ...(task.category && !selectedNodes.has(task.id)
                    ? {
                        stroke: CATEGORIES[task.category]?.color,
                        strokeWidth: 3,
                      }
                    : {}),
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, task.id)}
                onClick={() => handleNodeClick(task.id)}
              />
              <circle
                cx="0"
                cy="-25"
                r="10"
                className="node-number-badge"
                style={task.category ? { fill: CATEGORIES[task.category]?.color } : undefined}
              />
              <text
                x="0"
                y="-25"
                textAnchor="middle"
                dy="0.35em"
                className="node-number"
              >
                {index + 1}
              </text>
              <text
                textAnchor="middle"
                dy="0.3em"
                className="node-text"
                onMouseDown={(e) => handleNodeMouseDown(e, task.id)}
              >
                {task.text.slice(0, 8) || "?"}
              </text>
              {hoveredNode === task.id && task.text && (
                <g className="tooltip" transform="translate(0, 40)">
                  <rect
                    x={-Math.max(task.text.length * 4, 40)}
                    y="-12"
                    width={Math.max(task.text.length * 8, 80)}
                    height="24"
                    rx="4"
                  />
                  <text textAnchor="middle" dy="0.35em">
                    {task.text}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default App;
