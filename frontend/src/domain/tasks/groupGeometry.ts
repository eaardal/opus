import type { Group, Task } from "./types";

/**
 * Inset, in canvas units, from a group's top-left corner for a task created via
 * the sidebar's per-group "Add Task" button. A task node is a circle anchored at
 * its centre (radius ~25), so these insets leave a clear margin past that radius:
 * the X inset keeps the node clear of the left border, and the Y inset clears
 * both the group's title (drawn at y≈20) and the node's own radius so the whole
 * node lands inside the group rather than straddling the top edge.
 */
const GROUP_CORNER_INSET_X = 55;
const GROUP_CORNER_INSET_Y = 75;

/**
 * Compute canvas coordinates for a new task placed inside a group's top-left
 * corner area. The point is inset from the corner to clear the group header and
 * clamped to the group's bounds, so even for a group smaller than the inset the
 * point stays inside and `findOwningGroup` assigns the task to that group.
 */
export function taskPositionInGroupCorner(group: Group): { x: number; y: number } {
  return {
    x: Math.min(group.x + GROUP_CORNER_INSET_X, group.x + group.width),
    y: Math.min(group.y + GROUP_CORNER_INSET_Y, group.y + group.height),
  };
}

/**
 * Find the first group that geometrically contains the given task position.
 * Edges are inclusive; if multiple groups overlap the same point, the first
 * group in the array wins (the caller controls priority via order).
 */
export function findOwningGroup(task: Task, groups: Group[]): Group | null {
  for (const group of groups) {
    if (
      task.x >= group.x &&
      task.x <= group.x + group.width &&
      task.y >= group.y &&
      task.y <= group.y + group.height
    ) {
      return group;
    }
  }
  return null;
}
