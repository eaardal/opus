import { describe, expect, test } from "vitest";
import {
  addConnectionIfNew,
  addGroup,
  addTask,
  assignPerson,
  assignPersonInProgress,
  deleteEntities,
  deleteGroup,
  deleteTaskCascading,
  removeConnection,
  selectEntitiesInRect,
  toggleGroupLock,
  translateEntities,
  unassignPerson,
  updateGroup,
  updateTask,
} from "./operations";
import type { Connection, Group, Task } from "./types";

const taskAt = (id: string, x: number, y: number, overrides: Partial<Task> = {}): Task => ({
  id,
  text: id,
  x,
  y,
  status: "pending",
  ...overrides,
});

const group = (id: string, overrides: Partial<Group> = {}): Group => ({
  id,
  title: id,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...overrides,
});

describe("addTask", () => {
  test("appends the task to the end of the list", () => {
    const a = taskAt("a", 0, 0);
    const b = taskAt("b", 10, 10);
    expect(addTask([a], b)).toEqual([a, b]);
  });

  test("does not mutate the input array", () => {
    const a = taskAt("a", 0, 0);
    const tasks = [a];
    addTask(tasks, taskAt("b", 1, 1));
    expect(tasks).toEqual([a]);
  });
});

describe("updateTask", () => {
  test("merges updates into the matching task", () => {
    const tasks = [taskAt("a", 0, 0, { text: "old" }), taskAt("b", 1, 1)];
    const result = updateTask(tasks, "a", { text: "new", x: 99 });
    expect(result[0]).toMatchObject({ id: "a", text: "new", x: 99, y: 0 });
    expect(result[1]).toEqual(tasks[1]);
  });

  test("returns the same shape when the id is not found", () => {
    const tasks = [taskAt("a", 0, 0)];
    expect(updateTask(tasks, "missing", { text: "x" })).toEqual(tasks);
  });
});

describe("deleteTaskCascading", () => {
  test("removes the task and any connection that references it", () => {
    const tasks = [taskAt("a", 0, 0), taskAt("b", 1, 1), taskAt("c", 2, 2)];
    const connections: Connection[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "a" },
    ];
    const { tasks: t, connections: c } = deleteTaskCascading(tasks, connections, "b");
    expect(t.map((x) => x.id)).toEqual(["a", "c"]);
    // Connections to/from "b" must be gone, "c→a" remains.
    expect(c).toEqual([{ from: "c", to: "a" }]);
  });

  test("is a no-op for an unknown id", () => {
    const tasks = [taskAt("a", 0, 0)];
    const conns: Connection[] = [];
    const result = deleteTaskCascading(tasks, conns, "missing");
    expect(result.tasks).toEqual(tasks);
    expect(result.connections).toEqual(conns);
  });
});

describe("addGroup", () => {
  test("appends the group to the end of the list", () => {
    const a = group("a");
    const b = group("b");
    expect(addGroup([a], b)).toEqual([a, b]);
  });
});

describe("updateGroup", () => {
  test("merges updates into the matching group", () => {
    const groups = [group("a", { width: 100 }), group("b")];
    const result = updateGroup(groups, "a", { width: 250, x: 5 });
    expect(result[0]).toMatchObject({ id: "a", width: 250, x: 5 });
  });
});

describe("toggleGroupLock", () => {
  test("flips a missing locked field to true", () => {
    const result = toggleGroupLock([group("a")], "a");
    expect(result[0].locked).toBe(true);
  });

  test("flips locked: true → false", () => {
    const result = toggleGroupLock([group("a", { locked: true })], "a");
    expect(result[0].locked).toBe(false);
  });
});

describe("deleteGroup", () => {
  test("removes only the named group; tasks are not affected", () => {
    const groups = [group("a"), group("b")];
    expect(deleteGroup(groups, "a").map((g) => g.id)).toEqual(["b"]);
  });
});

describe("addConnectionIfNew", () => {
  test("adds a new connection that does not already exist", () => {
    const result = addConnectionIfNew([{ from: "a", to: "b" }], { from: "b", to: "c" });
    expect(result).toEqual([
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ]);
  });

  test("returns the same array reference when the connection already exists", () => {
    const conns: Connection[] = [{ from: "a", to: "b" }];
    expect(addConnectionIfNew(conns, { from: "a", to: "b" })).toBe(conns);
  });

  test("treats reversed direction as a different connection", () => {
    // The graph is directed — a→b and b→a are distinct.
    const conns: Connection[] = [{ from: "a", to: "b" }];
    const result = addConnectionIfNew(conns, { from: "b", to: "a" });
    expect(result).toHaveLength(2);
  });
});

describe("removeConnection", () => {
  test("removes the matching connection only", () => {
    const conns: Connection[] = [
      { from: "a", to: "b" },
      { from: "a", to: "c" },
    ];
    expect(removeConnection(conns, "a", "b")).toEqual([{ from: "a", to: "c" }]);
  });
});

describe("assignPersonInProgress", () => {
  test("adds the person and sets the task to in_progress", () => {
    const tasks = [taskAt("a", 0, 0, { assignedPersonIds: ["p1"] })];
    const result = assignPersonInProgress(tasks, "a", "p2");
    expect(result[0].status).toBe("in_progress");
    expect(result[0].assignedPersonIds).toEqual(["p1", "p2"]);
  });

  test("does not duplicate an already-assigned person", () => {
    const tasks = [taskAt("a", 0, 0, { assignedPersonIds: ["p1"] })];
    const result = assignPersonInProgress(tasks, "a", "p1");
    expect(result[0].assignedPersonIds).toEqual(["p1"]);
    expect(result[0].status).toBe("in_progress");
  });

  test("works on a task that has no assignedPersonIds yet", () => {
    const tasks = [taskAt("a", 0, 0)];
    const result = assignPersonInProgress(tasks, "a", "p1");
    expect(result[0].assignedPersonIds).toEqual(["p1"]);
    expect(result[0].status).toBe("in_progress");
  });
});

describe("assignPerson", () => {
  test("appends the person id when not already assigned", () => {
    const tasks = [taskAt("a", 0, 0, { assignedPersonIds: ["p1"] })];
    expect(assignPerson(tasks, "a", "p2")[0].assignedPersonIds).toEqual(["p1", "p2"]);
  });

  test("is a no-op when the person is already assigned", () => {
    const tasks = [taskAt("a", 0, 0, { assignedPersonIds: ["p1"] })];
    expect(assignPerson(tasks, "a", "p1")[0].assignedPersonIds).toEqual(["p1"]);
  });

  test("initialises assignedPersonIds when missing", () => {
    const tasks = [taskAt("a", 0, 0)];
    expect(assignPerson(tasks, "a", "p1")[0].assignedPersonIds).toEqual(["p1"]);
  });

  test("does not change task status, unlike assignPersonInProgress", () => {
    const tasks = [taskAt("a", 0, 0, { status: "pending" })];
    expect(assignPerson(tasks, "a", "p1")[0].status).toBe("pending");
  });
});

describe("unassignPerson", () => {
  test("removes the person id from the task's assignees", () => {
    const tasks = [taskAt("a", 0, 0, { assignedPersonIds: ["p1", "p2"] })];
    expect(unassignPerson(tasks, "a", "p1")[0].assignedPersonIds).toEqual(["p2"]);
  });

  test("is a no-op when the person was not assigned", () => {
    const tasks = [taskAt("a", 0, 0, { assignedPersonIds: ["p1"] })];
    expect(unassignPerson(tasks, "a", "p2")[0].assignedPersonIds).toEqual(["p1"]);
  });
});

describe("translateEntities", () => {
  test("offsets selected tasks and groups by the same delta", () => {
    const tasks = [taskAt("a", 10, 10), taskAt("b", 20, 20)];
    const groups = [group("g1", { x: 100, y: 100 })];
    const taskOrigins = new Map([
      ["a", { x: 10, y: 10 }],
      ["b", { x: 20, y: 20 }],
    ]);
    const groupOrigins = new Map([["g1", { x: 100, y: 100 }]]);

    const result = translateEntities({
      tasks,
      groups,
      taskOrigins,
      groupOrigins,
      dx: 5,
      dy: -3,
    });

    expect(result.tasks[0]).toMatchObject({ x: 15, y: 7 });
    expect(result.tasks[1]).toMatchObject({ x: 25, y: 17 });
    expect(result.groups[0]).toMatchObject({ x: 105, y: 97 });
  });

  test("leaves unselected entities untouched", () => {
    const tasks = [taskAt("a", 10, 10), taskAt("b", 20, 20)];
    const taskOrigins = new Map([["a", { x: 10, y: 10 }]]);
    const result = translateEntities({
      tasks,
      groups: [],
      taskOrigins,
      groupOrigins: new Map(),
      dx: 100,
      dy: 100,
    });
    expect(result.tasks[1]).toEqual(tasks[1]);
  });
});

describe("deleteEntities", () => {
  test("removes the named tasks and groups, plus all connections touching deleted tasks", () => {
    const tasks = [taskAt("a", 0, 0), taskAt("b", 1, 1), taskAt("c", 2, 2)];
    const connections: Connection[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "a", to: "c" },
    ];
    const groups = [group("g1"), group("g2")];

    const result = deleteEntities({ tasks, connections, groups }, new Set(["a"]), new Set(["g2"]));

    expect(result.tasks.map((t) => t.id)).toEqual(["b", "c"]);
    expect(result.groups.map((g) => g.id)).toEqual(["g1"]);
    // Only the b→c connection survives — a→b and a→c referenced "a".
    expect(result.connections).toEqual([{ from: "b", to: "c" }]);
  });

  test("is a pure no-op when the sets are empty (returns equal data)", () => {
    const state = {
      tasks: [taskAt("a", 0, 0)],
      connections: [{ from: "a", to: "a" }],
      groups: [group("g1")],
    };
    const result = deleteEntities(state, new Set(), new Set());
    expect(result.tasks).toEqual(state.tasks);
    expect(result.connections).toEqual(state.connections);
    expect(result.groups).toEqual(state.groups);
  });
});

describe("selectEntitiesInRect", () => {
  const NODE_R = 25;

  test("includes only tasks fully inside the rect (allowing for node radius)", () => {
    const inside = taskAt("inside", 100, 100);
    const onEdge = taskAt("edge", 25, 100); // x - r = 0, just inside
    const outside = taskAt("outside", 200, 100);

    const { taskIds } = selectEntitiesInRect({
      rect: { startX: 0, startY: 0, currentX: 150, currentY: 150 },
      tasks: [inside, onEdge, outside],
      groups: [],
      nodeRadius: NODE_R,
    });

    expect(taskIds).toEqual(new Set(["inside", "edge"]));
  });

  test("includes only unlocked groups fully inside the rect", () => {
    const free = group("free", { x: 10, y: 10, width: 50, height: 50 });
    const locked = group("locked", { x: 10, y: 10, width: 50, height: 50, locked: true });
    const partial = group("partial", { x: 10, y: 10, width: 200, height: 200 });

    const { groupIds } = selectEntitiesInRect({
      rect: { startX: 0, startY: 0, currentX: 100, currentY: 100 },
      tasks: [],
      groups: [free, locked, partial],
      nodeRadius: NODE_R,
    });

    expect(groupIds).toEqual(new Set(["free"]));
  });

  test("normalises rect direction (start past current works)", () => {
    const t = taskAt("t", 50, 50);
    // Drawn from bottom-right back to top-left.
    const { taskIds } = selectEntitiesInRect({
      rect: { startX: 100, startY: 100, currentX: 0, currentY: 0 },
      tasks: [t],
      groups: [],
      nodeRadius: NODE_R,
    });
    expect(taskIds).toEqual(new Set(["t"]));
  });
});
