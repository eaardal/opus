import { describe, expect, test } from "vitest";
import { classifyLinkNavigation, isLinkTask, linkTargetExistsIn, parseLinkTarget } from "./link";
import type { Group, LinkTarget, Task } from "./types";

const task = (id: string, type?: Task["type"]): Task => ({
  id,
  text: id,
  x: 0,
  y: 0,
  status: "pending",
  type,
});

const group = (id: string): Group => ({ id, title: id, x: 0, y: 0, width: 10, height: 10 });

describe("isLinkTask", () => {
  test("is true only when type is 'link'", () => {
    expect(isLinkTask(task("a", "link"))).toBe(true);
    expect(isLinkTask(task("a", "standard"))).toBe(false);
    expect(isLinkTask(task("a"))).toBe(false);
  });
});

describe("classifyLinkNavigation", () => {
  const active = "proj-active";

  test("project target → activate the project", () => {
    const target: LinkTarget = { kind: "project", projectId: "proj-x" };
    expect(classifyLinkNavigation(target, active)).toEqual({
      kind: "activateProject",
      projectId: "proj-x",
    });
  });

  test("task target in the active project → same-project task", () => {
    const target: LinkTarget = { kind: "task", projectId: active, taskId: "t1" };
    expect(classifyLinkNavigation(target, active)).toEqual({
      kind: "sameProjectTask",
      taskId: "t1",
    });
  });

  test("task target in another project → cross-project task", () => {
    const target: LinkTarget = { kind: "task", projectId: "proj-other", taskId: "t1" };
    expect(classifyLinkNavigation(target, active)).toEqual({
      kind: "crossProjectTask",
      projectId: "proj-other",
      taskId: "t1",
    });
  });

  test("group target in the active project → same-project group", () => {
    const target: LinkTarget = { kind: "group", projectId: active, groupId: "g1" };
    expect(classifyLinkNavigation(target, active)).toEqual({
      kind: "sameProjectGroup",
      groupId: "g1",
    });
  });

  test("group target in another project → cross-project group", () => {
    const target: LinkTarget = { kind: "group", projectId: "proj-other", groupId: "g1" };
    expect(classifyLinkNavigation(target, active)).toEqual({
      kind: "crossProjectGroup",
      projectId: "proj-other",
      groupId: "g1",
    });
  });
});

describe("linkTargetExistsIn", () => {
  const content = { tasks: [task("t1"), task("t2")], groups: [group("g1")] };

  test("task target exists when the task is present", () => {
    expect(linkTargetExistsIn({ kind: "task", projectId: "p", taskId: "t2" }, content)).toBe(true);
  });

  test("task target is missing when the task is gone", () => {
    expect(linkTargetExistsIn({ kind: "task", projectId: "p", taskId: "gone" }, content)).toBe(
      false,
    );
  });

  test("group target exists when the group is present", () => {
    expect(linkTargetExistsIn({ kind: "group", projectId: "p", groupId: "g1" }, content)).toBe(
      true,
    );
  });

  test("group target is missing when the group is gone", () => {
    expect(linkTargetExistsIn({ kind: "group", projectId: "p", groupId: "gone" }, content)).toBe(
      false,
    );
  });

  test("project targets are not validated against content (checked against summaries)", () => {
    expect(linkTargetExistsIn({ kind: "project", projectId: "p" }, content)).toBe(false);
  });
});

describe("parseLinkTarget", () => {
  test("parses a well-formed project target", () => {
    expect(parseLinkTarget({ kind: "project", projectId: "p1" })).toEqual({
      kind: "project",
      projectId: "p1",
    });
  });

  test("parses a well-formed task target", () => {
    expect(parseLinkTarget({ kind: "task", projectId: "p1", taskId: "t1" })).toEqual({
      kind: "task",
      projectId: "p1",
      taskId: "t1",
    });
  });

  test("parses a well-formed group target", () => {
    expect(parseLinkTarget({ kind: "group", projectId: "p1", groupId: "g1" })).toEqual({
      kind: "group",
      projectId: "p1",
      groupId: "g1",
    });
  });

  test("drops extra fields, keeping only the target shape", () => {
    expect(parseLinkTarget({ kind: "task", projectId: "p1", taskId: "t1", junk: 1 })).toEqual({
      kind: "task",
      projectId: "p1",
      taskId: "t1",
    });
  });

  test("returns undefined for malformed or missing data", () => {
    expect(parseLinkTarget(undefined)).toBeUndefined();
    expect(parseLinkTarget(null)).toBeUndefined();
    expect(parseLinkTarget("nope")).toBeUndefined();
    expect(parseLinkTarget({ kind: "task", projectId: "p1" })).toBeUndefined(); // no taskId
    expect(parseLinkTarget({ kind: "group", projectId: "p1" })).toBeUndefined(); // no groupId
    expect(parseLinkTarget({ kind: "project" })).toBeUndefined(); // no projectId
    expect(parseLinkTarget({ kind: "bogus", projectId: "p1" })).toBeUndefined();
  });
});
