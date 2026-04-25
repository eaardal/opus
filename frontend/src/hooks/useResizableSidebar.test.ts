import { act, fireEvent, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useResizableSidebar } from "./useResizableSidebar";

describe("useResizableSidebar", () => {
  test("starts at the initial width", () => {
    const { result } = renderHook(() =>
      useResizableSidebar({ initialWidth: 350, minWidth: 200, maxWidth: 600 }),
    );
    expect(result.current.width).toBe(350);
    expect(result.current.isResizing).toBe(false);
  });

  test("startResize sets isResizing and a mousemove updates the width within the clamp", () => {
    const { result } = renderHook(() =>
      useResizableSidebar({ initialWidth: 350, minWidth: 200, maxWidth: 600 }),
    );
    const fakeMouseDown = {
      preventDefault: () => {},
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.startResize(fakeMouseDown);
    });
    expect(result.current.isResizing).toBe(true);

    act(() => {
      fireEvent.mouseMove(document, { clientX: 420 });
    });
    expect(result.current.width).toBe(420);
  });

  test("clamps the width to minWidth and maxWidth", () => {
    const { result } = renderHook(() =>
      useResizableSidebar({ initialWidth: 350, minWidth: 200, maxWidth: 600 }),
    );
    act(() => {
      result.current.startResize({ preventDefault: () => {} } as unknown as React.MouseEvent);
    });
    act(() => {
      fireEvent.mouseMove(document, { clientX: 50 });
    });
    expect(result.current.width).toBe(200);

    act(() => {
      fireEvent.mouseMove(document, { clientX: 1000 });
    });
    expect(result.current.width).toBe(600);
  });

  test("mouseup clears isResizing", () => {
    const { result } = renderHook(() =>
      useResizableSidebar({ initialWidth: 350, minWidth: 200, maxWidth: 600 }),
    );
    act(() => {
      result.current.startResize({ preventDefault: () => {} } as unknown as React.MouseEvent);
    });
    expect(result.current.isResizing).toBe(true);
    act(() => {
      fireEvent.mouseUp(document);
    });
    expect(result.current.isResizing).toBe(false);
  });
});
