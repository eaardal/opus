import { useRef, useCallback, forwardRef, useImperativeHandle, useState, useEffect } from "react";
import "./Canvas.css";
import { Task, Group } from "./Sidebar";
import { Connector, PendingConnector } from "./Connector";
import { TaskNode } from "./TaskNode";
import { GroupRect } from "./GroupRect";
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
  groups: Group[];
  selectedGroups: Set<string>;
  onGroupMouseDown: (e: React.MouseEvent, groupId: string) => void;
  onGroupMove: (id: string, x: number, y: number) => void;
  onGroupResize: (id: string, width: number, height: number) => void;
  onGroupTitleChange: (id: string, title: string) => void;
}

const ZOOM_SENSITIVITY = 0.001;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

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
    groups,
    selectedGroups,
    onGroupMouseDown,
    onGroupMove,
    onGroupResize,
    onGroupTitleChange,
  },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const menuWrapperRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightMode, setLightMode] = useState(() => document.documentElement.getAttribute("data-theme") === "light");
  const [spacePressed, setSpacePressed] = useState(false);
  const [panning, setPanning] = useState<{ startX: number; startY: number; origVx: number; origVy: number } | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const viewBoxInitialized = useRef(false);

  // Initialize viewBox from container size
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || viewBoxInitialized.current) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setViewBox({ x: 0, y: 0, width: rect.width, height: rect.height });
      viewBoxInitialized.current = true;
    }
  });

  // Spacebar tracking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

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
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const svgPt = pt.matrixTransform(ctm.inverse());
      return { x: svgPt.x, y: svgPt.y };
    },
    []
  );

  useImperativeHandle(ref, () => ({
    getSvgCoords,
    getSvgElement: () => svgRef.current,
  }));

  const handleMouseDown = (e: React.MouseEvent) => {
    if (spacePressed) {
      e.preventDefault();
      setPanning({ startX: e.clientX, startY: e.clientY, origVx: viewBox.x, origVy: viewBox.y });
      return;
    }
    onMouseDown(e, svgRef.current);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (panning) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = viewBox.width / rect.width;
      const dx = (e.clientX - panning.startX) * scale;
      const dy = (e.clientY - panning.startY) * scale;
      setViewBox((prev) => ({ ...prev, x: panning.origVx - dx, y: panning.origVy - dy }));
      return;
    }
    onMouseMove(e, getSvgCoords(e));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (panning) {
      setPanning(null);
      return;
    }
    onMouseUp(e, getSvgCoords(e));
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseXFrac = (e.clientX - rect.left) / rect.width;
    const mouseYFrac = (e.clientY - rect.top) / rect.height;

    setViewBox((prev) => {
      const zoomFactor = 1 + e.deltaY * ZOOM_SENSITIVITY;
      const baseWidth = rect.width;
      const currentZoom = baseWidth / prev.width;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom / zoomFactor));
      const newWidth = baseWidth / newZoom;
      const newHeight = rect.height / newZoom;

      const newX = prev.x + (prev.width - newWidth) * mouseXFrac;
      const newY = prev.y + (prev.height - newHeight) * mouseYFrac;

      return { x: newX, y: newY, width: newWidth, height: newHeight };
    });
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

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
      const bgColor = getComputedStyle(document.documentElement).getPropertyValue("--bg-primary").trim();
      ctx.fillStyle = bgColor || "#0f0f1a";
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
            <button
              type="button"
              role="menuitem"
              className="canvas-menu-item"
              onClick={() => {
                const next = !lightMode;
                setLightMode(next);
                document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
                setMenuOpen(false);
              }}
            >
              {lightMode ? "Dark Mode" : "Light Mode"}
            </button>
          </div>
        )}
      </div>
      <svg
        ref={svgRef}
        className={`canvas ${spacePressed || panning ? "panning" : ""}`}
        viewBox={viewBox.width > 0 ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}` : undefined}
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
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--connector-color)" />
          </marker>
        </defs>

        {groups.map((group) => (
          <GroupRect
            key={group.id}
            group={group}
            isSelected={selectedGroups.has(group.id)}
            onMouseDown={onGroupMouseDown}
            onMove={onGroupMove}
            onResize={onGroupResize}
            onTitleChange={onGroupTitleChange}
          />
        ))}

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
      </svg>
    </div>
  );
});
