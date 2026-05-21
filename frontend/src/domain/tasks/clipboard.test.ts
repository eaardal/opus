import { describe, expect, test } from "vitest";
import { applyPaste, deserializeClipboard, serializeSelection } from "./clipboard";
import type { Connection, Group, Task, ViewBox } from "./types";

const task = (id: string, x = 0, y = 0, overrides: Partial<Task> = {}): Task => ({
  id,
  text: id,
  x,
  y,
  status: "pending",
  ...overrides,
});

const group = (id: string, x = 0, y = 0, overrides: Partial<Group> = {}): Group => ({
  id,
  title: id,
  x,
  y,
  width: 100,
  height: 100,
  ...overrides,
});

const conn = (from: string, to: string): Connection => ({ from, to });

const viewBox = (x = 0, y = 0, width = 800, height = 600): ViewBox => ({ x, y, width, height });

const WORKSPACE_A = "workspace-a";
const WORKSPACE_B = "workspace-b";

// ============================================================================
// serializeSelection
// ============================================================================

describe("serializeSelection", () => {
  test("returns null when nothing is selected", () => {
    const result = serializeSelection({
      selectedTaskIds: new Set(),
      selectedGroupIds: new Set(),
      tasks: [task("t1")],
      connections: [],
      groups: [],
      workspaceId: WORKSPACE_A,
    });
    expect(result).toBeNull();
  });

  test("serializes selected tasks to JSON", () => {
    const t1 = task("t1", 10, 20);
    const t2 = task("t2", 30, 40);
    const result = serializeSelection({
      selectedTaskIds: new Set(["t1"]),
      selectedGroupIds: new Set(),
      tasks: [t1, t2],
      connections: [],
      groups: [],
      workspaceId: WORKSPACE_A,
    });
    const parsed = JSON.parse(result!);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].id).toBe("t1");
    expect(parsed.groups).toHaveLength(0);
  });

  test("serializes selected groups to JSON", () => {
    const g1 = group("g1");
    const result = serializeSelection({
      selectedTaskIds: new Set(),
      selectedGroupIds: new Set(["g1"]),
      tasks: [],
      connections: [],
      groups: [g1],
      workspaceId: WORKSPACE_A,
    });
    const parsed = JSON.parse(result!);
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].id).toBe("g1");
  });

  test("includes connections where both endpoints are selected", () => {
    const result = serializeSelection({
      selectedTaskIds: new Set(["t1", "t2"]),
      selectedGroupIds: new Set(),
      tasks: [task("t1"), task("t2"), task("t3")],
      connections: [conn("t1", "t2"), conn("t1", "t3"), conn("t3", "t2")],
      groups: [],
      workspaceId: WORKSPACE_A,
    });
    const parsed = JSON.parse(result!);
    expect(parsed.connections).toHaveLength(1);
    expect(parsed.connections[0]).toEqual({ from: "t1", to: "t2" });
  });

  test("drops connections with one endpoint outside the selection", () => {
    const result = serializeSelection({
      selectedTaskIds: new Set(["t1"]),
      selectedGroupIds: new Set(),
      tasks: [task("t1"), task("t2")],
      connections: [conn("t1", "t2")],
      groups: [],
      workspaceId: WORKSPACE_A,
    });
    const parsed = JSON.parse(result!);
    expect(parsed.connections).toHaveLength(0);
  });

  test("embeds workspaceId and sentinel fields", () => {
    const result = serializeSelection({
      selectedTaskIds: new Set(["t1"]),
      selectedGroupIds: new Set(),
      tasks: [task("t1")],
      connections: [],
      groups: [],
      workspaceId: WORKSPACE_A,
    });
    const parsed = JSON.parse(result!);
    expect(parsed.type).toBe("domino/canvas-clipboard");
    expect(parsed.version).toBe(1);
    expect(parsed.workspaceId).toBe(WORKSPACE_A);
  });

  test("only serializes tasks that are selected", () => {
    const result = serializeSelection({
      selectedTaskIds: new Set(["t1"]),
      selectedGroupIds: new Set(),
      tasks: [task("t1"), task("t2"), task("t3")],
      connections: [],
      groups: [],
      workspaceId: WORKSPACE_A,
    });
    const parsed = JSON.parse(result!);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].id).toBe("t1");
  });
});

// ============================================================================
// deserializeClipboard
// ============================================================================

describe("deserializeClipboard", () => {
  const validPayload = () =>
    JSON.stringify({
      type: "domino/canvas-clipboard",
      version: 1,
      workspaceId: WORKSPACE_A,
      tasks: [],
      connections: [],
      groups: [],
    });

  test("parses a valid payload", () => {
    const result = deserializeClipboard(validPayload());
    expect(result).not.toBeNull();
    expect(result?.type).toBe("domino/canvas-clipboard");
    expect(result?.workspaceId).toBe(WORKSPACE_A);
  });

  test("returns null for invalid JSON", () => {
    expect(deserializeClipboard("not json")).toBeNull();
  });

  test("returns null when type sentinel is wrong", () => {
    const bad = JSON.stringify({ type: "other/thing", version: 1, workspaceId: "x", tasks: [], connections: [], groups: [] });
    expect(deserializeClipboard(bad)).toBeNull();
  });

  test("returns null when version field is missing", () => {
    const bad = JSON.stringify({ type: "domino/canvas-clipboard", workspaceId: "x", tasks: [], connections: [], groups: [] });
    expect(deserializeClipboard(bad)).toBeNull();
  });

  test("returns null when tasks array is missing", () => {
    const bad = JSON.stringify({ type: "domino/canvas-clipboard", version: 1, workspaceId: "x", connections: [], groups: [] });
    expect(deserializeClipboard(bad)).toBeNull();
  });

  test("returns null for an empty string", () => {
    expect(deserializeClipboard("")).toBeNull();
  });

  test("returns null for a plain string", () => {
    expect(deserializeClipboard("hello world")).toBeNull();
  });
});

// ============================================================================
// applyPaste
// ============================================================================

describe("applyPaste", () => {
  const clipboard = (overrides: Partial<Parameters<typeof applyPaste>[0]["clipboard"]> = {}) => ({
    type: "domino/canvas-clipboard" as const,
    version: 1 as const,
    workspaceId: WORKSPACE_A,
    tasks: [task("t1", 100, 100), task("t2", 200, 200)],
    connections: [conn("t1", "t2")],
    groups: [group("g1", 50, 50)],
    ...overrides,
  });

  test("generates new IDs for all tasks", () => {
    const result = applyPaste({
      clipboard: clipboard(),
      currentWorkspaceId: WORKSPACE_A,
      viewBox: viewBox(),
    });
    const resultIds = result.tasks.map(t => t.id);
    expect(resultIds).not.toContain("t1");
    expect(resultIds).not.toContain("t2");
    expect(new Set(resultIds).size).toBe(2);
  });

  test("generates new IDs for all groups", () => {
    const result = applyPaste({
      clipboard: clipboard(),
      currentWorkspaceId: WORKSPACE_A,
      viewBox: viewBox(),
    });
    const resultIds = result.groups.map(g => g.id);
    expect(resultIds).not.toContain("g1");
    expect(new Set(resultIds).size).toBe(1);
  });

  test("remaps connection IDs to match the new task IDs", () => {
    const result = applyPaste({
      clipboard: clipboard(),
      currentWorkspaceId: WORKSPACE_A,
      viewBox: viewBox(),
    });
    const taskIds = new Set(result.tasks.map(t => t.id));
    expect(taskIds.has(result.connections[0].from)).toBe(true);
    expect(taskIds.has(result.connections[0].to)).toBe(true);
  });

  test("keeps assignedPersonIds when pasting within the same workspace", () => {
    const cb = clipboard({
      tasks: [task("t1", 0, 0, { assignedPersonIds: ["person-1"] })],
      connections: [],
      groups: [],
    });
    const result = applyPaste({
      clipboard: cb,
      currentWorkspaceId: WORKSPACE_A,
      viewBox: viewBox(),
    });
    expect(result.tasks[0].assignedPersonIds).toEqual(["person-1"]);
  });

  test("strips assignedPersonIds when pasting into a different workspace", () => {
    const cb = clipboard({
      tasks: [task("t1", 0, 0, { assignedPersonIds: ["person-1"] })],
      connections: [],
      groups: [],
    });
    const result = applyPaste({
      clipboard: cb,
      currentWorkspaceId: WORKSPACE_B,
      viewBox: viewBox(),
    });
    expect(result.tasks[0].assignedPersonIds).toEqual([]);
  });

  test("positions pasted tasks near the viewport center", () => {
    const vb = viewBox(0, 0, 800, 600);
    const viewportCenterX = vb.x + vb.width / 2; // 400
    const viewportCenterY = vb.y + vb.height / 2; // 300

    const cb = clipboard({ tasks: [task("t1", 0, 0)], connections: [], groups: [] });
    const result = applyPaste({ clipboard: cb, currentWorkspaceId: WORKSPACE_A, viewBox: vb });

    // The single task should be near viewport center + offset (40, 40)
    expect(result.tasks[0].x).toBeCloseTo(viewportCenterX + 40);
    expect(result.tasks[0].y).toBeCloseTo(viewportCenterY + 40);
  });

  test("preserves relative positions between pasted elements", () => {
    const cb = clipboard({
      tasks: [task("t1", 0, 0), task("t2", 100, 50)],
      connections: [],
      groups: [],
    });
    const result = applyPaste({
      clipboard: cb,
      currentWorkspaceId: WORKSPACE_A,
      viewBox: viewBox(),
    });
    const t1 = result.tasks[0];
    const t2 = result.tasks[1];
    expect(t2.x - t1.x).toBeCloseTo(100);
    expect(t2.y - t1.y).toBeCloseTo(50);
  });

  test("preserves all task fields except id, position, and assignedPersonIds", () => {
    const cb = clipboard({
      tasks: [task("t1", 0, 0, { text: "hello", status: "completed", category: "backend" })],
      connections: [],
      groups: [],
    });
    const result = applyPaste({ clipboard: cb, currentWorkspaceId: WORKSPACE_A, viewBox: viewBox() });
    expect(result.tasks[0].text).toBe("hello");
    expect(result.tasks[0].status).toBe("completed");
    expect(result.tasks[0].category).toBe("backend");
  });

  test("returns empty arrays for an empty clipboard", () => {
    const cb = clipboard({ tasks: [], connections: [], groups: [] });
    const result = applyPaste({ clipboard: cb, currentWorkspaceId: WORKSPACE_A, viewBox: viewBox() });
    expect(result.tasks).toHaveLength(0);
    expect(result.connections).toHaveLength(0);
    expect(result.groups).toHaveLength(0);
  });
});
