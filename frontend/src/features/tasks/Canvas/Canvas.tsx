import { useRef, useCallback, forwardRef, useImperativeHandle, useState, useEffect } from "react";
import "./Canvas.css";
import { Maximize, Focus, Undo2, Redo2, LayoutList } from "lucide-react";
import type { Task, Group, TaskStatus } from "../../../domain/tasks/types";
import { Connector, PendingConnector } from "./Connector";
import { TaskNode } from "./TaskNode";
import { ProgressBar } from "./ProgressBar";
import { type CategoryConfig, type StatusConfig, getConnector, getGroupBox } from "../theme";
import { GroupRect } from "./GroupRect";
import type { Person } from "../../../domain/teams/types";
import { TaskContextMenu } from "../TaskContextMenu";
import { TaskQueuePanel } from "../TaskQueuePanel";
import { SettingsDialog, type AppSettings, loadSettings } from "../SettingsDialog";
import { toSvgCoords as toSvgCoordsPure } from "../../../lib/svgCoords";
import { fitViewBoxToContent, zoomViewBoxAtPoint } from "../../../domain/tasks/viewport";
import { exportSvgElementAsPng } from "../../../domain/tasks/exportCanvasAsPng";
import type { Connection, ViewBox } from "../../../domain/tasks/types";

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
  exportAsPng: () => void;
  openSettings: () => void;
  openHelp: () => void;
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
  onGroupMoveStart: () => void;
  onGroupResize: (id: string, x: number, y: number, width: number, height: number) => void;
  onGroupResizeStart: () => void;
  onGroupTitleChange: (id: string, title: string) => void;
  onGroupZoomTo: (id: string) => void;
  onGroupToggleLock: (id: string) => void;
  onGroupDelete: (id: string) => void;
  people: Person[];
  onAssignPeople: (taskId: string, personIds: string[]) => void;
  onAssignPersonAndSetInProgress: (taskId: string, personId: string) => void;
  viewBox: ViewBox;
  onViewBoxChange: (vb: ViewBox) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSetTaskStatus: (id: string, status: TaskStatus) => void;
  onSetTaskCategory: (id: string, category: string | undefined) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTaskText: (id: string, text: string) => void;
  onCreateTaskAt: (x: number, y: number) => void;
  onCreateGroupAt: (x: number, y: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onHighlightTask: (taskId: string | null) => void;
}

const ZOOM_SENSITIVITY = 0.001;
const ZOOM_SENSITIVITY_TRACKPAD = 0.02;
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
    onGroupMoveStart,
    onGroupResize,
    onGroupResizeStart,
    onGroupTitleChange,
    onGroupZoomTo,
    onGroupToggleLock,
    onGroupDelete,
    people,
    onAssignPeople,
    onAssignPersonAndSetInProgress,
    viewBox,
    onViewBoxChange,
    theme,
    onToggleTheme,
    onSetTaskStatus,
    onSetTaskCategory,
    onDeleteTask,
    onUpdateTaskText,
    onCreateTaskAt,
    onCreateGroupAt,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onHighlightTask,
  },
  ref,
) {
  const groupBox = getGroupBox(theme);
  const connector = getConnector(theme);

  const svgRef = useRef<SVGSVGElement>(null);
  const groupContextMenuRef = useRef<HTMLDivElement>(null);
  const canvasContextMenuRef = useRef<HTMLDivElement>(null);
  const touchPanRef = useRef<{
    startX: number;
    startY: number;
    origVx: number;
    origVy: number;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [isTaskQueueOpen, setIsTaskQueueOpen] = useState(false);
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    taskId: string;
    x: number;
    y: number;
  } | null>(null);
  const [groupContextMenu, setGroupContextMenu] = useState<{
    groupId: string;
    x: number;
    y: number;
    svgX: number;
    svgY: number;
  } | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<{
    screenX: number;
    screenY: number;
    svgX: number;
    svgY: number;
  } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [middleMouseHeld, setMiddleMouseHeld] = useState(false);
  const panMode = spaceHeld || middleMouseHeld;
  const [panning, setPanning] = useState<{
    startX: number;
    startY: number;
    origVx: number;
    origVy: number;
  } | null>(null);
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
    if (!groupContextMenu) return;
    const handleClose = (e: MouseEvent) => {
      if (groupContextMenuRef.current && !groupContextMenuRef.current.contains(e.target as Node)) {
        setGroupContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGroupContextMenu(null);
    };
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [groupContextMenu]);

  useEffect(() => {
    if (!canvasContextMenu) return;
    const handleClose = (e: MouseEvent) => {
      if (
        canvasContextMenuRef.current &&
        !canvasContextMenuRef.current.contains(e.target as Node)
      ) {
        setCanvasContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCanvasContextMenu(null);
    };
    document.addEventListener("mousedown", handleClose);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [canvasContextMenu]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setNodeContextMenu({ taskId, x: e.clientX, y: e.clientY });
  }, []);

  const toSvgCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } =>
      svgRef.current ? toSvgCoordsPure(svgRef.current, clientX, clientY) : { x: 0, y: 0 },
    [],
  );

  const getSvgCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => toSvgCoords(e.clientX, e.clientY),
    [toSvgCoords],
  );

  useImperativeHandle(ref, () => ({
    getSvgCoords,
    getSvgElement: () => svgRef.current,
    exportAsPng: () => {
      void exportCanvasAsPng();
    },
    openSettings: () => setShowSettings(true),
    openHelp: () => setShowHelp(true),
  }));

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.target !== svgRef.current) return;
      e.preventDefault();
      const coords = getSvgCoords(e);
      setCanvasContextMenu({
        screenX: e.clientX,
        screenY: e.clientY,
        svgX: coords.x,
        svgY: coords.y,
      });
    },
    [getSvgCoords],
  );

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

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const sensitivity = e.ctrlKey ? ZOOM_SENSITIVITY_TRACKPAD : ZOOM_SENSITIVITY;
      onViewBoxChange(
        zoomViewBoxAtPoint({
          viewBox: viewBoxRef.current,
          screen: { width: rect.width, height: rect.height },
          mouseFracX: (e.clientX - rect.left) / rect.width,
          mouseFracY: (e.clientY - rect.top) / rect.height,
          zoomFactor: 1 + e.deltaY * sensitivity,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
        }),
      );
    },
    [onViewBoxChange],
  );

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
        touchPanRef.current = {
          startX: x,
          startY: y,
          origVx: viewBoxRef.current.x,
          origVy: viewBoxRef.current.y,
        };
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
      onViewBoxChange({
        ...viewBoxRef.current,
        x: touchPanRef.current.origVx - dx,
        y: touchPanRef.current.origVy - dy,
      });
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

  const exportCanvasAsPng = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const computedRoot = getComputedStyle(document.documentElement);
      const bgColor = computedRoot.getPropertyValue("--bg-primary").trim();
      await exportSvgElementAsPng({
        svg,
        filename: "canvas.png",
        getCssValue: (name) => computedRoot.getPropertyValue(name),
        fontFamily: getComputedStyle(document.body).fontFamily,
        backgroundColor: bgColor || "#0f0f1a",
      });
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, []);

  const fitToScreen = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    onViewBoxChange(
      fitViewBoxToContent(
        tasks.map((t) => ({ x: t.x, y: t.y })),
        groups.map((g) => ({ x: g.x, y: g.y, width: g.width, height: g.height })),
        { width: rect.width, height: rect.height },
        60,
      ),
    );
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
          className={`canvas-toolbar-btn ${isTaskQueueOpen ? "active" : ""}`}
          onClick={() => setIsTaskQueueOpen((prev) => !prev)}
          aria-label="Task Queue"
          data-tooltip="Task Queue"
        >
          <LayoutList size={16} />
        </button>
        <button
          type="button"
          className="canvas-toolbar-btn"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          data-tooltip="Undo (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className="canvas-toolbar-btn"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          data-tooltip="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={16} />
        </button>
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
      {isTaskQueueOpen && (
        <TaskQueuePanel
          tasks={tasks}
          groups={groups}
          connections={connections}
          people={people}
          categories={categories}
          statuses={statuses}
          highlightedTaskId={highlightedTaskId}
          showBlockedBySection={settings.showBlockedBySection}
          onAssignPersonToTask={onAssignPeople}
          onAssignPersonAndSetInProgress={onAssignPersonAndSetInProgress}
          onSetTaskStatus={onSetTaskStatus}
          onHighlightTask={onHighlightTask}
          onClose={() => setIsTaskQueueOpen(false)}
        />
      )}
      {showSettings && (
        <SettingsDialog
          settings={settings}
          theme={theme}
          onChange={setSettings}
          onToggleTheme={onToggleTheme}
          onClose={() => setShowSettings(false)}
        />
      )}
      <svg
        ref={svgRef}
        className={`canvas ${panMode || panning ? "panning" : ""}`}
        viewBox={
          viewBox.width > 0
            ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
            : undefined
        }
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleCanvasContextMenu}
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
            panMode={panMode}
            onMouseDown={onGroupMouseDown}
            onMove={onGroupMove}
            onMoveStart={onGroupMoveStart}
            onResize={onGroupResize}
            onResizeStart={onGroupResizeStart}
            onTitleChange={onGroupTitleChange}
            onZoomTo={onGroupZoomTo}
            onToggleLock={onGroupToggleLock}
            onContextMenu={(e, id) => {
              const svgPos = toSvgCoords(e.clientX, e.clientY);
              setGroupContextMenu({
                groupId: id,
                x: e.clientX,
                y: e.clientY,
                svgX: svgPos.x,
                svgY: svgPos.y,
              });
            }}
            toSvgCoords={toSvgCoords}
          />
        ))}

        {tasks
          .filter((task) => task.id !== hoveredNode)
          .map((task) => (
            <TaskNode
              key={task.id}
              task={task}
              index={tasks.indexOf(task)}
              categories={categories}
              statuses={statuses}
              isDragging={draggingNode === task.id}
              isHighlighted={highlightedTaskId === task.id}
              isSelected={selectedNodes.has(task.id)}
              assignedPersons={
                task.assignedPersonIds
                  ?.map((id) => people.find((p) => p.id === id))
                  .filter(Boolean) as Person[]
              }
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

        {hoveredNode &&
          (() => {
            const task = tasks.find((t) => t.id === hoveredNode);
            if (!task) return null;
            return (
              <TaskNode
                key={task.id}
                task={task}
                index={tasks.indexOf(task)}
                categories={categories}
                statuses={statuses}
                isDragging={draggingNode === task.id}
                isHighlighted={highlightedTaskId === task.id}
                isSelected={selectedNodes.has(task.id)}
                assignedPersons={
                  task.assignedPersonIds
                    ?.map((id) => people.find((p) => p.id === id))
                    .filter(Boolean) as Person[]
                }
                onMouseDown={(e) => onNodeMouseDown(e, task.id)}
                onClick={() => onNodeClick(task.id)}
                onMouseEnter={() => onNodeHover(task.id)}
                onMouseLeave={() => onNodeHover(null)}
                onContextMenu={(e) => handleNodeContextMenu(e, task.id)}
                onUpdateText={(text) => onUpdateTaskText(task.id, text)}
              />
            );
          })()}

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
              <button className="help-close-btn" onClick={() => setShowHelp(false)}>
                ×
              </button>
            </div>
            <table className="help-table">
              <tbody>
                <tr>
                  <td className="help-key">Cmd/Ctrl + S</td>
                  <td>Save</td>
                </tr>
                <tr>
                  <td className="help-key">Cmd/Ctrl + Z</td>
                  <td>Undo</td>
                </tr>
                <tr>
                  <td className="help-key">Cmd/Ctrl + Shift + Z</td>
                  <td>Redo</td>
                </tr>
                <tr>
                  <td className="help-key">Cmd/Ctrl + Enter</td>
                  <td>Add new task</td>
                </tr>
                <tr>
                  <td className="help-key">Shift + drag</td>
                  <td>Connect nodes</td>
                </tr>
                <tr>
                  <td className="help-key">Shift + click connection</td>
                  <td>Remove connection</td>
                </tr>
                <tr>
                  <td className="help-key">Space + drag</td>
                  <td>Pan canvas</td>
                </tr>
                <tr>
                  <td className="help-key">Middle mouse + drag</td>
                  <td>Pan canvas</td>
                </tr>
                <tr>
                  <td className="help-key">Scroll wheel</td>
                  <td>Zoom in/out</td>
                </tr>
                <tr>
                  <td className="help-key">Drag on canvas</td>
                  <td>Select — node/group must be fully inside the selection area</td>
                </tr>
                <tr>
                  <td className="help-key">Escape</td>
                  <td>Clear selection</td>
                </tr>
                <tr>
                  <td className="help-key">Double-click group title</td>
                  <td>Edit group name</td>
                </tr>
                <tr>
                  <td className="help-key">Double-click node tooltip</td>
                  <td>Rename node</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {canvasContextMenu && (
        <div
          ref={canvasContextMenuRef}
          className="task-menu"
          style={{
            position: "fixed",
            top: canvasContextMenu.screenY,
            left: canvasContextMenu.screenX,
            transform: "none",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="menu-item"
            onClick={() => {
              onCreateTaskAt(canvasContextMenu.svgX, canvasContextMenu.svgY);
              setCanvasContextMenu(null);
            }}
          >
            New task here
          </button>
          <button
            className="menu-item"
            onClick={() => {
              onCreateGroupAt(canvasContextMenu.svgX, canvasContextMenu.svgY);
              setCanvasContextMenu(null);
            }}
          >
            New group here
          </button>
        </div>
      )}
      {groupContextMenu &&
        (() => {
          const ctxGroup = groups.find((g) => g.id === groupContextMenu.groupId);
          return (
            <div
              ref={groupContextMenuRef}
              className="task-menu"
              style={{
                position: "fixed",
                top: groupContextMenu.y,
                left: groupContextMenu.x,
                transform: "none",
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                className="menu-item"
                onClick={() => {
                  onCreateTaskAt(groupContextMenu.svgX, groupContextMenu.svgY);
                  setGroupContextMenu(null);
                }}
              >
                New task here
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  onGroupZoomTo(groupContextMenu.groupId);
                  setGroupContextMenu(null);
                }}
              >
                Zoom to group
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  onGroupToggleLock(groupContextMenu.groupId);
                  setGroupContextMenu(null);
                }}
              >
                {ctxGroup?.locked ? "Unlock group" : "Lock group"}
              </button>
              <button
                className="menu-item delete-item"
                onClick={() => {
                  onGroupDelete(groupContextMenu.groupId);
                  setGroupContextMenu(null);
                }}
              >
                Delete group
              </button>
            </div>
          );
        })()}
      {nodeContextMenu &&
        (() => {
          const task = tasks.find((t) => t.id === nodeContextMenu.taskId);
          if (!task) return null;
          return (
            <TaskContextMenu
              task={task}
              x={nodeContextMenu.x}
              y={nodeContextMenu.y}
              categories={categories}
              statuses={statuses}
              people={people}
              onSetStatus={(status) => {
                onSetTaskStatus(task.id, status);
                setNodeContextMenu(null);
              }}
              onSetCategory={(category) => {
                onSetTaskCategory(task.id, category);
                setNodeContextMenu(null);
              }}
              onDelete={() => {
                onDeleteTask(task.id);
                setNodeContextMenu(null);
              }}
              onAssignPeople={(ids) => onAssignPeople(task.id, ids)}
              onClose={() => setNodeContextMenu(null)}
            />
          );
        })()}
    </div>
  );
});
