import { describe, expect, test } from "vitest";
import { findOwningGroup, taskPositionInGroupCorner } from "./groupGeometry";
import type { Group, Task } from "./types";

const t = (x: number, y: number, overrides: Partial<Task> = {}): Task => ({
  id: "t",
  text: "",
  x,
  y,
  status: "pending",
  ...overrides,
});

const g = (overrides: Partial<Group> & Pick<Group, "x" | "y" | "width" | "height">): Group => ({
  id: "g",
  title: "",
  ...overrides,
});

describe("findOwningGroup", () => {
  test("returns the group containing the task", () => {
    const groups = [g({ id: "outer", x: 0, y: 0, width: 100, height: 100 })];
    expect(findOwningGroup(t(50, 50), groups)?.id).toBe("outer");
  });

  test("returns null when no group contains the task", () => {
    const groups = [g({ id: "outer", x: 0, y: 0, width: 100, height: 100 })];
    expect(findOwningGroup(t(200, 200), groups)).toBeNull();
  });

  test("treats group edges as inclusive", () => {
    const groups = [g({ id: "edge", x: 0, y: 0, width: 100, height: 100 })];
    expect(findOwningGroup(t(0, 0), groups)?.id).toBe("edge");
    expect(findOwningGroup(t(100, 100), groups)?.id).toBe("edge");
  });

  test("returns the first matching group when groups overlap", () => {
    const groups = [
      g({ id: "first", x: 0, y: 0, width: 100, height: 100 }),
      g({ id: "second", x: 0, y: 0, width: 200, height: 200 }),
    ];
    expect(findOwningGroup(t(50, 50), groups)?.id).toBe("first");
  });
});

describe("taskPositionInGroupCorner", () => {
  test("insets the position from the group's top-left corner", () => {
    const group = g({ id: "x", x: 100, y: 200, width: 300, height: 250 });
    expect(taskPositionInGroupCorner(group)).toEqual({ x: 155, y: 275 });
  });

  test("returns a point that the group geometrically contains", () => {
    const group = g({ id: "x", x: 100, y: 200, width: 300, height: 250 });
    const { x, y } = taskPositionInGroupCorner(group);
    expect(findOwningGroup(t(x, y), [group])?.id).toBe("x");
  });

  test("clamps inside groups smaller than the inset so membership still holds", () => {
    const group = g({ id: "tiny", x: 0, y: 0, width: 10, height: 10 });
    const { x, y } = taskPositionInGroupCorner(group);
    expect(x).toBeLessThanOrEqual(10);
    expect(y).toBeLessThanOrEqual(10);
    expect(findOwningGroup(t(x, y), [group])?.id).toBe("tiny");
  });
});
