import { useState, useRef, useEffect } from "react";
import "./TaskNode.css";
import { Task } from "./Sidebar";
import { CategoryConfig, StatusConfig } from "./theme";
import { TaskStatus } from "./Sidebar";

function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lighten = (c: number) =>
    Math.min(255, Math.round(c + (255 - c) * amount));
  return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
}

interface TaskNodeProps {
  task: Task;
  index: number;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  isDragging: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onUpdateText: (text: string) => void;
}

export function TaskNode({
  task,
  index,
  categories,
  statuses,
  isDragging,
  isHighlighted,
  isSelected,
  isHovered,
  onMouseDown,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onContextMenu,
  onUpdateText,
}: TaskNodeProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    onUpdateText(editValue);
  };

  const statusColor = statuses[task.status]?.color || statuses.pending.color;
  const statusFontColor = statuses[task.status]?.fontColor || statuses.pending.fontColor;
  const category = task.category ? categories[task.category] : undefined;
  const categoryColor = category?.color;
  const shape = category?.shape || "circle";
  const baseFill = categoryColor || statusColor;
  const fillColor = isHighlighted ? lightenColor(baseFill, 0.4) : baseFill;
  const nodeClass = `node ${isDragging ? "dragging" : ""} ${isHighlighted ? "highlighted" : ""} ${isSelected ? "selected" : ""}`;
  const nodeStyle = {
    fill: fillColor,
    stroke: isSelected ? undefined : statusColor,
    strokeWidth: 3,
  };

  const tooltipText = editing ? editValue : task.text;
  const tooltipWidth = Math.max(tooltipText.length * 8, 80);
  const tooltipX = -tooltipWidth / 2;

  return (
    <g
      transform={`translate(${task.x}, ${task.y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {shape === "diamond" ? (
        <polygon
          points="0,-30 30,0 0,30 -30,0"
          className={nodeClass}
          style={nodeStyle}
          onMouseDown={onMouseDown}
          onClick={onClick}
          onContextMenu={onContextMenu}
        />
      ) : (
        <circle
          r="25"
          className={nodeClass}
          style={nodeStyle}
          onMouseDown={onMouseDown}
          onClick={onClick}
          onContextMenu={onContextMenu}
        />
      )}
      <circle
        cx="0"
        cy={shape === "diamond" ? -30 : -25}
        r="10"
        className="node-number-badge"
        style={task.category ? { fill: categories[task.category]?.color } : undefined}
      />
      <text
        x="0"
        y={shape === "diamond" ? -30 : -25}
        textAnchor="middle"
        dy="0.35em"
        className="node-number"
      >
        {index + 1}
      </text>
      <text
        textAnchor="middle"
        dy="0.35em"
        className="node-emoji"
        onMouseDown={onMouseDown}
      >
        {statuses[task.status]?.emoji || "💤"}
      </text>
      {(task.text || editing) && (
        <g transform="translate(0, 40)">
          {editing ? (
            <foreignObject x={tooltipX} y="-12" width={tooltipWidth} height="24">
              <input
                ref={inputRef}
                className="group-title-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                  if (e.key === "Escape") {
                    setEditValue(task.text);
                    setEditing(false);
                  }
                }}
              />
            </foreignObject>
          ) : (
            <g
              className="tooltip"
              style={{ cursor: "text" }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditValue(task.text);
                setEditing(true);
              }}
            >
              <rect
                x={tooltipX}
                y="-12"
                width={tooltipWidth}
                height="24"
                rx="4"
                style={{ fill: statusColor }}
              />
              <text textAnchor="middle" dy="0.35em" style={{ fill: statusFontColor }}>
                {task.text}
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}
