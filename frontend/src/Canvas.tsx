import { useRef, useCallback, forwardRef, useImperativeHandle, useState, useEffect } from "react";
import "./Canvas.css";
import { Maximize, Focus } from "lucide-react";
import { Task, Group, TaskStatus } from "./Sidebar";
import { Connector, PendingConnector } from "./Connector";
import { TaskNode } from "./TaskNode";
import { ProgressBar } from "./ProgressBar";
import { CategoryConfig, StatusConfig, getConnector, getGroupBox } from "./theme";
import { GroupRect } from "./GroupRect";
import { SaveImageAs, GetAtlassianAuthStatus, StartAtlassianLogin, AtlassianLogout } from "../wailsjs/go/main/App";

interface AtlassianStatus {
  loggedIn: boolean;
  displayName: string;
  email: string;
}

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

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasHandle {
  getSvgCoords: (e: React.MouseEvent) => { x: number; y: number };
  getSvgElement: () => SVGSVGElement | null;
}

interface CanvasProps {
  tasks: Task[];
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
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
  onGroupResize: (id: string, x: number, y: number, width: number, height: number) => void;
  onGroupTitleChange: (id: string, title: string) => void;
  onGroupZoomTo: (id: string) => void;
  viewBox: ViewBox;
  onViewBoxChange: (vb: ViewBox) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSetTaskStatus: (id: string, status: TaskStatus) => void;
  onSetTaskCategory: (id: string, category: string | undefined) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTaskText: (id: string, text: string) => void;
}

const ZOOM_SENSITIVITY = 0.001;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  {
    tasks,
    categories,
    statuses,
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
    onGroupZoomTo,
    viewBox,
    onViewBoxChange,
    theme,
    onToggleTheme,
    onSetTaskStatus,
    onSetTaskCategory,
    onDeleteTask,
    onUpdateTaskText,
  },
  ref
) {
  const groupBox = getGroupBox(theme);
  const connector = getConnector(theme);

  const svgRef = useRef<SVGSVGElement>(null);
  const menuWrapperRef = useRef<HTMLDivElement>(null);
  const nodeContextMenuRef = useRef<HTMLDivElement>(null);
  const touchPanRef = useRef<{ startX: number; startY: number; origVx: number; origVy: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [atlassianStatus, setAtlassianStatus] = useState<AtlassianStatus>({ loggedIn: false, displayName: "", email: "" });
  const [atlassianLoginInProgress, setAtlassianLoginInProgress] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [middleMouseHeld, setMiddleMouseHeld] = useState(false);
  const panMode = spaceHeld || middleMouseHeld;
  const [panning, setPanning] = useState<{ startX: number; startY: number; origVx: number; origVy: number } | null>(null);
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;
  const viewBoxInitialized = useRef(false);

  // Initialize viewBox dimensions from container size if not yet set
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || viewBoxInitialized.current) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (viewBox.width === 0 && viewBox.height === 0) {
        onViewBoxChange({ ...viewBox, width: rect.width, height: rect.height });
      }
      viewBoxInitialized.current = true;
    }
  });

  // Spacebar tracking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
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

  useEffect(() => {
    if (!nodeContextMenu) return;
    const handleClose = (e: MouseEvent) => {
      if (nodeContextMenuRef.current && !nodeContextMenuRef.current.contains(e.target as Node)) {
        setNodeContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNodeContextMenu(null);
    };
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [nodeContextMenu]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setNodeContextMenu({ taskId, x: e.clientX, y: e.clientY });
  }, []);

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
    if (e.button === 1) {
      e.preventDefault();
      setMiddleMouseHeld(true);
      setPanning({ startX: e.clientX, startY: e.clientY, origVx: viewBox.x, origVy: viewBox.y });
      return;
    }
    if (panMode) {
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
      onViewBoxChange({ ...viewBox, x: panning.origVx - dx, y: panning.origVy - dy });
      return;
    }
    onMouseMove(e, getSvgCoords(e));
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1) {
      setMiddleMouseHeld(false);
    }
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

    const prev = viewBoxRef.current;
    const zoomFactor = 1 + e.deltaY * ZOOM_SENSITIVITY;
    const baseWidth = rect.width;
    const currentZoom = baseWidth / prev.width;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom / zoomFactor));
    const newWidth = baseWidth / newZoom;
    const newHeight = rect.height / newZoom;

    const newX = prev.x + (prev.width - newWidth) * mouseXFrac;
    const newY = prev.y + (prev.height - newHeight) * mouseYFrac;

    onViewBoxChange({ x: newX, y: newY, width: newWidth, height: newHeight });
  }, [onViewBoxChange]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const avgTouchPos = (touches: TouchList) => ({
      x: Array.from(touches).reduce((s, t) => s + t.clientX, 0) / touches.length,
      y: Array.from(touches).reduce((s, t) => s + t.clientY, 0) / touches.length,
    });

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 3) {
        e.preventDefault();
        const { x, y } = avgTouchPos(e.touches);
        touchPanRef.current = { startX: x, startY: y, origVx: viewBoxRef.current.x, origVy: viewBoxRef.current.y };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchPanRef.current || e.touches.length < 3) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const { x, y } = avgTouchPos(e.touches);
      const scale = viewBoxRef.current.width / rect.width;
      const dx = (x - touchPanRef.current.startX) * scale;
      const dy = (y - touchPanRef.current.startY) * scale;
      onViewBoxChange({ ...viewBoxRef.current, x: touchPanRef.current.origVx - dx, y: touchPanRef.current.origVy - dy });
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 3) touchPanRef.current = null;
    };

    svg.addEventListener("touchstart", handleTouchStart, { passive: false });
    svg.addEventListener("touchmove", handleTouchMove, { passive: false });
    svg.addEventListener("touchend", handleTouchEnd);
    return () => {
      svg.removeEventListener("touchstart", handleTouchStart);
      svg.removeEventListener("touchmove", handleTouchMove);
      svg.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onViewBoxChange]);

  useEffect(() => {
    GetAtlassianAuthStatus()
      .then((s) => setAtlassianStatus(s))
      .catch(console.error);
  }, []);

  const handleAtlassianLogin = useCallback(async () => {
    setMenuOpen(false);
    setAtlassianLoginInProgress(true);
    try {
      await StartAtlassianLogin();
    } catch (err) {
      console.error("Atlassian login failed:", err);
    } finally {
      setAtlassianLoginInProgress(false);
      GetAtlassianAuthStatus()
        .then((s) => setAtlassianStatus(s))
        .catch(console.error);
    }
  }, []);

  const handleAtlassianLogout = useCallback(async () => {
    setMenuOpen(false);
    try {
      await AtlassianLogout();
    } catch (err) {
      console.error("Atlassian logout failed:", err);
    }
    setAtlassianStatus({ loggedIn: false, displayName: "", email: "" });
  }, []);

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

      // Resolve all CSS variables so the serialized SVG renders correctly when
      // loaded as an <img> (external stylesheets and CSS vars are unavailable there).
      const computedRoot = getComputedStyle(document.documentElement);
      const cssVarNames = [
        "--bg-primary", "--bg-secondary", "--bg-tertiary",
        "--text-primary", "--text-secondary",
        "--node-fill", "--node-stroke", "--node-badge-fill", "--node-badge-stroke",
        "--tooltip-fill", "--tooltip-stroke",
        "--connector-color", "--connector-pending",
        "--selection-fill", "--selection-stroke",
        "--group-fill", "--group-stroke", "--group-stroke-hover", "--group-title-color",
      ];
      const cssVarBlock = cssVarNames
        .map(v => `${v}: ${computedRoot.getPropertyValue(v).trim()};`)
        .join(" ");

      const appFont = getComputedStyle(document.body).fontFamily;

      const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleEl.textContent = `
        :root { ${cssVarBlock} }
        svg, text, tspan { font-family: ${appFont}; }
        .node { fill: var(--node-fill); stroke: var(--node-stroke); stroke-width: 2; }
        .node.highlighted { stroke-width: 3; }
        .node.selected { stroke: var(--selection-stroke); stroke-width: 3; }
        .node-text { fill: var(--text-primary); font-size: 10px; font-weight: 500; }
        .node-emoji { font-size: 18px; }
        .node-number-badge { fill: var(--node-badge-fill); stroke: var(--node-badge-stroke); stroke-width: 1; }
        .node-number { fill: var(--text-primary); font-size: 10px; font-weight: 600; }
        .tooltip rect { fill: var(--tooltip-fill); stroke: var(--tooltip-stroke); stroke-width: 1; }
        .tooltip text { fill: var(--text-primary); font-size: 12px; }
        .group-rect { fill: var(--group-fill); stroke: var(--group-stroke); stroke-width: 1.5; stroke-dasharray: 6, 3; }
        .group-rect.selected { stroke: var(--selection-stroke); stroke-width: 2; }
        .group-title { fill: var(--group-title-color); font-size: 13px; font-weight: 500; }
        .group-zoom-btn-bg { fill: var(--group-fill); stroke: var(--group-stroke); stroke-width: 1; }
        .group-zoom-btn-icon { fill: none; stroke: var(--group-title-color); stroke-width: 1.5; stroke-linecap: round; }
        .group-progress-track { fill: var(--bg-tertiary); }
        .group-progress-fill { transition: width 0.3s; }
        .group-resize-handle { display: none; }
      `;
      clone.prepend(styleEl);

      // Also replace var() in presentation attributes since some browsers won't
      // resolve them when SVG is rendered as a standalone document via <img>.
      const resolveVarAttrs = (el: Element) => {
        for (const attr of Array.from(el.attributes)) {
          if (attr.value.includes("var(")) {
            attr.value = attr.value.replace(/var\(([^)]+)\)/g, (_, name) =>
              computedRoot.getPropertyValue(name.trim()).trim()
            );
          }
        }
        for (const child of Array.from(el.children)) resolveVarAttrs(child);
      };
      resolveVarAttrs(clone);

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

  const fitToScreen = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const padding = 60;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    tasks.forEach((t) => {
      minX = Math.min(minX, t.x - 30);
      minY = Math.min(minY, t.y - 30);
      maxX = Math.max(maxX, t.x + 30);
      maxY = Math.max(maxY, t.y + 60);
    });
    groups.forEach((g) => {
      minX = Math.min(minX, g.x);
      minY = Math.min(minY, g.y);
      maxX = Math.max(maxX, g.x + g.width);
      maxY = Math.max(maxY, g.y + g.height);
    });

    if (!isFinite(minX)) {
      onViewBoxChange({ x: 0, y: 0, width: rect.width, height: rect.height });
      return;
    }

    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const scaleX = rect.width / contentW;
    const scaleY = rect.height / contentH;
    const scale = Math.min(scaleX, scaleY);
    const fitW = rect.width / scale;
    const fitH = rect.height / scale;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    onViewBoxChange({
      x: cx - fitW / 2,
      y: cy - fitH / 2,
      width: fitW,
      height: fitH,
    });
  }, [tasks, groups, onViewBoxChange]);

  const resetZoom = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    onViewBoxChange({ x: 0, y: 0, width: rect.width, height: rect.height });
  }, [onViewBoxChange]);

  return (
    <div className="canvas-container">
      <div className="canvas-toolbar">
        <button
          type="button"
          className="canvas-toolbar-btn"
          onClick={fitToScreen}
          aria-label="Fit to screen"
          data-tooltip="Fit to screen"
        >
          <Maximize size={16} />
        </button>
        <button
          type="button"
          className="canvas-toolbar-btn"
          onClick={resetZoom}
          aria-label="Reset zoom to 100%"
          data-tooltip="Reset zoom"
        >
          <Focus size={16} />
        </button>
      </div>
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
                onToggleTheme();
                setMenuOpen(false);
              }}
            >
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </button>
            <button
              type="button"
              role="menuitem"
              className="canvas-menu-item"
              onClick={() => {
                setShowHelp(true);
                setMenuOpen(false);
              }}
            >
              How to Use
            </button>
            <hr className="canvas-menu-divider" />
            {atlassianStatus.loggedIn ? (
              <>
                <div className="canvas-menu-info" role="menuitem" aria-disabled="true">
                  Logged in as {atlassianStatus.displayName}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="canvas-menu-item"
                  onClick={handleAtlassianLogout}
                >
                  Logout from Atlassian
                </button>
              </>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="canvas-menu-item"
                onClick={handleAtlassianLogin}
                disabled={atlassianLoginInProgress}
              >
                {atlassianLoginInProgress ? "Logging in…" : "Login to Atlassian"}
              </button>
            )}
          </div>
        )}
      </div>
      <svg
        ref={svgRef}
        className={`canvas ${panMode || panning ? "panning" : ""}`}
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
            <polygon points="0 0, 10 3.5, 0 7" fill={connector.color} />
          </marker>
        </defs>

        {groups.map((group) => (
          <GroupRect
            key={group.id}
            group={group}
            tasks={tasks}
            statuses={statuses}
            groupBox={groupBox}
            isSelected={selectedGroups.has(group.id)}
            onMouseDown={onGroupMouseDown}
            onMove={onGroupMove}
            onResize={onGroupResize}
            onTitleChange={onGroupTitleChange}
            onZoomTo={onGroupZoomTo}
          />
        ))}

        {tasks.map((task, index) => (
          <TaskNode
            key={task.id}
            task={task}
            index={index}
            categories={categories}
            statuses={statuses}
            isDragging={draggingNode === task.id}
            isHighlighted={highlightedTaskId === task.id}
            isSelected={selectedNodes.has(task.id)}
            isHovered={hoveredNode === task.id}
            onMouseDown={(e) => onNodeMouseDown(e, task.id)}
            onClick={() => onNodeClick(task.id)}
            onMouseEnter={() => onNodeHover(task.id)}
            onMouseLeave={() => onNodeHover(null)}
            onContextMenu={(e) => handleNodeContextMenu(e, task.id)}
            onUpdateText={(text) => onUpdateTaskText(task.id, text)}
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
              connector={connector}
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
            connector={connector}
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
      <ProgressBar tasks={tasks} statuses={statuses} groupBox={groupBox} />
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="help-dialog-header">
              <h3>Keyboard Shortcuts</h3>
              <button className="help-close-btn" onClick={() => setShowHelp(false)}>×</button>
            </div>
            <table className="help-table">
              <tbody>
                <tr><td className="help-key">Cmd/Ctrl + S</td><td>Save</td></tr>
                <tr><td className="help-key">Cmd/Ctrl + Enter</td><td>Add new task</td></tr>
                <tr><td className="help-key">Shift + drag</td><td>Connect nodes</td></tr>
                <tr><td className="help-key">Shift + click connection</td><td>Remove connection</td></tr>
                <tr><td className="help-key">Space + drag</td><td>Pan canvas</td></tr>
                <tr><td className="help-key">Middle mouse + drag</td><td>Pan canvas</td></tr>
                <tr><td className="help-key">Scroll wheel</td><td>Zoom in/out</td></tr>
                <tr><td className="help-key">Escape</td><td>Clear selection</td></tr>
                <tr><td className="help-key">Double-click group title</td><td>Edit group name</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {nodeContextMenu && (() => {
        const task = tasks.find((t) => t.id === nodeContextMenu.taskId);
        if (!task) return null;
        return (
          <div
            ref={nodeContextMenuRef}
            className="task-menu"
            style={{ position: "fixed", top: nodeContextMenu.y, left: nodeContextMenu.x, transform: "none" }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="menu-section-label">Status</div>
            {(Object.entries(statuses) as [TaskStatus, StatusConfig][]).map(([key, { label, color }]) => (
              <button
                key={key}
                className={`menu-item ${task.status === key ? "active" : ""}`}
                onClick={() => { onSetTaskStatus(task.id, key); setNodeContextMenu(null); }}
              >
                <span className="status-dot" style={{ background: color }} />
                {label}
              </button>
            ))}
            <div className="menu-section-label">Category</div>
            {Object.entries(categories).map(([key, { label, color }]) => (
              <button
                key={key}
                className={`menu-item ${task.category === key ? "active" : ""}`}
                onClick={() => { onSetTaskCategory(task.id, key); setNodeContextMenu(null); }}
              >
                <span className="category-dot" style={{ background: color }} />
                {label}
              </button>
            ))}
            {task.category && (
              <button
                className="menu-item clear-category"
                onClick={() => { onSetTaskCategory(task.id, undefined); setNodeContextMenu(null); }}
              >
                Clear category
              </button>
            )}
            <button
              className="menu-item delete-item"
              onClick={() => { onDeleteTask(task.id); setNodeContextMenu(null); }}
            >
              Delete
            </button>
          </div>
        );
      })()}
    </div>
  );
});
