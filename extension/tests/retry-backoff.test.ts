import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_RETRY_POLICY,
  canRetry,
  delayForMs,
  type RetryPolicy,
} from '../src/retry/backoff';

// ============================================================================
// BACKOFF POLICY (bead 0h4d.1.3, plan
// docs/superpowers/plans/2026-09-28-backoff-retry.md). Pure, deterministic
// given the injected rng: the machine consults canRetry, the engine sleeps
// delayForMs. Full jitter = uniform in [0, exp) where exp = min(cap, base·2ⁿ).
// maxAttempts counts TOTAL attempts (initial + retries): with 3, the third
// transient failure settles — matching the corpus case "transient ×3 →
// terminal".
// ============================================================================

describe('backoff policy (0h4d.1.3)', () => {
  it('delay is exponential: attempt n doubles the window (without jitter)', () => {
    const noJitter: RetryPolicy = { ...DEFAULT_RETRY_POLICY, jitter: 'none' };
    expect(delayForMs(1, noJitter)).toBe(2000);
    expect(delayForMs(2, noJitter)).toBe(4000);
    expect(delayForMs(3, noJitter)).toBe(8000);
    expect(delayForMs(4, noJitter)).toBe(16000);
  });

  it('delay never exceeds the cap (high attempts clamp)', () => {
    const noJitter: RetryPolicy = { ...DEFAULT_RETRY_POLICY, jitter: 'none' };
    expect(delayForMs(10, noJitter)).toBe(DEFAULT_RETRY_POLICY.capMs);
    expect(delayForMs(50, noJitter)).toBe(DEFAULT_RETRY_POLICY.capMs);
  });

  it('full jitter lands in [0, exp) and stays monotone in the window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.double({ min: 0, max: 0.999999, noNaN: true }),
        (attempt, roll) => {
          const d = delayForMs(attempt, DEFAULT_RETRY_POLICY, () => roll);
          const exp = Math.min(DEFAULT_RETRY_POLICY.capMs, DEFAULT_RETRY_POLICY.baseMs * 2 ** (attempt - 1));
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThan(exp);
        },
      ),
    );
  });

  it('canRetry: retries within maxAttempts total attempts, then stops', () => {
    // maxAttempts 3 → the failure on attempt 1 retries, attempt 2 retries,
    // attempt 3 settles. retryCount = retries already performed.
    expect(canRetry(DEFAULT_RETRY_POLICY, 0)).toBe(true);
    expect(canRetry(DEFAULT_RETRY_POLICY, 1)).toBe(true);
    expect(canRetry(DEFAULT_RETRY_POLICY, 2)).toBe(false);
  });

  it('canRetry honors the policy for any maxAttempts ≥ 1', () => {
    fc.assert(
      fc.property(
        fc.record({
          baseMs: fc.constant(100),
          capMs: fc.constant(1000),
          maxAttempts: fc.integer({ min: 1, max: 6 }),
          jitter: fc.constant<'full' | 'none'>('none'),
        }),
        fc.integer({ min: 0, max: 8 }),
        (policy, retryCount) => {
          expect(canRetry(policy as RetryPolicy, retryCount)).toBe(
            retryCount + 1 < policy.maxAttempts,
          );
        },
      ),
    );
  });

  it('a maxAttempts=1 policy never retries (single-shot, the old default)', () => {
    const single: RetryPolicy = { ...DEFAULT_RETRY_POLICY, maxAttempts: 1 };
    expect(canRetry(single, 0)).toBe(false);
  });
});
