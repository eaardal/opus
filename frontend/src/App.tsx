import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";
import { ConfirmDialog, ExportData, ImportData } from "../wailsjs/go/main/App";

type TaskStatus = "pending" | "in_progress" | "completed" | "archived";

interface Task {
  id: string;
  text: string;
  x: number;
  y: number;
  category?: string;
  status: TaskStatus;
}

interface Connection {
  from: string;
  to: string;
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
  backend: { label: "Backend", color: "#f97316" },
  frontend: { label: "Frontend", color: "#60a5fa" },
  ux: { label: "UX", color: "#f472b6" },
};

const STATUSES: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#3a3a5a" },
  in_progress: { label: "In Progress", color: "#3737d0" },
  completed: { label: "Completed", color: "#22c55e" },
  archived: { label: "Archived", color: "#5e5e5e" },
};

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
  const svgRef = useRef<SVGSVGElement>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftPressed(true);
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

  useEffect(() => {
    if (focusTaskId) {
      const input = inputRefs.current.get(focusTaskId);
      if (input) {
        input.focus();
        setFocusTaskId(null);
      }
    }
  }, [focusTaskId, tasks]);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openMenuId]);

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

  const handleExport = async () => {
    const data = JSON.stringify({ tasks, connections }, null, 2);
    try {
      await ExportData(data);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleImport = async () => {
    try {
      const data = await ImportData();
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.connections) setConnections(parsed.connections);
      }
    } catch (err) {
      console.error("Import failed:", err);
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
    if (e.shiftKey) {
      const coords = getSvgCoords(e);
      setConnecting({ from: taskId, mouseX: coords.x, mouseY: coords.y });
    } else {
      setDraggingNode(taskId);
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingNode) {
        const coords = getSvgCoords(e);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === draggingNode ? { ...t, x: coords.x, y: coords.y } : t,
          ),
        );
      } else if (connecting) {
        const coords = getSvgCoords(e);
        setConnecting({ ...connecting, mouseX: coords.x, mouseY: coords.y });
      }
    },
    [draggingNode, connecting],
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
    setDraggingNode(null);
    setConnecting(null);
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

  return (
    <div id="App">
      <div className="sidebar">
        <div className="actionbar">
          <button className="action-btn" onClick={handleImport}>
            Import
          </button>
          <button className="action-btn" onClick={handleExport}>
            Export
          </button>
        </div>
        <h2>Tasks</h2>
        <button className="add-btn" onClick={addTask}>
          + Add Task
        </button>
        <div className="task-list">
          {tasks.map((task, index) => (
            <div key={task.id} className="task-item">
              <span
                className="task-number"
                style={
                  task.category
                    ? { background: CATEGORIES[task.category]?.color }
                    : undefined
                }
              >
                {index + 1}
              </span>
              <input
                ref={(el) => {
                  if (el) inputRefs.current.set(task.id, el);
                  else inputRefs.current.delete(task.id);
                }}
                type="text"
                value={task.text}
                onChange={(e) => updateTaskText(task.id, e.target.value)}
                onKeyDown={handleTaskKeyDown}
                placeholder="Enter task..."
              />
              <div className="task-menu-container">
                <button
                  className="menu-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === task.id ? null : task.id);
                  }}
                >
                  ⋯
                </button>
                {openMenuId === task.id && (
                  <div
                    className="task-menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="menu-section-label">Status</div>
                    {(
                      Object.entries(STATUSES) as [
                        TaskStatus,
                        { label: string; color: string },
                      ][]
                    ).map(([key, { label, color }]) => (
                      <button
                        key={key}
                        className={`menu-item ${task.status === key ? "active" : ""}`}
                        onClick={() => setTaskStatus(task.id, key)}
                      >
                        <span
                          className="status-dot"
                          style={{ background: color }}
                        />
                        {label}
                      </button>
                    ))}
                    <div className="menu-section-label">Category</div>
                    {Object.entries(CATEGORIES).map(
                      ([key, { label, color }]) => (
                        <button
                          key={key}
                          className={`menu-item ${task.category === key ? "active" : ""}`}
                          onClick={() => setTaskCategory(task.id, key)}
                        >
                          <span
                            className="category-dot"
                            style={{ background: color }}
                          />
                          {label}
                        </button>
                      ),
                    )}
                    {task.category && (
                      <button
                        className="menu-item clear-category"
                        onClick={() => setTaskCategory(task.id, undefined)}
                      >
                        Clear category
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                className="delete-btn"
                onClick={() => deleteTask(task.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="help-text">
          <p>Cmd/Ctrl+Enter to add new task</p>
          <p>Shift+drag between nodes to connect</p>
          <p>Shift+click connection to remove</p>
        </div>
      </div>

      <div className="canvas-container">
        <svg
          ref={svgRef}
          className="canvas"
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

          {tasks.map((task, index) => (
            <g
              key={task.id}
              transform={`translate(${task.x}, ${task.y})`}
              onMouseEnter={() => setHoveredNode(task.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <circle
                r="25"
                className={`node ${draggingNode === task.id ? "dragging" : ""}`}
                style={{
                  fill: STATUSES[task.status]?.color || STATUSES.pending.color,
                  ...(task.category
                    ? {
                        stroke: CATEGORIES[task.category]?.color,
                        strokeWidth: 3,
                      }
                    : {}),
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, task.id)}
              />
              <circle cx="0" cy="-25" r="10" className="node-number-badge" />
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
