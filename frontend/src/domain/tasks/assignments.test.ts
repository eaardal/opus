import { describe, expect, test } from "vitest";
import type { Person } from "../teams/types";
import {
  hasTasksWithAssignedPeople,
  orderPeopleByAssignment,
  peopleWithAssignedTasks,
  peopleWithSwimlanes,
  taskCountsByPerson,
  tasksAssignedToPerson,
} from "./assignments";
import type { Task, TaskStatus } from "./types";

const person = (id: string, name = id): Person => ({ id, name, picture: null });

const task = (id: string, assignedPersonIds?: string[]): Task => ({
  id,
  text: id,
  x: 0,
  y: 0,
  status: "pending",
  assignedPersonIds,
});

const taskWith = (id: string, status: TaskStatus, assignedPersonIds: string[]): Task => ({
  id,
  text: id,
  x: 0,
  y: 0,
  status,
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

describe("peopleWithSwimlanes", () => {
  test("returns only people with at least one active task, sorted by name", () => {
    const people = [CARLA, ALICE, BOB];
    const tasks = [task("t1", ["carla"]), task("t2", ["alice", "bob"])];

    const result = peopleWithSwimlanes(people, tasks);

    expect(result).toEqual([ALICE, BOB, CARLA]);
  });

  test("orders by name regardless of which task was assigned first", () => {
    // Assignment order (carla, then bob) must not leak into swimlane order.
    const people = [ALICE, BOB, CARLA];
    const assignedCarlaFirst = [task("t1", ["carla"]), task("t2", ["bob"]), task("t3", ["alice"])];
    const assignedBobFirst = [task("t1", ["bob"]), task("t2", ["carla"]), task("t3", ["alice"])];

    const fromCarlaFirst = peopleWithSwimlanes(people, assignedCarlaFirst);
    const fromBobFirst = peopleWithSwimlanes(people, assignedBobFirst);

    expect(fromCarlaFirst.map((p) => p.id)).toEqual(["alice", "bob", "carla"]);
    expect(fromBobFirst.map((p) => p.id)).toEqual(["alice", "bob", "carla"]);
  });

  test("sorts names case-insensitively", () => {
    const zoe = person("p1", "Zoe");
    const adam = person("p2", "adam");

    const result = peopleWithSwimlanes([zoe, adam], [task("t1", ["p1", "p2"])]);

    expect(result.map((p) => p.name)).toEqual(["adam", "Zoe"]);
  });

  test("excludes people whose only tasks are completed or archived", () => {
    const tasks = [
      taskWith("t1", "completed", ["alice"]),
      taskWith("t2", "archived", ["bob"]),
      taskWith("t3", "in_progress", ["carla"]),
    ];

    const result = peopleWithSwimlanes([ALICE, BOB, CARLA], tasks);

    expect(result).toEqual([CARLA]);
  });

  test("ignores assignee ids that do not match a known person", () => {
    const result = peopleWithSwimlanes([ALICE], [task("t1", ["ghost"])]);
    expect(result).toEqual([]);
  });

  test("does not mutate the input people array", () => {
    const list = [CARLA, ALICE, BOB];
    peopleWithSwimlanes(list, [task("t1", ["alice", "bob", "carla"])]);
    expect(list).toEqual([CARLA, ALICE, BOB]);
  });
});

describe("hasTasksWithAssignedPeople", () => {
  test("returns true when at least one task has an assigned person", () => {
    expect(hasTasksWithAssignedPeople([task("t1"), task("t2", ["alice"])])).toBe(true);
  });

  test("returns false when no task has an assigned person", () => {
    expect(hasTasksWithAssignedPeople([task("t1"), task("t2", [])])).toBe(false);
  });

  test("returns false for an empty task list", () => {
    expect(hasTasksWithAssignedPeople([])).toBe(false);
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

describe("taskCountsByPerson", () => {
  test("counts each person's assigned tasks, mapping people with none to 0", () => {
    const tasks = [task("t1", ["alice"]), task("t2", ["alice", "bob"])];

    const result = taskCountsByPerson(tasks, [ALICE, BOB, CARLA]);

    expect(result).toEqual({ alice: 2, bob: 1, carla: 0 });
  });

  test("counts only tasks in the given status when a status is provided", () => {
    const tasks: Task[] = [
      { id: "t1", text: "t1", x: 0, y: 0, status: "in_progress", assignedPersonIds: ["alice"] },
      { id: "t2", text: "t2", x: 0, y: 0, status: "completed", assignedPersonIds: ["alice"] },
      { id: "t3", text: "t3", x: 0, y: 0, status: "in_progress", assignedPersonIds: ["bob"] },
    ];

    const result = taskCountsByPerson(tasks, [ALICE, BOB], "in_progress");

    expect(result).toEqual({ alice: 1, bob: 1 });
  });
});

describe("orderPeopleByAssignment", () => {
  test("lists assigned people first, each group sorted alphabetically (case-insensitive)", () => {
    const zoe = person("z", "Zoe");
    const adam = person("a", "adam");
    const mia = person("m", "Mia");
    const bob = person("b", "Bob");

    const result = orderPeopleByAssignment([zoe, adam, mia, bob], new Set(["z", "b"]));

    // assigned (Bob, Zoe) alphabetically, then unassigned (adam, Mia) alphabetically
    expect(result.map((p) => p.id)).toEqual(["b", "z", "a", "m"]);
  });

  test("returns everyone alphabetically when no one is assigned", () => {
    const result = orderPeopleByAssignment([person("z", "Zoe"), person("a", "adam")], new Set());
    expect(result.map((p) => p.id)).toEqual(["a", "z"]);
  });

  test("does not mutate the input array", () => {
    const list = [person("z", "Zoe"), person("a", "adam")];
    orderPeopleByAssignment(list, new Set());
    expect(list.map((p) => p.id)).toEqual(["z", "a"]);
  });
});
