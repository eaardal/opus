import type { Connection, Task } from "./types";

const ACTIVE_STATUSES: ReadonlySet<Task["status"]> = new Set(["pending", "in_progress"]);

/**
 * Ids of tasks that are pending or in_progress and assigned to the given person.
 * Used to drive a person's swimlane in the queue panel.
 */
export function findActiveTaskIdsFor(tasks: Task[], personId: string): Set<string> {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (ACTIVE_STATUSES.has(task.status) && (task.assignedPersonIds ?? []).includes(personId)) {
      ids.add(task.id);
    }
  }
  return ids;
}

/**
 * Ids of every person who has at least one active task assigned to them.
 * These are the people that get a swimlane.
 */
export function findSwimlanePersonIds(tasks: Task[]): Set<string> {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (!ACTIVE_STATUSES.has(task.status)) continue;
    for (const personId of task.assignedPersonIds ?? []) {
      ids.add(personId);
    }
  }
  return ids;
}

/**
 * Ids of upstream tasks that are blocking the given person's active work.
 *
 * A task `b` is a blocker for `personId` when:
 *   - there is a connection `b → t` for some task `t` of `personId`'s, AND
 *   - `t` is itself active (pending/in_progress), AND
 *   - `b` is not yet finished (status is not completed or archived), AND
 *   - `b` is not also assigned to `personId` (their own work doesn't block them).
 */
export function findBlockerTaskIds(args: {
  tasks: Task[];
  connections: Connection[];
  personId: string;
}): Set<string> {
  const { tasks, connections, personId } = args;
  const myActiveTaskIds = findActiveTaskIdsFor(tasks, personId);
  if (myActiveTaskIds.size === 0) return new Set();

  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const blockerIds = new Set<string>();

  for (const conn of connections) {
    if (!myActiveTaskIds.has(conn.to)) continue;
    const blocker = tasksById.get(conn.from);
    if (!blocker) continue;
    if (blocker.status === "completed" || blocker.status === "archived") continue;
    if ((blocker.assignedPersonIds ?? []).includes(personId)) continue;
    blockerIds.add(blocker.id);
  }
  return blockerIds;
}
