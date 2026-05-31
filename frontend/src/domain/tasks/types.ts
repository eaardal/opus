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

export type TaskStatus = "pending" | "in_progress" | "completed" | "archived";

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
