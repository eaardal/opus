import { useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Task } from "./Sidebar";
import { Connector, PendingConnector } from "./Connector";
import { TaskNode } from "./TaskNode";

export interface Connection {
  from: string;
  to: string;
}

interface SelectionRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface ConnectingState {
  from: string;
  mouseX: number;
  mouseY: number;
}

export interface CanvasHandle {
  getSvgCoords: (e: React.MouseEvent) => { x: number; y: number };
  getSvgElement: () => SVGSVGElement | null;
}

interface CanvasProps {
  tasks: Task[];
  connections: Connection[];
  draggingNode: string | null;
  connecting: ConnectingState | null;
  shiftPressed: boolean;
  hoveredNode: string | null;
  highlightedTaskId: string | null;
  selectedNodes: Set<string>;
  selection: SelectionRect | null;
  onMouseDown: (e: React.MouseEvent, svgElement: SVGSVGElement | null) => void;
  onMouseMove: (e: React.MouseEvent, coords: { x: number; y: number }) => void;
  onMouseUp: (e: React.MouseEvent, coords: { x: number; y: number }) => void;
  onNodeMouseDown: (e: React.MouseEvent, taskId: string) => void;
  onNodeClick: (taskId: string) => void;
  onNodeHover: (taskId: string | null) => void;
  onRemoveConnection: (e: React.MouseEvent, from: string, to: string) => void;
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  {
    tasks,
    connections,
    draggingNode,
    connecting,
    shiftPressed,
    hoveredNode,
    highlightedTaskId,
    selectedNodes,
    selection,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onNodeMouseDown,
    onNodeClick,
    onNodeHover,
    onRemoveConnection,
  },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);

  const getSvgCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  useImperativeHandle(ref, () => ({
    getSvgCoords,
    getSvgElement: () => svgRef.current,
  }));

  const handleMouseDown = (e: React.MouseEvent) => {
    onMouseDown(e, svgRef.current);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    onMouseMove(e, getSvgCoords(e));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    onMouseUp(e, getSvgCoords(e));
  };

  return (
    <div className="canvas-container">
      <svg
        ref={svgRef}
        className="canvas"
        onMouseDown={handleMouseDown}
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

          return (
            <Connector
              key={`${conn.from}-${conn.to}`}
              fromTask={fromTask}
              toTask={toTask}
              shiftPressed={shiftPressed}
              onRemove={(e) => onRemoveConnection(e, conn.from, conn.to)}
            />
          );
        })}

        {connecting && (
          <PendingConnector
            fromX={tasks.find((t) => t.id === connecting.from)?.x || 0}
            fromY={tasks.find((t) => t.id === connecting.from)?.y || 0}
            toX={connecting.mouseX}
            toY={connecting.mouseY}
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
          <TaskNode
            key={task.id}
            task={task}
            index={index}
            isDragging={draggingNode === task.id}
            isHighlighted={highlightedTaskId === task.id}
            isSelected={selectedNodes.has(task.id)}
            isHovered={hoveredNode === task.id}
            onMouseDown={(e) => onNodeMouseDown(e, task.id)}
            onClick={() => onNodeClick(task.id)}
            onMouseEnter={() => onNodeHover(task.id)}
            onMouseLeave={() => onNodeHover(null)}
          />
        ))}
      </svg>
    </div>
  );
});
