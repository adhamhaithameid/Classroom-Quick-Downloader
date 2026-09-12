/**
 * First-in-view orchestration for AnimatedNumber.
 *
 * Decides when a counter starts animating, exactly once, using three paths:
 *
 *  1. No IntersectionObserver (node/SSR-like runtimes, very old browsers) —
 *     enter right away, preserving the historical no-IO behavior.
 *  2. Real-viewport fast path — if the host rect is non-zero-size and any
 *     part of it lies inside the real viewport, enter right away without
 *     waiting for the observer. This exists because a `rootMargin` like
 *     '0px 0px -8% 0px' shrinks the observation root, so a host that is
 *     partially visible in that bottom band can otherwise never report
 *     intersecting and the counter would stay at 0 forever.
 *  3. Observe the host; enter when the observer reports isIntersecting.
 *
 * A fallback timer (default 4000 ms) enters anyway if nothing else has fired,
 * so a counter can never get stuck at its initial value.
 *
 * Test seams (vitest runs in the `node` environment, so there is no DOM):
 * the IntersectionObserver constructor and the viewport height are resolved
 * from `globalThis` at call time. Node tests stub them with
 * `vi.stubGlobal('IntersectionObserver', Fake)` and
 * `vi.stubGlobal('innerHeight', height)`; the only DOM surface the host needs
 * is a `getBoundingClientRect()` returning `{ top, bottom, width, height }`.
 */

export interface InViewOptions {
  /** Passed through to the IntersectionObserver constructor. */
  threshold: number;
  /** Passed through to the IntersectionObserver constructor. */
  rootMargin: string;
  /** Invoked exactly once, by whichever visibility path fires first. */
  onEnter: () => void;
  /** Delay before the fallback fires if nothing else has. Default 4000 ms. */
  fallbackDelayMs?: number;
}

export interface InViewHandle {
  /** Cancels the observer and the fallback timer so onEnter can no longer fire. */
  disconnect: () => void;
}

const DEFAULT_FALLBACK_DELAY_MS = 4000;

interface RectLike {
  top: number;
  bottom: number;
  width: number;
  height: number;
}

function resolveIoCtor(): typeof IntersectionObserver | undefined {
  return (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
}

function resolveViewportHeight(): number | undefined {
  const height = (globalThis as { innerHeight?: number }).innerHeight;
  return typeof height === 'number' ? height : undefined;
}

export function observeFirstInView(host: Element, options: InViewOptions): InViewHandle {
  const fallbackDelayMs = options.fallbackDelayMs ?? DEFAULT_FALLBACK_DELAY_MS;

  let fired = false;
  let disconnected = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let observer: IntersectionObserver | null = null;

  const stopPending = (): void => {
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (observer !== null) {
      observer.disconnect();
      observer = null;
    }
  };

  const fire = (): void => {
    if (fired || disconnected) return;
    fired = true;
    stopPending();
    options.onEnter();
  };

  const handle: InViewHandle = {
    disconnect: () => {
      disconnected = true;
      stopPending();
    }
  };

  const ioCtor = resolveIoCtor();
  if (typeof ioCtor !== 'function') {
    fire();
    return handle;
  }

  observer = new ioCtor(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        fire();
        break;
      }
    },
    { threshold: options.threshold, rootMargin: options.rootMargin }
  );
  observer.observe(host);

  fallbackTimer = setTimeout(fire, fallbackDelayMs);

  // Real-viewport fast path (the fix): the rootMargin band must not be able
  // to hold a partially visible counter at 0.
  const viewportHeight = resolveViewportHeight();
  const rect: RectLike = host.getBoundingClientRect();
  const nonZeroSize = rect.width > 0 && rect.height > 0;
  const insideViewport = viewportHeight !== undefined && rect.bottom > 0 && rect.top < viewportHeight;
  if (nonZeroSize && insideViewport) {
    fire();
  }

  return handle;
}
