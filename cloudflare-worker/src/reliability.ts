/**
 * RELIABILITY METRIC (bead 0h4d.1.10, plan
 * docs/superpowers/plans/2026-09-28-reliability-metric.md).
 *
 * First-attempt and eventual success rates computed from the DO's lifetime
 * counters. Definitions (operationalized):
 *   - first-attempt: terminal success with download_retries = 0
 *   - eventual: terminal success within the backoff policy (buckets 3+ count
 *     as eventual successes too — the policy caps at 3 total attempts)
 *   - denominator: terminal outcomes only (success + fail; cancelled excluded)
 *
 * Precision is 2 decimals and empty windows read as null — never a fake
 * 100%. The numbers are LIFETIME (the DO aggregates are not windowed); a
 * rolling 7-day view needs windowed telemetry and stays a follow-up.
 */

export interface ReliabilityInput {
  totalSuccess?: unknown;
  totalFail?: unknown;
  successByRetries?: unknown;
}

export interface ReliabilityByBrowser {
  browser: string;
  firstAttemptRate: number | null;
  eventualRate: number | null;
  samples: number;
}

export interface ReliabilityMetric {
  window: "lifetime";
  firstAttemptRate: number | null;
  eventualRate: number | null;
  samples: number;
  computedAtUtc: number;
  byBrowser: ReliabilityByBrowser[];
}

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

/** First-attempt successes = the "0" bucket. */
function firstAttemptSuccesses(successByRetries: Record<string, number>): number {
  return asCount(successByRetries["0"]);
}

/**
 * Compute the reliability metric. Both browsers report into the same
 * counters today (the DO's byBrowser splits attempts, not success×retries),
 * so byBrowser carries per-browser attempt samples while the headline rates
 * are global — splitting success×retries by browser is a follow-up once the
 * counters gain that dimension.
 */
export function computeReliability(
  input: ReliabilityInput,
  opts: { now?: number; byBrowser?: Record<string, number> } = {},
): ReliabilityMetric {
  const totalSuccess = asCount(input.totalSuccess);
  const totalFail = asCount(input.totalFail);
  const terminals = totalSuccess + totalFail;
  const retries = (input.successByRetries ?? {}) as Record<string, number>;

  const firstAttempt = firstAttemptSuccesses(retries);
  const eventual = totalSuccess;

  const byBrowser: ReliabilityByBrowser[] = Object.entries(opts.byBrowser ?? {})
    .map(([browser, samples]) => ({
      browser,
      firstAttemptRate: null,
      eventualRate: null,
      samples: asCount(samples),
    }))
    .sort((a, b) => b.samples - a.samples)
    .slice(0, 8);

  return {
    window: "lifetime",
    firstAttemptRate: rate(firstAttempt, terminals),
    eventualRate: rate(eventual, terminals),
    samples: terminals,
    computedAtUtc: opts.now ?? Date.now(),
    byBrowser,
  };
}
