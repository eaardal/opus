import { describe, expect, test } from "vitest";
import type { Person } from "../teams/types";
import { peopleWithAssignedTasks, tasksAssignedToPerson } from "./assignments";
import type { Task } from "./types";

const person = (id: string, name = id): Person => ({ id, name, picture: null });

const task = (id: string, assignedPersonIds?: string[]): Task => ({
  id,
  text: id,
  x: 0,
  y: 0,
  status: "pending",
  assignedPersonIds,
});

const ALICE = person("alice");
const BOB = person("bob");
const CARLA = person("carla");

describe("peopleWithAssignedTasks", () => {
  test("returns only people assigned to at least one task, sorted by name", () => {
    const people = [CARLA, ALICE, BOB];
    const tasks = [task("t1", ["carla"]), task("t2", ["alice", "bob"])];

    const result = peopleWithAssignedTasks(people, tasks);

    expect(result).toEqual([ALICE, BOB, CARLA]);
  });

  test("sorts names case-insensitively", () => {
    const zoe = person("p1", "Zoe");
    const adam = person("p2", "adam");

    const result = peopleWithAssignedTasks([zoe, adam], [task("t1", ["p1", "p2"])]);

    expect(result.map((p) => p.name)).toEqual(["adam", "Zoe"]);
  });

  test("ignores tasks with no assignees", () => {
    const result = peopleWithAssignedTasks([ALICE], [task("t1"), task("t2", [])]);
    expect(result).toEqual([]);
  });

  test("ignores assignee ids that do not match a known person", () => {
    const result = peopleWithAssignedTasks([ALICE], [task("t1", ["ghost"])]);
    expect(result).toEqual([]);
  });
});

describe("tasksAssignedToPerson", () => {
  test("returns the person's tasks in their original (sequence) order", () => {
    const tasks = [task("t1", ["alice"]), task("t2", ["bob"]), task("t3", ["alice", "bob"])];

    const result = tasksAssignedToPerson(tasks, "alice");

    expect(result.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  test("returns an empty array when the person has no assigned tasks", () => {
    expect(tasksAssignedToPerson([task("t1", ["bob"])], "alice")).toEqual([]);
  });

  test("keeps only tasks in the given status when a status is provided", () => {
    const tasks: Task[] = [
      { id: "t1", text: "t1", x: 0, y: 0, status: "in_progress", assignedPersonIds: ["alice"] },
      { id: "t2", text: "t2", x: 0, y: 0, status: "completed", assignedPersonIds: ["alice"] },
      { id: "t3", text: "t3", x: 0, y: 0, status: "in_progress", assignedPersonIds: ["alice"] },
    ];

    const result = tasksAssignedToPerson(tasks, "alice", "in_progress");

    expect(result.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  test("includes every status when no status filter is given", () => {
    const tasks: Task[] = [
      { id: "t1", text: "t1", x: 0, y: 0, status: "in_progress", assignedPersonIds: ["alice"] },
      { id: "t2", text: "t2", x: 0, y: 0, status: "completed", assignedPersonIds: ["alice"] },
    ];

    expect(tasksAssignedToPerson(tasks, "alice").map((t) => t.id)).toEqual(["t1", "t2"]);
  });
});
