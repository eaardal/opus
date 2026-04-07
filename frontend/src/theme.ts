import { TaskStatus, NodeShape } from "./Sidebar";

export type Theme = "dark" | "light";

export interface CategoryConfig {
  label: string;
  color: string;
  shape?: NodeShape;
}

export interface StatusConfig {
  label: string;
  color: string;
  emoji: string;
}

const CATEGORIES_DARK: Record<string, CategoryConfig> = {
  backend: { label: "Backend", color: "#f6b093" },
  frontend: { label: "Frontend", color: "#a0c4f1" },
  ux: { label: "UX", color: "#f0a6ce" },
  integration: { label: "Integration Point", color: "#ffffff", shape: "diamond" },
};

const CATEGORIES_LIGHT: Record<string, CategoryConfig> = {
  backend: { label: "Backend", color: "#e08860" },
  frontend: { label: "Frontend", color: "#6a9fd8" },
  ux: { label: "UX", color: "#d87aaa" },
  integration: { label: "Integration Point", color: "#f5f5f5", shape: "diamond" },
};

const STATUSES_DARK: Record<TaskStatus, StatusConfig> = {
  pending: { label: "Pending", color: "#3a3a5a", emoji: "💤" },
  in_progress: { label: "In Progress", color: "#3737af", emoji: "👀" },
  completed: { label: "Completed", color: "#2ea058", emoji: "✅" },
  archived: { label: "Archived", color: "#5e5e5e", emoji: "🪦" },
};

const STATUSES_LIGHT: Record<TaskStatus, StatusConfig> = {
  pending: { label: "Pending", color: "#b0b0c8", emoji: "💤" },
  in_progress: { label: "In Progress", color: "#8888cc", emoji: "👀" },
  completed: { label: "Completed", color: "#6abf85", emoji: "✅" },
  archived: { label: "Archived", color: "#a0a0a0", emoji: "🪦" },
};

export function getCategories(theme: Theme): Record<string, CategoryConfig> {
  return theme === "light" ? CATEGORIES_LIGHT : CATEGORIES_DARK;
}

export function getStatuses(theme: Theme): Record<TaskStatus, StatusConfig> {
  return theme === "light" ? STATUSES_LIGHT : STATUSES_DARK;
}
