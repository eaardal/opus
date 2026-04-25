import type { TaskStatus } from "./types";

/** Theme-independent properties of a task status. View-only props (colour, */
/** font colour) live with the per-theme tables in features/. */
export interface StatusDefinition {
  label: string;
  emoji: string;
}

export const STATUS_DEFINITIONS: Record<TaskStatus, StatusDefinition> = {
  pending: { label: "Pending", emoji: "💤" },
  in_progress: { label: "In Progress", emoji: "👀" },
  completed: { label: "Completed", emoji: "✅" },
  archived: { label: "Archived", emoji: "🪦" },
};
