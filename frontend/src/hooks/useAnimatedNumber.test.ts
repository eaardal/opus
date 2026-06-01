import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAnimatedNumber } from "./useAnimatedNumber";

let frameQueue: Array<{ id: number; cb: FrameRequestCallback }>;
let nextFrameId: number;
let now: number;

/** Run the next queued animation frame at the given timestamp. */
function flushFrame(atTime: number) {
  now = atTime;
  const next = frameQueue.shift();
  next?.cb(atTime);
}

beforeEach(() => {
  frameQueue = [];
  nextFrameId = 1;
  now = 1000;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextFrameId++;
    frameQueue.push({ id, cb });
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frameQueue = frameQueue.filter((f) => f.id !== id);
  });
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useAnimatedNumber", () => {
  test("adopts the initial target without animating", () => {
    const { result } = renderHook(({ t }) => useAnimatedNumber(t, 100), {
      initialProps: { t: 0.5 },
    });

    expect(result.current.value).toBe(0.5);
    expect(result.current.animating).toBe(false);
    expect(frameQueue).toHaveLength(0);
  });

  test("animates to a higher target and ends exactly on it", () => {
    const { result, rerender } = renderHook(({ t }) => useAnimatedNumber(t, 100), {
      initialProps: { t: 0 },
    });

    rerender({ t: 1 });
    expect(result.current.animating).toBe(true);

    act(() => flushFrame(1050)); // t = 0.5
    expect(result.current.value).toBeGreaterThan(0);
    expect(result.current.value).toBeLessThan(1);

    act(() => flushFrame(1100)); // t = 1 → settle
    expect(result.current.value).toBe(1);
    expect(result.current.animating).toBe(false);
    expect(frameQueue).toHaveLength(0);
  });

  test("animates downward for a decrease (regression)", () => {
    const { result, rerender } = renderHook(({ t }) => useAnimatedNumber(t, 100), {
      initialProps: { t: 1 },
    });

    rerender({ t: 0 });
    act(() => flushFrame(1050));
    expect(result.current.value).toBeGreaterThan(0);
    expect(result.current.value).toBeLessThan(1);

    act(() => flushFrame(1100));
    expect(result.current.value).toBe(0);
    expect(result.current.animating).toBe(false);
  });
});
