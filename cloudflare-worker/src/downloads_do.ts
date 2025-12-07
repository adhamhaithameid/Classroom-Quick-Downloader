// src/downloads_do.ts
import type { DurableObjectState } from '@cloudflare/workers-types';
import type { Env } from './types';

interface AnalyticsEvent {
  status: 'success' | 'fail';
  file_type: string;
  browser: string;
  os: string;
  ext_version: string;
  duration_ms: number;
  bypass_used: boolean;
  error_type?: string;
  language: string;
  timestamp: number;
}

interface Counters {
  totalEvents: number;
  totalDownloads: number;
  totalSuccess: number;
  totalFail: number;

  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byBrowser: Record<string, number>;
  byOs: Record<string, number>;
  byExtVersion: Record<string, number>;
  byLanguage: Record<string, number>;

  lastEventAt: number | null;
  lastFlushAt: number | null;
}

const STORAGE_KEY_COUNTERS = 'counters';
const STORAGE_KEY_BUFFER = 'buffer';

function emptyCounters(): Counters {
  return {
    totalEvents: 0,
    totalDownloads: 0,
    totalSuccess: 0,
    totalFail: 0,
    byStatus: {},
    byType: {},
    byBrowser: {},
    byOs: {},
    byExtVersion: {},
    byLanguage: {},
    lastEventAt: null,
    lastFlushAt: null,
  };
}

/**
 * Normalize/migrate old counters to the new shape.
 * - Merges stored counters into the new structure.
 * - Recomputes totalEvents/totalSuccess/totalFail/totalDownloads from byStatus.
 */
function normalizeCounters(stored: any | undefined | null): Counters {
  if (!stored) return emptyCounters();

  const base = emptyCounters();

  const merged: Counters = {
    ...base,
    ...stored,
    byStatus: {
      ...base.byStatus,
      ...(stored.byStatus || {}),
    },
    byType: {
      ...base.byType,
      ...(stored.byType || {}),
    },
    byBrowser: {
      ...base.byBrowser,
      ...(stored.byBrowser || {}),
    },
    byOs: {
      ...base.byOs,
      ...(stored.byOs || {}),
    },
    byExtVersion: {
      ...base.byExtVersion,
      ...(stored.byExtVersion || {}),
    },
    byLanguage: {
      ...base.byLanguage,
      ...(stored.byLanguage || {}),
    },
  };

  // Recompute totals from byStatus EVERY TIME so everything is consistent.
  let totalEvents = 0;
  let totalSuccess = 0;
  let totalFail = 0;

  for (const [status, count] of Object.entries(merged.byStatus)) {
    const n = typeof count === 'number' && Number.isFinite(count) ? count : 0;
    totalEvents += n;
    if (status === 'success') totalSuccess += n;
    else if (status === 'fail') totalFail += n;
  }

  merged.totalEvents = totalEvents;
  merged.totalSuccess = totalSuccess;
  merged.totalFail = totalFail;
  merged.totalDownloads = totalSuccess;

  return merged;
}

export class DownloadsDurable {
  private state: DurableObjectState;
  private env: Env;

  private counters: Counters;
  private buffer: AnalyticsEvent[] = [];
  private readonly maxBuffer: number;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    const parsedMax =
      parseInt(env.MAX_BATCH_EVENTS || '10000', 10) || 10000;
    this.maxBuffer = parsedMax;

    this.counters = emptyCounters();

    this.state.blockConcurrencyWhile(async () => {
      const [storedCounters, storedBuffer] = await Promise.all([
        this.state.storage.get<any>(STORAGE_KEY_COUNTERS),
        this.state.storage.get<AnalyticsEvent[]>(STORAGE_KEY_BUFFER),
      ]);

      this.counters = normalizeCounters(storedCounters);

      if (Array.isArray(storedBuffer)) {
        this.buffer = storedBuffer;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname.endsWith('/track')) {
      return this.handleTrack(request);
    }

    if (request.method === 'GET' && url.pathname.endsWith('/stats')) {
      return this.handleStats();
    }

    if (request.method === 'GET' && url.pathname.endsWith('/health')) {
      return this.handleHealth();
    }

    // Debug endpoints (only reachable if Worker forwards them)
    if (request.method === 'POST' && url.pathname.endsWith('/debug/reset')) {
      return this.handleReset();
    }

    if (request.method === 'POST' && url.pathname.endsWith('/debug/flush')) {
      return this.handleFlush();
    }

    return this.json({ ok: true }, 200);
  }

  // ---------------------------------------------------------------------------
  // TRACK
  // ---------------------------------------------------------------------------
  private async handleTrack(request: Request): Promise<Response> {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return this.json({ ok: false, error: 'invalid_json' }, 400);
    }

    const rawEvents = Array.isArray(body?.events) ? body.events : [];
    if (!rawEvents.length) {
      return this.json({ ok: false, error: 'no_events' }, 400);
    }

    const normalized: AnalyticsEvent[] = rawEvents.map(
      (e: any): AnalyticsEvent => ({
        status: e.status === 'success' ? 'success' : 'fail',
        file_type: typeof e.file_type === 'string' ? e.file_type : 'unknown',
        browser: typeof e.browser === 'string' ? e.browser : 'unknown',
        os: typeof e.os === 'string' ? e.os : 'unknown',
        ext_version:
          typeof e.ext_version === 'string' ? e.ext_version : '0.0.0',
        duration_ms:
          typeof e.duration_ms === 'number' && Number.isFinite(e.duration_ms)
            ? e.duration_ms
            : 0,
        bypass_used: !!e.bypass_used,
        error_type:
          typeof e.error_type === 'string' ? e.error_type : undefined,
        language: typeof e.language === 'string' ? e.language : 'unknown',
        timestamp:
          typeof e.timestamp === 'number' && Number.isFinite(e.timestamp)
            ? e.timestamp
            : Date.now(),
      }),
    );

    for (const ev of normalized) {
      this.updateCounters(ev);
    }

    this.buffer.push(...normalized);

    await Promise.all([
      this.state.storage.put(STORAGE_KEY_COUNTERS, this.counters),
      this.state.storage.put(STORAGE_KEY_BUFFER, this.buffer),
    ]);

    if (this.buffer.length >= this.maxBuffer) {
      await this.maybeFlushToOracle();
    }

    return this.json(
      {
        ok: true,
        accepted: normalized.length,
        totalEvents: this.counters.totalEvents,
        totalDownloads: this.counters.totalDownloads,
        totalSuccess: this.counters.totalSuccess,
        totalFail: this.counters.totalFail,
        pendingEvents: this.buffer.length,
        lastEventAt: this.counters.lastEventAt,
        lastFlushAt: this.counters.lastFlushAt,
      },
      202,
    );
  }

  private updateCounters(ev: AnalyticsEvent): void {
    // We recompute from byStatus on load, but we still keep this simple local increment.
    this.counters.totalEvents += 1;

    const statusKey = ev.status || 'unknown';
    this.counters.byStatus[statusKey] =
      (this.counters.byStatus[statusKey] || 0) + 1;

    const typeKey = ev.file_type || 'unknown';
    this.counters.byType[typeKey] =
      (this.counters.byType[typeKey] || 0) + 1;

    const browserKey = ev.browser || 'unknown';
    this.counters.byBrowser[browserKey] =
      (this.counters.byBrowser[browserKey] || 0) + 1;

    const osKey = ev.os || 'unknown';
    this.counters.byOs[osKey] =
      (this.counters.byOs[osKey] || 0) + 1;

    const verKey = ev.ext_version || '0.0.0';
    this.counters.byExtVersion[verKey] =
      (this.counters.byExtVersion[verKey] || 0) + 1;

    const langKey = ev.language || 'unknown';
    this.counters.byLanguage[langKey] =
      (this.counters.byLanguage[langKey] || 0) + 1;

    if (ev.status === 'success') {
      this.counters.totalDownloads += 1;
      this.counters.totalSuccess += 1;
    } else {
      this.counters.totalFail += 1;
    }

    if (
      this.counters.lastEventAt == null ||
      ev.timestamp > this.counters.lastEventAt
    ) {
      this.counters.lastEventAt = ev.timestamp;
    }
  }

  // ---------------------------------------------------------------------------
  // STATS / HEALTH / RESET / FLUSH
  // ---------------------------------------------------------------------------
  private async handleStats(): Promise<Response> {
    // Ensure totals are coherent every time we expose stats
    this.counters = normalizeCounters(this.counters);

    const body = {
      ok: true,
      totalEvents: this.counters.totalEvents,
      totalDownloads: this.counters.totalDownloads,
      totalSuccess: this.counters.totalSuccess,
      totalFail: this.counters.totalFail,
      pendingEvents: this.buffer.length,
      lastEventAt: this.counters.lastEventAt,
      lastFlushAt: this.counters.lastFlushAt,
      counters: {
        byStatus: this.counters.byStatus,
        byType: this.counters.byType,
        byBrowser: this.counters.byBrowser,
        byOs: this.counters.byOs,
        byExtVersion: this.counters.byExtVersion,
        byLanguage: this.counters.byLanguage,
      },
    };

    return this.json(body, 200);
  }

  private async handleHealth(): Promise<Response> {
    this.counters = normalizeCounters(this.counters);

    return this.json(
      {
        ok: true,
        totalEvents: this.counters.totalEvents,
        totalDownloads: this.counters.totalDownloads,
        totalSuccess: this.counters.totalSuccess,
        totalFail: this.counters.totalFail,
        pendingEvents: this.buffer.length,
        lastEventAt: this.counters.lastEventAt,
        lastFlushAt: this.counters.lastFlushAt,
      },
      200,
    );
  }

  private async handleReset(): Promise<Response> {
    this.counters = emptyCounters();
    this.buffer = [];

    await Promise.all([
      this.state.storage.put(STORAGE_KEY_COUNTERS, this.counters),
      this.state.storage.put(STORAGE_KEY_BUFFER, this.buffer),
    ]);

    return this.json({ ok: true, reset: true }, 200);
  }

  private async handleFlush(): Promise<Response> {
    if (this.buffer.length === 0) {
      return this.json(
        { ok: true, flushed: false, reason: 'buffer_empty' },
        200,
      );
    }

    const endpoint = (this.env.ORACLE_ENDPOINT || '').trim();

    // DEV MODE: no Oracle backend yet → just clear buffer and set lastFlushAt.
    if (!endpoint) {
      const count = this.buffer.length;
      this.buffer = [];
      this.counters.lastFlushAt = Date.now();

      await Promise.all([
        this.state.storage.put(STORAGE_KEY_BUFFER, this.buffer),
        this.state.storage.put(STORAGE_KEY_COUNTERS, this.counters),
      ]);

      return this.json(
        {
          ok: true,
          flushed: true,
          mode: 'local',
          droppedEvents: count,
          note: 'ORACLE_ENDPOINT is empty – buffer cleared only.',
        },
        200,
      );
    }

    // PROD MODE: we have Oracle endpoint.
    const eventsToSend = this.buffer.slice();
    const ok = await this.flushToOracle(endpoint, eventsToSend);
    if (!ok) {
      return this.json(
        { ok: false, flushed: false, reason: 'oracle_failed' },
        502,
      );
    }

    this.buffer = [];
    this.counters.lastFlushAt = Date.now();
    await Promise.all([
      this.state.storage.put(STORAGE_KEY_BUFFER, this.buffer),
      this.state.storage.put(STORAGE_KEY_COUNTERS, this.counters),
    ]);

    return this.json(
      { ok: true, flushed: true, mode: 'oracle', sent: eventsToSend.length },
      200,
    );
  }

  // ---------------------------------------------------------------------------
  // ORACLE
  // ---------------------------------------------------------------------------
  private async maybeFlushToOracle(): Promise<void> {
    const endpoint = (this.env.ORACLE_ENDPOINT || '').trim();
    if (!endpoint || this.buffer.length === 0) return;

    const eventsToSend = this.buffer.slice();
    const ok = await this.flushToOracle(endpoint, eventsToSend);
    if (!ok) return;

    this.buffer = [];
    this.counters.lastFlushAt = Date.now();

    await Promise.all([
      this.state.storage.put(STORAGE_KEY_BUFFER, this.buffer),
      this.state.storage.put(STORAGE_KEY_COUNTERS, this.counters),
    ]);
  }

  private async flushToOracle(
    endpoint: string,
    events: AnalyticsEvent[],
  ): Promise<boolean> {
    try {
      const secret = (this.env.DO_SHARED_SECRET || '').trim();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (secret) headers['X-DO-SECRET'] = secret;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ events }),
      });

      return res.ok;
    } catch (err) {
      console.error('Flush to Oracle failed', err);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // JSON helper
  // ---------------------------------------------------------------------------
  private json(obj: unknown, status = 200): Response {
    return new Response(JSON.stringify(obj), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}
