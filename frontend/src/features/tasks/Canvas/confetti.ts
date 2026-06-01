// canvas-confetti is a tiny (~5kb), zero-dependency celebration library. Wrapped
// here so the dependency is imported in exactly one place.
import confetti from "canvas-confetti";

/**
 * Bursts confetti from a point given in client (viewport) pixels — e.g. the
 * on-screen position of a progress bar's tip. canvas-confetti positions the
 * origin as window fractions and draws on its own fixed overlay canvas, so this
 * works regardless of canvas pan/zoom. Respects the user's reduced-motion setting.
 */
export function burstConfettiAt(clientX: number, clientY: number): void {
  const { innerWidth, innerHeight } = window;
  if (innerWidth === 0 || innerHeight === 0) return;
  confetti({
    origin: { x: clientX / innerWidth, y: clientY / innerHeight },
    particleCount: 90,
    spread: 70,
    startVelocity: 38,
    gravity: 0.9,
    scalar: 0.9,
    ticks: 200,
    disableForReducedMotion: true,
  });
}

/**
 * A bigger, canvas-wide celebration: confetti rains down from the top edge of the
 * given client-pixel rect (the canvas area), spread across its width, so it falls
 * over the whole canvas. For the "everything is done" moment.
 */
export function rainConfettiFromTop(rect: DOMRect): void {
  const { innerWidth, innerHeight } = window;
  if (innerWidth === 0 || innerHeight === 0) return;
  const y = rect.top / innerHeight;
  const ORIGIN_FRACTIONS = [0.1, 0.3, 0.5, 0.7, 0.9];
  for (const fraction of ORIGIN_FRACTIONS) {
    confetti({
      origin: { x: (rect.left + rect.width * fraction) / innerWidth, y },
      angle: 270, // fire downward so it drops from the top
      particleCount: 60,
      spread: 110,
      startVelocity: 32,
      gravity: 1,
      scalar: 1,
      ticks: 300, // live long enough to fall the height of the canvas
      disableForReducedMotion: true,
    });
  }
}
