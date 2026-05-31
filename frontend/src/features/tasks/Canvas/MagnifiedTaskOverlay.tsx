import { useLayoutEffect, useRef, useState } from "react";
import "./MagnifiedTaskOverlay.css";
import type { Task, TaskStatus } from "../../../domain/tasks/types";
import type { Person } from "../../../domain/teams/types";
import type { CategoryConfig, StatusConfig } from "../theme";
import { wrapText } from "../../../lib/wrapText";
import { TaskNode } from "./TaskNode";

// How much larger than its on-canvas-at-100% size the copy is drawn.
const SCALE = 2;
// Breathing room (node-local units) between the node and the panel edge.
const PADDING = 8;
// Baseline of the parent-group label's bottom line, above the node's number badge.
const GROUP_LABEL_Y = -54;
// A long title wraps into stacked lines rather than overflowing on one line.
const GROUP_LABEL_MAX_CHARS_PER_LINE = 28;
const GROUP_LABEL_LINE_HEIGHT = 14;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MagnifiedTaskOverlayProps {
  task: Task;
  index: number;
  categories: Record<string, CategoryConfig>;
  statuses: Record<TaskStatus, StatusConfig>;
  assignedPersons: Person[];
  /** Title of the group this task belongs to, shown above the node. */
  groupTitle: string | null;
  /** Task centre in pixels, relative to the canvas container. */
  left: number;
  top: number;
}

const noop = () => {};

/**
 * A floating, read-only enlarged copy of a task, shown over the canvas while
 * magnifying. Purely visual — `pointer-events: none` lets hover detection keep
 * working on the real task underneath. The panel is sized to the node's actual
 * bounding box so it hugs the content rather than using a fixed, roomy card.
 */
export function MagnifiedTaskOverlay({
  task,
  index,
  categories,
  statuses,
  assignedPersons,
  groupTitle,
  left,
  top,
}: MagnifiedTaskOverlayProps) {
  const groupRef = useRef<SVGGElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  // Measure the rendered node after every render and fit the panel snugly around
  // it. useLayoutEffect runs before paint, so the snug size is what the user sees
  // (no flash); the equality guard stops the measurement from looping.
  //
  // The box is snapped to integers: text getBBox() (the group label) is not
  // bit-stable across calls — it jitters by sub-pixel amounts — so an exact
  // float comparison would never converge and the effect would loop forever.
  // Floor the origin and ceil the far edge so rounding never clips the content.
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const bb = group.getBBox();
    const x = Math.floor(bb.x) - PADDING;
    const y = Math.floor(bb.y) - PADDING;
    const next: Box = {
      x,
      y,
      width: Math.ceil(bb.x + bb.width) + PADDING - x,
      height: Math.ceil(bb.y + bb.height) + PADDING - y,
    };
    setBox((prev) =>
      prev &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.width === next.width &&
      prev.height === next.height
        ? prev
        : next,
    );
  });

  // The node's centre (task.x, task.y) as a fraction of the fitted box, so the
  // panel can be anchored to keep the magnified node over the real one.
  const fracX = box ? (task.x - box.x) / box.width : 0.5;
  const fracY = box ? (task.y - box.y) / box.height : 0.3;

  // SVG text does not wrap, so split the title ourselves and stack the lines.
  const groupLabelLines = groupTitle ? wrapText(groupTitle, GROUP_LABEL_MAX_CHARS_PER_LINE) : [];

  return (
    <div
      className="magnifier-overlay"
      style={{
        left,
        top,
        transform: `translate(${-fracX * 100}%, ${-fracY * 100}%)`,
        visibility: box ? "visible" : "hidden",
      }}
    >
      <svg
        className="magnifier-svg"
        width={box ? box.width * SCALE : 0}
        height={box ? box.height * SCALE : 0}
        viewBox={box ? `${box.x} ${box.y} ${box.width} ${box.height}` : undefined}
        aria-hidden="true"
      >
        <g ref={groupRef}>
          {groupLabelLines.length > 0 && (
            <text className="magnifier-group-label" x={task.x} textAnchor="middle">
              {groupLabelLines.map((line, i) => (
                <tspan
                  // biome-ignore lint/suspicious/noArrayIndexKey: stateless, static lines that never reorder
                  key={i}
                  x={task.x}
                  y={
                    task.y +
                    GROUP_LABEL_Y -
                    (groupLabelLines.length - 1 - i) * GROUP_LABEL_LINE_HEIGHT
                  }
                >
                  {line}
                </tspan>
              ))}
            </text>
          )}
          <TaskNode
            task={task}
            index={index}
            categories={categories}
            statuses={statuses}
            isDragging={false}
            isHighlighted={false}
            isSelected={false}
            isEditing={false}
            assignedPersons={assignedPersons}
            idPrefix="mag-"
            onMouseDown={noop}
            onClick={noop}
            onMouseEnter={noop}
            onMouseLeave={noop}
            onContextMenu={noop}
            onUpdateText={noop}
            onEditingChange={noop}
          />
        </g>
      </svg>
    </div>
  );
}
