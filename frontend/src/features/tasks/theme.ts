import { CATEGORY_DEFINITIONS, CATEGORY_IDS } from "../../domain/tasks/categoryConfig";
import { STATUS_DEFINITIONS } from "../../domain/tasks/statusConfig";
import type { NodeShape, TaskStatus } from "../../domain/tasks/types";

/** View of a category — the shape consumed by Canvas, Sidebar, TaskNode, etc. */
export interface CategoryConfig {
  label: string;
  color: string;
  shape?: NodeShape;
}

/** View of a status. */
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

const CATEGORY_COLORS: Record<string, string> = {
  backend: "#ffce92",
  frontend: "#9dcbef",
  ux: "#f289bf",
  milestone: "#f5f5f5",
  qa: "#f5eeaa",
  external_dependency: "#bf8ede",
};

interface StatusPalette {
  color: string;
  fontColor: string;
}

const STATUS_PALETTE: Record<TaskStatus, StatusPalette> = {
  pending: { color: "#cbcce2", fontColor: "#2a2a3e" },
  in_progress: { color: "#8e8ebb", fontColor: "#eeeffa" },
  blocked: { color: "#f5a9a9", fontColor: "#5a1f1f" },
  completed: { color: "#56cf7c", fontColor: "#0f3d1f" },
  archived: { color: "#a0a0a0", fontColor: "#2a2a2a" },
};

const GROUP_BOX: GroupBoxConfig = {
  allDoneFill: "rgba(86, 207, 124, 0.1)",
  allDoneStroke: "#56cf7c",
  progressCompletedFill: "#56cf7c",
};

const CONNECTOR: ConnectorConfig = {
  color: "#929292",
  pendingColor: "#3c3c3c",
  removeColor: "#e04040",
  strokeWidth: 2,
  pendingDasharray: "5,5",
};

export function getCategories(): Record<string, CategoryConfig> {
  const result: Record<string, CategoryConfig> = {};
  for (const id of CATEGORY_IDS) {
    const def = CATEGORY_DEFINITIONS[id];
    result[id] = { label: def.label, shape: def.shape, color: CATEGORY_COLORS[id] };
  }
  return result;
}

export function getStatuses(): Record<TaskStatus, StatusConfig> {
  const result = {} as Record<TaskStatus, StatusConfig>;
  for (const status of Object.keys(STATUS_DEFINITIONS) as TaskStatus[]) {
    const def = STATUS_DEFINITIONS[status];
    result[status] = {
      label: def.label,
      emoji: def.emoji,
      color: STATUS_PALETTE[status].color,
      fontColor: STATUS_PALETTE[status].fontColor,
    };
  }
  return result;
}

export function getGroupBox(): GroupBoxConfig {
  return GROUP_BOX;
}

export function getConnector(): ConnectorConfig {
  return CONNECTOR;
}
