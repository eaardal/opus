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
  test("returns only people assigned to at least one task, in the original order", () => {
    const people = [ALICE, BOB, CARLA];
    const tasks = [task("t1", ["bob"]), task("t2", ["alice", "bob"])];

    const result = peopleWithAssignedTasks(people, tasks);

    expect(result).toEqual([ALICE, BOB]);
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
});
