import { fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useGlobalKeyboardShortcuts } from "./useGlobalKeyboardShortcuts";

function makeHandlers() {
  return {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onEscape: vi.fn(),
    onDelete: vi.fn(),
  };
}

describe("useGlobalKeyboardShortcuts", () => {
  test("Cmd/Ctrl+Z calls onUndo", () => {
    const handlers = makeHandlers();
    renderHook(() => useGlobalKeyboardShortcuts(handlers));
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
  });

  test("Cmd/Ctrl+Shift+Z calls onRedo", () => {
    const handlers = makeHandlers();
    renderHook(() => useGlobalKeyboardShortcuts(handlers));
    fireEvent.keyDown(window, { key: "z", metaKey: true, shiftKey: true });
    expect(handlers.onRedo).toHaveBeenCalledTimes(1);
    expect(handlers.onUndo).not.toHaveBeenCalled();
  });

  test("Cmd/Ctrl+Y calls onRedo", () => {
    const handlers = makeHandlers();
    renderHook(() => useGlobalKeyboardShortcuts(handlers));
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(handlers.onRedo).toHaveBeenCalledTimes(1);
  });

  test("Escape calls onEscape", () => {
    const handlers = makeHandlers();
    renderHook(() => useGlobalKeyboardShortcuts(handlers));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
  });

  test("Delete and Backspace call onDelete", () => {
    const handlers = makeHandlers();
    renderHook(() => useGlobalKeyboardShortcuts(handlers));
    fireEvent.keyDown(window, { key: "Delete" });
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(handlers.onDelete).toHaveBeenCalledTimes(2);
  });

  test("ignores keystrokes that originate in input/textarea elements", () => {
    const handlers = makeHandlers();
    renderHook(() => useGlobalKeyboardShortcuts(handlers));
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "Escape", bubbles: true });
    fireEvent.keyDown(input, { key: "Delete", bubbles: true });
    fireEvent.keyDown(input, { key: "z", metaKey: true, bubbles: true });
    expect(handlers.onEscape).not.toHaveBeenCalled();
    expect(handlers.onDelete).not.toHaveBeenCalled();
    expect(handlers.onUndo).not.toHaveBeenCalled();
    input.remove();
  });

  test("tracks shiftPressed via the returned ref", () => {
    const handlers = makeHandlers();
    const { result } = renderHook(() => useGlobalKeyboardShortcuts(handlers));
    expect(result.current.shiftPressed).toBe(false);
    fireEvent.keyDown(window, { key: "Shift" });
    expect(result.current.shiftPressed).toBe(true);
    fireEvent.keyUp(window, { key: "Shift" });
    expect(result.current.shiftPressed).toBe(false);
  });
});
