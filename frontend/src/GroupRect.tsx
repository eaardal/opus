import { useState, useRef, useEffect } from "react";
import "./GroupRect.css";
import { Group, Task, TaskStatus } from "./Sidebar";
import { GroupBoxConfig, StatusConfig } from "./theme";

const HANDLE_SIZE = 12;
const EDGE_THICKNESS = 8;
const MIN_WIDTH = 80;
const MIN_HEIGHT = 60;

const ZOOM_BTN_SIZE = 20;
const ZOOM_BTN_MARGIN = 6;

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
  panMode: boolean;
  onMouseDown: (e: React.MouseEvent, groupId: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, x: number, y: number, width: number, height: number) => void;
  onTitleChange: (id: string, title: string) => void;
  onZoomTo: (id: string) => void;
}

export function GroupRect({
  group,
  tasks,
  statuses,
  groupBox,
  isSelected,
  panMode,
  onMouseDown: onGroupMouseDown,
  onMove,
  onResize,
  onTitleChange,
  onZoomTo,
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
  const inProgressTasks = containedTasks.filter(
    (t) => t.status === "in_progress",
  );
  const allDone = containedTasks.length > 0 && doneTasks.length === containedTasks.length;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(group.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitTitle = () => {
    setEditing(false);
    onTitleChange(group.id, editValue);
  };

  const handleBodyMouseDown = (e: React.MouseEvent) => {
    if (editing) return;
    if (panMode || e.button === 1) return;
    if (isSelected) {
      onGroupMouseDown(e, group.id);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = group.x;
    const origY = group.y;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      onMove(group.id, origX + dx, origY + dy);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleEdgeMouseDown = (edge: ResizeEdge) => (e: React.MouseEvent) => {
    if (panMode || e.button === 1) return;
    e.preventDefault();
    e.stopPropagation();

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const origX = group.x;
    const origY = group.y;
    const origW = group.width;
    const origH = group.height;

    const resizesLeft = edge.includes("w");
    const resizesRight = edge.includes("e");
    const resizesTop = edge.includes("n");
    const resizesBottom = edge.includes("s");

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouseX;
      const dy = ev.clientY - startMouseY;

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
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <g transform={`translate(${group.x}, ${group.y})`}>
      <rect
        className={`group-rect ${isSelected ? "selected" : ""}`}
        width={group.width}
        height={group.height}
        rx="8"
        onMouseDown={handleBodyMouseDown}
        style={allDone ? { fill: groupBox.allDoneFill, stroke: groupBox.allDoneStroke } : undefined}
      />
      {editing ? (
        <foreignObject x="8" y="6" width={group.width - 16} height="24">
          <input
            ref={inputRef}
            className="group-title-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setEditValue(group.title);
                setEditing(false);
              }
            }}
          />
        </foreignObject>
      ) : (
        <text
          className="group-title"
          x="12"
          y="20"
          onDoubleClick={() => {
            setEditValue(group.title);
            setEditing(true);
          }}
          onMouseDown={handleBodyMouseDown}
        >
          {group.title || "Untitled Group"}
        </text>
      )}
      {containedTasks.length > 0 && (() => {
        const donePct = doneTasks.length / containedTasks.length;
        const inProgressPct = inProgressTasks.length / containedTasks.length;
        const barWidth = group.width - PROGRESS_BAR_MARGIN * 2;
        return (
          <g>
            <rect
              className="group-progress-track"
              x={PROGRESS_BAR_MARGIN}
              y={PROGRESS_BAR_Y}
              width={barWidth}
              height={PROGRESS_BAR_HEIGHT}
              rx="2"
            />
            {inProgressPct > 0 && (
              <rect
                className="group-progress-in-progress"
                x={PROGRESS_BAR_MARGIN}
                y={PROGRESS_BAR_Y}
                width={barWidth * (donePct + inProgressPct)}
                height={PROGRESS_BAR_HEIGHT}
                rx="2"
                style={{ fill: statuses.in_progress.color }}
              />
            )}
            {donePct > 0 && (
              <rect
                className="group-progress-fill"
                x={PROGRESS_BAR_MARGIN}
                y={PROGRESS_BAR_Y}
                width={barWidth * donePct}
                height={PROGRESS_BAR_HEIGHT}
                rx="2"
                style={{ fill: groupBox.progressCompletedFill }}
              />
            )}
          </g>
        );
      })()}
      <g
        className="group-zoom-btn"
        transform={`translate(${group.width - ZOOM_BTN_SIZE - ZOOM_BTN_MARGIN}, ${ZOOM_BTN_MARGIN})`}
        onClick={(e) => {
          e.stopPropagation();
          onZoomTo(group.id);
        }}
      >
        <rect
          width={ZOOM_BTN_SIZE}
          height={ZOOM_BTN_SIZE}
          rx="4"
          className="group-zoom-btn-bg"
        />
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
