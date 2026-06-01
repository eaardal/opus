import { useCallback, useEffect, useRef } from "react";
import { lerpViewBox } from "../domain/tasks/viewport";
import type { ViewBox } from "../domain/tasks/types";
import { easeInOutCubic } from "../lib/easing";

const DEFAULT_DURATION_MS = 450;

/** A stable string identity for a viewBox, used to recognise our own frames. */
function viewBoxKey(vb: ViewBox): string {
  return `${vb.x},${vb.y},${vb.width},${vb.height}`;
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
  // Keys of every frame this run has emitted. The parent echoes each frame back
  // through `viewBox`, and that echo (a post-paint re-render) lags behind the
  // pre-paint rAF loop — so we recognise our own frames by membership rather than
  // by matching only the latest, which the loop has usually moved past already.
  const emittedKeysRef = useRef<Set<string>>(new Set());

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    emittedKeysRef.current.clear();
  }, []);

  const animateTo = useCallback(
    (target: ViewBox) => {
      stop();
      const from = currentRef.current;
      const startTime = performance.now();

      const step = (now: number) => {
        const t = durationMs <= 0 ? 1 : Math.min(1, (now - startTime) / durationMs);
        const frame = lerpViewBox(from, target, easeInOutCubic(t));
        emittedKeysRef.current.add(viewBoxKey(frame));
        onChangeRef.current(frame);
        if (t < 1) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          frameRef.current = null;
          emittedKeysRef.current.clear();
        }
      };

      frameRef.current = requestAnimationFrame(step);
    },
    [durationMs, stop],
  );

  // If an external source moves the viewport mid-animation, the incoming viewBox
  // is a value this run never emitted — yield to it. Checking set membership (not
  // equality with the last frame) stays correct even when the parent's echo trails
  // the frame loop by several frames.
  useEffect(() => {
    if (frameRef.current === null || emittedKeysRef.current.size === 0) return;
    if (!emittedKeysRef.current.has(viewBoxKey(viewBox))) stop();
  }, [viewBox, stop]);

  // Cancel any in-flight animation on unmount.
  useEffect(() => stop, [stop]);

  return animateTo;
}
