// src/downloads_do.ts
import type { Env } from './types';

type SpeedBucket = 'fast' | 'medium' | 'slow';

interface DoCounters {
  totalEvents: number;
  totalDownloads: number;
  success: number;
  fail: number;
  byFileType: Record<string, number>;
  byBrowser: Record<string, number>;
  byOS: Record<string, number>;
  byLanguage: Record<string, number>;
  bySpeed: Record<SpeedBucket, number>;
  bypassCount: number;
  lastEventAt?: number;
}

interface PendingAggregate {
  eventCount: number;
  success: number;
  fail: number;
  byFileType: Record<string, number>;
  byBrowser: Record<string, number>;
  byOS: Record<string, number>;
  byLanguage: Record<string, number>;
  bySpeed: Record<SpeedBucket, number>;
  bypassCount: number;
}

interface RetryState {
  backoffMs: number;
  lastError?: string;
}

const COUNTERS_KEY = 'counters';
const PENDING_KEY = 'pending';
const RETRY_STATE_KEY = 'retry_state';

const MIN_BACKOFF_MS = 60_000;           // 1 min
const MAX_BACKOFF_MS = 60 * 60 * 1000;   // 1 hour

function blankCounters(): DoCounters {
  return {
    totalEvents: 0,
    totalDownloads: 0,
    success: 0,
    fail: 0,
    byFileType: {},
    byBrowser: {},
    byOS: {},
    byLanguage: {},
    bySpeed: { fast: 0, medium: 0, slow: 0 },
    bypassCount: 0,
    lastEventAt: undefined,
  };
}

function blankPending(): PendingAggregate {
  return {
    eventCount: 0,
    success: 0,
    fail: 0,
    byFileType: {},
    byBrowser: {},
    byOS: {},
    byLanguage: {},
    bySpeed: { fast: 0, medium: 0, slow: 0 },
    bypassCount: 0,
  };
}

function bucketDuration(durationMs: number): SpeedBucket {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'fast';
  if (durationMs <= 3000) return 'fast';
  if (durationMs <= 15000) return 'medium';
  return 'slow';
}

// Mirror (roughly) your extension's type normalization
function normalizeType(raw: unknown): string {
  if (!raw || typeof raw !== 'string') return 'unknown';
  let t = raw.trim().toLowerCase();
  if (!t) return 'unknown';

  if (['doc', 'docx', 'txt', 'rtf'].includes(t)) return 'docs';
  if (['xls', 'xlsx', 'csv'].includes(t)) return 'sheets';
  if (['ppt', 'pptx'].includes(t)) return 'slides';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(t)) return 'images';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(t)) return 'archive';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(t)) return 'video';
  if (['mp3', 'wav', 'aac'].includes(t)) return 'audio';
  return t;
}

function normStr(raw: unknown, fallback: string): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const s = raw.trim();
  return s || fallback;
}

export class DownloadsDurable {
  private state: DurableObjectState;
  private env: Env;
  private maxBatchEvents: number;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    const rawMax = env.MAX_BATCH_EVENTS ? Number(env.MAX_BATCH_EVENTS) : NaN;
    this.maxBatchEvents =
      Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 10_000;

    // Ensure we have base objects initialized
    this.state.blockConcurrencyWhile(async () => {
      const [counters, pending] = await Promise.all([
        this.state.storage.get<DoCounters>(COUNTERS_KEY),
        this.state.storage.get<PendingAggregate>(PENDING_KEY),
      ]);

      if (!counters) {
        await this.state.storage.put(COUNTERS_KEY, blankCounters());
      }
      if (!pending) {
        await this.state.storage.put(PENDING_KEY, blankPending());
      }
    });
  }

  private get remoteEnabled(): boolean {
    const endpoint = this.env.ORACLE_ENDPOINT || '';
    return endpoint.trim().length > 0;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/track') {
      return this.handleTrack(request);
    }

    if (request.method === 'GET' && url.pathname === '/stats') {
      return this.handleStats();
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return this.handleHealth();
    }

    return new Response('Not found (DO)', { status: 404 });
  }

  private async handleTrack(request: Request): Promise<Response> {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return this.json({ error: 'invalid JSON' }, 400);
    }

    const events = Array.isArray(body?.events) ? body.events : [];
    if (!events.length) {
      return this.json({ error: 'no events' }, 400);
    }

    const [countersRaw, pendingRaw] = await Promise.all([
      this.state.storage.get<DoCounters>(COUNTERS_KEY),
      this.state.storage.get<PendingAggregate>(PENDING_KEY),
    ]);

    const counters = countersRaw || blankCounters();
    const pending = pendingRaw || blankPending();

    let accepted = 0;

    for (const raw of events) {
      if (!raw || typeof raw !== 'object') continue;

      const status = raw.status === 'success' ? 'success' : 'fail';
      const type = normalizeType(raw.file_type);
      const browser = normStr(raw.browser, 'unknown');
      const os = normStr(raw.os, 'unknown');
      const lang = normStr(raw.language, 'unknown').toLowerCase();
      const durationMs =
        typeof raw.duration_ms === 'number' ? raw.duration_ms : 0;
      const speed = bucketDuration(durationMs);
      const bypass = !!raw.bypass_used;
      const ts =
        typeof raw.timestamp === 'number' ? raw.timestamp : Date.now();

      // Global counters
      counters.totalEvents += 1;
      if (status === 'success') {
        counters.success += 1;
        counters.totalDownloads += 1;
      } else {
        counters.fail += 1;
      }

      counters.byFileType[type] = (counters.byFileType[type] || 0) + 1;
      counters.byBrowser[browser] = (counters.byBrowser[browser] || 0) + 1;
      counters.byOS[os] = (counters.byOS[os] || 0) + 1;
      counters.byLanguage[lang] = (counters.byLanguage[lang] || 0) + 1;
      counters.bySpeed[speed] = (counters.bySpeed[speed] || 0) + 1;
      if (bypass) counters.bypassCount += 1;
      counters.lastEventAt = ts;

      // Pending aggregate for future Oracle batches
      pending.eventCount += 1;
      if (status === 'success') pending.success += 1;
      else pending.fail += 1;
      pending.byFileType[type] = (pending.byFileType[type] || 0) + 1;
      pending.byBrowser[browser] = (pending.byBrowser[browser] || 0) + 1;
      pending.byOS[os] = (pending.byOS[os] || 0) + 1;
      pending.byLanguage[lang] = (pending.byLanguage[lang] || 0) + 1;
      pending.bySpeed[speed] = (pending.bySpeed[speed] || 0) + 1;
      if (bypass) pending.bypassCount += 1;

      accepted += 1;
    }

    await Promise.all([
      this.state.storage.put(COUNTERS_KEY, counters),
      this.state.storage.put(PENDING_KEY, pending),
    ]);

    // If enough events are pending, try to flush in the background
    if (pending.eventCount >= this.maxBatchEvents) {
      this.state.waitUntil(this.thresholdFlush());
    }

    return this.json({ accepted }, 202);
  }

  private async handleStats(): Promise<Response> {
    const counters =
      (await this.state.storage.get<DoCounters>(COUNTERS_KEY)) ||
      blankCounters();
    return this.json({ ok: true, counters }, 200);
  }

  private async handleHealth(): Promise<Response> {
    const [counters, pending, retry] = await Promise.all([
      this.state.storage.get<DoCounters>(COUNTERS_KEY),
      this.state.storage.get<PendingAggregate>(PENDING_KEY),
      this.state.storage.get<RetryState>(RETRY_STATE_KEY),
    ]);

    const body = {
      ok: true,
      totalEvents: counters?.totalEvents ?? 0,
      lastEventAt: counters?.lastEventAt ?? null,
      pendingEvents: pending?.eventCount ?? 0,
      retryState: retry ?? null,
    };

    return this.json(body, 200);
  }

  // Called when pending.eventCount >= maxBatchEvents
  private async thresholdFlush(): Promise<void> {
    const pending =
      (await this.state.storage.get<PendingAggregate>(PENDING_KEY)) ||
      blankPending();
    if (!pending.eventCount) return;

    const ok = await this.flushPendingToOracle(pending);
    if (ok) {
      await this.state.storage.put(PENDING_KEY, blankPending());
      await this.state.storage.delete(RETRY_STATE_KEY);
    } else {
      await this.scheduleRetry('threshold flush failed');
    }
  }

  // Step 1: if ORACLE_ENDPOINT is empty, this just returns true and does nothing.
  private async flushPendingToOracle(
    pending: PendingAggregate,
  ): Promise<boolean> {
    if (!pending.eventCount) return true;

    if (!this.remoteEnabled) {
      // Step 1: Oracle is not configured yet.
      // We treat this as "logically flushed" and keep all global counters
      // in DO storage only. No remote dependency.
      return true;
    }

    const endpoint = (this.env.ORACLE_ENDPOINT || '').trim();
    const secret = (this.env.DO_SHARED_SECRET || '').trim();

    const payload = {
      batchId: `do-${this.state.id.toString()}-${Date.now()}`,
      eventCount: pending.eventCount,
      counters: pending,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (secret) {
      // Step 2: your Go backend will validate this header
      headers['X-DO-SECRET'] = secret;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      console.error('[DO] flushPendingToOracle error:', err);
      return false;
    }
  }

  private async scheduleRetry(lastError?: string): Promise<void> {
    if (!this.remoteEnabled) {
      // No Oracle configured => do not schedule retries.
      return;
    }

    const now = Date.now();
    const current =
      (await this.state.storage.get<RetryState>(RETRY_STATE_KEY)) || {
        backoffMs: MIN_BACKOFF_MS,
      };

    let backoff = current.backoffMs || MIN_BACKOFF_MS;
    backoff = Math.min(
      Math.max(backoff * 2, MIN_BACKOFF_MS),
      MAX_BACKOFF_MS,
    );

    const nextTime = now + backoff;
    const nextRetry: RetryState = {
      backoffMs: backoff,
      lastError: lastError || current.lastError,
    };

    await this.state.storage.put(RETRY_STATE_KEY, nextRetry);
    await this.state.storage.setAlarm(nextTime);
  }

  // Called by Cloudflare when alarm triggers
  async alarm(_alarmTime: number): Promise<void> {
    if (!this.remoteEnabled) {
      return;
    }

    const pending =
      (await this.state.storage.get<PendingAggregate>(PENDING_KEY)) ||
      blankPending();
    if (!pending.eventCount) {
      await this.state.storage.delete(RETRY_STATE_KEY);
      return;
    }

    const ok = await this.flushPendingToOracle(pending);
    if (ok) {
      await this.state.storage.put(PENDING_KEY, blankPending());
      await this.state.storage.delete(RETRY_STATE_KEY);
    } else {
      await this.scheduleRetry('alarm flush failed');
    }
  }

  private json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}