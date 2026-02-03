import { useState, useRef, useCallback } from 'react';
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
  const svgRef = useRef<SVGSVGElement>(null);

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
    setTasks(tasks.filter(t => t.id !== id));
    setConnections(connections.filter(c => c.from !== id && c.to !== id));
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

  const removeConnection = (from: string, to: string) => {
    setConnections(connections.filter(c => !(c.from === from && c.to === to)));
  };

  const getArrowPath = (fromTask: Task, toTask: Task): string => {
    const dx = toTask.x - fromTask.x;
    const dy = toTask.y - fromTask.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return '';

    const nodeRadius = 25;
    const arrowOffset = 8;

    const ux = dx / len;
    const uy = dy / len;

    const startX = fromTask.x + ux * nodeRadius;
    const startY = fromTask.y + uy * nodeRadius;
    const endX = toTask.x - ux * (nodeRadius + arrowOffset);
    const endY = toTask.y - uy * (nodeRadius + arrowOffset);

    return `M ${startX} ${startY} L ${endX} ${endY}`;
  };

  return (
    <div id="App">
      <div className="sidebar">
        <h2>Tasks</h2>
        <button className="add-btn" onClick={addTask}>+ Add Task</button>
        <div className="task-list">
          {tasks.map(task => (
            <div key={task.id} className="task-item">
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
          <p>Click connection to remove</p>
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

            return (
              <path
                key={`${conn.from}-${conn.to}`}
                d={getArrowPath(fromTask, toTask)}
                stroke="#666"
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
                className="connection"
                onClick={() => removeConnection(conn.from, conn.to)}
              />
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

          {tasks.map(task => (
            <g key={task.id} transform={`translate(${task.x}, ${task.y})`}>
              <circle
                r="25"
                className={`node ${draggingNode === task.id ? 'dragging' : ''}`}
                onMouseDown={(e) => handleNodeMouseDown(e, task.id)}
              />
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
