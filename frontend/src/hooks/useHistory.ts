import { useCallback, useReducer, useRef } from "react";
import type { Connection, Group, Task } from "../domain/tasks/types";

export interface CanvasState {
  tasks: Task[];
  connections: Connection[];
  groups: Group[];
}

/** Snapshot of a single undo or redo step, returned so the caller can react
 *  to the change atomically (e.g. write the new state to a backing store). */
export interface HistoryStep {
  before: CanvasState;
  after: CanvasState;
}

export interface UseHistoryResult {
  present: CanvasState;
  /** Commit a new user action. Adds a new entry to history and becomes the live state. */
  push: (state: CanvasState) => void;
  /** Update the current history entry in place. Use for transient local edits (e.g. drag). */
  replace: (state: CanvasState) => void;
  /**
   * Apply an external state update (e.g. from a remote subscription) without
   * touching user-authored history. Updates the live view; when the user is
   * not viewing a historical state, this also becomes the visible `present`.
   */
  reconcileRemote: (state: CanvasState) => void;
  /** Move one step back. Returns the step taken, or null if already at the oldest entry. */
  undo: () => HistoryStep | null;
  /** Move one step forward. Returns the step taken, or null if already at the newest entry. */
  redo: () => HistoryStep | null;
  /** Hard-reset history with a new baseline (typically on initial load). */
  reset: (state: CanvasState) => void;
  markSaved: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
}

const MAX_HISTORY = 50;

/**
 * In-memory undo/redo history for the canvas, with explicit separation between:
 *   • the user's authored timeline (`historyRef` + `indexRef`), and
 *   • the latest known live state (`liveRef`), which may diverge from the
 *     timeline when the user has undone and is viewing a historical entry.
 *
 * `present` follows whichever is appropriate: the live state at the head of
 * history, or the historical entry the user has rewound to. Remote updates
 * always go through `reconcileRemote`, which is safe to call at any time —
 * it never overwrites a historical slot, so an in-flight remote echo cannot
 * corrupt the undo target.
 */
export function useHistory(initial: CanvasState): UseHistoryResult {
  const historyRef = useRef<CanvasState[]>([initial]);
  const indexRef = useRef(0);
  const savedIndexRef = useRef(0);
  const liveRef = useRef<CanvasState>(initial);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  const push = useCallback((state: CanvasState) => {
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current.push(state);
    indexRef.current++;
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
      indexRef.current--;
      if (savedIndexRef.current > 0) savedIndexRef.current--;
    }
    liveRef.current = state;
    forceRender();
  }, []);

  const replace = useCallback((state: CanvasState) => {
    historyRef.current[indexRef.current] = state;
    liveRef.current = state;
    forceRender();
  }, []);

  const reconcileRemote = useCallback((state: CanvasState) => {
    liveRef.current = state;
    // Only refresh the history slot when the user is at the head of the
    // timeline; otherwise we'd silently overwrite the entry an in-flight
    // undo/redo is about to navigate to.
    const lastIndex = historyRef.current.length - 1;
    if (indexRef.current === lastIndex) {
      historyRef.current[lastIndex] = state;
    }
    forceRender();
  }, []);

  const undo = useCallback((): HistoryStep | null => {
    if (indexRef.current <= 0) return null;
    const before = historyRef.current[indexRef.current];
    const after = historyRef.current[indexRef.current - 1];
    indexRef.current--;
    forceRender();
    return { before, after };
  }, []);

  const redo = useCallback((): HistoryStep | null => {
    if (indexRef.current >= historyRef.current.length - 1) return null;
    const before = historyRef.current[indexRef.current];
    const after = historyRef.current[indexRef.current + 1];
    indexRef.current++;
    // When redo lands back at the head, the live view should reflect the
    // redone state immediately — the remote echo from the resulting sync
    // will catch up shortly, but we don't want a flash of the stale live.
    if (indexRef.current === historyRef.current.length - 1) {
      liveRef.current = after;
    }
    forceRender();
    return { before, after };
  }, []);

  const reset = useCallback((state: CanvasState) => {
    historyRef.current = [state];
    indexRef.current = 0;
    savedIndexRef.current = 0;
    liveRef.current = state;
    forceRender();
  }, []);

  const markSaved = useCallback(() => {
    savedIndexRef.current = indexRef.current;
    forceRender();
  }, []);

  const lastIndex = historyRef.current.length - 1;
  const present =
    indexRef.current < lastIndex ? historyRef.current[indexRef.current] : liveRef.current;
  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < lastIndex;
  const hasUnsavedChanges = indexRef.current !== savedIndexRef.current;

  return {
    present,
    push,
    replace,
    reconcileRemote,
    undo,
    redo,
    reset,
    markSaved,
    canUndo,
    canRedo,
    hasUnsavedChanges,
  };
}
