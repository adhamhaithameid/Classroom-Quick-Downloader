/**
 * ============================================================================
 * BACKOFF POLICY — bounded exponential backoff with full jitter
 * (bead 0h4d.1.3, plan docs/superpowers/plans/2026-09-28-backoff-retry.md)
 * ============================================================================
 *
 * Lives OUTSIDE src/core/ on purpose: the architecture fitness rules
 * (ADR-0007, tests/architecture/engine-layers.test.ts) require core/** to
 * import nothing but contracts and to touch no randomness — this module is
 * engine-side timing policy. The MACHINE keeps its own attempt bound as data
 * (MAX_TRANSIENT_RETRIES in state-machine.ts); the differential corpus
 * (tests/acquire-corpus.test.ts) is the contract that the two agree.
 *
 * Pure: no chrome APIs, no timers. The engine sleeps delayForMs. maxAttempts
 * counts TOTAL attempts (initial + retries) so "transient ×3 → terminal" in
 * the corpus means three failed attempts, then the honest settle.
 */

export interface RetryPolicy {
  baseMs: number;
  capMs: number;
  /** Total attempts including the first. maxAttempts 3 = two retries. */
  maxAttempts: number;
  /** 'full' → uniform in [0, exp); 'none' → deterministic exp (tests). */
  jitter: 'full' | 'none';
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseMs: 2_000,
  capMs: 60_000,
  maxAttempts: 3,
  jitter: 'full',
};

/**
 * Delay before the `retryNumber`-th retry (1-based). Exponential window
 * min(cap, base·2^(n-1)); full jitter draws uniformly from it.
 *
 * Jitter randomness is deliberately non-cryptographic (Math.random): there is
 * no security property in when a retry fires — the rng exists so tests can
 * inject determinism. Scanners flag "weak random for crypto use"; this is
 * timing jitter only.
 */
export function delayForMs(
  retryNumber: number,
  policy: RetryPolicy,
  rand: () => number = Math.random,
): number {
  const exp = Math.min(policy.capMs, policy.baseMs * 2 ** Math.max(0, retryNumber - 1));
  if (policy.jitter === 'none') return exp;
  return Math.floor(exp * rand());
}

/**
 * `retryCount` = retries already performed. The attempt that just failed is
 * number retryCount + 1; a retry may follow while that attempt number is
 * still below maxAttempts.
 */
export function canRetry(policy: RetryPolicy, retryCount: number): boolean {
  return retryCount + 1 < policy.maxAttempts;
}
