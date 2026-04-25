import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { Connection, Group, Task, TaskGraphState } from "../domain/tasks/types";
import { useHistory } from "./useHistory";

const t = (id: string): Task => ({ id, text: id, x: 0, y: 0, status: "pending" });
const g = (id: string): Group => ({ id, title: id, x: 0, y: 0, width: 10, height: 10 });
const c = (from: string, to: string): Connection => ({ from, to });

const initial: TaskGraphState = { tasks: [], connections: [], groups: [] };

describe("useHistory", () => {
  test("starts with the initial state, no undo or redo available", () => {
    const { result } = renderHook(() => useHistory(initial));
    expect(result.current.present).toEqual(initial);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  test("push adds a new entry and enables undo", () => {
    const { result } = renderHook(() => useHistory(initial));
    const next: TaskGraphState = { tasks: [t("a")], connections: [], groups: [] };
    act(() => result.current.push(next));
    expect(result.current.present).toEqual(next);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  test("undo and redo move between adjacent entries", () => {
    const { result } = renderHook(() => useHistory(initial));
    const a: TaskGraphState = { tasks: [t("a")], connections: [], groups: [] };
    const b: TaskGraphState = { tasks: [t("a"), t("b")], connections: [], groups: [] };
    act(() => result.current.push(a));
    act(() => result.current.push(b));
    expect(result.current.present).toEqual(b);

    act(() => result.current.undo());
    expect(result.current.present).toEqual(a);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.present).toEqual(initial);

    act(() => result.current.redo());
    expect(result.current.present).toEqual(a);
  });

  test("pushing after undo discards the redo branch", () => {
    const { result } = renderHook(() => useHistory(initial));
    const a: TaskGraphState = { tasks: [t("a")], connections: [], groups: [] };
    const b: TaskGraphState = { tasks: [t("b")], connections: [], groups: [] };
    const c: TaskGraphState = { tasks: [t("c")], connections: [], groups: [] };
    act(() => result.current.push(a));
    act(() => result.current.push(b));
    act(() => result.current.undo()); // present = a, redo back to b
    act(() => result.current.push(c)); // overwrites b with c

    expect(result.current.present).toEqual(c);
    expect(result.current.canRedo).toBe(false); // b is gone
  });

  test("replace overwrites the current entry without pushing a new one", () => {
    const { result } = renderHook(() => useHistory(initial));
    const a: TaskGraphState = { tasks: [t("a")], connections: [], groups: [] };
    const aMoved: TaskGraphState = { tasks: [{ ...t("a"), x: 5 }], connections: [], groups: [] };
    act(() => result.current.push(a));
    act(() => result.current.replace(aMoved));
    expect(result.current.present).toEqual(aMoved);
    // Undo goes back to initial — the in-place edit was a single history step.
    act(() => result.current.undo());
    expect(result.current.present).toEqual(initial);
  });

  test("reset wipes history and uses the given state as the new baseline", () => {
    const { result } = renderHook(() => useHistory(initial));
    const a: TaskGraphState = { tasks: [t("a")], connections: [], groups: [] };
    act(() => result.current.push(a));
    expect(result.current.canUndo).toBe(true);

    const fresh: TaskGraphState = {
      tasks: [t("x"), t("y")],
      connections: [c("x", "y")],
      groups: [g("g1")],
    };
    act(() => result.current.reset(fresh));
    expect(result.current.present).toEqual(fresh);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  test("markSaved clears hasUnsavedChanges; pushing again re-marks it", () => {
    const { result } = renderHook(() => useHistory(initial));
    act(() => result.current.push({ tasks: [t("a")], connections: [], groups: [] }));
    expect(result.current.hasUnsavedChanges).toBe(true);
    act(() => result.current.markSaved());
    expect(result.current.hasUnsavedChanges).toBe(false);
    act(() => result.current.push({ tasks: [t("a"), t("b")], connections: [], groups: [] }));
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  test("history is bounded — pushing more than the limit drops the oldest entry", () => {
    // The component sets MAX_HISTORY = 50 internally. Push past that and verify
    // we cannot undo all the way back to the original baseline.
    const { result } = renderHook(() => useHistory(initial));
    for (let i = 0; i < 60; i++) {
      const state: TaskGraphState = {
        tasks: [{ ...t("a"), x: i }],
        connections: [],
        groups: [],
      };
      act(() => result.current.push(state));
    }
    // Undo as far as we can. We should NOT reach the empty initial state.
    while (result.current.canUndo) {
      act(() => result.current.undo());
    }
    expect(result.current.present.tasks.length).toBe(1);
    expect(result.current.present).not.toEqual(initial);
  });
});
