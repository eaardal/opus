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
}: TaskNodeProps) {
  const statusColor = statuses[task.status]?.color || statuses.pending.color;
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
      {task.text && (
        <g className="tooltip" transform="translate(0, 40)">
          <rect
            x={-Math.max(task.text.length * 4, 40)}
            y="-12"
            width={Math.max(task.text.length * 8, 80)}
            height="24"
            rx="4"
            style={{ fill: statusColor }}
          />
          <text textAnchor="middle" dy="0.35em">
            {task.text}
          </text>
        </g>
      )}
    </g>
  );
}
