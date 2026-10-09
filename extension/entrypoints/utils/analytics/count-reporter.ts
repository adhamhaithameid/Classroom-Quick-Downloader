// filepath: extension/entrypoints/utils/analytics/count-reporter.ts
/**
 * 1.9.0 confetti, commit 4 — DORMANT download-count reporting.
 *
 * Clones the /track POST pattern (flush.ts sendBatchToCloudflare): one small
 * JSON body {installId, lifetimeCount, browser, clientBatchId} to the same
 * TRACK_URL. The worker keys a per-install cumulative counter on installId
 * (latest-report-wins with a monotonic max guard) and serves the aggregate
 * to the admin dashboard.
 *
 * Gating: REMOTE_COUNTS_ENABLED (constants.ts) is false, so every entry
 * point here returns { success: false, skipped: true } BEFORE any fetch is
 * constructed. The call sites (milestone crossings + every 100th increment)
 * stay wired but cost nothing.
 *
 * Idempotency: clientBatchId is deterministic — the same install reporting
 * the same lifetime count always produces the same id, so a retry or replay
 * collapses to one change on the worker (its processed-report ring).
 */

import { REMOTE_COUNTS_ENABLED, TRACK_URL } from './constants';
import { detectBrowser } from './detection';

export interface DownloadCountPayload {
  installId: string;
  lifetimeCount: number;
  browser: string;
  clientBatchId: string;
}

export interface CountReportResult {
  success: boolean;
  /** True when the switch kept the report on the ground (no fetch). */
  skipped?: boolean;
  duplicate?: boolean;
  error?: string;
}

/**
 * Deterministic batch id: dlc-<installId>-<lifetimeCount>. The worker's
 * idempotency ring collapses duplicates; replays and downgrades cannot
 * double-count (and its monotonic guard cannot lower a count).
 */
export function buildCountBatchId(installId: string, lifetimeCount: number): string {
  return `dlc-${installId}-${lifetimeCount}`;
}

/** POST one count report to /track. Gate first: no URL, no payload, no fetch. */
export async function sendCountReport(payload: DownloadCountPayload): Promise<CountReportResult> {
  if (!REMOTE_COUNTS_ENABLED) {
    return { success: false, skipped: true };
  }
  if (!TRACK_URL || !payload.installId || !Number.isFinite(payload.lifetimeCount)) {
    return { success: false, skipped: true, error: 'No URL or invalid payload' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (resp.status === 429) {
      return { success: false, error: 'Rate limited' };
    }
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    const json = (await resp.json()) as { ok?: boolean; duplicate?: boolean };
    return { success: json.ok === true, duplicate: json.duplicate === true };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timeout' };
    }
    return { success: false, error: String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The wired call site: assemble the payload (deterministic batch id, UA
 * browser name) and attempt one report. With the switch off this is a
 * no-op that never touches the network.
 */
export async function reportDownloadCount(stats: {
  installId: string;
  lifetimeCount: number;
}): Promise<CountReportResult> {
  return sendCountReport({
    installId: stats.installId,
    lifetimeCount: stats.lifetimeCount,
    browser: detectBrowser() || 'unknown',
    clientBatchId: buildCountBatchId(stats.installId, stats.lifetimeCount),
  });
}
