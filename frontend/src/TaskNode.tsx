import "./TaskNode.css";
import { Task, CATEGORIES, STATUSES } from "./Sidebar";

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
          fill: STATUSES[task.status]?.color || STATUSES.pending.color,
          ...(task.category && !isSelected
            ? {
                stroke: CATEGORIES[task.category]?.color,
                strokeWidth: 3,
              }
            : {}),
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
      {isHovered && task.text && (
        <g className="tooltip" transform="translate(0, 40)">
          <rect
            x={-Math.max(task.text.length * 4, 40)}
            y="-12"
            width={Math.max(task.text.length * 8, 80)}
            height="24"
            rx="4"
          />
          <text textAnchor="middle" dy="0.35em">
            {task.text}
          </text>
        </g>
      )}
    </g>
  );
}
