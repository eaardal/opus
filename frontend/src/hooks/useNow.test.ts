import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useNow } from "./useNow";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  test("returns the current time and advances on the interval", () => {
    vi.setSystemTime(1000);
    const { result } = renderHook(() => useNow(500));
    expect(result.current).toBe(1000);

    // Advancing fake timers also advances Date.now(), so the tick lands at 1500.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(1500);
  });

  test("stops ticking after unmount", () => {
    vi.setSystemTime(1000);
    const { result, unmount } = renderHook(() => useNow(500));
    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(1000);
  });
});
