import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ViewBox } from "../domain/tasks/types";
import { useViewBoxAnimation } from "./useViewBoxAnimation";

const START: ViewBox = { x: 0, y: 0, width: 100, height: 100 };
const TARGET: ViewBox = { x: 200, y: 200, width: 100, height: 100 };

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

describe("useViewBoxAnimation", () => {
  test("emits frames and ends exactly on the target", () => {
    const emitted: ViewBox[] = [];
    const { result, rerender } = renderHook(
      ({ vb }) => useViewBoxAnimation(vb, (next) => emitted.push(next), 100),
      { initialProps: { vb: START } },
    );

    act(() => result.current(TARGET));
    // Each emitted frame becomes the next incoming viewBox, mirroring the parent.
    act(() => flushFrame(1000)); // t=0
    rerender({ vb: emitted[emitted.length - 1] });
    act(() => flushFrame(1050)); // t=0.5
    rerender({ vb: emitted[emitted.length - 1] });
    act(() => flushFrame(1100)); // t=1 → final frame
    rerender({ vb: emitted[emitted.length - 1] });

    expect(emitted[emitted.length - 1]).toEqual(TARGET);
    expect(frameQueue).toHaveLength(0);
  });

  test("keeps animating to the target when the parent echo lags behind the frame loop", () => {
    const emitted: ViewBox[] = [];
    const { result, rerender } = renderHook(
      ({ vb }) => useViewBoxAnimation(vb, (next) => emitted.push(next), 100),
      { initialProps: { vb: START } },
    );

    act(() => result.current(TARGET));
    // The rAF loop runs ahead of the parent: two frames emit before the parent
    // re-renders with the first of them (a post-paint echo trailing the loop).
    act(() => flushFrame(1000)); // frame 1 (t=0)
    act(() => flushFrame(1050)); // frame 2 (t=0.5)
    const emittedAfterTwoFrames = emitted.length;

    // Catching up only to the FIRST emitted frame must NOT be read as an external
    // change — it is still one of ours, just lagging.
    rerender({ vb: emitted[0] });

    act(() => flushFrame(1100)); // frame 3 (t=1) → must still reach the target
    expect(emitted[emitted.length - 1]).toEqual(TARGET);
    expect(emitted.length).toBeGreaterThan(emittedAfterTwoFrames);
  });

  test("yields when an external viewBox change interrupts the animation", () => {
    const emitted: ViewBox[] = [];
    const { result, rerender } = renderHook(
      ({ vb }) => useViewBoxAnimation(vb, (next) => emitted.push(next), 100),
      { initialProps: { vb: START } },
    );

    act(() => result.current(TARGET));
    act(() => flushFrame(1000));
    rerender({ vb: emitted[emitted.length - 1] });

    const countBeforeInterrupt = emitted.length;
    // The user pans elsewhere: the incoming viewBox no longer matches the frame
    // the animation last emitted, so it must stop.
    rerender({ vb: { x: 999, y: 999, width: 50, height: 50 } });

    act(() => flushFrame(1050));
    expect(emitted).toHaveLength(countBeforeInterrupt);
  });
});
