import type { Group, Task } from "./types";

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
