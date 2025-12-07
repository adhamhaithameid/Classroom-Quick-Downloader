// filepath: cloudflare-worker/src/downloads_do.ts

import type {
  Env,
  AnalyticsEvent,
  Counters,
  PendingState,
  RetryState,
} from './types';

const COUNTERS_KEY = 'counters';
const PENDING_KEY = 'pending';
const RETRY_KEY = 'retry_state';
const LAST_FLUSH_KEY = 'last_flush_at';

function defaultCounters(): Counters {
  return {
    totalEvents: 0,
    totalDownloads: 0,
    success: 0,
    fail: 0,
    byFileType: {},
    byBrowser: {},
    byOS: {},
    byLanguage: {},
    bySpeed: {
      fast: 0,
      medium: 0,
      slow: 0,
    },
    bypassCount: 0,
    lastEventAt: null,
  };
}

function bucketDuration(durationMs: number): 'fast' | 'medium' | 'slow' {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'fast';
  if (durationMs <= 3000) return 'fast';
  if (durationMs <= 15000) return 'medium';
  return 'slow';
}

export class DownloadsDurable {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Route based on method + path.
    if (request.method === 'POST') {
      // We treat any POST hitting this DO as ingestion (/track).
      return this.handleTrack(request);
    }

    if (request.method === 'GET') {
      if (url.pathname.endsWith('/stats')) {
        return this.handleStats();
      }
      if (url.pathname.endsWith('/health')) {
        return this.handleHealth();
      }
    }

    return new Response('OK', { status: 200 });
  }

  // POST ingestion from Worker /track
  private async handleTrack(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const events = Array.isArray((body as any)?.events)
      ? ((body as any).events as AnalyticsEvent[])
      : [];

    if (!events.length) {
      return new Response('No events', { status: 400 });
    }

    const maxBatch =
      parseInt(this.env.MAX_BATCH_EVENTS || '10000', 10) || 10000;

    // Load existing state
    const [storedCounters, storedPending, storedRetry] = await Promise.all([
      this.storage.get<Counters>(COUNTERS_KEY),
      this.storage.get<PendingState>(PENDING_KEY),
      this.storage.get<RetryState>(RETRY_KEY),
    ]);

    const counters: Counters = storedCounters ?? defaultCounters();
    const pending: PendingState = storedPending ?? { events: [] };
    const retryState: RetryState =
      storedRetry ?? { attempts: 0, nextAttemptAt: null };

    // Update counters + buffer
    const now = Date.now();
    let lastEventAt = counters.lastEventAt;

    for (const e of events) {
      const status = e.status === 'success' ? 'success' : 'fail';
      const fileType = (e.file_type || 'unknown').trim().toLowerCase();
      const browser = (e.browser || 'unknown').trim().toLowerCase();
      const os = (e.os || 'unknown').trim().toLowerCase();
      const language = (e.language || 'unknown').trim().toLowerCase();

      counters.totalEvents += 1;
      if (status === 'success') {
        counters.success += 1;
        counters.totalDownloads += 1;
      } else {
        counters.fail += 1;
      }

      if (!counters.byFileType[fileType]) counters.byFileType[fileType] = 0;
      counters.byFileType[fileType] += 1;

      if (!counters.byBrowser[browser]) counters.byBrowser[browser] = 0;
      counters.byBrowser[browser] += 1;

      if (!counters.byOS[os]) counters.byOS[os] = 0;
      counters.byOS[os] += 1;

      if (!counters.byLanguage[language]) {
        counters.byLanguage[language] = 0;
      }
      counters.byLanguage[language] += 1;

      const bucket = bucketDuration(e.duration_ms ?? 0);
      counters.bySpeed[bucket] += 1;

      if (e.bypass_used) {
        counters.bypassCount += 1;
      }

      const ts = typeof e.timestamp === 'number' ? e.timestamp : now;
      if (lastEventAt == null || ts > lastEventAt) {
        lastEventAt = ts;
      }

      // Append to pending buffer (for future Oracle flush)
      pending.events.push({
        ...e,
        timestamp: ts,
      });
    }

    counters.lastEventAt = lastEventAt;

    // Persist counters + pending
    await Promise.all([
      this.storage.put(COUNTERS_KEY, counters),
      this.storage.put(PENDING_KEY, pending),
      this.storage.put(RETRY_KEY, retryState),
    ]);

    let flushed = false;

    // If buffer large enough, attempt flush
    if (pending.events.length >= maxBatch) {
      const flushOk = await this.flushToOracle(pending.events);
      if (flushOk) {
        flushed = true;
        pending.events = [];
        await Promise.all([
          this.storage.put(PENDING_KEY, pending),
          this.storage.put(LAST_FLUSH_KEY, Date.now()),
          this.storage.put(RETRY_KEY, {
            attempts: 0,
            nextAttemptAt: null,
          } satisfies RetryState),
        ]);
      } else {
        // For now: keep data, bump attempts; alarms/backoff can be added in Step 2.
        const nextAttempts = (retryState.attempts || 0) + 1;
        const delayMs = Math.min(60_000 * nextAttempts, 60 * 60 * 1000); // cap at 1h
        const nextAttemptAt = Date.now() + delayMs;

        retryState.attempts = nextAttempts;
        retryState.nextAttemptAt = nextAttemptAt;
        retryState.lastError = 'Last flushToOracle failed';

        await this.storage.put(RETRY_KEY, retryState);

        // NOTE: We do not drop events. They stay in pending.events.
        // In Step 2 we can plug Durable Object alarms here.
      }
    }

    return new Response(
      JSON.stringify({
        accepted: events.length,
        buffered: pending.events.length,
        flushed,
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  private async handleStats(): Promise<Response> {
    const [storedCounters, storedPending, lastFlush, retryState] =
      await Promise.all([
        this.storage.get<Counters>(COUNTERS_KEY),
        this.storage.get<PendingState>(PENDING_KEY),
        this.storage.get<number>(LAST_FLUSH_KEY),
        this.storage.get<RetryState>(RETRY_KEY),
      ]);

    const counters: Counters = storedCounters ?? defaultCounters();
    const pendingCount = storedPending?.events?.length ?? 0;

    return new Response(
      JSON.stringify({
        ok: true,
        counters,
        pendingEvents: pendingCount,
        lastFlushAt: lastFlush ?? null,
        retryState: retryState ?? null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  private async handleHealth(): Promise<Response> {
    const [storedCounters, storedPending, retryState] = await Promise.all([
      this.storage.get<Counters>(COUNTERS_KEY),
      this.storage.get<PendingState>(PENDING_KEY),
      this.storage.get<RetryState>(RETRY_KEY),
    ]);

    const counters: Counters = storedCounters ?? defaultCounters();
    const pendingCount = storedPending?.events?.length ?? 0;

    return new Response(
      JSON.stringify({
        ok: true,
        totalEvents: counters.totalEvents,
        totalDownloads: counters.totalDownloads,
        pendingEvents: pendingCount,
        lastEventAt: counters.lastEventAt ?? null,
        retryState: retryState ?? null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  /**
   * Flush buffered events to Oracle backend.
   * For STEP 1:
   * - If ORACLE_ENDPOINT is empty, we *pretend success* and let DO
   *   clear the buffer so storage doesn't grow without bound.
   */
  private async flushToOracle(events: AnalyticsEvent[]): Promise<boolean> {
    const endpoint = (this.env.ORACLE_ENDPOINT || '').trim();
    if (!events.length) return true;

    if (!endpoint) {
      console.log(
        `[DownloadsDurable] ORACLE_ENDPOINT not set. Simulating successful flush of ${events.length} events.`,
      );
      return true;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DO-SECRET': this.env.DO_SHARED_SECRET || '',
        },
        body: JSON.stringify({ events }),
      });

      if (!res.ok) {
        console.error(
          '[DownloadsDurable] Oracle flush failed with status:',
          res.status,
        );
        return false;
      }

      return true;
    } catch (err) {
      console.error('[DownloadsDurable] Oracle flush error:', err);
      return false;
    }
  }
}