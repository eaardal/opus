export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Connection {
  from: string;
  to: string;
}

export type TaskStatus = "pending" | "in_progress" | "blocked" | "completed" | "archived";

/**
 * A span of time a task spent in the "in_progress" status. `start`/`end` are
 * epoch milliseconds; `end` is null while the task is currently in progress
 * (the open interval). A task accumulates one interval per time it enters
 * in_progress.
 */
export interface InProgressInterval {
  start: number;
  end: number | null;
  /** The status the task moved to when this interval ended (e.g. completed,
      pending). Absent while the interval is still open. */
  endStatus?: TaskStatus;
}

/**
 * Whether a task is an ordinary task or a "link" task that navigates to another
 * destination. Absent ⇒ "standard" (the default for every pre-existing task).
 */
export type TaskType = "standard" | "link";

/**
 * Where a link task points. Always within the same workspace, so the workspace
 * is implicit; `projectId` identifies the destination project (it equals the
 * link's own project for same-project links). A project link carries no
 * task/group id; a task/group link carries the specific entity id.
 */
export type LinkTarget =
  | { kind: "project"; projectId: string }
  | { kind: "task"; projectId: string; taskId: string }
  | { kind: "group"; projectId: string; groupId: string };

export interface Task {
  id: string;
  text: string;
  x: number;
  y: number;
  category?: string;
  status: TaskStatus;
  assignedPersonIds?: string[];
  /** Every span this task has been in_progress (most recent last). */
  inProgressIntervals?: InProgressInterval[];
  /** Epoch ms each currently-assigned person was (most recently) assigned. */
  assignedAt?: Record<string, number>;
  /** Task kind. Absent ⇒ "standard". */
  type?: TaskType;
  /** Destination of a link task. Present iff `type === "link"`. */
  linkTarget?: LinkTarget;
}

export interface Group {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
}

export type NodeShape = "circle" | "diamond" | "triangle";

/** The full graph state that operations transform. */
export interface TaskGraphState {
  tasks: Task[];
  connections: Connection[];
  groups: Group[];
}
