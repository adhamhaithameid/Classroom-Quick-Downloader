// src/downloads_do.ts
// Durable Object implementation for analytics aggregation + buffering.

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

    // Default counters in case nothing is stored yet.
    this.counters = {
      totalEvents: 0,
      totalDownloads: 0,
      byStatus: {},
      byType: {},
      byBrowser: {},
      byOs: {},
      byExtVersion: {},
      byLanguage: {},
      lastEventAt: null,
      lastFlushAt: null,
    };

    // Initialize from durable storage once.
    this.state.blockConcurrencyWhile(async () => {
      const [storedCounters, storedBuffer] = await Promise.all([
        this.state.storage.get<Counters>(STORAGE_KEY_COUNTERS),
        this.state.storage.get<AnalyticsEvent[]>(STORAGE_KEY_BUFFER),
      ]);

      if (storedCounters) {
        this.counters = {
          ...this.counters,
          ...storedCounters,
        };
      }

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

    // Fallback: DO is alive but endpoint not recognized.
    return new Response('OK', { status: 200 });
  }

  // ---------------------------
  // Track ingestion
  // ---------------------------

  private async handleTrack(request: Request): Promise<Response> {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return this.json(
        { ok: false, error: 'invalid_json' },
        400,
      );
    }

    const rawEvents = Array.isArray(body?.events) ? body.events : [];
    if (!rawEvents.length) {
      return this.json(
        { ok: false, error: 'no_events' },
        400,
      );
    }

    const normalized: AnalyticsEvent[] = rawEvents.map(
      (e: any): AnalyticsEvent => ({
        status: e.status === 'success' ? 'success' : 'fail',
        file_type:
          typeof e.file_type === 'string'
            ? e.file_type
            : 'unknown',
        browser:
          typeof e.browser === 'string'
            ? e.browser
            : 'unknown',
        os:
          typeof e.os === 'string'
            ? e.os
            : 'unknown',
        ext_version:
          typeof e.ext_version === 'string'
            ? e.ext_version
            : '0.0.0',
        duration_ms:
          typeof e.duration_ms === 'number' && Number.isFinite(e.duration_ms)
            ? e.duration_ms
            : 0,
        bypass_used: !!e.bypass_used,
        error_type:
          typeof e.error_type === 'string'
            ? e.error_type
            : undefined,
        language:
          typeof e.language === 'string'
            ? e.language
            : 'unknown',
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

    // Optional: flush to Oracle when threshold reached AND endpoint configured.
    if (this.buffer.length >= this.maxBuffer) {
      await this.maybeFlushToOracle();
    }

    return this.json(
      {
        ok: true,
        accepted: normalized.length,
        totalEvents: this.counters.totalEvents,
        totalDownloads: this.counters.totalDownloads,
        pendingEvents: this.buffer.length,
        lastEventAt: this.counters.lastEventAt,
        lastFlushAt: this.counters.lastFlushAt,
      },
      202,
    );
  }

  private updateCounters(ev: AnalyticsEvent): void {
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
    }

    if (
      this.counters.lastEventAt == null ||
      ev.timestamp > this.counters.lastEventAt
    ) {
      this.counters.lastEventAt = ev.timestamp;
    }
  }

  // ---------------------------
  // /stats endpoint
  // ---------------------------

  private async handleStats(): Promise<Response> {
    const body = {
      ok: true,
      totalEvents: this.counters.totalEvents,
      totalDownloads: this.counters.totalDownloads,
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

  // ---------------------------
  // /health endpoint
  // ---------------------------

  private async handleHealth(): Promise<Response> {
    const body = {
      ok: true,
      totalEvents: this.counters.totalEvents,
      totalDownloads: this.counters.totalDownloads,
      pendingEvents: this.buffer.length,
      lastEventAt: this.counters.lastEventAt,
      lastFlushAt: this.counters.lastFlushAt,
    };
    return this.json(body, 200);
  }

  // ---------------------------
  // Optional Oracle flush
  // ---------------------------

  private async maybeFlushToOracle(): Promise<void> {
    const endpoint = (this.env.ORACLE_ENDPOINT || '').trim();
    if (!endpoint || this.buffer.length === 0) {
      // No remote configured or nothing to send yet.
      return;
    }

    const eventsToSend = this.buffer.slice();

    const ok = await this.flushToOracle(endpoint, eventsToSend);
    if (!ok) {
      // Leave buffer intact; will try again later when threshold hit again.
      return;
    }

    // Remote accepted → clear buffer, store updated counters.
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
      if (secret) {
        headers['X-DO-SECRET'] = secret;
      }

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

  // ---------------------------
  // Response helper
  // ---------------------------

  private json(obj: unknown, status = 200): Response {
    return new Response(JSON.stringify(obj), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}