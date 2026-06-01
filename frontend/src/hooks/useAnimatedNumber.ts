import { useEffect, useRef, useState } from "react";
import { easeInOutCubic } from "../lib/easing";

const DEFAULT_DURATION_MS = 350;

/**
 * Tweens a value toward `target` with eased requestAnimationFrame frames, so a
 * changing number animates instead of jumping. Returns the current value and
 * whether an animation is in flight (useful for showing a moving indicator).
 *
 * The first render adopts `target` without animating; later changes animate from
 * the current value, redirecting smoothly if `target` changes mid-flight. The
 * direction is symmetric — increases and decreases animate the same way.
 */
export function useAnimatedNumber(
  target: number,
  durationMs: number = DEFAULT_DURATION_MS,
): { value: number; animating: boolean } {
  const [value, setValue] = useState(target);
  const [animating, setAnimating] = useState(false);

  // Refs let the rAF loop and the retarget effect read the latest values without
  // re-subscribing or listing `value` as a dependency (which would restart it).
  const valueRef = useRef(target);
  valueRef.current = value;
  const targetRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === targetRef.current) return;
    targetRef.current = target;
    const from = valueRef.current;
    const startTime = performance.now();
    setAnimating(true);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    const step = (now: number) => {
      const t = durationMs <= 0 ? 1 : Math.min(1, (now - startTime) / durationMs);
      setValue(from + (target - from) * easeInOutCubic(t));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
        setValue(target);
        setAnimating(false);
      }
    };

    frameRef.current = requestAnimationFrame(step);
  }, [target, durationMs]);

  // Cancel any in-flight animation on unmount.
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return { value, animating };
}
