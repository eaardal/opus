import { CATEGORY_DEFINITIONS, CATEGORY_IDS } from "../../domain/tasks/categoryConfig";
import { STATUS_DEFINITIONS } from "../../domain/tasks/statusConfig";
import type { NodeShape, TaskStatus } from "../../domain/tasks/types";

export type Theme = "dark" | "light";

/** Theme-merged view of a category — the shape consumed by Canvas, Sidebar,
 *  TaskNode, etc. Combines the canonical definition with a per-theme colour. */
export interface CategoryConfig {
  label: string;
  color: string;
  shape?: NodeShape;
}

/** Theme-merged view of a status. Same idea as CategoryConfig. */
export interface StatusConfig {
  label: string;
  color: string;
  fontColor: string;
  emoji: string;
}

export interface GroupBoxConfig {
  allDoneFill: string;
  allDoneStroke: string;
  progressCompletedFill: string;
}

export interface ConnectorConfig {
  color: string;
  pendingColor: string;
  removeColor: string;
  strokeWidth: number;
  pendingDasharray: string;
}

const CATEGORY_COLORS_DARK: Record<string, string> = {
  backend: "#f6b093",
  frontend: "#a0c4f1",
  ux: "#f0a6ce",
  integration: "#ffffff",
  qa: "#e8d97a",
  external_dependency: "#b47fe0",
};

const CATEGORY_COLORS_LIGHT: Record<string, string> = {
  backend: "#ffce92",
  frontend: "#9dcbef",
  ux: "#f289bf",
  integration: "#f5f5f5",
  qa: "#f5eeaa",
  external_dependency: "#bf8ede",
};

interface StatusPalette {
  color: string;
  fontColor: string;
}

const STATUS_PALETTE_DARK: Record<TaskStatus, StatusPalette> = {
  pending: { color: "#3a3a5a", fontColor: "#ffffff" },
  in_progress: { color: "#3737af", fontColor: "#ffffff" },
  completed: { color: "#2ea058", fontColor: "#ffffff" },
  archived: { color: "#5e5e5e", fontColor: "#ffffff" },
};

const STATUS_PALETTE_LIGHT: Record<TaskStatus, StatusPalette> = {
  pending: { color: "#cbcce2", fontColor: "#2a2a3e" },
  in_progress: { color: "#8e8ebb", fontColor: "#eeeffa" },
  completed: { color: "#56cf7c", fontColor: "#0f3d1f" },
  archived: { color: "#a0a0a0", fontColor: "#2a2a2a" },
};

const GROUP_BOX_DARK: GroupBoxConfig = {
  allDoneFill: "rgba(46, 160, 88, 0.08)",
  allDoneStroke: "#2ea058",
  progressCompletedFill: "#2ea058",
};

const GROUP_BOX_LIGHT: GroupBoxConfig = {
  allDoneFill: "rgba(86, 207, 124, 0.1)",
  allDoneStroke: "#56cf7c",
  progressCompletedFill: "#56cf7c",
};

const CONNECTOR_DARK: ConnectorConfig = {
  color: "#666",
  pendingColor: "#999",
  removeColor: "#ff6b6b",
  strokeWidth: 2,
  pendingDasharray: "5,5",
};

const CONNECTOR_LIGHT: ConnectorConfig = {
  color: "#929292",
  pendingColor: "#3c3c3c",
  removeColor: "#e04040",
  strokeWidth: 2,
  pendingDasharray: "5,5",
};

export function getCategories(theme: Theme): Record<string, CategoryConfig> {
  const colors = theme === "light" ? CATEGORY_COLORS_LIGHT : CATEGORY_COLORS_DARK;
  const result: Record<string, CategoryConfig> = {};
  for (const id of CATEGORY_IDS) {
    const def = CATEGORY_DEFINITIONS[id];
    result[id] = { label: def.label, shape: def.shape, color: colors[id] };
  }
  return result;
}

export function getStatuses(theme: Theme): Record<TaskStatus, StatusConfig> {
  const palette = theme === "light" ? STATUS_PALETTE_LIGHT : STATUS_PALETTE_DARK;
  const result = {} as Record<TaskStatus, StatusConfig>;
  for (const status of Object.keys(STATUS_DEFINITIONS) as TaskStatus[]) {
    const def = STATUS_DEFINITIONS[status];
    result[status] = {
      label: def.label,
      emoji: def.emoji,
      color: palette[status].color,
      fontColor: palette[status].fontColor,
    };
  }
  return result;
}

export function getGroupBox(theme: Theme): GroupBoxConfig {
  return theme === "light" ? GROUP_BOX_LIGHT : GROUP_BOX_DARK;
}

export function getConnector(theme: Theme): ConnectorConfig {
  return theme === "light" ? CONNECTOR_LIGHT : CONNECTOR_DARK;
}
