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
  BatchSummary,
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
  totalCancelled: number;
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

  // --- Security / Anti-Abuse ---
  // Tracks requests per IP (for monitoring, not enforcement)
  ipCounts: Record<string, number>;
  
  // Set of recently processed event IDs for O(1) idempotency lookup
  processedIds: string[];
  
  // Burst tracking (legacy, kept for compatibility)
  burstCounts: Record<string, { count: number; minute: number }>;

  // =========================================================================
  // REMOTE CONFIG - Controllable from Cloudflare Dashboard
  // =========================================================================
  
  // Extension batching: downloads per request (default: 50)
  configBatchSize: number;
  
  // Extension rate limit: max requests per day (default: 50)
  configMaxDailyRequests: number;
  
  // Extension retry: max retries before dropping event (default: 5)
  configMaxRetry: number;
  
  // Worker validation: max events per request (default: 5000)
  configMaxEventsPerRequest: number;
  
  // Worker buffer: max events in buffer (default: 50000)
  configMaxBufferSize: number;
  
  // Flush mode: 'next_day' | 'time_based' (default: 'next_day')
  // next_day: Only flush at 1:00 AM local time
  // time_based: Flush based on timeFlushMinutes
  configFlushMode: 'next_day' | 'time_based';
  
  // Time-based flush intervals (only used if flushMode is 'time_based')
  configTimeFlushMinutes: {
    low: number;   // queue < 15 events
    mid: number;   // 15-35 events  
    high: number;  // 35+ events
  };

  // Cancel hold delay: time in ms before cancel button becomes active (default: 1000ms)
  // Range: 0-10000ms. Configurable from dashboard to prevent accidental cancels.
  configCancelHoldDelayMs: number;
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
      totalCancelled: 0,
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
      
      ipCounts: {},
      processedIds: [],
      burstCounts: {},

      // Remote config defaults
      configBatchSize: 50,
      configMaxDailyRequests: 50,
      configMaxRetry: 5,
      configMaxEventsPerRequest: 5000,
      configMaxBufferSize: 50000,
      configFlushMode: 'next_day',
      configTimeFlushMinutes: { low: 1440, mid: 1440, high: 1440 }, // 1440 = 24h = next day
      configCancelHoldDelayMs: 1000, // 1 second default
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
      totalCancelled: stored.totalCancelled ?? base.totalCancelled,
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

      ipCounts: stored.ipCounts ?? {},
      processedIds: Array.isArray(stored.processedIds) ? stored.processedIds : [],
      burstCounts: stored.burstCounts ?? {},

      // Remote config - preserve stored values or use defaults
      configBatchSize: stored.configBatchSize ?? base.configBatchSize,
      configMaxDailyRequests: stored.configMaxDailyRequests ?? base.configMaxDailyRequests,
      configMaxRetry: stored.configMaxRetry ?? base.configMaxRetry,
      configMaxEventsPerRequest: stored.configMaxEventsPerRequest ?? base.configMaxEventsPerRequest,
      configMaxBufferSize: stored.configMaxBufferSize ?? base.configMaxBufferSize,
      configFlushMode: stored.configFlushMode ?? base.configFlushMode,
      configTimeFlushMinutes: stored.configTimeFlushMinutes ?? base.configTimeFlushMinutes,
      configCancelHoldDelayMs: stored.configCancelHoldDelayMs ?? base.configCancelHoldDelayMs,
    };

    // Ensure midnight alarm is scheduled
    await this.scheduleNextMidnightAlarm();
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
      // Reset daily IP counters
      this.d.ipCounts = {};
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

    // Admin endpoint to update remote config (batchSize, maxDailyRequests, etc.)
    if (pathname === "/admin/update-config" && request.method === "POST") {
      return this.handleAdminUpdateConfig(request);
    }

    if (pathname === "/admin/full-sync" && request.method === "POST") {
      return this.handleAdminFullSync(request);
    }

    return new Response("Not found (DO)", { status: 404 });
  }

  // ---------------------------------------------------------------------------
  // Alarms for retry / backoff AND scheduled midnight flush
  // ---------------------------------------------------------------------------

  async alarm(): Promise<void> {
    await this.loaded;
    const now = Date.now();

    // =========================================================================
    // SCHEDULED MIDNIGHT FLUSH TO ORACLE
    // At 00:00-00:15, flush all buffered events to Oracle
    // This happens before extensions wake up at 1:00 AM
    // =========================================================================
    const currentHour = new Date().getUTCHours();
    if (this.d.buffer.length > 0 && currentHour === 0) {
      console.log(`[Alarm] Midnight flush: ${this.d.buffer.length} events to Oracle`);
      await this.flushToOracle(true);
    }

    // Schedule next midnight alarm
    await this.scheduleNextMidnightAlarm();

    // Retry failed Oracle flushes
    if (this.d.retryState && this.d.retryState.nextRetryAt && now >= this.d.retryState.nextRetryAt) {
      await this.flushToOracle(false);
    }
  }

  /**
   * Schedule an alarm for the next midnight (00:00 UTC).
   * Called after each alarm to ensure continuous scheduling.
   */
  private async scheduleNextMidnightAlarm(): Promise<void> {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0); // Midnight UTC tomorrow

    const alarmTime = tomorrow.getTime();
    
    // Only set if no alarm is scheduled or if this is earlier
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm || currentAlarm > alarmTime) {
      await this.state.storage.setAlarm(alarmTime);
      console.log(`[Alarm] Scheduled next midnight flush for ${tomorrow.toISOString()}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private async handleTrack(request: Request): Promise<Response> {
    // Update daily request counters (for dashboard monitoring only)
    this.ensureRequestDay();
    this.d.reqCountToday += 1;

    const now = Date.now();

    // --- Country from CF header ---
    const countryHeader = request.headers.get("X-Geo-Country");
    const countryFromRequest =
      countryHeader && countryHeader.length > 0
        ? countryHeader
        : undefined;

    // --- IP Extraction (for audit logging only, not rate limiting) ---
    const ip = request.headers.get("X-Client-IP") || "unknown";
    
    // Track IP for monitoring (no enforcement - extension handles rate limiting)
    this.d.ipCounts[ip] = (this.d.ipCounts[ip] || 0) + 1;

    // =========================================================================
    // LAYER 1: PAYLOAD VALIDATION
    // =========================================================================
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

    // Allow large batches to support next-day consolidation (extension sends all pending at once)
    const MAX_EVENTS_PER_REQUEST = 5000;
    const MAX_BUFFER_SIZE = 50_000;

    if (events.length > MAX_EVENTS_PER_REQUEST) {
      return json(
        { ok: false, error: "too_many_events", max: MAX_EVENTS_PER_REQUEST, message: "Max 10 events per request." },
        { status: 400 }
      );
    }

    // =========================================================================
    // LAYER 2: EVENT SIZE VALIDATION (Prevent memory exhaustion via oversized payloads)
    // =========================================================================
    const MAX_EVENT_SIZE_BYTES = 10 * 1024; // 10KB per event
    for (const ev of events) {
      try {
        const eventSize = JSON.stringify(ev).length;
        if (eventSize > MAX_EVENT_SIZE_BYTES) {
          return json(
            { ok: false, error: "event_too_large", maxBytes: MAX_EVENT_SIZE_BYTES },
            { status: 400 }
          );
        }
      } catch {
        return json(
          { ok: false, error: "invalid_event_structure" },
          { status: 400 }
        );
      }
    }

    if (this.d.buffer.length >= MAX_BUFFER_SIZE) {
      return json(
        { ok: false, error: "buffer_full", bufferSize: this.d.buffer.length },
        { status: 503 }
      );
    }

    // =========================================================================
    // LAYER 4: ROBUST IDEMPOTENCY (Set-based O(1) lookup + timestamp validation)
    // =========================================================================
    const MAX_PROCESSED_IDS = 5000;
    const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
    const MIN_EVENT_TIME = now - MAX_EVENT_AGE_MS;
    const MAX_FUTURE_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

    // Use Set for O(1) lookup
    const processedSet = new Set(this.d.processedIds);
    let acceptedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (const ev of events) {
      // ----- VALIDATION: Event ID required -----
      if (!ev.id || typeof ev.id !== "string" || ev.id.length < 10) {
        invalidCount++;
        continue;
      }

      // ----- VALIDATION: Event ID format (ext-<timestamp>-<random>) -----
      const idMatch = ev.id.match(/^ext-(\d+)-([a-z0-9]+)$/);
      if (!idMatch) {
        invalidCount++;
        continue;
      }

      // ----- VALIDATION: Timestamp must be reasonable -----
      const idTimestamp = parseInt(idMatch[1], 10);
      if (isNaN(idTimestamp) || idTimestamp < MIN_EVENT_TIME || idTimestamp > now + MAX_FUTURE_DRIFT_MS) {
        invalidCount++;
        continue;
      }

      // ----- IDEMPOTENCY: Skip duplicates -----
      if (processedSet.has(ev.id)) {
        duplicateCount++;
        continue;
      }

      // ----- VALIDATION: Timestamp sanity -----
      if (typeof ev.timestamp !== "number" || ev.timestamp < MIN_EVENT_TIME || ev.timestamp > now + MAX_FUTURE_DRIFT_MS) {
        invalidCount++;
        continue;
      }

      // ----- VALIDATION: Required fields -----
      if (!ev.status || (ev.status !== "success" && ev.status !== "fail" && ev.status !== "cancelled")) {
        invalidCount++;
        continue;
      }

      // Add to processed set and array
      processedSet.add(ev.id);
      this.d.processedIds.push(ev.id);

      // Hydrate country from CF geo if missing
      if (!ev.country && countryFromRequest) {
        ev.country = countryFromRequest;
      }

      // Store IP for audit
      if (!ev.ip_address) {
        ev.ip_address = ip;
      }

      this.d.buffer.push(ev);
      this.d.totalEvents += 1;
      acceptedCount++;
      
      // totalDownloads = all download attempts (success + fail)
      this.d.totalDownloads += 1;

      if (ev.status === "success") {
        this.d.totalSuccess += 1;
      } else if (ev.status === "cancelled") {
        this.d.totalCancelled += 1;
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

      // --- CHANGED: use request geo as fallback before "unknown" ---
      const effectiveCountry = (
        ev.country ||
        countryFromRequest ||
        "unknown"
      ).toLowerCase();
      c.byCountry[effectiveCountry] =
        (c.byCountry[effectiveCountry] || 0) + 1;

      // NEW: error-type counter (only for fails)
      if (ev.status === "fail") {
        const errKey = (ev.error_type || "unknown").toLowerCase();
        c.byErrorType[errKey] = (c.byErrorType[errKey] || 0) + 1;
      }
    }

    // =========================================================================
    // CLEANUP - Trim processedIds to prevent unbounded growth
    // =========================================================================
    const MAX_PROCESSED_IDS_TRIM = 5000;
    if (this.d.processedIds.length > MAX_PROCESSED_IDS_TRIM) {
      // Keep newest IDs (from end)
      this.d.processedIds = this.d.processedIds.slice(-MAX_PROCESSED_IDS_TRIM);
    }

    await this.persist();

    // Size-based flush to Oracle
    const maxBatch =
      parseInt(this.env.MAX_BATCH_EVENTS || "500", 10) || 500;

    if (this.d.buffer.length >= maxBatch) {
      await this.flushToOracle(false);
    }

    return json({ 
      ok: true, 
      accepted: acceptedCount,
      duplicates: duplicateCount,
      invalid: invalidCount,
    }, { status: 202 });
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

    // Get next scheduled alarm time
    const nextAlarm = await this.state.storage.getAlarm();
    const nextAlarmAt = nextAlarm ? new Date(nextAlarm).toISOString() : null;

    // Remote config with null-safe values for dashboard display
    const remoteConfig = {
      batchSize: this.d.configBatchSize ?? 50,
      maxDailyRequests: this.d.configMaxDailyRequests ?? 50,
      maxRetry: this.d.configMaxRetry ?? 5,
      maxEventsPerRequest: this.d.configMaxEventsPerRequest ?? 5000,
      maxBufferSize: this.d.configMaxBufferSize ?? 50000,
      flushMode: this.d.configFlushMode ?? 'next_day',
      timeFlushMinutes: this.d.configTimeFlushMinutes ?? { low: 1440, mid: 1440, high: 1440 },
      hardRemoteOff: this.d.hardRemoteOff ?? false,
    };

    // Buffer status for dashboard
    const bufferStatus = {
      currentSize: this.d.buffer?.length ?? 0,
      maxSize: remoteConfig.maxBufferSize,
      utilizationPercent: ((this.d.buffer?.length ?? 0) / remoteConfig.maxBufferSize * 100).toFixed(2),
    };

    const payload = {
      ok: true,
      totalEvents: this.d.totalEvents ?? 0,
      totalDownloads: this.d.totalDownloads ?? 0,
      totalSuccess: this.d.totalSuccess ?? 0,
      totalFail: this.d.totalFail ?? 0,
      totalCancelled: this.d.totalCancelled ?? 0,
      pendingEvents: this.d.pendingEvents ?? 0,
      lastEventAt: this.d.lastEventAt ?? null,
      lastFlushAt: this.d.lastFlushAt ?? null,
      counters: this.d.counters ?? {},
      retryState: this.d.retryState ?? null,
      quota,
      envSnapshot,
      
      // NEW: Remote config for dashboard display
      remoteConfig,
      bufferStatus,
      nextAlarmAt,
      
      // Request tracking (for monitoring)
      requestsToday: this.d.reqCountToday ?? 0,
      requestDate: this.d.reqCountDate ?? null,
      uniqueIpsToday: Object.keys(this.d.ipCounts ?? {}).length,
    };

    return json(payload);
  }

  /**
   * Config endpoint used by the extension to adapt batching / flush behaviour.
   * All these values are controllable from Cloudflare dashboard via admin endpoints.
   */
  private async handleConfig(): Promise<Response> {
    this.ensureRequestDay();
    const quota = computeQuotaDescriptor(
      this.d.reqCountToday,
      this.d.hardRemoteOff,
    );

    // Return all remote-controllable config values
    const config = {
      ok: true,
      
      // Batching config
      batchSize: this.d.configBatchSize,
      maxDailyRequests: this.d.configMaxDailyRequests,
      maxRetry: this.d.configMaxRetry,
      
      // Flush mode: 'next_day' (default) or 'time_based'
      flushMode: this.d.configFlushMode,
      
      // Time-based flush intervals (only used if flushMode is 'time_based')
      timeFlushMinutes: this.d.configTimeFlushMinutes,
      
      // Remote enabled (can be disabled for emergencies)
      remoteEnabled: quota.remoteEnabled,
      
      // Cancel hold delay: time before cancel becomes active (default 1000ms)
      cancelHoldDelayMs: this.d.configCancelHoldDelayMs,
      
      // Quota info for extension awareness
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
    // Preserve config settings during reset
    const preservedConfig = {
      configBatchSize: this.d.configBatchSize ?? 50,
      configMaxDailyRequests: this.d.configMaxDailyRequests ?? 50,
      configMaxRetry: this.d.configMaxRetry ?? 5,
      configMaxEventsPerRequest: this.d.configMaxEventsPerRequest ?? 5000,
      configMaxBufferSize: this.d.configMaxBufferSize ?? 50000,
      configFlushMode: this.d.configFlushMode ?? 'next_day' as const,
      configTimeFlushMinutes: this.d.configTimeFlushMinutes ?? { low: 1440, mid: 1440, high: 1440 },
      configCancelHoldDelayMs: this.d.configCancelHoldDelayMs ?? 1000,
    };
    
    this.data = {
      totalEvents: 0,
      totalDownloads: 0,
      totalSuccess: 0,
      totalFail: 0,
      totalCancelled: 0,
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
      ipCounts: {},
      processedIds: [],
      burstCounts: {},
      ...preservedConfig,
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

  /**
   * Admin endpoint to update remote config values.
   * All extensions will pick up these changes on their next config fetch.
   * 
   * POST /admin/update-config
   * Body: { batchSize?: number, maxDailyRequests?: number, maxRetry?: number, 
   *         maxEventsPerRequest?: number, maxBufferSize?: number,
   *         flushMode?: 'next_day' | 'time_based',
   *         timeFlushMinutes?: { low: number, mid: number, high: number } }
   */
  private async handleAdminUpdateConfig(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    // Update each config field if provided and valid
    if (typeof body.batchSize === 'number' && body.batchSize > 0 && body.batchSize <= 1000) {
      this.d.configBatchSize = body.batchSize;
    }
    
    if (typeof body.maxDailyRequests === 'number' && body.maxDailyRequests > 0 && body.maxDailyRequests <= 1000) {
      this.d.configMaxDailyRequests = body.maxDailyRequests;
    }
    
    if (typeof body.maxRetry === 'number' && body.maxRetry >= 0 && body.maxRetry <= 20) {
      this.d.configMaxRetry = body.maxRetry;
    }
    
    if (typeof body.maxEventsPerRequest === 'number' && body.maxEventsPerRequest > 0 && body.maxEventsPerRequest <= 50000) {
      this.d.configMaxEventsPerRequest = body.maxEventsPerRequest;
    }
    
    if (typeof body.maxBufferSize === 'number' && body.maxBufferSize > 0 && body.maxBufferSize <= 500000) {
      this.d.configMaxBufferSize = body.maxBufferSize;
    }
    
    if (body.flushMode === 'next_day' || body.flushMode === 'time_based') {
      this.d.configFlushMode = body.flushMode;
    }
    
    if (body.timeFlushMinutes && typeof body.timeFlushMinutes === 'object') {
      const tfm = body.timeFlushMinutes as Record<string, unknown>;
      if (typeof tfm.low === 'number' && typeof tfm.mid === 'number' && typeof tfm.high === 'number') {
        this.d.configTimeFlushMinutes = {
          low: Math.max(1, Math.min(10080, tfm.low)),   // 1 min to 7 days
          mid: Math.max(1, Math.min(10080, tfm.mid)),
          high: Math.max(1, Math.min(10080, tfm.high)),
        };
      }
    }

    await this.persist();

    // Return current config state
    return json({
      ok: true,
      message: "Config updated. Extensions will pick up changes on next config fetch.",
      config: {
        batchSize: this.d.configBatchSize,
        maxDailyRequests: this.d.configMaxDailyRequests,
        maxRetry: this.d.configMaxRetry,
        maxEventsPerRequest: this.d.configMaxEventsPerRequest,
        maxBufferSize: this.d.configMaxBufferSize,
        flushMode: this.d.configFlushMode,
        timeFlushMinutes: this.d.configTimeFlushMinutes,
      },
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
   * Helper to find the key with the highest count in a record
   */
  private getTopKey(record: Record<string, number>): string {
    let topKey = "unknown";
    let max = -1;
    for (const [key, val] of Object.entries(record)) {
      if (val > max) {
        max = val;
        topKey = key;
      }
    }
    return topKey;
  }

  /**
   * Build an aggregated OracleBatch from raw events in buffer.
   * Groups events by hour and aggregates counters.
   */
  private buildOracleBatch(events: StoredEvent[]): OracleBatch {
    const now = Date.now();
    
    // 1. Group events by hour bucket (Keep logic for historical data)
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
    timeBuckets.sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));

    // 2. Build Full Batch Summary (Aggregates EVERYTHING)
    const summary: BatchSummary = {
      totals: { totalEvents: 0, totalDownloads: 0, totalSuccess: 0, totalFail: 0 },
      browsers: {},
      os: {},
      countries: {},
      languages: {},
      versions: {},
      types: {},
      errorReasons: {},
      topBrowser: "unknown",
      topOs: "unknown",
      topCountry: "unknown",
      topType: "unknown"
    };

    for (const ev of events) {
      summary.totals.totalEvents++;
      summary.totals.totalDownloads++; // Assuming every event is a download attempt
      
      if (ev.status === "success") summary.totals.totalSuccess++;
      else summary.totals.totalFail++;

      // Aggregations
      const browser = (ev.browser || "unknown").toLowerCase();
      summary.browsers[browser] = (summary.browsers[browser] || 0) + 1;

      const os = (ev.os || "unknown").toLowerCase();
      summary.os[os] = (summary.os[os] || 0) + 1;

      const country = (ev.country || "unknown").toLowerCase();
      summary.countries[country] = (summary.countries[country] || 0) + 1;

      const lang = (ev.language || "unknown").toLowerCase();
      summary.languages[lang] = (summary.languages[lang] || 0) + 1;

      const ver = ev.ext_version || "0.0.0";
      summary.versions[ver] = (summary.versions[ver] || 0) + 1;

      const type = (ev.file_type || "unknown").toLowerCase();
      summary.types[type] = (summary.types[type] || 0) + 1;

      if (ev.status === "fail") {
        const err = (ev.error_type || "unknown").toLowerCase();
        summary.errorReasons[err] = (summary.errorReasons[err] || 0) + 1;
      }
    }

    // Calculate "Top" stats
    summary.topBrowser = this.getTopKey(summary.browsers);
    summary.topOs = this.getTopKey(summary.os);
    summary.topCountry = this.getTopKey(summary.countries);
    summary.topType = this.getTopKey(summary.types);

    // 3. Build DO state snapshot
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
    const batchId = `do-seq${this.d.batchSeq}-${events.length}ev`;

    return {
      batchId,
      generatedAt: now,
      timeZone: "UTC",
      summary,     // <--- The new big JSON object
      timeBuckets, // <--- Still useful for hourly charts
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
    _force: boolean,
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

    // --- LOGGING for Debugging ---
    const targetUrl = this.env.ORACLE_ENDPOINT + "/ingest-batch";
    console.log("------------------------------------------------");
    console.log("Attempting Flush to:", targetUrl);
    console.log("Secret Length:", this.env.DO_SHARED_SECRET ? this.env.DO_SHARED_SECRET.length : "MISSING");
    // ----------------------

    if (!this.d.retryState) this.d.retryState = { ...DEFAULT_RETRY_STATE };
    this.d.retryState.lastFlushAttemptAt = now;

    // Build aggregated batch (groups by hour, aggregates counters)
    const oracleBatch = this.buildOracleBatch(eventsToFlush);

    try {
      // Send to /ingest-batch endpoint (aggregated format)
      // We append "/ingest-batch" here to correct the base URL if needed
      const res = await fetch(targetUrl, {
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
    } catch (err: unknown) {
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