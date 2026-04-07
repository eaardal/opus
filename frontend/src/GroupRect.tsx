import { useState, useRef, useEffect } from "react";
import "./GroupRect.css";
import { Group } from "./Sidebar";

const RESIZE_HANDLE_SIZE = 12;
const MIN_WIDTH = 80;
const MIN_HEIGHT = 60;

interface GroupRectProps {
  group: Group;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number) => void;
  onTitleChange: (id: string, title: string) => void;
}

export function GroupRect({
  group,
  onMove,
  onResize,
  onTitleChange,
}: GroupRectProps) {
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

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const origW = group.width;
    const origH = group.height;

    const handleMouseMove = (ev: MouseEvent) => {
      const newW = Math.max(MIN_WIDTH, origW + (ev.clientX - startX));
      const newH = Math.max(MIN_HEIGHT, origH + (ev.clientY - startY));
      onResize(group.id, newW, newH);
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
        className="group-rect"
        width={group.width}
        height={group.height}
        rx="8"
        onMouseDown={handleBodyMouseDown}
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
      <rect
        className="group-resize-handle"
        x={group.width - RESIZE_HANDLE_SIZE}
        y={group.height - RESIZE_HANDLE_SIZE}
        width={RESIZE_HANDLE_SIZE}
        height={RESIZE_HANDLE_SIZE}
        onMouseDown={handleResizeMouseDown}
      />
    </g>
  );
}
