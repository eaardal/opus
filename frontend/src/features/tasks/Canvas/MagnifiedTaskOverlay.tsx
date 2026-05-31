import { useLayoutEffect, useRef, useState } from "react";
import "./MagnifiedTaskOverlay.css";
import type { Task, TaskStatus } from "../../../domain/tasks/types";
import type { Person } from "../../../domain/teams/types";
import type { CategoryConfig, StatusConfig } from "../theme";
import { TaskNode } from "./TaskNode";

// How much larger than its on-canvas-at-100% size the copy is drawn.
const SCALE = 2;
// Breathing room (node-local units) between the node and the panel edge.
const PADDING = 8;

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
  left,
  top,
}: MagnifiedTaskOverlayProps) {
  const groupRef = useRef<SVGGElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  // Measure the rendered node after every render and fit the panel snugly around
  // it. useLayoutEffect runs before paint, so the snug size is what the user sees
  // (no flash); the equality guard stops the measurement from looping.
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const bb = group.getBBox();
    const next: Box = {
      x: bb.x - PADDING,
      y: bb.y - PADDING,
      width: bb.width + PADDING * 2,
      height: bb.height + PADDING * 2,
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
