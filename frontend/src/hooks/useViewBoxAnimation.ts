import { useCallback, useEffect, useRef } from "react";
import { lerpViewBox } from "../domain/tasks/viewport";
import type { ViewBox } from "../domain/tasks/types";
import { easeInOutCubic } from "../lib/easing";

const DEFAULT_DURATION_MS = 450;

function viewBoxEquals(a: ViewBox, b: ViewBox): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Animates the viewport smoothly from its current position to a target viewBox,
 * emitting intermediate frames through `onViewBoxChange` (the same channel pan
 * and zoom use). Returns an `animateTo` function.
 *
 * - Calling `animateTo` again mid-flight redirects from the current on-screen
 *   position, so rapid triggers stay smooth.
 * - If something else moves the viewport (a pan, a wheel-zoom, fit-to-screen)
 *   while an animation is running, the animation yields and stops.
 */
export function useViewBoxAnimation(
  viewBox: ViewBox,
  onViewBoxChange: (vb: ViewBox) => void,
  durationMs: number = DEFAULT_DURATION_MS,
): (target: ViewBox) => void {
  // Refs keep the rAF loop reading the latest values without re-subscribing.
  const currentRef = useRef(viewBox);
  currentRef.current = viewBox;
  const onChangeRef = useRef(onViewBoxChange);
  onChangeRef.current = onViewBoxChange;

  const frameRef = useRef<number | null>(null);
  const lastEmittedRef = useRef<ViewBox | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastEmittedRef.current = null;
  }, []);

  const animateTo = useCallback(
    (target: ViewBox) => {
      stop();
      const from = currentRef.current;
      const startTime = performance.now();

      const step = (now: number) => {
        const t = durationMs <= 0 ? 1 : Math.min(1, (now - startTime) / durationMs);
        const frame = lerpViewBox(from, target, easeInOutCubic(t));
        lastEmittedRef.current = frame;
        onChangeRef.current(frame);
        if (t < 1) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          frameRef.current = null;
          lastEmittedRef.current = null;
        }
      };

      frameRef.current = requestAnimationFrame(step);
    },
    [durationMs, stop],
  );

  // If an external source moves the viewport mid-animation, the incoming
  // viewBox no longer matches the frame we last emitted — yield to it.
  useEffect(() => {
    if (frameRef.current !== null && lastEmittedRef.current) {
      if (!viewBoxEquals(viewBox, lastEmittedRef.current)) stop();
    }
  }, [viewBox, stop]);

  // Cancel any in-flight animation on unmount.
  useEffect(() => stop, [stop]);

  return animateTo;
}
