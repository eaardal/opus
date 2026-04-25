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

export interface Task {
  id: string;
  text: string;
  x: number;
  y: number;
  category?: string;
  status: TaskStatus;
  assignedPersonIds?: string[];
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
