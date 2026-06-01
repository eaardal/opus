import { useState, useRef, useEffect, useLayoutEffect } from "react";
import "./TaskNode.css";
import type { Task } from "../../../domain/tasks/types";
import type { CategoryConfig, StatusConfig } from "../theme";
import type { TaskStatus } from "../../../domain/tasks/types";
import type { Person } from "../../../domain/teams/types";
import { avatarColor } from "../../../lib/avatar";

// The title editor auto-grows: it starts one line tall and expands downward to
// fit wrapped lines as you type. EDIT_BORDER_Y restores the 1px top/bottom border
// that scrollHeight omits but the border-box height needs.
const EDIT_WIDTH = 220;
const EDIT_MIN_HEIGHT = 33;
const EDIT_BORDER_Y = 2;

interface TaskNodeProps {
  task: Task;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  isDragging: boolean;
  isHighlighted: boolean;
  isSelected: boolean;
  /** Whether this node's inline title editor is open. Controlled by the canvas
      so editing survives hover changes and can be opened on task creation. */
  isEditing: boolean;
  assignedPersons?: Person[];
  /** Prefix for internal SVG ids so a duplicate render (e.g. the magnifier
      overlay) doesn't collide with this node's clip-path ids. */
  idPrefix?: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onUpdateText: (text: string) => void;
  onEditingChange: (editing: boolean) => void;
}

export function TaskNode({
  task,
  categories,
  statuses,
  isDragging,
  isHighlighted,
  isSelected,
  isEditing,
  assignedPersons = [],
  idPrefix = "",
  onMouseDown,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onContextMenu,
  onUpdateText,
  onEditingChange,
}: TaskNodeProps) {
  const [editValue, setEditValue] = useState(task.text);
  const [editHeight, setEditHeight] = useState(EDIT_MIN_HEIGHT);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Auto-grow the editor to fit its wrapped lines, measured before paint so it
  // never flashes at the wrong size. Collapsing to "auto" first lets scrollHeight
  // report the true content height even when the field is currently taller.
  // biome-ignore lint/correctness/useExhaustiveDependencies: editValue is the resize trigger — it drives the textarea content we measure, even though the body reads the DOM, not the value.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!isEditing || !el) return;
    el.style.height = "auto";
    const next = Math.max(EDIT_MIN_HEIGHT, el.scrollHeight + EDIT_BORDER_Y);
    el.style.height = `${next}px`;
    setEditHeight(next);
  }, [isEditing, editValue]);

  const startEdit = () => {
    if (isEditing) return;
    setEditValue(task.text);
    onEditingChange(true);
  };

  // Double-clicking the node shape (or its title) enters title edit mode.
  // stopPropagation keeps the canvas from also handling the event.
  const handleStartEditDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    startEdit();
  };

  const commitEdit = () => {
    onEditingChange(false);
    onUpdateText(editValue);
  };

  const cancelEdit = () => {
    setEditValue(task.text);
    onEditingChange(false);
  };

  const statusColor = statuses[task.status]?.color || statuses.pending.color;
  const statusFontColor = statuses[task.status]?.fontColor || statuses.pending.fontColor;
  const category = task.category ? categories[task.category] : undefined;
  const categoryColor = category?.color;
  const shape = category?.shape || "circle";
  const baseFill = categoryColor || statusColor;
  const nodeClass = `node ${isDragging ? "dragging" : ""} ${isHighlighted ? "highlighted" : ""} ${isSelected ? "selected" : ""}`;
  const nodeStyle = {
    fill: baseFill,
    stroke: isHighlighted ? "var(--highlight-border)" : isSelected ? undefined : statusColor,
    strokeWidth: isHighlighted ? 4 : 3,
  };

  const MAX_TOOLTIP_WIDTH = 170;
  const CHAR_WIDTH = 8;
  const LINE_HEIGHT = 16;
  const TOOLTIP_V_PADDING = 8;
  const MAX_CHARS = Math.floor(MAX_TOOLTIP_WIDTH / CHAR_WIDTH);

  const tooltipText = isEditing ? editValue : task.text;

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
  const longestLine = tooltipLines.reduce((a, b) => (a.length > b.length ? a : b), "");
  const tooltipWidth = Math.min(Math.max(longestLine.length * CHAR_WIDTH, 80), MAX_TOOLTIP_WIDTH);
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
          onDoubleClick={handleStartEditDoubleClick}
          onContextMenu={onContextMenu}
        />
      ) : shape === "triangle" ? (
        <polygon
          points="0,-30 26,20 -26,20"
          className={nodeClass}
          style={nodeStyle}
          onMouseDown={onMouseDown}
          onClick={onClick}
          onDoubleClick={handleStartEditDoubleClick}
          onContextMenu={onContextMenu}
        />
      ) : (
        <circle
          r="25"
          className={nodeClass}
          style={nodeStyle}
          onMouseDown={onMouseDown}
          onClick={onClick}
          onDoubleClick={handleStartEditDoubleClick}
          onContextMenu={onContextMenu}
        />
      )}
      <text
        textAnchor="middle"
        dy="0.35em"
        className="node-emoji"
        onMouseDown={onMouseDown}
        onDoubleClick={handleStartEditDoubleClick}
      >
        {statuses[task.status]?.emoji || "💤"}
      </text>
      {(task.text || isEditing) && (
        <g transform="translate(0, 40)">
          {isEditing ? (
            <foreignObject x={-EDIT_WIDTH / 2} y="-12" width={EDIT_WIDTH} height={editHeight}>
              <textarea
                ref={inputRef}
                className="task-title-input"
                rows={1}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEdit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
              />
            </foreignObject>
          ) : (
            <g
              className="tooltip"
              style={{ cursor: "text" }}
              onDoubleClick={handleStartEditDoubleClick}
            >
              <rect
                x={tooltipX}
                y="-12"
                width={tooltipWidth}
                height={tooltipHeight}
                rx="4"
                style={{ fill: statusColor }}
              />
              {isHighlighted && (
                <rect
                  x={tooltipX - 2}
                  y="-14"
                  width={tooltipWidth + 4}
                  height={tooltipHeight + 4}
                  rx="6"
                  style={{
                    fill: "none",
                    stroke: "var(--highlight-border)",
                    strokeWidth: 2,
                  }}
                />
              )}
              <text textAnchor="middle" style={{ fill: statusFontColor }}>
                {tooltipLines.map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: tooltipLines is the deterministic line-split of task.text; index is the natural identity
                  <tspan key={i} x="0" dy={i === 0 ? "0.35em" : `${LINE_HEIGHT}px`}>
                    {line}
                  </tspan>
                ))}
              </text>
              {assignedPersons.length > 0 &&
                (() => {
                  const AVATAR_R = 15;
                  const AVATAR_STEP = AVATAR_R * 2 - 2; // slight overlap
                  const cx = tooltipWidth / 2;
                  const firstAvatarY = -12; // tooltip top edge (50% overlap)
                  return (
                    <>
                      <defs>
                        {assignedPersons.map((person, i) => (
                          <clipPath key={person.id} id={`clip-ta-${idPrefix}${task.id}-${i}`}>
                            <circle cx={cx} cy={firstAvatarY + i * AVATAR_STEP} r={AVATAR_R} />
                          </clipPath>
                        ))}
                      </defs>
                      {[...assignedPersons].reverse().map((person, ri) => {
                        const i = assignedPersons.length - 1 - ri;
                        const cy = firstAvatarY + i * AVATAR_STEP;
                        const initials = person.name.trim()
                          ? person.name.trim()[0].toUpperCase()
                          : "?";
                        return (
                          <g key={person.id}>
                            {person.picture ? (
                              <image
                                href={person.picture}
                                x={cx - AVATAR_R}
                                y={cy - AVATAR_R}
                                width={AVATAR_R * 2}
                                height={AVATAR_R * 2}
                                clipPath={`url(#clip-ta-${idPrefix}${task.id}-${i})`}
                                preserveAspectRatio="xMidYMid slice"
                              />
                            ) : (
                              <>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={AVATAR_R}
                                  fill={avatarColor(person.id)}
                                  clipPath={`url(#clip-ta-${idPrefix}${task.id}-${i})`}
                                />
                                <text
                                  x={cx}
                                  y={cy}
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
                            <circle
                              cx={cx}
                              cy={cy}
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
