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
