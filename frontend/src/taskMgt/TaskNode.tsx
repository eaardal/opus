import { useState, useRef, useEffect } from "react";
import "./TaskNode.css";
import { Task } from "./Sidebar";
import { CategoryConfig, StatusConfig } from "./theme";
import { TaskStatus } from "./Sidebar";
import { Person } from "../teamMgt/types";
import { avatarColor } from "../shared/avatarUtils";



interface TaskNodeProps {
  task: Task;
  index: number;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  isDragging: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  isHovered: boolean;
  assignedPersons?: Person[];
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
  assignedPersons = [],
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
  const statusFontColor =
    statuses[task.status]?.fontColor || statuses.pending.fontColor;
  const category = task.category ? categories[task.category] : undefined;
  const categoryColor = category?.color;
  const shape = category?.shape || "circle";
  const baseFill = categoryColor || statusColor;
  const nodeClass = `node ${isDragging ? "dragging" : ""} ${isHighlighted ? "highlighted" : ""} ${isSelected ? "selected" : ""}`;
  const nodeStyle = {
    fill: baseFill,
    stroke: isHighlighted ? "var(--highlight-border)" : (isSelected ? undefined : statusColor),
    strokeWidth: isHighlighted ? 4 : 3,
  };

  const MAX_TOOLTIP_WIDTH = 170;
  const CHAR_WIDTH = 8;
  const LINE_HEIGHT = 16;
  const TOOLTIP_V_PADDING = 8;
  const MAX_CHARS = Math.floor(MAX_TOOLTIP_WIDTH / CHAR_WIDTH);

  const tooltipText = editing ? editValue : task.text;

  const wrapLines = (text: string): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      if (word.length > MAX_CHARS) {
        if (line) {
          lines.push(line);
          line = "";
        }
        let rest = word;
        while (rest.length > MAX_CHARS) {
          lines.push(rest.slice(0, MAX_CHARS));
          rest = rest.slice(MAX_CHARS);
        }
        line = rest;
      } else {
        const test = line ? `${line} ${word}` : word;
        if (test.length > MAX_CHARS && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
    }
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [""];
  };

  const tooltipLines = wrapLines(tooltipText);
  const longestLine = tooltipLines.reduce(
    (a, b) => (a.length > b.length ? a : b),
    "",
  );
  const tooltipWidth = Math.min(
    Math.max(longestLine.length * CHAR_WIDTH, 80),
    MAX_TOOLTIP_WIDTH,
  );
  const tooltipX = -tooltipWidth / 2;
  const tooltipHeight = tooltipLines.length * LINE_HEIGHT + TOOLTIP_V_PADDING;

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
        style={
          task.category ? { fill: categories[task.category]?.color } : undefined
        }
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
            <foreignObject
              x={-MAX_TOOLTIP_WIDTH / 2}
              y="-12"
              width={MAX_TOOLTIP_WIDTH}
              height="24"
            >
              <input
                ref={inputRef}
                className="group-title-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEdit();
                  }
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
                height={tooltipHeight}
                rx="4"
                style={{ fill: statusColor }}
              />
              <text textAnchor="middle" style={{ fill: statusFontColor }}>
                {tooltipLines.map((line, i) => (
                  <tspan
                    key={i}
                    x="0"
                    dy={i === 0 ? "0.35em" : `${LINE_HEIGHT}px`}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
              {assignedPersons.length > 0 &&
                (() => {
                  const AVATAR_R = 12;
                  const AVATAR_STEP = AVATAR_R * 2 - 2; // slight overlap
                  const rightEdge = tooltipWidth / 2;
                  const avatarY = -12; // tooltip top edge (50% overlap)
                  return (
                    <>
                      <defs>
                        {assignedPersons.map((person, i) => (
                          <clipPath key={i} id={`clip-ta-${task.id}-${i}`}>
                            <circle
                              cx={rightEdge - i * AVATAR_STEP}
                              cy={avatarY}
                              r={AVATAR_R}
                            />
                          </clipPath>
                        ))}
                      </defs>
                      {[...assignedPersons].reverse().map((person, ri) => {
                        const i = assignedPersons.length - 1 - ri;
                        const cx = rightEdge - i * AVATAR_STEP;
                        const initials = person.name.trim()
                          ? person.name.trim()[0].toUpperCase()
                          : "?";
                        return (
                          <g key={i}>
                            {person.picture ? (
                              <image
                                href={person.picture}
                                x={cx - AVATAR_R}
                                y={avatarY - AVATAR_R}
                                width={AVATAR_R * 2}
                                height={AVATAR_R * 2}
                                clipPath={`url(#clip-ta-${task.id}-${i})`}
                                preserveAspectRatio="xMidYMid slice"
                              />
                            ) : (
                              <>
                                <circle
                                  cx={cx}
                                  cy={avatarY}
                                  r={AVATAR_R}
                                  fill={avatarColor(person.id)}
                                  clipPath={`url(#clip-ta-${task.id}-${i})`}
                                />
                                <text
                                  x={cx}
                                  y={avatarY}
                                  textAnchor="middle"
                                  dy="0.35em"
                                  fontSize="7"
                                  fill="#fff"
                                  style={{
                                    fontWeight: 700,
                                    userSelect: "none",
                                  }}
                                >
                                  {initials}
                                </text>
                              </>
                            )}
                            {/* Separator ring so overlapping avatars are distinct */}
                            <circle
                              cx={cx}
                              cy={avatarY}
                              r={AVATAR_R}
                              fill="none"
                              stroke={statusColor}
                              strokeWidth="1.5"
                            />
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
            </g>
          )}
        </g>
      )}
    </g>
  );
}
