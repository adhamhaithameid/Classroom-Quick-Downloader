/**
 * Runtime-error telemetry for the extension background service worker.
 *
 * Unhandled errors/rejections are reported through the existing /track
 * pipeline as download-failure events with file_type 'runtime_error', so
 * extension-side breakage (e.g. after a Chrome upgrade) shows up in the same
 * counters and dashboards as download failures.
 *
 * Privacy: only a sanitized error signature (error name + optional context
 * slug) is sent — never messages, stack traces, URLs, or tab content.
 */

import { Analytics } from './index';

const MAX_ERROR_EVENTS_PER_HOUR = 10;
const RATE_STORAGE_KEY = 'cqd.analytics.runtimeErrorRate';

export const RUNTIME_ERROR_FILE_TYPE = 'runtime_error';

/** Reduce any error to a schema-safe signature ([a-z0-9._-], ≤32 chars). */
export function sanitizeErrorSignature(raw: unknown): string {
  const base = typeof raw === 'string' ? raw : '';
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return slug || 'unknown_error';
}

/** Extract a coarse signature (error name + optional context slug). */
export function errorSignature(error: unknown, context?: string): string {
  const name =
    error instanceof Error
      ? error.name
      : typeof error === 'string'
        ? 'unhandled_rejection'
        : 'unknown_error';
  const parts = [name, context ? sanitizeErrorSignature(context) : '']
    .filter(Boolean)
    .join('_');
  return sanitizeErrorSignature(parts);
}

function currentHourBucket(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 13);
}

type RateState = { hour: string; count: number };

async function loadRateState(): Promise<RateState> {
  try {
    const result = await chrome.storage.local.get(RATE_STORAGE_KEY);
    const raw = result?.[RATE_STORAGE_KEY] as RateState | undefined;
    if (raw && typeof raw.hour === 'string' && typeof raw.count === 'number') {
      return raw;
    }
  } catch {
    // Storage unavailable — fall through to a fresh bucket.
  }
  return { hour: currentHourBucket(), count: 0 };
}

async function saveRateState(state: RateState): Promise<void> {
  try {
    await chrome.storage.local.set({ [RATE_STORAGE_KEY]: state });
  } catch {
    // Rate-limit persistence is best-effort only.
  }
}

/** Pure gate: should this error be reported given the hourly cap? */
export function shouldReport(state: RateState, now = Date.now()): boolean {
  const bucket = currentHourBucket(now);
  const count = state.hour === bucket ? state.count : 0;
  return count < MAX_ERROR_EVENTS_PER_HOUR;
}

/**
 * Install global error/unhandledrejection listeners on the service-worker
 * global scope. Safe to call once from the background entrypoint.
 */
export function installRuntimeErrorReporting(): void {
  const scope = self as unknown as {
    addEventListener?: (type: string, handler: (event: Event | PromiseRejectionEvent) => void) => void;
  };
  if (typeof scope.addEventListener !== 'function') return;

  const report = (error: unknown, context?: string): void => {
    void (async () => {
      try {
        const state = await loadRateState();
        if (!shouldReport(state)) return;
        const bucket = currentHourBucket();
        await saveRateState({
          hour: bucket,
          count: (state.hour === bucket ? state.count : 0) + 1,
        });
        Analytics.track({
          status: 'fail',
          file_type: RUNTIME_ERROR_FILE_TYPE,
          duration_ms: 0,
          bypass_used: false,
          error_type: errorSignature(error, context),
          source: 'background',
        });
      } catch {
        // The error reporter must never become an error source itself.
      }
    })();
  };

  scope.addEventListener('error', (event) => {
    if (event && 'error' in event) {
      report((event as ErrorEvent).error ?? (event as ErrorEvent).message, 'global_error');
    }
  });

  scope.addEventListener('unhandledrejection', (event) => {
    if (event && 'reason' in event) {
      report((event as PromiseRejectionEvent).reason, 'unhandled_rejection');
    }
  });
}
