import { describe, expect, test } from "vitest";
import { findActiveTaskIdsFor, findBlockerTaskIds, findSwimlanePersonIds } from "./blockers";
import type { Connection, Task } from "./types";

const t = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  text: id,
  x: 0,
  y: 0,
  status: "pending",
  ...overrides,
});

describe("findActiveTaskIdsFor", () => {
  test("returns ids of pending and in_progress tasks assigned to the person", () => {
    const tasks = [
      t("a", { status: "pending", assignedPersonIds: ["p1"] }),
      t("b", { status: "in_progress", assignedPersonIds: ["p1"] }),
      t("c", { status: "completed", assignedPersonIds: ["p1"] }),
      t("d", { status: "archived", assignedPersonIds: ["p1"] }),
      t("e", { status: "pending", assignedPersonIds: ["p2"] }),
    ];
    expect(findActiveTaskIdsFor(tasks, "p1")).toEqual(new Set(["a", "b"]));
  });

  test("returns empty set when the person has no active tasks", () => {
    const tasks = [t("a", { status: "completed", assignedPersonIds: ["p1"] })];
    expect(findActiveTaskIdsFor(tasks, "p1")).toEqual(new Set());
  });
});

describe("findSwimlanePersonIds", () => {
  test("returns ids of every person assigned to a non-finished task", () => {
    const tasks = [
      t("a", { status: "pending", assignedPersonIds: ["p1", "p2"] }),
      t("b", { status: "in_progress", assignedPersonIds: ["p3"] }),
      t("c", { status: "completed", assignedPersonIds: ["p4"] }),
      t("d", { status: "archived", assignedPersonIds: ["p5"] }),
    ];
    expect(findSwimlanePersonIds(tasks)).toEqual(new Set(["p1", "p2", "p3"]));
  });

  test("ignores tasks with no assignees", () => {
    const tasks = [t("a", { status: "pending" })];
    expect(findSwimlanePersonIds(tasks)).toEqual(new Set());
  });
});

describe("findBlockerTaskIds", () => {
  test("returns ids of unfinished upstream tasks not assigned to the person", () => {
    // Graph: blocker → mine; blocker is unfinished and not mine → reported.
    const tasks = [
      t("blocker", { status: "pending", assignedPersonIds: ["p2"] }),
      t("mine", { status: "pending", assignedPersonIds: ["p1"] }),
    ];
    const connections: Connection[] = [{ from: "blocker", to: "mine" }];
    const result = findBlockerTaskIds({ tasks, connections, personId: "p1" });
    expect(result).toEqual(new Set(["blocker"]));
  });

  test("excludes blockers that are completed or archived", () => {
    const tasks = [
      t("done", { status: "completed", assignedPersonIds: ["p2"] }),
      t("dropped", { status: "archived", assignedPersonIds: ["p2"] }),
      t("active", { status: "pending", assignedPersonIds: ["p2"] }),
      t("mine", { status: "pending", assignedPersonIds: ["p1"] }),
    ];
    const connections: Connection[] = [
      { from: "done", to: "mine" },
      { from: "dropped", to: "mine" },
      { from: "active", to: "mine" },
    ];
    const result = findBlockerTaskIds({ tasks, connections, personId: "p1" });
    expect(result).toEqual(new Set(["active"]));
  });

  test("excludes blockers also assigned to the same person (not blocking themselves)", () => {
    const tasks = [
      t("ours", { status: "pending", assignedPersonIds: ["p1"] }),
      t("mine", { status: "in_progress", assignedPersonIds: ["p1"] }),
    ];
    const connections: Connection[] = [{ from: "ours", to: "mine" }];
    const result = findBlockerTaskIds({ tasks, connections, personId: "p1" });
    expect(result).toEqual(new Set());
  });

  test("considers blockers across all of a person's active tasks", () => {
    const tasks = [
      t("upstream1", { status: "pending", assignedPersonIds: ["p2"] }),
      t("upstream2", { status: "pending", assignedPersonIds: ["p3"] }),
      t("a", { status: "pending", assignedPersonIds: ["p1"] }),
      t("b", { status: "in_progress", assignedPersonIds: ["p1"] }),
    ];
    const connections: Connection[] = [
      { from: "upstream1", to: "a" },
      { from: "upstream2", to: "b" },
    ];
    const result = findBlockerTaskIds({ tasks, connections, personId: "p1" });
    expect(result).toEqual(new Set(["upstream1", "upstream2"]));
  });

  test("does not double-count a blocker that targets multiple of the person's tasks", () => {
    const tasks = [
      t("blocker", { status: "pending", assignedPersonIds: ["p2"] }),
      t("a", { status: "pending", assignedPersonIds: ["p1"] }),
      t("b", { status: "pending", assignedPersonIds: ["p1"] }),
    ];
    const connections: Connection[] = [
      { from: "blocker", to: "a" },
      { from: "blocker", to: "b" },
    ];
    const result = findBlockerTaskIds({ tasks, connections, personId: "p1" });
    expect(result).toEqual(new Set(["blocker"]));
  });

  test("ignores connections where the target is finished (those tasks aren't waiting)", () => {
    const tasks = [
      t("blocker", { status: "pending", assignedPersonIds: ["p2"] }),
      t("doneTask", { status: "completed", assignedPersonIds: ["p1"] }),
    ];
    const connections: Connection[] = [{ from: "blocker", to: "doneTask" }];
    const result = findBlockerTaskIds({ tasks, connections, personId: "p1" });
    expect(result).toEqual(new Set());
  });
});
