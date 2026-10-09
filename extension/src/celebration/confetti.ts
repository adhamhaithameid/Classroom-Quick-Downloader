/**
 * ============================================================================
 * CONFETTI BURST — CSP-safe, popup-only celebration effect
 * (1.9.0 confetti feature, commit 2)
 * ============================================================================
 *
 * One canvas-confetti burst per call: particleCount 80, ~1.5-2.5s of
 * physics, no workers (useWorker: false), no remote code — the module is
 * bundled by WXT like any other import, so the extension CSP is untouched.
 * The canvas is created here (not by the library) so it can carry
 * aria-hidden="true" and be removed when the burst settles.
 *
 * Motion gate: callers must check celebrationUsesConfetti() first — the OS
 * prefers-reduced-motion query OR the in-app reducedMotionPreferred setting
 * skips the canvas entirely (toast only). disableForReducedMotion is also
 * passed to the library as a second belt.
 */

/** Live OS reduced-motion read; false when the query is unavailable. */
export function prefersReducedMotionOS(): boolean {
  try {
    const mq = (
      globalThis as { matchMedia?: (query: string) => { matches: boolean } }
    ).matchMedia?.('(prefers-reduced-motion: reduce)');
    return mq?.matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Double gate: confetti plays only when the OS allows motion AND the user
 * has not asked for calm in the extension. Either gate alone skips it.
 */
export function celebrationUsesConfetti(reducedMotionSetting: boolean): boolean {
  return !prefersReducedMotionOS() && !reducedMotionSetting;
}

const CONFETTI_LINGER_MS = 2500;

/** Fire exactly one burst into a self-managed, aria-hidden canvas. */
export async function fireConfettiBurst(): Promise<void> {
  try {
    const confetti = (await import('canvas-confetti')).default;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '2147483646';
    (document.body ?? document.documentElement).appendChild(canvas);
    const burst = confetti.create(canvas, { resize: true, useWorker: false });
    burst({
      particleCount: 80,
      spread: 75,
      startVelocity: 42,
      ticks: 140,
      origin: { y: 0.6 },
      disableForReducedMotion: true,
    });
    setTimeout(() => {
      try {
        canvas.remove();
      } catch {
        // the popup can close first; nothing to clean up then
      }
    }, CONFETTI_LINGER_MS);
  } catch {
    // Celebration is garnish: a failed burst must never break the toast.
  }
}
