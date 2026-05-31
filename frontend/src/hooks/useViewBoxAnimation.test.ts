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
