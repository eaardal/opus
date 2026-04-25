import type { Connection, Group, Task, TaskGraphState } from "./types";

// ============================================================================
// Tasks
// ============================================================================

export function addTask(tasks: Task[], newTask: Task): Task[] {
  return [...tasks, newTask];
}

export function updateTask(tasks: Task[], id: string, updates: Partial<Task>): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
}

/**
 * Remove a task and any connection that referenced it (either as source or
 * target). Returns both lists; the caller decides where to put them.
 */
export function deleteTaskCascading(
  tasks: Task[],
  connections: Connection[],
  id: string,
): { tasks: Task[]; connections: Connection[] } {
  return {
    tasks: tasks.filter((t) => t.id !== id),
    connections: connections.filter((c) => c.from !== id && c.to !== id),
  };
}

/**
 * Add the given person to a task's assignees (if not already present).
 * Status is unchanged; use `assignPersonInProgress` for the queue-panel flow
 * that simultaneously sets in_progress.
 */
export function assignPerson(tasks: Task[], taskId: string, personId: string): Task[] {
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    const existing = t.assignedPersonIds ?? [];
    if (existing.includes(personId)) return t;
    return { ...t, assignedPersonIds: [...existing, personId] };
  });
}

/** Remove the given person id from a task's assignees. */
export function unassignPerson(tasks: Task[], taskId: string, personId: string): Task[] {
  return tasks.map((t) =>
    t.id === taskId
      ? { ...t, assignedPersonIds: (t.assignedPersonIds ?? []).filter((id) => id !== personId) }
      : t,
  );
}

/**
 * Add the given person to a task's assignees (if not already present) and set
 * the task's status to in_progress. Used by the queue panel when a person
 * picks up a new task.
 */
export function assignPersonInProgress(tasks: Task[], taskId: string, personId: string): Task[] {
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    const existing = t.assignedPersonIds ?? [];
    const assignedPersonIds = existing.includes(personId) ? existing : [...existing, personId];
    return { ...t, assignedPersonIds, status: "in_progress" as const };
  });
}

// ============================================================================
// Groups
// ============================================================================

export function addGroup(groups: Group[], newGroup: Group): Group[] {
  return [...groups, newGroup];
}

export function updateGroup(groups: Group[], id: string, updates: Partial<Group>): Group[] {
  return groups.map((g) => (g.id === id ? { ...g, ...updates } : g));
}

export function deleteGroup(groups: Group[], id: string): Group[] {
  return groups.filter((g) => g.id !== id);
}

export function toggleGroupLock(groups: Group[], id: string): Group[] {
  return groups.map((g) => (g.id === id ? { ...g, locked: !g.locked } : g));
}

// ============================================================================
// Connections
// ============================================================================

/**
 * Add the connection iff one with the same `from`/`to` does not already exist.
 * Returns the original array reference when nothing changed (useful as a hint
 * that a re-render is unnecessary).
 */
export function addConnectionIfNew(connections: Connection[], candidate: Connection): Connection[] {
  const exists = connections.some((c) => c.from === candidate.from && c.to === candidate.to);
  if (exists) return connections;
  return [...connections, candidate];
}

export function removeConnection(
  connections: Connection[],
  from: string,
  to: string,
): Connection[] {
  return connections.filter((c) => !(c.from === from && c.to === to));
}

// ============================================================================
// Multi-entity operations
// ============================================================================

interface TranslateArgs {
  tasks: Task[];
  groups: Group[];
  taskOrigins: Map<string, { x: number; y: number }>;
  groupOrigins: Map<string, { x: number; y: number }>;
  dx: number;
  dy: number;
}

/**
 * Apply a translation (dx, dy) to every entity whose id appears in the origin
 * maps, computed from the origin position rather than the current position.
 * This is the move-selection-while-dragging operation: each frame we recompute
 * positions from the original drag-start positions to avoid drift from
 * accumulated rounding.
 */
export function translateEntities({
  tasks,
  groups,
  taskOrigins,
  groupOrigins,
  dx,
  dy,
}: TranslateArgs): { tasks: Task[]; groups: Group[] } {
  return {
    tasks: tasks.map((t) => {
      const origin = taskOrigins.get(t.id);
      return origin ? { ...t, x: origin.x + dx, y: origin.y + dy } : t;
    }),
    groups: groups.map((g) => {
      const origin = groupOrigins.get(g.id);
      return origin ? { ...g, x: origin.x + dx, y: origin.y + dy } : g;
    }),
  };
}

/**
 * Remove every task in `taskIds`, every group in `groupIds`, and every
 * connection that touched a deleted task. Used by the multi-select
 * delete-key handler.
 */
export function deleteEntities(
  state: TaskGraphState,
  taskIds: ReadonlySet<string>,
  groupIds: ReadonlySet<string>,
): TaskGraphState {
  return {
    tasks: state.tasks.filter((t) => !taskIds.has(t.id)),
    connections: state.connections.filter((c) => !taskIds.has(c.from) && !taskIds.has(c.to)),
    groups: state.groups.filter((g) => !groupIds.has(g.id)),
  };
}

interface Rect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/**
 * Hit-test marquee selection: return the ids of tasks fully inside the rect
 * (allowing for `nodeRadius`) and unlocked groups whose extents fit inside.
 * Order of `start`/`current` doesn't matter — the rect is normalised.
 */
export function selectEntitiesInRect(args: {
  rect: Rect;
  tasks: Task[];
  groups: Group[];
  nodeRadius: number;
}): { taskIds: Set<string>; groupIds: Set<string> } {
  const { rect, tasks, groups, nodeRadius } = args;
  const minX = Math.min(rect.startX, rect.currentX);
  const maxX = Math.max(rect.startX, rect.currentX);
  const minY = Math.min(rect.startY, rect.currentY);
  const maxY = Math.max(rect.startY, rect.currentY);

  const taskIds = new Set<string>();
  for (const t of tasks) {
    if (
      t.x - nodeRadius >= minX &&
      t.x + nodeRadius <= maxX &&
      t.y - nodeRadius >= minY &&
      t.y + nodeRadius <= maxY
    ) {
      taskIds.add(t.id);
    }
  }

  const groupIds = new Set<string>();
  for (const g of groups) {
    if (
      !g.locked &&
      g.x >= minX &&
      g.x + g.width <= maxX &&
      g.y >= minY &&
      g.y + g.height <= maxY
    ) {
      groupIds.add(g.id);
    }
  }

  return { taskIds, groupIds };
}
