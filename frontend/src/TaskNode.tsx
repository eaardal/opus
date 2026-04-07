import "./TaskNode.css";
import { Task, CATEGORIES, STATUSES } from "./Sidebar";

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
  isDragging: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function TaskNode({
  task,
  index,
  isDragging,
  isHighlighted,
  isSelected,
  isHovered,
  onMouseDown,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: TaskNodeProps) {
  const statusColor = STATUSES[task.status]?.color || STATUSES.pending.color;
  const categoryColor = task.category
    ? CATEGORIES[task.category]?.color
    : undefined;
  const baseFill = categoryColor || statusColor;
  const fillColor = isHighlighted ? lightenColor(baseFill, 0.4) : baseFill;

  return (
    <g
      transform={`translate(${task.x}, ${task.y})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <circle
        r="25"
        className={`node ${isDragging ? "dragging" : ""} ${isHighlighted ? "highlighted" : ""} ${isSelected ? "selected" : ""}`}
        style={{
          fill: fillColor,
          stroke: isSelected ? undefined : statusColor,
          strokeWidth: 3,
        }}
        onMouseDown={onMouseDown}
        onClick={onClick}
      />
      <circle
        cx="0"
        cy="-25"
        r="10"
        className="node-number-badge"
        style={task.category ? { fill: CATEGORIES[task.category]?.color } : undefined}
      />
      <text
        x="0"
        y="-25"
        textAnchor="middle"
        dy="0.35em"
        className="node-number"
      >
        {index + 1}
      </text>
      <text
        textAnchor="middle"
        dy="0.3em"
        className="node-text"
        onMouseDown={onMouseDown}
      >
        {task.text.slice(0, 8) || "?"}
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
