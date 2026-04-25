import { useEffect, useRef, useState } from "react";

interface UseGlobalKeyboardShortcutsArgs {
  onUndo: () => void;
  onRedo: () => void;
  onEscape: () => void;
  onDelete: () => void;
}

export interface UseGlobalKeyboardShortcutsResult {
  /** True while Shift is held — exposed for UI hints (e.g. "shift-drag to connect"). */
  shiftPressed: boolean;
}

/**
 * Window-level keyboard shortcuts for the task editor:
 *   - Cmd/Ctrl+Z          → undo
 *   - Cmd/Ctrl+Shift+Z    → redo
 *   - Cmd/Ctrl+Y          → redo
 *   - Escape              → caller-defined (typically clears selection)
 *   - Delete / Backspace  → caller-defined (typically deletes selected items)
 *
 * Shortcuts are suppressed when focus is inside an input or textarea so
 * typing doesn't trigger commands. Handler refs are kept current internally,
 * so the listener stays bound across re-renders without re-attaching.
 */
export function useGlobalKeyboardShortcuts({
  onUndo,
  onRedo,
  onEscape,
  onDelete,
}: UseGlobalKeyboardShortcutsArgs): UseGlobalKeyboardShortcutsResult {
  const [shiftPressed, setShiftPressed] = useState(false);

  const handlersRef = useRef({ onUndo, onRedo, onEscape, onDelete });
  handlersRef.current = { onUndo, onRedo, onEscape, onDelete };

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === "Shift") setShiftPressed(true);
      if (e.key === "Escape") handlersRef.current.onEscape();
      if (e.key === "Delete" || e.key === "Backspace") handlersRef.current.onDelete();
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        handlersRef.current.onUndo();
      }
      if (cmd && (e.shiftKey ? e.key === "z" : e.key === "y")) {
        e.preventDefault();
        handlersRef.current.onRedo();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return { shiftPressed };
}
