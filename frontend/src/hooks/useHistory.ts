import { useCallback, useReducer, useRef } from "react";
import type { Connection, Group, Task } from "../domain/tasks/types";

export interface CanvasState {
  tasks: Task[];
  connections: Connection[];
  groups: Group[];
}

export interface UseHistoryResult {
  present: CanvasState;
  push: (state: CanvasState) => void;
  replace: (state: CanvasState) => void;
  undo: () => void;
  redo: () => void;
  reset: (state: CanvasState) => void;
  markSaved: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
}

const MAX_HISTORY = 50;

export function useHistory(initial: CanvasState): UseHistoryResult {
  const historyRef = useRef<CanvasState[]>([initial]);
  const indexRef = useRef(0);
  const savedIndexRef = useRef(0);
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
    forceRender();
  }, []);

  const replace = useCallback((state: CanvasState) => {
    historyRef.current[indexRef.current] = state;
    forceRender();
  }, []);

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    indexRef.current--;
    forceRender();
  }, []);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    indexRef.current++;
    forceRender();
  }, []);

  const reset = useCallback((state: CanvasState) => {
    historyRef.current = [state];
    indexRef.current = 0;
    savedIndexRef.current = 0;
    forceRender();
  }, []);

  const markSaved = useCallback(() => {
    savedIndexRef.current = indexRef.current;
    forceRender();
  }, []);

  const present = historyRef.current[indexRef.current];
  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;
  const hasUnsavedChanges = indexRef.current !== savedIndexRef.current;

  return {
    present,
    push,
    replace,
    undo,
    redo,
    reset,
    markSaved,
    canUndo,
    canRedo,
    hasUnsavedChanges,
  };
}
