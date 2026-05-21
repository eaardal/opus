import type { Connection, Group, Task, ViewBox } from "./types";

const CLIPBOARD_TYPE = "domino/canvas-clipboard" as const;
const CLIPBOARD_VERSION = 1 as const;
const PASTE_OFFSET = 40;

export interface CanvasClipboard {
  type: typeof CLIPBOARD_TYPE;
  version: typeof CLIPBOARD_VERSION;
  workspaceId: string;
  tasks: Task[];
  connections: Connection[];
  groups: Group[];
}

interface SerializeArgs {
  selectedTaskIds: ReadonlySet<string>;
  selectedGroupIds: ReadonlySet<string>;
  tasks: Task[];
  connections: Connection[];
  groups: Group[];
  workspaceId: string;
}

export function serializeSelection(args: SerializeArgs): string | null {
  const { selectedTaskIds, selectedGroupIds, tasks, connections, groups, workspaceId } = args;

  const selectedTasks = tasks.filter((t) => selectedTaskIds.has(t.id));
  const selectedGroups = groups.filter((g) => selectedGroupIds.has(g.id));

  if (selectedTasks.length === 0 && selectedGroups.length === 0) return null;

  const selectedConnections = connections.filter(
    (c) => selectedTaskIds.has(c.from) && selectedTaskIds.has(c.to),
  );

  const clipboard: CanvasClipboard = {
    type: CLIPBOARD_TYPE,
    version: CLIPBOARD_VERSION,
    workspaceId,
    tasks: selectedTasks,
    connections: selectedConnections,
    groups: selectedGroups,
  };

  return JSON.stringify(clipboard);
}

export function deserializeClipboard(raw: string): CanvasClipboard | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isCanvasClipboard(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isCanvasClipboard(value: unknown): value is CanvasClipboard {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj["type"] === CLIPBOARD_TYPE &&
    obj["version"] === CLIPBOARD_VERSION &&
    typeof obj["workspaceId"] === "string" &&
    Array.isArray(obj["tasks"]) &&
    Array.isArray(obj["connections"]) &&
    Array.isArray(obj["groups"])
  );
}

interface PasteArgs {
  clipboard: CanvasClipboard;
  currentWorkspaceId: string;
  viewBox: ViewBox;
}

interface PasteResult {
  tasks: Task[];
  connections: Connection[];
  groups: Group[];
}

export function applyPaste({ clipboard, currentWorkspaceId, viewBox }: PasteArgs): PasteResult {
  const isSameWorkspace = clipboard.workspaceId === currentWorkspaceId;

  const taskIdMap = new Map<string, string>();
  for (const t of clipboard.tasks) {
    taskIdMap.set(t.id, crypto.randomUUID());
  }

  const groupIdMap = new Map<string, string>();
  for (const g of clipboard.groups) {
    groupIdMap.set(g.id, crypto.randomUUID());
  }

  const { dx, dy } = computeTranslation(clipboard.tasks, clipboard.groups, viewBox);

  const tasks: Task[] = clipboard.tasks.map((t) => ({
    ...t,
    id: taskIdMap.get(t.id)!,
    x: t.x + dx,
    y: t.y + dy,
    assignedPersonIds: isSameWorkspace ? (t.assignedPersonIds ?? []) : [],
  }));

  const connections: Connection[] = clipboard.connections.map((c) => ({
    from: taskIdMap.get(c.from)!,
    to: taskIdMap.get(c.to)!,
  }));

  const groups: Group[] = clipboard.groups.map((g) => ({
    ...g,
    id: groupIdMap.get(g.id)!,
    x: g.x + dx,
    y: g.y + dy,
  }));

  return { tasks, connections, groups };
}

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function computeBoundingBox(tasks: Task[], groups: Group[]): BoundingBox | null {
  if (tasks.length === 0 && groups.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const t of tasks) {
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
  }

  for (const g of groups) {
    if (g.x < minX) minX = g.x;
    if (g.x + g.width > maxX) maxX = g.x + g.width;
    if (g.y < minY) minY = g.y;
    if (g.y + g.height > maxY) maxY = g.y + g.height;
  }

  return { minX, maxX, minY, maxY };
}

function computeTranslation(
  tasks: Task[],
  groups: Group[],
  viewBox: ViewBox,
): { dx: number; dy: number } {
  const box = computeBoundingBox(tasks, groups);
  if (!box) return { dx: 0, dy: 0 };

  const selectionCenterX = (box.minX + box.maxX) / 2;
  const selectionCenterY = (box.minY + box.maxY) / 2;

  const viewportCenterX = viewBox.x + viewBox.width / 2;
  const viewportCenterY = viewBox.y + viewBox.height / 2;

  return {
    dx: viewportCenterX - selectionCenterX + PASTE_OFFSET,
    dy: viewportCenterY - selectionCenterY + PASTE_OFFSET,
  };
}
