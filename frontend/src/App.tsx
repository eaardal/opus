import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

interface Task {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface Connection {
  from: string;
  to: string;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ from: string; mouseX: number; mouseY: number } | null>(null);
  const [shiftPressed, setShiftPressed] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const addTask = () => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: '',
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    };
    setTasks([...tasks, newTask]);
  };

  const updateTaskText = (id: string, text: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, text } : t));
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    const taskName = task?.text || 'this task';
    if (confirm(`Delete "${taskName}"?`)) {
      setTasks(prev => prev.filter(t => t.id !== id));
      setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
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

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNode) {
      const coords = getSvgCoords(e);
      setTasks(prev => prev.map(t =>
        t.id === draggingNode ? { ...t, x: coords.x, y: coords.y } : t
      ));
    } else if (connecting) {
      const coords = getSvgCoords(e);
      setConnecting({ ...connecting, mouseX: coords.x, mouseY: coords.y });
    }
  }, [draggingNode, connecting]);

  const handleMouseUp = (e: React.MouseEvent) => {
    if (connecting) {
      const coords = getSvgCoords(e);
      const targetTask = tasks.find(t => {
        const dx = t.x - coords.x;
        const dy = t.y - coords.y;
        return Math.sqrt(dx * dx + dy * dy) < 30;
      });

      if (targetTask && targetTask.id !== connecting.from) {
        const exists = connections.some(
          c => c.from === connecting.from && c.to === targetTask.id
        );
        if (!exists) {
          setConnections([...connections, { from: connecting.from, to: targetTask.id }]);
        }
      }
    }
    setDraggingNode(null);
    setConnecting(null);
  };

  const removeConnection = (e: React.MouseEvent, from: string, to: string) => {
    if (e.shiftKey) {
      setConnections(connections.filter(c => !(c.from === from && c.to === to)));
    }
  };

  const getArrowPath = (fromTask: Task, toTask: Task): { path: string; endX: number; endY: number } => {
    const dx = toTask.x - fromTask.x;
    const dy = toTask.y - fromTask.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { path: '', endX: 0, endY: 0 };

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
        <h2>Tasks</h2>
        <button className="add-btn" onClick={addTask}>+ Add Task</button>
        <div className="task-list">
          {tasks.map((task, index) => (
            <div key={task.id} className="task-item">
              <span className="task-number">{index + 1}</span>
              <input
                type="text"
                value={task.text}
                onChange={(e) => updateTaskText(task.id, e.target.value)}
                placeholder="Enter task..."
              />
              <button className="delete-btn" onClick={() => deleteTask(task.id)}>×</button>
            </div>
          ))}
        </div>
        <div className="help-text">
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

          {connections.map(conn => {
            const fromTask = tasks.find(t => t.id === conn.from);
            const toTask = tasks.find(t => t.id === conn.to);
            if (!fromTask || !toTask) return null;

            const { path, endX, endY } = getArrowPath(fromTask, toTask);

            return (
              <g key={`${conn.from}-${conn.to}`} className={`connection-group ${shiftPressed ? 'shift-active' : ''}`}>
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
              x1={tasks.find(t => t.id === connecting.from)?.x || 0}
              y1={tasks.find(t => t.id === connecting.from)?.y || 0}
              x2={connecting.mouseX}
              y2={connecting.mouseY}
              stroke="#999"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          )}

          {tasks.map((task, index) => (
            <g key={task.id} transform={`translate(${task.x}, ${task.y})`}>
              <circle
                r="25"
                className={`node ${draggingNode === task.id ? 'dragging' : ''}`}
                onMouseDown={(e) => handleNodeMouseDown(e, task.id)}
              />
              <circle
                cx="0"
                cy="-25"
                r="10"
                className="node-number-badge"
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
                {task.text.slice(0, 8) || '?'}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default App;
