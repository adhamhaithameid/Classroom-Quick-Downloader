// filepath: cloudflare-worker/src/downloads_do.ts

import {
  Counters,
  RetryState,
  StatsResponse,
  ConfigResponse,
  QuotaDescriptor,
  StoredEvent,
  EnvSnapshot,
  OracleBatch,
  TimeBucket,
  BucketTotals,
  BucketCounters,
  DOStateBatch,
} from "./types";

export interface Env {
  ORACLE_ENDPOINT: string;
  DO_SHARED_SECRET: string;
  MAX_BATCH_EVENTS: string;
}

type DurableStateShape = {
  totalEvents: number;
  totalDownloads: number;
  totalSuccess: number;
  totalFail: number;
  pendingEvents: number;
  lastEventAt: number | null;
  lastFlushAt: number | null;
  counters: Counters;
  retryState: RetryState | null;

  // daily request counting for quota awareness
  reqCountToday: number;
  reqCountDate: string | null; // "YYYY-MM-DD" UTC

  // admin switch: when true, remote analytics is forced OFF
  hardRemoteOff: boolean;

  // Buffered events waiting to be flushed to Oracle
  buffer: StoredEvent[];
  
  // Monotonically increasing batch sequence number for stable batchId across retries
  // Only incremented after successful flush to Oracle
  batchSeq: number;
};

const DEFAULT_COUNTERS: Counters = {
  byStatus: {},
  byType: {},
  byBrowser: {},
  byOs: {},
  byExtVersion: {},
  byLanguage: {},
  byCountry: {},
  byErrorType: {}, // NEW
};

const DEFAULT_RETRY_STATE: RetryState = {
  consecutiveFailures: 0,
};

// Quota thresholds (approx. Cloudflare daily request quotas)
const QUOTA_VERY_SOFT_LIMIT = 30_000;
const QUOTA_SOFT_LIMIT = 40_000;
const QUOTA_VERY_NORMAL_LIMIT = 50_000;
const QUOTA_NORMAL_LIMIT = 60_000;
const QUOTA_HARD_NORMAL_LIMIT = 70_000;
const QUOTA_HARD_LIMIT = 80_000;
const QUOTA_VERY_HARD_LIMIT = 90_000;

// Storage key inside DO storage
const STORAGE_KEY = "analytics_state";

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Decide quota level, mode label, remoteEnabled and batchSizeSuggestion
 * from the current daily request count.
 */
function computeQuotaDescriptor(
  requestsToday: number,
  hardRemoteOff: boolean,
): QuotaDescriptor {
  let quotaLevel = "BELOW_LIMITS";
  let modeLabel = "chill";
  let batchSizeSuggestion = 50;
  let remoteEnabled = !hardRemoteOff;

  if (requestsToday >= QUOTA_VERY_SOFT_LIMIT) {
    quotaLevel = "QUOTA_VERY_SOFT_LIMIT";
    modeLabel = "kinda easy";
    batchSizeSuggestion = 100;
  }
  if (requestsToday >= QUOTA_SOFT_LIMIT) {
    quotaLevel = "QUOTA_SOFT_LIMIT";
    modeLabel = "normal";
    batchSizeSuggestion = 150;
  }
  if (requestsToday >= QUOTA_VERY_NORMAL_LIMIT) {
    quotaLevel = "QUOTA_VERY_NORMAL_LIMIT";
    modeLabel = "slightly busy";
    batchSizeSuggestion = 200;
  }
  if (requestsToday >= QUOTA_NORMAL_LIMIT) {
    quotaLevel = "QUOTA_NORMAL_LIMIT";
    modeLabel = "kinda busy";
    batchSizeSuggestion = 250;
  }
  if (requestsToday >= QUOTA_HARD_NORMAL_LIMIT) {
    quotaLevel = "QUOTA_HARD_NORMAL_LIMIT";
    modeLabel = "busy";
    batchSizeSuggestion = 300;
  }
  if (requestsToday >= QUOTA_HARD_LIMIT) {
    quotaLevel = "QUOTA_HARD_LIMIT";
    modeLabel = "very busy";
    batchSizeSuggestion = 500;
  }
  if (requestsToday >= QUOTA_VERY_HARD_LIMIT) {
    quotaLevel = "QUOTA_VERY_HARD_LIMIT";
    modeLabel = "emergency";
    // At this point, we effectively "cut power" to remote analytics.
    remoteEnabled = false;
  }

  if (hardRemoteOff) {
    // Admin override / Danger Zone toggle.
    remoteEnabled = false;
    if (requestsToday < QUOTA_VERY_HARD_LIMIT) {
      quotaLevel = "ADMIN_REMOTE_OFF";
      modeLabel = "admin-cut-power";
    }
  }

  return {
    requestsToday,
    quotaLevel,
    modeLabel,
    remoteEnabled,
    batchSizeSuggestion,
  };
}

function json<T>(obj: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(obj), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Durable Object class
// ---------------------------------------------------------------------------

export class DownloadsDurable {
  private state: DurableObjectState;
  private env: Env;
  private data: DurableStateShape | null = null;
  private loaded: Promise<void>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.loaded = this.load();
  }

  // ---------------------------------------------------------------------------
  // Loading & persistence
  // ---------------------------------------------------------------------------

  private async load(): Promise<void> {
    const stored = await this.state.storage.get<DurableStateShape>(STORAGE_KEY);

    const base: DurableStateShape = {
      totalEvents: 0,
      totalDownloads: 0,
      totalSuccess: 0,
      totalFail: 0,
      pendingEvents: 0,
      lastEventAt: null,
      lastFlushAt: null,
      counters: { ...DEFAULT_COUNTERS },
      retryState: { ...DEFAULT_RETRY_STATE },

      reqCountToday: 0,
      reqCountDate: null,
      hardRemoteOff: false,

      buffer: [],
      batchSeq: 0,
    };

    if (!stored) {
      this.data = base;
      return;
    }

    // Merge stored with defaults to be robust to schema changes.
    this.data = {
      totalEvents: stored.totalEvents ?? base.totalEvents,
      totalDownloads: stored.totalDownloads ?? base.totalDownloads,
      totalSuccess: stored.totalSuccess ?? base.totalSuccess,
      totalFail: stored.totalFail ?? base.totalFail,
      pendingEvents: stored.pendingEvents ?? base.pendingEvents,
      lastEventAt: stored.lastEventAt ?? base.lastEventAt,
      lastFlushAt: stored.lastFlushAt ?? base.lastFlushAt,
      counters: {
        byStatus: stored.counters?.byStatus ?? { ...DEFAULT_COUNTERS.byStatus },
        byType: stored.counters?.byType ?? { ...DEFAULT_COUNTERS.byType },
        byBrowser:
          stored.counters?.byBrowser ?? { ...DEFAULT_COUNTERS.byBrowser },
        byOs: stored.counters?.byOs ?? { ...DEFAULT_COUNTERS.byOs },
        byExtVersion:
          stored.counters?.byExtVersion ?? { ...DEFAULT_COUNTERS.byExtVersion },
        byLanguage:
          stored.counters?.byLanguage ?? { ...DEFAULT_COUNTERS.byLanguage },
        byCountry:
          stored.counters?.byCountry ?? { ...DEFAULT_COUNTERS.byCountry },
        byErrorType:
          stored.counters?.byErrorType ?? { ...DEFAULT_COUNTERS.byErrorType },
      },
      retryState: stored.retryState ?? { ...DEFAULT_RETRY_STATE },

      reqCountToday: stored.reqCountToday ?? 0,
      reqCountDate: stored.reqCountDate ?? null,
      hardRemoteOff: stored.hardRemoteOff ?? false,

      buffer: Array.isArray(stored.buffer) ? stored.buffer : [],
      batchSeq: stored.batchSeq ?? 0,
    };
  }

  private async persist(): Promise<void> {
    if (!this.data) return;
    await this.state.storage.put(STORAGE_KEY, this.data);
  }

  private get d(): DurableStateShape {
    if (!this.data) {
      throw new Error("DurableObject state not loaded yet");
    }
    return this.data;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Ensure reqCountToday is for the current UTC day. Resets counters
   * when the day changes.
   */
  private ensureRequestDay(): void {
    const today = todayUtcDate();
    if (this.d.reqCountDate !== today) {
      this.d.reqCountDate = today;
      this.d.reqCountToday = 0;
      // hardRemoteOff is NOT reset automatically here.
    }
  }

  private isAuthorizedAdmin(request: Request): boolean {
    const header = request.headers.get("X-Admin-Secret") || "";
    const expected = this.env.DO_SHARED_SECRET;
    if (!expected) return false;
    return header === expected;
  }

  // ---------------------------------------------------------------------------
  // Core fetch router
  // ---------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    await this.loaded;

    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/track" && request.method === "POST") {
      return this.handleTrack(request);
    }

    if (pathname === "/stats" && request.method === "GET") {
      return this.handleStats();
    }

    if (pathname === "/config" && request.method === "GET") {
      return this.handleConfig();
    }

    if (pathname === "/health" && request.method === "GET") {
      return this.handleHealth();
    }

    if (pathname === "/debug/flush" && request.method === "POST") {
      // Require admin auth for debug endpoints
      if (!this.isAuthorizedAdmin(request)) {
        return json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      return this.handleDebugFlush();
    }

    if (pathname === "/debug/reset" && request.method === "POST") {
      // Require admin auth for debug endpoints
      if (!this.isAuthorizedAdmin(request)) {
        return json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      return this.handleDebugReset();
    }

    if (pathname === "/admin/force-flush" && request.method === "POST") {
      return this.handleAdminForceFlush(request);
    }

    if (pathname === "/admin/cut-power" && request.method === "POST") {
      return this.handleAdminCutPower(request);
    }

    if (pathname === "/admin/restore-power" && request.method === "POST") {
      return this.handleAdminRestorePower(request);
    }

    if (pathname === "/admin/full-sync" && request.method === "POST") {
      return this.handleAdminFullSync(request);
    }

    return new Response("Not found (DO)", { status: 404 });
  }

  // ---------------------------------------------------------------------------
  // Alarms for retry / backoff
  // ---------------------------------------------------------------------------

  async alarm(): Promise<void> {
    await this.loaded;
    if (!this.d.retryState || !this.d.retryState.nextRetryAt) return;

    const now = Date.now();
    if (now >= this.d.retryState.nextRetryAt) {
      await this.flushToOracle(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private async handleTrack(request: Request): Promise<Response> {
    // Update daily request counters
    this.ensureRequestDay();
    this.d.reqCountToday += 1;

    let body: { events?: StoredEvent[] } | null = null;
    try {
      body = await request.json();
    } catch {
      await this.persist();
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const events = body?.events;
    if (!Array.isArray(events) || events.length === 0) {
      await this.persist();
      return json({ ok: true, accepted: 0 }, { status: 202 });
    }

    // Input validation: cap events per request to prevent abuse
    const MAX_EVENTS_PER_REQUEST = 500;
    const MAX_BUFFER_SIZE = 50_000;
    
    if (events.length > MAX_EVENTS_PER_REQUEST) {
      return json({ ok: false, error: "too_many_events", max: MAX_EVENTS_PER_REQUEST }, { status: 400 });
    }
    
    // Prevent buffer from growing too large (drop request if at limit)
    if (this.d.buffer.length >= MAX_BUFFER_SIZE) {
      return json({ ok: false, error: "buffer_full", bufferSize: this.d.buffer.length }, { status: 503 });
    }

    // Append to buffer + update counters
    for (const ev of events) {
      this.d.buffer.push(ev);
      this.d.totalEvents += 1;
      
      // totalDownloads = all download attempts (success + fail)
      this.d.totalDownloads += 1;

      if (ev.status === "success") {
        this.d.totalSuccess += 1;
      } else {
        this.d.totalFail += 1;
      }

      this.d.pendingEvents += 1;
      this.d.lastEventAt = ev.timestamp ?? Date.now();

      // Update counters
      const c = this.d.counters;
      c.byStatus[ev.status] = (c.byStatus[ev.status] || 0) + 1;

      const type = (ev.file_type || "unknown").toLowerCase();
      c.byType[type] = (c.byType[type] || 0) + 1;

      const browser = (ev.browser || "unknown").toLowerCase();
      c.byBrowser[browser] = (c.byBrowser[browser] || 0) + 1;

      const os = (ev.os || "unknown").toLowerCase();
      c.byOs[os] = (c.byOs[os] || 0) + 1;

      const extVersion = ev.ext_version || "0.0.0";
      c.byExtVersion[extVersion] =
        (c.byExtVersion[extVersion] || 0) + 1;

      const lang = (ev.language || "unknown").toLowerCase();
      c.byLanguage[lang] = (c.byLanguage[lang] || 0) + 1;

      const country = (ev.country || "unknown").toLowerCase();
      c.byCountry[country] = (c.byCountry[country] || 0) + 1;

      // NEW: error-type counter (only for fails)
      if (ev.status === "fail") {
        const errKey = (ev.error_type || "unknown").toLowerCase();
        c.byErrorType[errKey] = (c.byErrorType[errKey] || 0) + 1;
      }
    }

    await this.persist();

    // Size-based flush to Oracle
    const maxBatch =
      parseInt(this.env.MAX_BATCH_EVENTS || "500", 10) || 500;

    if (this.d.buffer.length >= maxBatch) {
      await this.flushToOracle(false);
    }

    return json({ ok: true, accepted: events.length }, { status: 202 });
  }

  private async handleStats(): Promise<Response> {
    this.ensureRequestDay();
    const quota = computeQuotaDescriptor(
      this.d.reqCountToday,
      this.d.hardRemoteOff,
    );

    const envSnapshot: EnvSnapshot = {
      maxBatchEvents: this.env.MAX_BATCH_EVENTS || "n/a",
      oracleEndpoint: this.env.ORACLE_ENDPOINT || "unknown",
    };

    const payload: StatsResponse = {
      ok: true,
      totalEvents: this.d.totalEvents,
      totalDownloads: this.d.totalDownloads,
      totalSuccess: this.d.totalSuccess,
      totalFail: this.d.totalFail,
      pendingEvents: this.d.pendingEvents,
      lastEventAt: this.d.lastEventAt,
      lastFlushAt: this.d.lastFlushAt,
      counters: this.d.counters,
      retryState: this.d.retryState,
      quota,
      envSnapshot,
    };

    return json(payload);
  }

  /**
   * Config endpoint used by the extension to adapt batching / flush behaviour.
   */
  private async handleConfig(): Promise<Response> {
    this.ensureRequestDay();
    const quota = computeQuotaDescriptor(
      this.d.reqCountToday,
      this.d.hardRemoteOff,
    );

    const config: ConfigResponse = {
      ok: true,
      batchSize: quota.batchSizeSuggestion,
      timeFlushMinutes: {
        low: 120,
        mid: 60,
        high: 30,
      },
      remoteEnabled: quota.remoteEnabled,
      quota,
    };

    return json(config);
  }

  private async handleHealth(): Promise<Response> {
    this.ensureRequestDay();
    return json({
      ok: true,
      pendingEvents: this.d.pendingEvents,
      lastEventAt: this.d.lastEventAt,
      lastFlushAt: this.d.lastFlushAt,
    });
  }

  private async handleDebugFlush(): Promise<Response> {
    const before = this.d.buffer.length;
    return json({
      ok: true,
      message: "debug flush not implemented in this step",
      bufferSize: before,
    });
  }

  private async handleDebugReset(): Promise<Response> {
    const today = todayUtcDate();
    this.data = {
      totalEvents: 0,
      totalDownloads: 0,
      totalSuccess: 0,
      totalFail: 0,
      pendingEvents: 0,
      lastEventAt: null,
      lastFlushAt: null,
      counters: { ...DEFAULT_COUNTERS },
      retryState: { ...DEFAULT_RETRY_STATE },
      reqCountToday: 0,
      reqCountDate: today,
      hardRemoteOff: false,
      buffer: [],
      batchSeq: 0,
    };
    await this.state.storage.delete(STORAGE_KEY);
    await this.state.storage.deleteAlarm();
    await this.persist();
    return json({ ok: true, message: "state reset" });
  }

  private async handleAdminForceFlush(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const result = await this.flushToOracle(true);
    if (!result.ok) {
      return json(
        {
          ok: false,
          error: result.error || "flush_failed",
          remaining: this.d.buffer.length,
        },
        { status: 500 },
      );
    }

    return json({
      ok: true,
      sent: result.sent,
      remaining: this.d.buffer.length,
    });
  }

  private async handleAdminCutPower(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    this.d.hardRemoteOff = true;
    await this.persist();

    const quota = computeQuotaDescriptor(
      this.d.reqCountToday,
      this.d.hardRemoteOff,
    );

    return json({
      ok: true,
      remoteEnabled: quota.remoteEnabled,
      quotaLevel: quota.quotaLevel,
      modeLabel: quota.modeLabel,
    });
  }

  private async handleAdminRestorePower(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    this.d.hardRemoteOff = false;
    await this.persist();

    const quota = computeQuotaDescriptor(
      this.d.reqCountToday,
      this.d.hardRemoteOff,
    );

    return json({
      ok: true,
      remoteEnabled: quota.remoteEnabled,
      quotaLevel: quota.quotaLevel,
      modeLabel: quota.modeLabel,
    });
  }

  private async handleAdminFullSync(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let iterations = 0;
    let lastError: string | undefined;

    while (this.d.buffer.length > 0 && iterations < 20) {
      const result = await this.flushToOracle(true);
      if (!result.ok) {
        lastError = result.error;
        break;
      }
      iterations++;
    }

    const ok = this.d.buffer.length === 0 && !lastError;

    return json({
      ok,
      remaining: this.d.buffer.length,
      iterations,
      error: lastError,
    });
  }

  // ---------------------------------------------------------------------------
  // Oracle flush + retry/backoff
  // ---------------------------------------------------------------------------

  private async scheduleRetry(): Promise<void> {
    if (!this.d.retryState) {
      this.d.retryState = { ...DEFAULT_RETRY_STATE };
    }

    const rs = this.d.retryState;
    const backoffStepsSeconds = [
      60, // 1 min
      300, // 5 min
      900, // 15 min
      1800, // 30 min
      3600, // 1 hour
      21_600, // 6 hours
      43_200, // 12 hours
      86_400, // 1 day
    ];
    // FIX: first failure (1) should map to index 0 (60s)
    const idx = Math.min(
      Math.max((rs.consecutiveFailures || 0) - 1, 0),
      backoffStepsSeconds.length - 1,
    );
    const backoffSec = backoffStepsSeconds[idx];
    const nextMs = Date.now() + backoffSec * 1000;

    rs.nextRetryAt = nextMs;
    await this.state.storage.setAlarm(nextMs);
  }

  /**
   * Build an aggregated OracleBatch from raw events in buffer.
   * Groups events by hour and aggregates counters.
   */
  private buildOracleBatch(events: StoredEvent[]): OracleBatch {
    const now = Date.now();
    
    // Group events by hour bucket
    const hourBuckets = new Map<string, StoredEvent[]>();
    for (const ev of events) {
      const ts = ev.timestamp || now;
      const d = new Date(ts);
      // Truncate to hour: "2025-12-11T03:00:00Z"
      const hourKey = d.toISOString().slice(0, 13) + ":00:00Z";
      if (!hourBuckets.has(hourKey)) {
        hourBuckets.set(hourKey, []);
      }
      hourBuckets.get(hourKey)!.push(ev);
    }

    // Aggregate each hour bucket
    const timeBuckets: TimeBucket[] = [];
    for (const [hourStart, evs] of hourBuckets) {
      const bucket = this.aggregateBucket(hourStart, evs);
      timeBuckets.push(bucket);
    }

    // Sort by bucket start
    timeBuckets.sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));

    // Build DO state snapshot
    const quota = computeQuotaDescriptor(this.d.reqCountToday, this.d.hardRemoteOff);
    const doState: DOStateBatch = {
      ok: true,
      totalEvents: this.d.totalEvents,
      totalDownloads: this.d.totalDownloads,
      totalSuccess: this.d.totalSuccess,
      totalFail: this.d.totalFail,
      pendingEvents: this.d.pendingEvents,
      lastEventAt: this.d.lastEventAt,
      lastFlushAt: this.d.lastFlushAt,
      quota,
      envSnapshot: {
        maxBatchEvents: this.env.MAX_BATCH_EVENTS || "n/a",
        oracleEndpoint: this.env.ORACLE_ENDPOINT || "unknown",
      },
    };

    // Generate stable batch ID using sequence number (doesn't change on retry)
    // batchSeq is only incremented after successful flush
    const batchId = `do-seq${this.d.batchSeq}-${events.length}ev`;

    return {
      batchId,
      generatedAt: now,
      timeZone: "UTC",
      timeBuckets,
      doState,
    };
  }

  private aggregateBucket(hourStart: string, events: StoredEvent[]): TimeBucket {
    const totals: BucketTotals = {
      totalEvents: events.length,
      totalDownloads: 0,
      totalSuccess: 0,
      totalFail: 0,
    };

    const counters: BucketCounters = {
      byStatus: {},
      byType: {},
      byBrowser: {},
      byOs: {},
      byExtVersion: {},
      byLanguage: {},
      byCountry: {},
      byErrorType: {},
    };

    for (const ev of events) {
      // totalDownloads = all download attempts (success + fail)
      totals.totalDownloads++;
      
      if (ev.status === "success") {
        totals.totalSuccess++;
      } else {
        totals.totalFail++;
      }

      // Aggregate counters
      const status = ev.status || "unknown";
      counters.byStatus[status] = (counters.byStatus[status] || 0) + 1;

      const type = (ev.file_type || "unknown").toLowerCase();
      counters.byType[type] = (counters.byType[type] || 0) + 1;

      const browser = (ev.browser || "unknown").toLowerCase();
      counters.byBrowser[browser] = (counters.byBrowser[browser] || 0) + 1;

      const os = (ev.os || "unknown").toLowerCase();
      counters.byOs[os] = (counters.byOs[os] || 0) + 1;

      const extVer = ev.ext_version || "0.0.0";
      counters.byExtVersion[extVer] = (counters.byExtVersion[extVer] || 0) + 1;

      const lang = (ev.language || "unknown").toLowerCase();
      counters.byLanguage[lang] = (counters.byLanguage[lang] || 0) + 1;

      const country = (ev.country || "unknown").toLowerCase();
      counters.byCountry[country] = (counters.byCountry[country] || 0) + 1;

      if (ev.status === "fail") {
        const errType = (ev.error_type || "unknown").toLowerCase();
        counters.byErrorType[errType] = (counters.byErrorType[errType] || 0) + 1;
      }
    }

    // Calculate bucket end (1 hour later)
    const startDate = new Date(hourStart);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const bucketEnd = endDate.toISOString().slice(0, 19) + "Z";

    return {
      bucketStart: hourStart,
      bucketEnd,
      totals,
      counters,
    };
  }

  private async flushToOracle(
    force: boolean,
  ): Promise<{ ok: boolean; sent: number; error?: string }> {
    const now = Date.now();

    if (!this.d.buffer.length) {
      // Nothing to flush; clear retry state + alarm.
      this.d.lastFlushAt = now;
      this.d.retryState = { ...DEFAULT_RETRY_STATE };
      await this.state.storage.deleteAlarm();
      await this.persist();
      return { ok: true, sent: 0 };
    }

    if (!this.env.ORACLE_ENDPOINT || !this.env.DO_SHARED_SECRET) {
      const msg = "ORACLE_ENDPOINT or DO_SHARED_SECRET not configured";
      if (!this.d.retryState) this.d.retryState = { ...DEFAULT_RETRY_STATE };
      this.d.retryState.lastError = msg;
      this.d.retryState.lastFlushAttemptAt = now;
      // Don't schedule retries if endpoint is missing - just report error
      await this.state.storage.deleteAlarm();
      await this.persist();
      return { ok: false, sent: 0, error: msg };
    }

    const maxBatchEnv =
      parseInt(this.env.MAX_BATCH_EVENTS || "500", 10) || 500;
    // FIX: even "force" should chunk; force just means "try now / bypass gating"
    const eventsToFlush = this.d.buffer.slice(0, maxBatchEnv);

    if (!this.d.retryState) this.d.retryState = { ...DEFAULT_RETRY_STATE };
    this.d.retryState.lastFlushAttemptAt = now;

    // Build aggregated batch (groups by hour, aggregates counters)
    const oracleBatch = this.buildOracleBatch(eventsToFlush);

    try {
      // Send to /ingest-batch endpoint (aggregated format)
      const res = await fetch(this.env.ORACLE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DO-SECRET": this.env.DO_SHARED_SECRET,
        },
        body: JSON.stringify(oracleBatch),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const msg = `Oracle responded ${res.status} ${res.statusText} ${text}`;
        this.d.retryState.lastError = msg;
        this.d.retryState.consecutiveFailures += 1;
        await this.scheduleRetry();
        await this.persist();
        return { ok: false, sent: 0, error: msg };
      }

      // Success: drop the sent events and increment batch sequence
      this.d.buffer = this.d.buffer.slice(eventsToFlush.length);
      this.d.pendingEvents = Math.max(
        0,
        this.d.pendingEvents - eventsToFlush.length,
      );
      this.d.lastFlushAt = now;
      this.d.batchSeq += 1; // Increment so next batch gets new ID
      this.d.retryState = { ...DEFAULT_RETRY_STATE };
      await this.state.storage.deleteAlarm();
      await this.persist();

      return { ok: true, sent: eventsToFlush.length };
    } catch (err: any) {
      const msg = `Oracle flush error: ${String(err)}`;
      if (!this.d.retryState) this.d.retryState = { ...DEFAULT_RETRY_STATE };
      this.d.retryState.lastError = msg;
      this.d.retryState.consecutiveFailures += 1;
      await this.scheduleRetry();
      await this.persist();
      return { ok: false, sent: 0, error: msg };
    }
  }
}