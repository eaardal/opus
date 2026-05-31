import type { InProgressInterval, Task, TaskStatus } from "./types";

function hasOpenInterval(intervals: InProgressInterval[]): boolean {
  const last = intervals[intervals.length - 1];
  return last !== undefined && last.end === null;
}

/**
 * Apply a status change to a task, maintaining its in-progress interval history.
 * Entering in_progress opens a new interval (unless one is already open);
 * leaving in_progress closes the open interval at `now`.
 */
export function recordStatusChange(task: Task, status: TaskStatus, now: number): Task {
  const intervals = [...(task.inProgressIntervals ?? [])];
  const open = hasOpenInterval(intervals);

  if (status === "in_progress" && !open) {
    intervals.push({ start: now, end: null });
  } else if (status !== "in_progress" && open) {
    intervals[intervals.length - 1] = {
      ...intervals[intervals.length - 1],
      end: now,
      endStatus: status,
    };
  }

  return { ...task, status, inProgressIntervals: intervals };
}

/**
 * Apply a new set of assigned people to a task. People who were already
 * assigned keep their original assignment time; newly added people are stamped
 * with `now`; removed people lose their timestamp.
 */
export function recordAssignment(task: Task, personIds: string[], now: number): Task {
  const previous = task.assignedAt ?? {};
  const assignedAt: Record<string, number> = {};
  for (const id of personIds) {
    assignedAt[id] = previous[id] ?? now;
  }
  return { ...task, assignedPersonIds: personIds, assignedAt };
}

/** Total time the task has spent in_progress across all intervals, up to `now`. */
export function totalInProgressMs(task: Task, now: number): number {
  return (task.inProgressIntervals ?? []).reduce(
    (sum, { start, end }) => sum + Math.max(0, (end ?? now) - start),
    0,
  );
}

/**
 * Time the task has been in_progress while a given person was assigned: the
 * overlap of the in-progress intervals with [assignedAt, now].
 */
export function personInProgressMs(task: Task, personId: string, now: number): number {
  const assignedAt = task.assignedAt?.[personId];
  if (assignedAt === undefined) return 0;
  return (task.inProgressIntervals ?? []).reduce((sum, { start, end }) => {
    const overlapStart = Math.max(start, assignedAt);
    const overlapEnd = end ?? now;
    return sum + Math.max(0, overlapEnd - overlapStart);
  }, 0);
}

/** True if the task is missing tracking data that should be backfilled "from now". */
export function needsBackfill(task: Task): boolean {
  const intervals = task.inProgressIntervals ?? [];
  if (task.status === "in_progress" && !hasOpenInterval(intervals)) return true;
  const assignedAt = task.assignedAt ?? {};
  return (task.assignedPersonIds ?? []).some((id) => assignedAt[id] === undefined);
}

/**
 * Fill in tracking data that pre-dates this feature: open an interval for a task
 * that is in_progress without one, and stamp assigned people who have no
 * assignment time — both starting at `now`. Returns the same task if nothing
 * needs filling.
 */
export function backfillTracking(task: Task, now: number): Task {
  if (!needsBackfill(task)) return task;

  let next = task;
  const intervals = next.inProgressIntervals ?? [];
  if (next.status === "in_progress" && !hasOpenInterval(intervals)) {
    next = { ...next, inProgressIntervals: [...intervals, { start: now, end: null }] };
  }

  const assignedIds = next.assignedPersonIds ?? [];
  if (assignedIds.length > 0) {
    const assignedAt = { ...(next.assignedAt ?? {}) };
    for (const id of assignedIds) {
      if (assignedAt[id] === undefined) assignedAt[id] = now;
    }
    next = { ...next, assignedAt };
  }

  return next;
}

/**
 * The Firestore field changes needed to backfill a task's tracking, or null if
 * none are needed. Returns only the fields that actually change, so the write
 * doesn't touch unrelated data.
 */
export function backfillUpdate(
  task: Task,
  now: number,
): Pick<Task, "inProgressIntervals" | "assignedAt"> | null {
  if (!needsBackfill(task)) return null;
  const filled = backfillTracking(task, now);
  const update: Pick<Task, "inProgressIntervals" | "assignedAt"> = {};
  if (filled.inProgressIntervals !== task.inProgressIntervals) {
    update.inProgressIntervals = filled.inProgressIntervals ?? [];
  }
  if (filled.assignedAt !== task.assignedAt) {
    update.assignedAt = filled.assignedAt ?? {};
  }
  return update;
}

/** Tasks that have ever been in_progress (have at least one interval). */
export function tasksWithInProgressHistory(tasks: Task[]): Task[] {
  return tasks.filter((t) => (t.inProgressIntervals ?? []).length > 0);
}
