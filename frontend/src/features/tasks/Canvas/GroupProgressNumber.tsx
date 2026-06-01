import { useEffect, useState } from "react";
import "./GroupProgressNumber.css";

interface GroupProgressNumberProps {
  /** Animated completed fraction (0..1), rendered as a whole-percent number. */
  value: number;
  /**
   * Whether the number should play. The parent passes true only while the
   * progress is counting from a change worth highlighting — it gates out
   * non-progress changes (e.g. a task being created), so this can be false even
   * while the bar itself is animating.
   */
  animating: boolean;
  groupWidth: number;
  groupHeight: number;
}

// Fraction of the group the number should fill, and rough glyph metrics used to
// turn that into a font size without distortion.
const COVERAGE = 0.8;
const CAP_HEIGHT_RATIO = 0.72; // visible glyph height ≈ this × font-size
const DIGIT_WIDTH_RATIO = 0.62; // average glyph advance ≈ this × font-size
// Almost-transparent: a faint giant number that counts during the animation.
const PEAK_OPACITY = 0.08;

// Quick to appear so it's readable while counting; then it lingers on the final
// value before fading out over FADE_OUT_MS. Only FADE_OUT_MS was requested — the
// other two are sensible defaults and easy to tune.
const FADE_IN_MS = 150;
const LINGER_MS = 500;
const FADE_OUT_MS = 350;

/**
 * A giant, almost-transparent percentage laid over the whole group while its
 * progress animates — it counts from the old value to the new one (up for
 * completions, down for regressions) to draw the eye to the change. When the
 * count finishes it lingers on the final value, then fades out over 350 ms.
 * Sized to fill ~80% of the group in its binding dimension.
 */
export function GroupProgressNumber({
  value,
  animating,
  groupWidth,
  groupHeight,
}: GroupProgressNumberProps) {
  // `shown` stays true through the count and the linger that follows, then drops
  // to false to trigger the fade-out. Decoupling it from `animating` is what lets
  // the final number dwell after counting stops.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (animating) {
      setShown(true);
      return;
    }
    if (!shown) return; // never shown (e.g. on mount) — nothing to linger/fade
    const timer = setTimeout(() => setShown(false), LINGER_MS);
    return () => clearTimeout(timer);
  }, [animating, shown]);

  const label = `${Math.round(value * 100)}%`;
  const fontSize = Math.min(
    (groupHeight * COVERAGE) / CAP_HEIGHT_RATIO,
    (groupWidth * COVERAGE) / (label.length * DIGIT_WIDTH_RATIO),
  );

  return (
    <text
      className="group-progress-number"
      x={groupWidth / 2}
      y={groupHeight / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={fontSize}
      style={{
        opacity: shown ? PEAK_OPACITY : 0,
        transitionDuration: shown ? `${FADE_IN_MS}ms` : `${FADE_OUT_MS}ms`,
      }}
    >
      {label}
    </text>
  );
}
