// filepath: extension/src/engines/v3/api/rate-limiter.ts
/**
 * ============================================================================
 * RATE LIMITER — the csaa.5 budget for Classroom API discovery calls
 * ============================================================================
 *
 * Single rolling-window budget shared by every API caller in the process.
 * Design (wayfinder csaa.5, resolved 2026-09-21):
 *
 *   - 30 calls / rolling 60s — 25x headroom under the documented
 *     1,200 queries/min per-user quota (Classroom "Usage Limits").
 *   - Over budget → acquire() returns false → the caller skips the fetch
 *     silently and the feature degrades to DOM-only (R7: assist never
 *     blocks, never retries interactively).
 *
 * The limiter owns COUNTING only — backoff/cooldown semantics live with the
 * callers. Pure clock injection keeps it deterministic under test.
 */

/** Documented-permitting headroom: 25x under the 1,200/min user quota. */
export const MAX_CALLS_PER_WINDOW = 30;
export const WINDOW_MS = 60_000;

export interface RateLimiterOptions {
  maxCalls?: number;
  windowMs?: number;
  now?: () => number;
}

export class ClassroomApiRateLimiter {
  private readonly maxCalls: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private callTimestamps: number[] = [];

  constructor(options: RateLimiterOptions = {}) {
    this.maxCalls = options.maxCalls ?? MAX_CALLS_PER_WINDOW;
    this.windowMs = options.windowMs ?? WINDOW_MS;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Try to spend one call. True = budget available (and now spent).
   * False = over budget; the caller must skip the fetch silently.
   */
  acquire(): boolean {
    const now = this.now();
    this.prune(now);
    if (this.callTimestamps.length >= this.maxCalls) return false;
    this.callTimestamps.push(now);
    return true;
  }

  /** Calls spent inside the current window (exposed for tests/diagnostics). */
  used(): number {
    this.prune(this.now());
    return this.callTimestamps.length;
  }

  /** Drop every timestamp — navigation teardown / session reset. */
  reset(): void {
    this.callTimestamps = [];
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    if (this.callTimestamps.length === 0) return;
    this.callTimestamps = this.callTimestamps.filter((ts) => ts > cutoff);
  }
}

/**
 * The one budget instance for every v3 API caller in this content-script
 * context (csaa.5: a single rolling window). The submissions assist
 * (createDefaultApiDiscoveryService) and the course inventory both gate
 * their HTTP calls through it.
 */
export const sharedClassroomRateLimiter = new ClassroomApiRateLimiter();
