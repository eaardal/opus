import { useState, useRef, useEffect } from "react";
import "./GroupRect.css";
import type { Group, Task, TaskStatus } from "../../../domain/tasks/types";
import type { GroupBoxConfig, StatusConfig } from "../theme";
import { GroupProgressBar } from "./GroupProgressBar";

const HANDLE_SIZE = 12;
const EDGE_THICKNESS = 8;
const MIN_WIDTH = 80;
const MIN_HEIGHT = 60;

const ZOOM_BTN_SIZE = 20;
const ZOOM_BTN_MARGIN = 6;
const LOCK_BTN_GAP = 4;

const PROGRESS_BAR_Y = 30;
const PROGRESS_BAR_HEIGHT = 4;
const PROGRESS_BAR_MARGIN = 8;

type ResizeEdge = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

const CURSOR_MAP: Record<ResizeEdge, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  se: "nwse-resize",
};

interface GroupRectProps {
  group: Group;
  tasks: Task[];
  statuses: Record<TaskStatus, StatusConfig>;
  groupBox: GroupBoxConfig;
  isSelected: boolean;
  /** Whether this group's title editor is open. Controlled by the canvas so
      editing can be opened on group creation. */
  isEditing: boolean;
  panMode: boolean;
  canvasLocked?: boolean;
  onMouseDown: (e: React.MouseEvent, groupId: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMoveWithTasks: (id: string, x: number, y: number, taskIds: ReadonlySet<string>) => void;
  onMoveStart: () => void;
  onMoveEnd: (id: string, movedTaskIds: ReadonlySet<string>) => void;
  onResize: (id: string, x: number, y: number, width: number, height: number) => void;
  onResizeStart: () => void;
  onResizeEnd: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onEditingChange: (editing: boolean) => void;
  onZoomTo: (id: string) => void;
  onToggleLock: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, groupId: string) => void;
  onHover?: (hovering: boolean) => void;
  toSvgCoords: (clientX: number, clientY: number) => { x: number; y: number };
}

export function GroupRect({
  group,
  tasks,
  statuses,
  groupBox,
  isSelected,
  isEditing,
  panMode,
  canvasLocked = false,
  onMouseDown: onGroupMouseDown,
  onMove,
  onMoveWithTasks,
  onMoveStart,
  onMoveEnd,
  onResize,
  onResizeStart,
  onResizeEnd,
  onTitleChange,
  onEditingChange,
  onZoomTo,
  onToggleLock,
  onContextMenu: onGroupContextMenu,
  onHover,
  toSvgCoords,
}: GroupRectProps) {
  const containedTasks = tasks.filter(
    (t) =>
      t.x >= group.x &&
      t.x <= group.x + group.width &&
      t.y >= group.y &&
      t.y <= group.y + group.height,
  );
  const doneTasks = containedTasks.filter(
    (t) => t.status === "completed" || t.status === "archived",
  );
  const inProgressTasks = containedTasks.filter((t) => t.status === "in_progress");
  const allDone = containedTasks.length > 0 && doneTasks.length === containedTasks.length;

  const [editValue, setEditValue] = useState(group.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEdit = () => {
    if (isEditing) return;
    setEditValue(group.title);
    onEditingChange(true);
  };

  const commitTitle = () => {
    onEditingChange(false);
    onTitleChange(group.id, editValue);
  };

  const cancelEdit = () => {
    setEditValue(group.title);
    onEditingChange(false);
  };

  const handleBodyMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    if (panMode || e.button === 1) return;
    if (canvasLocked) return;
    if (group.locked && !e.shiftKey) return;
    if (isSelected) {
      onGroupMouseDown(e, group.id);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    onMoveStart();

    const startSvg = toSvgCoords(e.clientX, e.clientY);
    const origX = group.x;
    const origY = group.y;
    const withTasks = !e.shiftKey;
    const carriedTaskIds = withTasks ? new Set(containedTasks.map((t) => t.id)) : new Set<string>();

    const handleMouseMove = (ev: MouseEvent) => {
      const currentSvg = toSvgCoords(ev.clientX, ev.clientY);
      const newX = origX + currentSvg.x - startSvg.x;
      const newY = origY + currentSvg.y - startSvg.y;
      if (withTasks) {
        onMoveWithTasks(group.id, newX, newY, carriedTaskIds);
      } else {
        onMove(group.id, newX, newY);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      onMoveEnd(group.id, carriedTaskIds);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleEdgeMouseDown = (edge: ResizeEdge) => (e: React.MouseEvent) => {
    if (panMode || e.button === 1) return;
    if (canvasLocked) return;
    if (group.locked && !e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();

    onResizeStart();

    const startSvg = toSvgCoords(e.clientX, e.clientY);
    const origX = group.x;
    const origY = group.y;
    const origW = group.width;
    const origH = group.height;

    const resizesLeft = edge.includes("w");
    const resizesRight = edge.includes("e");
    const resizesTop = edge.includes("n");
    const resizesBottom = edge.includes("s");

    const handleMouseMove = (ev: MouseEvent) => {
      const currentSvg = toSvgCoords(ev.clientX, ev.clientY);
      const dx = currentSvg.x - startSvg.x;
      const dy = currentSvg.y - startSvg.y;

      let newX = origX;
      let newY = origY;
      let newW = origW;
      let newH = origH;

      if (resizesRight) {
        newW = Math.max(MIN_WIDTH, origW + dx);
      }
      if (resizesBottom) {
        newH = Math.max(MIN_HEIGHT, origH + dy);
      }
      if (resizesLeft) {
        const maxDx = origW - MIN_WIDTH;
        const clampedDx = Math.min(dx, maxDx);
        newX = origX + clampedDx;
        newW = origW - clampedDx;
      }
      if (resizesTop) {
        const maxDy = origH - MIN_HEIGHT;
        const clampedDy = Math.min(dy, maxDy);
        newY = origY + clampedDy;
        newH = origH - clampedDy;
      }

      onResize(group.id, newX, newY, newW, newH);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      onResizeEnd(group.id);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <g
      transform={`translate(${group.x}, ${group.y})`}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onGroupContextMenu(e, group.id);
      }}
    >
      <rect
        className={`group-rect ${isSelected ? "selected" : ""} ${group.locked ? "locked" : ""}`}
        width={group.width}
        height={group.height}
        rx="8"
        onMouseDown={handleBodyMouseDown}
        style={allDone ? { fill: groupBox.allDoneFill, stroke: groupBox.allDoneStroke } : undefined}
      />
      {isEditing ? (
        <foreignObject x="8" y="6" width={group.width - 16} height="24">
          <input
            ref={inputRef}
            className="group-title-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") cancelEdit();
            }}
          />
        </foreignObject>
      ) : (
        <text
          className="group-title"
          x="12"
          y="20"
          onDoubleClick={(e) => {
            if (group.locked && !e.shiftKey) return;
            startEdit();
          }}
          onMouseDown={handleBodyMouseDown}
        >
          {group.title || "Untitled Group"}
        </text>
      )}
      {containedTasks.length > 0 && (
        <GroupProgressBar
          donePct={doneTasks.length / containedTasks.length}
          inProgressPct={inProgressTasks.length / containedTasks.length}
          barWidth={group.width - PROGRESS_BAR_MARGIN * 2}
          x={PROGRESS_BAR_MARGIN}
          y={PROGRESS_BAR_Y}
          height={PROGRESS_BAR_HEIGHT}
          completedFill={groupBox.progressCompletedFill}
          inProgressFill={statuses.in_progress.color}
        />
      )}
      <g
        className="group-lock-btn"
        transform={`translate(${group.width - ZOOM_BTN_SIZE - ZOOM_BTN_MARGIN}, ${ZOOM_BTN_MARGIN})`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock(group.id);
        }}
      >
        <rect width={ZOOM_BTN_SIZE} height={ZOOM_BTN_SIZE} rx="4" className="group-zoom-btn-bg" />
        {group.locked ? (
          /* Closed padlock */
          <g>
            <path d="M7,9 L7,6 C7,3 13,3 13,6 L13,9" className="group-zoom-btn-icon" />
            <rect x="5" y="9" width="10" height="8" rx="2" className="group-zoom-btn-icon" />
            <circle cx="10" cy="13.5" r="1.5" className="group-lock-icon-fill" />
          </g>
        ) : (
          /* Open padlock — shackle open on right */
          <g>
            <path d="M7,9 L7,5 C7,2 13,2 13,5" className="group-zoom-btn-icon" />
            <rect x="5" y="9" width="10" height="8" rx="2" className="group-zoom-btn-icon" />
            <circle cx="10" cy="13.5" r="1.5" className="group-lock-icon-fill" />
          </g>
        )}
      </g>
      <g
        className="group-zoom-btn"
        transform={`translate(${group.width - ZOOM_BTN_SIZE * 2 - ZOOM_BTN_MARGIN - LOCK_BTN_GAP}, ${ZOOM_BTN_MARGIN})`}
        onClick={(e) => {
          e.stopPropagation();
          onZoomTo(group.id);
        }}
      >
        <rect width={ZOOM_BTN_SIZE} height={ZOOM_BTN_SIZE} rx="4" className="group-zoom-btn-bg" />
        <circle cx="9" cy="9" r="4" className="group-zoom-btn-icon" />
        <line x1="12" y1="12" x2="16" y2="16" className="group-zoom-btn-icon" />
      </g>

      {/* Edge handles */}
      <rect
        className="group-resize-handle"
        x={HANDLE_SIZE}
        y={-EDGE_THICKNESS / 2}
        width={group.width - HANDLE_SIZE * 2}
        height={EDGE_THICKNESS}
        style={{ cursor: CURSOR_MAP.n }}
        onMouseDown={handleEdgeMouseDown("n")}
      />
      <rect
        className="group-resize-handle"
        x={HANDLE_SIZE}
        y={group.height - EDGE_THICKNESS / 2}
        width={group.width - HANDLE_SIZE * 2}
        height={EDGE_THICKNESS}
        style={{ cursor: CURSOR_MAP.s }}
        onMouseDown={handleEdgeMouseDown("s")}
      />
      <rect
        className="group-resize-handle"
        x={-EDGE_THICKNESS / 2}
        y={HANDLE_SIZE}
        width={EDGE_THICKNESS}
        height={group.height - HANDLE_SIZE * 2}
        style={{ cursor: CURSOR_MAP.w }}
        onMouseDown={handleEdgeMouseDown("w")}
      />
      <rect
        className="group-resize-handle"
        x={group.width - EDGE_THICKNESS / 2}
        y={HANDLE_SIZE}
        width={EDGE_THICKNESS}
        height={group.height - HANDLE_SIZE * 2}
        style={{ cursor: CURSOR_MAP.e }}
        onMouseDown={handleEdgeMouseDown("e")}
      />

      {/* Corner handles */}
      <rect
        className="group-resize-handle"
        x={-HANDLE_SIZE / 2}
        y={-HANDLE_SIZE / 2}
        width={HANDLE_SIZE}
        height={HANDLE_SIZE}
        style={{ cursor: CURSOR_MAP.nw }}
        onMouseDown={handleEdgeMouseDown("nw")}
      />
      <rect
        className="group-resize-handle"
        x={group.width - HANDLE_SIZE / 2}
        y={-HANDLE_SIZE / 2}
        width={HANDLE_SIZE}
        height={HANDLE_SIZE}
        style={{ cursor: CURSOR_MAP.ne }}
        onMouseDown={handleEdgeMouseDown("ne")}
      />
      <rect
        className="group-resize-handle"
        x={-HANDLE_SIZE / 2}
        y={group.height - HANDLE_SIZE / 2}
        width={HANDLE_SIZE}
        height={HANDLE_SIZE}
        style={{ cursor: CURSOR_MAP.sw }}
        onMouseDown={handleEdgeMouseDown("sw")}
      />
      <rect
        className="group-resize-handle"
        x={group.width - HANDLE_SIZE / 2}
        y={group.height - HANDLE_SIZE / 2}
        width={HANDLE_SIZE}
        height={HANDLE_SIZE}
        style={{ cursor: CURSOR_MAP.se }}
        onMouseDown={handleEdgeMouseDown("se")}
      />
    </g>
  );
}
