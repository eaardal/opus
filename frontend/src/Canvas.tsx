import { useRef, useCallback, forwardRef, useImperativeHandle, useState, useEffect } from "react";
import "./Canvas.css";
import { Task } from "./Sidebar";
import { Connector, PendingConnector } from "./Connector";
import { TaskNode } from "./TaskNode";
import { SaveImageAs } from "../wailsjs/go/main/App";

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
  const menuWrapperRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuWrapperRef.current && !menuWrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

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

  const exportCanvasAsPng = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    setMenuOpen(false);
    try {
      const rect = svg.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", String(w));
      clone.setAttribute("height", String(h));
      const xml = new XMLSerializer().serializeToString(clone);
      const svgDataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load SVG image"));
        img.src = svgDataUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      ctx.fillStyle = "#0f0f1a";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const pngDataUrl = canvas.toDataURL("image/png");
      const base64 = pngDataUrl.replace(/^data:image\/png;base64,/, "");
      await SaveImageAs(base64);
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, []);

  return (
    <div className="canvas-container">
      <div className="canvas-menu-wrapper" ref={menuWrapperRef}>
        <button
          type="button"
          className="canvas-menu-trigger"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Canvas menu"
          aria-expanded={menuOpen}
        >
          <span className="canvas-menu-icon" aria-hidden>☰</span>
        </button>
        {menuOpen && (
          <div className="canvas-menu-dropdown" role="menu">
            <button
              type="button"
              role="menuitem"
              className="canvas-menu-item"
              onClick={exportCanvasAsPng}
            >
              Export as PNG
            </button>
          </div>
        )}
      </div>
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
