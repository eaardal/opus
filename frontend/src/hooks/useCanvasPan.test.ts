import { act, renderHook } from "@testing-library/react";
import { type RefObject, useRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ViewBox } from "../domain/tasks/types";
import { useCanvasPan } from "./useCanvasPan";

interface MockSvgOptions {
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

/**
 * Build a mock SVG element that exposes the parts useCanvasPan touches:
 * addEventListener / removeEventListener and getBoundingClientRect.
 * Listeners registered on it are kept in a map so tests can dispatch them.
 */
function makeMockSvg({ width = 1000, height = 800, left = 0, top = 0 }: MockSvgOptions = {}) {
  const listeners: Record<string, EventListener[]> = {};
  return {
    addEventListener: vi.fn((type: string, fn: EventListener) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: EventListener) => {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== fn);
    }),
    getBoundingClientRect: () => ({
      width,
      height,
      left,
      top,
      right: left + width,
      bottom: top + height,
    }),
    /** Test helper — fire a registered listener. */
    fire(type: string, event: Event) {
      for (const fn of listeners[type] ?? []) fn(event);
    },
  } as unknown as SVGSVGElement & { fire: (type: string, event: Event) => void };
}

const VIEWBOX: ViewBox = { x: 0, y: 0, width: 1000, height: 800 };

interface RenderArgs {
  viewBox?: ViewBox;
  svg?: ReturnType<typeof makeMockSvg> | null;
}

function renderCanvasPan({ viewBox = VIEWBOX, svg = makeMockSvg() }: RenderArgs = {}) {
  const onViewBoxChange = vi.fn<[ViewBox], void>();
  const result = renderHook(() => {
    // Use useRef so the ref identity stays stable across renders.
    const svgRef = useRef(svg) as RefObject<SVGSVGElement | null>;
    return useCanvasPan({ svgRef, viewBox, onViewBoxChange, scrollToPan: true });
  });
  return { ...result, onViewBoxChange, svg };
}

const mouseEvent = (overrides: Partial<MouseEvent> = {}) =>
  ({
    button: 0,
    clientX: 0,
    clientY: 0,
    preventDefault: vi.fn(),
    ...overrides,
  }) as unknown as React.MouseEvent;

const wheelEvent = (overrides: Partial<WheelEvent> = {}) =>
  ({
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    clientX: 0,
    clientY: 0,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  }) as unknown as WheelEvent;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("space-bar tracking", () => {
  test("panMode becomes true while Space is held and clears on keyup", () => {
    const { result } = renderCanvasPan();
    expect(result.current.panMode).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });
    expect(result.current.panMode).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    });
    expect(result.current.panMode).toBe(false);
  });

  test("ignores Space presses originating from input fields", () => {
    const { result } = renderCanvasPan();
    const input = document.createElement("input");
    document.body.appendChild(input);

    act(() => {
      input.dispatchEvent(
        Object.assign(new KeyboardEvent("keydown", { code: "Space", bubbles: true }), {}),
      );
    });
    expect(result.current.panMode).toBe(false);

    input.remove();
  });
});

describe("tryStartPan", () => {
  test("starts a pan on middle-mouse-button press and returns true", () => {
    const { result } = renderCanvasPan();
    let consumed = false;
    act(() => {
      consumed = result.current.tryStartPan(mouseEvent({ button: 1, clientX: 50, clientY: 30 }));
    });
    expect(consumed).toBe(true);
    expect(result.current.panning).toMatchObject({ startX: 50, startY: 30, origVx: 0, origVy: 0 });
  });

  test("starts a pan when space is held and left button is pressed", () => {
    const { result } = renderCanvasPan();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    });
    let consumed = false;
    act(() => {
      consumed = result.current.tryStartPan(mouseEvent({ button: 0, clientX: 10, clientY: 10 }));
    });
    expect(consumed).toBe(true);
    expect(result.current.panning).not.toBeNull();
  });

  test("does not consume a plain left-click when space is not held", () => {
    const { result } = renderCanvasPan();
    let consumed = true;
    act(() => {
      consumed = result.current.tryStartPan(mouseEvent({ button: 0 }));
    });
    expect(consumed).toBe(false);
    expect(result.current.panning).toBeNull();
  });
});

describe("tryUpdatePan", () => {
  test("translates the viewBox by the mouse delta scaled to viewBox units", () => {
    const { result, onViewBoxChange } = renderCanvasPan({
      viewBox: { x: 100, y: 50, width: 1000, height: 800 },
    });
    act(() => {
      result.current.tryStartPan(mouseEvent({ button: 1, clientX: 100, clientY: 100 }));
    });
    act(() => {
      result.current.tryUpdatePan(mouseEvent({ clientX: 150, clientY: 130 }));
    });
    // viewBox.width === rect.width (1000) so scale is 1; deltas become viewBox units.
    expect(onViewBoxChange).toHaveBeenCalledWith({
      x: 100 - 50,
      y: 50 - 30,
      width: 1000,
      height: 800,
    });
  });

  test("returns false when no pan is in progress", () => {
    const { result } = renderCanvasPan();
    let consumed = true;
    act(() => {
      consumed = result.current.tryUpdatePan(mouseEvent({ clientX: 50, clientY: 50 }));
    });
    expect(consumed).toBe(false);
  });
});

describe("wheel zoom", () => {
  // A zoom changes the viewBox dimensions (width/height); a pan only translates
  // x/y. Asserting on which of those changed keeps these tests independent of the
  // exact zoom-factor math, which is covered in viewport.test.ts.
  test("zooms when Ctrl is held with the wheel", () => {
    const svg = makeMockSvg();
    const { onViewBoxChange } = renderCanvasPan({ svg });
    act(() => {
      svg.fire("wheel", wheelEvent({ ctrlKey: true, deltaY: 100, clientX: 500, clientY: 400 }));
    });
    expect(onViewBoxChange).toHaveBeenCalledTimes(1);
    expect(onViewBoxChange.mock.calls[0][0].width).not.toBe(VIEWBOX.width);
  });

  test("zooms when Cmd/Meta is held with the wheel", () => {
    const svg = makeMockSvg();
    const { onViewBoxChange } = renderCanvasPan({ svg });
    act(() => {
      svg.fire("wheel", wheelEvent({ metaKey: true, deltaY: 100, clientX: 500, clientY: 400 }));
    });
    expect(onViewBoxChange).toHaveBeenCalledTimes(1);
    expect(onViewBoxChange.mock.calls[0][0].width).not.toBe(VIEWBOX.width);
  });

  test("pans (does not zoom) on a plain wheel when scrollToPan is on", () => {
    const svg = makeMockSvg();
    const { onViewBoxChange } = renderCanvasPan({ svg });
    act(() => {
      svg.fire("wheel", wheelEvent({ deltaX: 20, deltaY: 30 }));
    });
    expect(onViewBoxChange).toHaveBeenCalledTimes(1);
    // scale is 1 (viewBox.width === rect.width), so deltas map straight to x/y.
    expect(onViewBoxChange).toHaveBeenCalledWith({ x: 20, y: 30, width: 1000, height: 800 });
  });
});

describe("tryEndPan", () => {
  test("ends an active pan and returns true", () => {
    const { result } = renderCanvasPan();
    act(() => {
      result.current.tryStartPan(mouseEvent({ button: 1 }));
    });
    let consumed = false;
    act(() => {
      consumed = result.current.tryEndPan(mouseEvent({ button: 1 }));
    });
    expect(consumed).toBe(true);
    expect(result.current.panning).toBeNull();
  });

  test("returns false when there is no pan to end", () => {
    const { result } = renderCanvasPan();
    let consumed = true;
    act(() => {
      consumed = result.current.tryEndPan(mouseEvent({}));
    });
    expect(consumed).toBe(false);
  });
});
