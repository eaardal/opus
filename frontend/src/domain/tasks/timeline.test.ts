import { describe, expect, test } from "vitest";
import {
  backfillTracking,
  backfillUpdate,
  needsBackfill,
  personInProgressMs,
  recordAssignment,
  recordStatusChange,
  tasksWithInProgressHistory,
  totalInProgressMs,
} from "./timeline";
import type { Task } from "./types";

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  text: "t1",
  x: 0,
  y: 0,
  status: "pending",
  ...overrides,
});

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("recordStatusChange", () => {
  test("opens a new interval when entering in_progress", () => {
    const result = recordStatusChange(task(), "in_progress", 1000);
    expect(result.status).toBe("in_progress");
    expect(result.inProgressIntervals).toEqual([{ start: 1000, end: null }]);
  });

  test("does not open a second interval if one is already open", () => {
    const t = task({ status: "in_progress", inProgressIntervals: [{ start: 1000, end: null }] });
    const result = recordStatusChange(t, "in_progress", 5000);
    expect(result.inProgressIntervals).toEqual([{ start: 1000, end: null }]);
  });

  test("closes the open interval and records the status it changed to", () => {
    const t = task({ status: "in_progress", inProgressIntervals: [{ start: 1000, end: null }] });
    const result = recordStatusChange(t, "pending", 5000);
    expect(result.status).toBe("pending");
    expect(result.inProgressIntervals).toEqual([{ start: 1000, end: 5000, endStatus: "pending" }]);
  });

  test("records 'completed' as the end status when finishing a task", () => {
    const t = task({ status: "in_progress", inProgressIntervals: [{ start: 1000, end: null }] });
    const result = recordStatusChange(t, "completed", 5000);
    expect(result.inProgressIntervals).toEqual([
      { start: 1000, end: 5000, endStatus: "completed" },
    ]);
  });

  test("re-entering in_progress after closing adds another interval", () => {
    const t = task({ status: "pending", inProgressIntervals: [{ start: 1000, end: 5000 }] });
    const result = recordStatusChange(t, "in_progress", 8000);
    expect(result.inProgressIntervals).toEqual([
      { start: 1000, end: 5000 },
      { start: 8000, end: null },
    ]);
  });

  test("leaving a status that was never in_progress leaves intervals untouched", () => {
    const result = recordStatusChange(task({ status: "pending" }), "completed", 5000);
    expect(result.inProgressIntervals ?? []).toEqual([]);
  });
});

describe("recordAssignment", () => {
  test("stamps newly assigned people with the current time", () => {
    const result = recordAssignment(task(), ["alice"], 1000);
    expect(result.assignedPersonIds).toEqual(["alice"]);
    expect(result.assignedAt).toEqual({ alice: 1000 });
  });

  test("keeps the original time for people who stay assigned", () => {
    const t = task({ assignedPersonIds: ["alice"], assignedAt: { alice: 1000 } });
    const result = recordAssignment(t, ["alice", "bob"], 5000);
    expect(result.assignedAt).toEqual({ alice: 1000, bob: 5000 });
  });

  test("drops the timestamp for people who are unassigned", () => {
    const t = task({ assignedPersonIds: ["alice", "bob"], assignedAt: { alice: 1000, bob: 2000 } });
    const result = recordAssignment(t, ["bob"], 5000);
    expect(result.assignedPersonIds).toEqual(["bob"]);
    expect(result.assignedAt).toEqual({ bob: 2000 });
  });
});

describe("totalInProgressMs", () => {
  test("sums closed intervals", () => {
    const t = task({
      inProgressIntervals: [
        { start: 0, end: 2 * HOUR },
        { start: 3 * HOUR, end: 4 * HOUR },
      ],
    });
    expect(totalInProgressMs(t, 10 * HOUR)).toBe(3 * HOUR);
  });

  test("counts the open interval up to now", () => {
    const t = task({ inProgressIntervals: [{ start: HOUR, end: null }] });
    expect(totalInProgressMs(t, 3 * HOUR)).toBe(2 * HOUR);
  });

  test("is zero with no intervals", () => {
    expect(totalInProgressMs(task(), 1000)).toBe(0);
  });
});

describe("personInProgressMs (overlap of in-progress with assignment)", () => {
  test("counts only the part of in-progress time after the person was assigned", () => {
    // In progress [0, 4h]; Alice assigned at 1h → overlap 3h.
    const t = task({
      inProgressIntervals: [{ start: 0, end: 4 * HOUR }],
      assignedPersonIds: ["alice"],
      assignedAt: { alice: HOUR },
    });
    expect(personInProgressMs(t, "alice", 10 * HOUR)).toBe(3 * HOUR);
  });

  test("counts the whole interval when assigned before it started", () => {
    const t = task({
      inProgressIntervals: [{ start: 2 * HOUR, end: 5 * HOUR }],
      assignedPersonIds: ["alice"],
      assignedAt: { alice: HOUR },
    });
    expect(personInProgressMs(t, "alice", 10 * HOUR)).toBe(3 * HOUR);
  });

  test("counts the open interval up to now", () => {
    const t = task({
      inProgressIntervals: [{ start: HOUR, end: null }],
      assignedPersonIds: ["alice"],
      assignedAt: { alice: 2 * HOUR },
    });
    expect(personInProgressMs(t, "alice", 5 * HOUR)).toBe(3 * HOUR);
  });

  test("is zero when assigned after all in-progress time", () => {
    const t = task({
      inProgressIntervals: [{ start: 0, end: 2 * HOUR }],
      assignedPersonIds: ["alice"],
      assignedAt: { alice: 5 * HOUR },
    });
    expect(personInProgressMs(t, "alice", 10 * HOUR)).toBe(0);
  });

  test("is zero for a person who is not assigned", () => {
    const t = task({ inProgressIntervals: [{ start: 0, end: 2 * HOUR }] });
    expect(personInProgressMs(t, "ghost", 10 * HOUR)).toBe(0);
  });
});

describe("needsBackfill / backfillTracking", () => {
  test("opens an interval for an in_progress task that has none", () => {
    const t = task({ status: "in_progress" });
    expect(needsBackfill(t)).toBe(true);
    const result = backfillTracking(t, 1000);
    expect(result.inProgressIntervals).toEqual([{ start: 1000, end: null }]);
  });

  test("stamps assigned people who have no assignment time", () => {
    const t = task({ status: "pending", assignedPersonIds: ["alice"] });
    expect(needsBackfill(t)).toBe(true);
    const result = backfillTracking(t, 1000);
    expect(result.assignedAt).toEqual({ alice: 1000 });
  });

  test("leaves a fully-tracked task unchanged", () => {
    const t = task({
      status: "in_progress",
      inProgressIntervals: [{ start: 1, end: null }],
      assignedPersonIds: ["alice"],
      assignedAt: { alice: 1 },
    });
    expect(needsBackfill(t)).toBe(false);
    expect(backfillTracking(t, 1000)).toBe(t);
  });

  test("does not open an interval for a task that is not in_progress", () => {
    const t = task({ status: "pending" });
    expect(needsBackfill(t)).toBe(false);
    expect(backfillTracking(t, 1000).inProgressIntervals ?? []).toEqual([]);
  });
});

describe("backfillUpdate (persist payload)", () => {
  test("returns an opening interval for an in_progress task with none", () => {
    expect(backfillUpdate(task({ status: "in_progress" }), 1000)).toEqual({
      inProgressIntervals: [{ start: 1000, end: null }],
    });
  });

  test("returns assignment times for assigned people who lack them", () => {
    const result = backfillUpdate(task({ status: "pending", assignedPersonIds: ["alice"] }), 1000);
    expect(result).toEqual({ assignedAt: { alice: 1000 } });
  });

  test("fills both fields when a task needs both", () => {
    const result = backfillUpdate(
      task({ status: "in_progress", assignedPersonIds: ["alice"] }),
      1000,
    );
    expect(result).toEqual({
      inProgressIntervals: [{ start: 1000, end: null }],
      assignedAt: { alice: 1000 },
    });
  });

  test("returns null when nothing needs backfilling", () => {
    const t = task({
      status: "in_progress",
      inProgressIntervals: [{ start: 1, end: null }],
      assignedPersonIds: ["alice"],
      assignedAt: { alice: 1 },
    });
    expect(backfillUpdate(t, 1000)).toBeNull();
  });
});

describe("tasksWithInProgressHistory", () => {
  test("keeps tasks that have ever been in progress, regardless of current status", () => {
    const a = task({ id: "a", inProgressIntervals: [{ start: 0, end: 1 }] });
    const b = task({
      id: "b",
      status: "in_progress",
      inProgressIntervals: [{ start: 0, end: null }],
    });
    const c = task({ id: "c", status: "pending" });
    expect(tasksWithInProgressHistory([a, b, c]).map((t) => t.id)).toEqual(["a", "b"]);
  });
});
