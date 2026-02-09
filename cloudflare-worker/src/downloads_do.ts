// filepath: cloudflare-worker/src/downloads_do.ts

import {
  Counters,
  RetryState,
  QuotaDescriptor,
  StoredEvent,
  EnvSnapshot,
  OracleBatch,
  TimeBucket,
  BucketTotals,
  BucketCounters,
  DOStateBatch,
  BatchSummary,
  ChangelogEntry,
  ChangelogConfig,
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

  // Monotonic sequence for event commit tracking
  eventSeq: number;

  // Highest event sequence confirmed committed to Oracle
  committedSeq: number;

  // Durable queue of aggregated batches waiting for Oracle
  pendingBatches: PendingOracleBatch[];

  // --- Privacy / Anti-Abuse ---
  // IP tracking is disabled for privacy compliance. These fields are kept
  // for backward compatibility but are always cleared.
  ipCounts: Record<string, number>;
  
  // Legacy cached size (always 0 when IP tracking is disabled)
  ipCountsSize: number;
  
  // Derived counter (always 0 when IP tracking is disabled)
  uniqueRequestsToday: number;
  
  // Set of recently processed event IDs for O(1) idempotency lookup
  processedIds: string[];
  
  // Burst tracking (legacy, kept for compatibility)
  burstCounts: Record<string, { count: number; minute: number }>;

  // Login attempts for rate limiting
  loginAttempts: Record<string, { attempts: number; firstAttemptAt: number }>;

  // IP Allowlist configuration
  ipAllowlistEnabled: boolean;
  ipAllowlist: string[];

  // Track endpoint rate limiting (per-IP, per-minute)
  trackRates: Record<string, { count: number; minute: number }>;

  // =========================================================================
  // CHANGELOG & CONFIG
  // =========================================================================
  changelog: ChangelogEntry[];
  changelogConfig: ChangelogConfig;

  // =========================================================================
  // REMOTE CONFIG - Controllable from Cloudflare Dashboard
  // =========================================================================
  
  // Config schema version for migrations
  configVersion: number;

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
  // next_day: Flush in a daily UTC window
  // time_based: Flush based on timeFlushMinutes
  configFlushMode: 'next_day' | 'time_based';

  // Daily flush window (UTC)
  configDailyFlushWindowStartUtc: number;
  configDailyFlushWindowMinutes: number;
  
  // Time-based flush intervals (only used if flushMode is 'time_based')
  configTimeFlushMinutes: {
    low: number;   // queue < 15 events
    mid: number;   // 15-35 events  
    high: number;  // 35+ events
  };

  // Cancel hold delay: time in ms before cancel button becomes active (default: 1000ms)
  // Range: 0-10000ms. Configurable from dashboard to prevent accidental cancels.
  configCancelHoldDelayMs: number;

  // Legacy compatibility: allow missing/invalid event IDs by assigning new IDs
  // Default: true (temporary migration support)
  configAllowLegacyEvents: boolean;
};

type PendingOracleBatch = {
  batch: OracleBatch;
  eventCount: number;
  maxSeq: number;
  attempts: number;
  createdAt: number;
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

const CONFIG_VERSION = 2;
const DEFAULT_DAILY_FLUSH_WINDOW_START_UTC = 1;
const DEFAULT_DAILY_FLUSH_WINDOW_MINUTES = 120;

// Quota thresholds (approx. Cloudflare daily request quotas)
const QUOTA_VERY_SOFT_LIMIT = 30_000;
const QUOTA_SOFT_LIMIT = 40_000;
const QUOTA_VERY_NORMAL_LIMIT = 50_000;
const QUOTA_NORMAL_LIMIT = 60_000;
const QUOTA_HARD_NORMAL_LIMIT = 70_000;
const QUOTA_HARD_LIMIT = 80_000;
const QUOTA_VERY_HARD_LIMIT = 90_000;

// Backpressure thresholds to prevent cascading failures
const REMOTE_DISABLE_BUFFER_UTIL = 0.9;
const REMOTE_DISABLE_FAILURES = 5;
const COMPACT_TRIGGER_UTIL = 0.8;
const COMPACT_TARGET_UTIL = 0.5;
const COMPACT_MAX_BATCH = 5000;
const MAX_PENDING_BATCHES = 50;

// Track endpoint rate limits (per IP per minute)
const TRACK_RATE_LIMIT_PER_MIN = 120;
const TRACK_RATE_PRUNE_AFTER_MIN = 10;
const TRACK_RATE_MAX_KEYS = 5000;

// Storage key inside DO storage
const STORAGE_KEY = "analytics_state";

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeString(
  value: unknown,
  maxLen: number,
  pattern?: RegExp,
  fallback = "unknown",
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > maxLen) return fallback;
  if (pattern && !pattern.test(trimmed)) return fallback;
  return trimmed;
}

const FIELD_PATTERNS = {
  generic: /^[a-z0-9._-]+$/,
  language: /^[a-z0-9-]+$/,
};

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

function computeRemoteEnabled(
  quotaEnabled: boolean,
  bufferLen: number,
  maxBuffer: number,
  retryState: RetryState | null,
): { enabled: boolean; reason: string } {
  if (!quotaEnabled) {
    return { enabled: false, reason: "quota_or_admin" };
  }
  if (maxBuffer > 0 && bufferLen >= maxBuffer * REMOTE_DISABLE_BUFFER_UTIL) {
    return { enabled: false, reason: "buffer_high" };
  }
  if (retryState && retryState.consecutiveFailures >= REMOTE_DISABLE_FAILURES) {
    return { enabled: false, reason: "oracle_failures" };
  }
  return { enabled: true, reason: "ok" };
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

type LogLevel = "info" | "warn" | "error";

function logEvent(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...fields,
  };
  console.log(JSON.stringify(payload));
}

function generateAckId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `ack-${crypto.randomUUID()}`;
    }
  } catch {
    // ignore and fallback
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `ack-${Date.now().toString(36)}-${rand}`;
}

function generateEventId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `legacy-${crypto.randomUUID()}`;
    }
  } catch {
    // ignore and fallback
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `legacy-${Date.now().toString(36)}-${rand}`;
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
      eventSeq: 0,
      committedSeq: 0,
      pendingBatches: [],
      
      ipCounts: {},
      ipCountsSize: 0,
      uniqueRequestsToday: 0,
      processedIds: [],
      burstCounts: {},

      // Auth-related state
      loginAttempts: {},
      ipAllowlistEnabled: false,
      ipAllowlist: [],
      trackRates: {},

      // Remote config defaults
      configVersion: CONFIG_VERSION,
      configBatchSize: 50,
      configMaxDailyRequests: 50,
      configMaxRetry: 5,
      configMaxEventsPerRequest: 5000,
      configMaxBufferSize: 50000,
      configFlushMode: 'next_day',
      configDailyFlushWindowStartUtc: DEFAULT_DAILY_FLUSH_WINDOW_START_UTC,
      configDailyFlushWindowMinutes: DEFAULT_DAILY_FLUSH_WINDOW_MINUTES,
      configTimeFlushMinutes: { low: 1440, mid: 1440, high: 1440 }, // 1440 = 24h = next day
      configCancelHoldDelayMs: 1000, // 1 second default
      configAllowLegacyEvents: true,

      // Changelog defaults
      changelog: [],
      changelogConfig: {
        rules: [],
        lastUpdated: Date.now(),
      },
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
      eventSeq: stored.eventSeq ?? 0,
      committedSeq: stored.committedSeq ?? 0,
      pendingBatches: Array.isArray(stored.pendingBatches) ? stored.pendingBatches : [],

      ipCounts: {},
      ipCountsSize: 0,
      uniqueRequestsToday: 0,
      processedIds: Array.isArray(stored.processedIds) ? stored.processedIds : [],
      burstCounts: stored.burstCounts ?? {},

      // Auth-related state
      loginAttempts: stored.loginAttempts ?? base.loginAttempts,
      ipAllowlistEnabled: stored.ipAllowlistEnabled ?? base.ipAllowlistEnabled,
      ipAllowlist: Array.isArray(stored.ipAllowlist) ? stored.ipAllowlist : base.ipAllowlist,
      trackRates: stored.trackRates && typeof stored.trackRates === "object" ? stored.trackRates : base.trackRates,

      // Remote config - preserve stored values or use defaults
      configVersion: stored.configVersion ?? base.configVersion,
      configBatchSize: stored.configBatchSize ?? base.configBatchSize,
      configMaxDailyRequests: stored.configMaxDailyRequests ?? base.configMaxDailyRequests,
      configMaxRetry: stored.configMaxRetry ?? base.configMaxRetry,
      configMaxEventsPerRequest: stored.configMaxEventsPerRequest ?? base.configMaxEventsPerRequest,
      configMaxBufferSize: stored.configMaxBufferSize ?? base.configMaxBufferSize,
      configFlushMode: stored.configFlushMode ?? base.configFlushMode,
      configDailyFlushWindowStartUtc: stored.configDailyFlushWindowStartUtc ?? base.configDailyFlushWindowStartUtc,
      configDailyFlushWindowMinutes: stored.configDailyFlushWindowMinutes ?? base.configDailyFlushWindowMinutes,
      configTimeFlushMinutes: stored.configTimeFlushMinutes ?? base.configTimeFlushMinutes,
      configCancelHoldDelayMs: stored.configCancelHoldDelayMs ?? base.configCancelHoldDelayMs,
      configAllowLegacyEvents:
        typeof stored.configAllowLegacyEvents === "boolean"
          ? stored.configAllowLegacyEvents
          : base.configAllowLegacyEvents,

      changelog: Array.isArray(stored.changelog) ? stored.changelog : base.changelog,
      changelogConfig: stored.changelogConfig ?? base.changelogConfig,
    };

    if (Array.isArray(this.data.pendingBatches)) {
      this.data.pendingBatches = this.data.pendingBatches
        .filter((b) => b && typeof b === "object" && b.batch)
        .map((b) => ({
          ...b,
          attempts: typeof b.attempts === "number" ? b.attempts : 0,
          createdAt: typeof b.createdAt === "number" ? b.createdAt : Date.now(),
        }));
    } else {
      this.data.pendingBatches = [];
    }

    // Normalize config values and ensure schema version
    let configDirty = false;
    if (!Number.isFinite(this.data.configVersion) || this.data.configVersion < CONFIG_VERSION) {
      this.data.configVersion = CONFIG_VERSION;
      configDirty = true;
    }
    this.data.configBatchSize = clampInt(this.data.configBatchSize, 1, 1000, base.configBatchSize);
    this.data.configMaxDailyRequests = clampInt(this.data.configMaxDailyRequests, 1, 1000, base.configMaxDailyRequests);
    this.data.configMaxRetry = clampInt(this.data.configMaxRetry, 0, 20, base.configMaxRetry);
    this.data.configMaxEventsPerRequest = clampInt(this.data.configMaxEventsPerRequest, 1, 50_000, base.configMaxEventsPerRequest);
    this.data.configMaxBufferSize = clampInt(this.data.configMaxBufferSize, 1, 500_000, base.configMaxBufferSize);
    this.data.configDailyFlushWindowStartUtc = clampInt(
      this.data.configDailyFlushWindowStartUtc,
      0,
      23,
      base.configDailyFlushWindowStartUtc
    );
    this.data.configDailyFlushWindowMinutes = clampInt(
      this.data.configDailyFlushWindowMinutes,
      1,
      24 * 60,
      base.configDailyFlushWindowMinutes
    );
    if (typeof this.data.configAllowLegacyEvents !== "boolean") {
      this.data.configAllowLegacyEvents = base.configAllowLegacyEvents;
      configDirty = true;
    }
    if (!this.data.configTimeFlushMinutes || typeof this.data.configTimeFlushMinutes !== "object") {
      this.data.configTimeFlushMinutes = { ...base.configTimeFlushMinutes };
      configDirty = true;
    } else {
      const tfm = this.data.configTimeFlushMinutes;
      const nextLow = clampInt(tfm.low, 1, 10080, base.configTimeFlushMinutes.low);
      const nextMid = clampInt(tfm.mid, 1, 10080, base.configTimeFlushMinutes.mid);
      const nextHigh = clampInt(tfm.high, 1, 10080, base.configTimeFlushMinutes.high);
      if (nextLow !== tfm.low || nextMid !== tfm.mid || nextHigh !== tfm.high) {
        this.data.configTimeFlushMinutes = { low: nextLow, mid: nextMid, high: nextHigh };
        configDirty = true;
      }
    }
    const nextCancelHold = clampInt(
      this.data.configCancelHoldDelayMs,
      0,
      10000,
      base.configCancelHoldDelayMs
    );
    if (nextCancelHold !== this.data.configCancelHoldDelayMs) {
      this.data.configCancelHoldDelayMs = nextCancelHold;
      configDirty = true;
    }

    if (this.data.configFlushMode !== "next_day" && this.data.configFlushMode !== "time_based") {
      this.data.configFlushMode = base.configFlushMode;
      configDirty = true;
    }

    if (
      this.data.configBatchSize !== stored.configBatchSize ||
      this.data.configMaxDailyRequests !== stored.configMaxDailyRequests ||
      this.data.configMaxRetry !== stored.configMaxRetry ||
      this.data.configMaxEventsPerRequest !== stored.configMaxEventsPerRequest ||
      this.data.configMaxBufferSize !== stored.configMaxBufferSize ||
      this.data.configDailyFlushWindowStartUtc !== stored.configDailyFlushWindowStartUtc ||
      this.data.configDailyFlushWindowMinutes !== stored.configDailyFlushWindowMinutes ||
      this.data.configCancelHoldDelayMs !== stored.configCancelHoldDelayMs ||
      this.data.configAllowLegacyEvents !== stored.configAllowLegacyEvents ||
      this.data.configFlushMode !== stored.configFlushMode ||
      JSON.stringify(this.data.configTimeFlushMinutes) !== JSON.stringify(stored.configTimeFlushMinutes)
    ) {
      configDirty = true;
    }

    // PRIVACY: IP tracking disabled. Clear any persisted IP data on load.
    const hadLegacyIps = !!stored.ipCounts && Object.keys(stored.ipCounts).length > 0;
    this.data.ipCounts = {};
    this.data.ipCountsSize = 0;
    this.data.uniqueRequestsToday = 0;

    // Strip any persisted ip_address fields from buffered events
    let strippedEventIps = false;
    if (Array.isArray(this.data.buffer)) {
      for (const ev of this.data.buffer) {
        if (ev && typeof ev === "object" && "ip_address" in ev) {
          delete ev.ip_address;
          strippedEventIps = true;
        }
      }
    }

    if (hadLegacyIps || strippedEventIps || configDirty) {
      await this.persist();
    }

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
   * 
   * LIFECYCLE CRITICAL: This method manages daily-bounded state variables.
   * IP tracking is disabled for privacy. We still reset legacy fields to
   * guarantee no stale IP data persists across days.
   */
  private ensureRequestDay(): void {
    const today = todayUtcDate();
    if (this.d.reqCountDate !== today) {
      this.d.reqCountDate = today;
      this.d.reqCountToday = 0;
      
      // PRIVACY RESET: Clear legacy IP tracking fields every day
      this.d.ipCounts = {};
      this.d.ipCountsSize = 0;
      this.d.uniqueRequestsToday = 0;
      this.d.trackRates = {};
      
      // hardRemoteOff is NOT reset automatically here.
    }
  }

  private getClientIp(request: Request): string {
    return (
      request.headers.get("X-Client-IP") ||
      request.headers.get("CF-Connecting-IP") ||
      "unknown"
    );
  }

  private checkTrackRateLimit(ip: string, nowMs: number): { allowed: boolean; retryAfterSec?: number } {
    const minute = Math.floor(nowMs / 60000);
    const entry = this.d.trackRates[ip];

    if (!entry || entry.minute !== minute) {
      this.d.trackRates[ip] = { count: 1, minute };
    } else {
      entry.count += 1;
      if (entry.count > TRACK_RATE_LIMIT_PER_MIN) {
        const nextMinuteMs = (minute + 1) * 60000;
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((nextMinuteMs - nowMs) / 1000)) };
      }
    }

    // Prune old entries to prevent unbounded growth.
    if (Object.keys(this.d.trackRates).length > TRACK_RATE_MAX_KEYS) {
      const minMinute = minute - TRACK_RATE_PRUNE_AFTER_MIN;
      for (const [k, v] of Object.entries(this.d.trackRates)) {
        if (!v || v.minute < minMinute) {
          delete this.d.trackRates[k];
        }
      }
      if (Object.keys(this.d.trackRates).length > TRACK_RATE_MAX_KEYS) {
        // Emergency reset to avoid unbounded memory growth under abuse.
        this.d.trackRates = {};
      }
    }

    return { allowed: true };
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

    // Public Changelog
    if (pathname === "/changelog" && request.method === "GET") {
      return this.handleGetChangelog();
    }

    // Admin Changelog Update
    if (pathname === "/admin/changelog" && request.method === "POST") {
      return this.handleAdminUpdateChangelog(request);
    }

    // Login rate limiting - used by worker to check/record attempts
    if (pathname === "/auth/login-attempt" && request.method === "POST") {
      return this.handleLoginAttempt(request);
    }

    // IP Allowlist check - used by worker before login
    if (pathname === "/auth/check-ip-allowlist" && request.method === "POST") {
      return this.handleCheckIpAllowlist(request);
    }

    // Admin IP Allowlist management
    if (pathname === "/admin/ip-allowlist" && request.method === "POST") {
      return this.handleAdminIpAllowlist(request);
    }
    if (pathname === "/admin/ip-allowlist" && request.method === "GET") {
      return this.handleGetIpAllowlist(request);
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
    const clientIp = this.getClientIp(request);

    const rate = this.checkTrackRateLimit(clientIp, now);
    if (!rate.allowed) {
      await this.persist();
      return json(
        { ok: false, error: "rate_limited", retryAfterSec: rate.retryAfterSec ?? 60 },
        { status: 429 },
      );
    }

    // --- Country from CF header ---
    const countryHeader = request.headers.get("X-Geo-Country");
    const countryFromRequest =
      countryHeader && countryHeader.length > 0
        ? countryHeader
        : undefined;

    // =========================================================================
    // LAYER 1: PAYLOAD VALIDATION
    // =========================================================================
    let body: { events?: StoredEvent[]; clientBatchId?: string } | null = null;
    try {
      body = await request.json();
    } catch {
      logEvent("warn", "track_invalid_json");
      await this.persist();
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    if (!isPlainObject(body) || !Array.isArray(body.events)) {
      logEvent("warn", "track_invalid_payload");
      await this.persist();
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const events = body.events;
    const clientBatchId =
      typeof body.clientBatchId === "string" && body.clientBatchId.length <= 200
        ? body.clientBatchId
        : undefined;
    if (events.length === 0) {
      await this.persist();
      return json(
        {
          ok: true,
          accepted: 0,
          clientBatchId,
          ackId: generateAckId(),
          receivedAt: now,
        },
        { status: 202 },
      );
    }

    for (const ev of events) {
      if (!isPlainObject(ev)) {
        logEvent("warn", "track_invalid_event_payload");
        await this.persist();
        return json({ ok: false, error: "invalid_event_payload" }, { status: 400 });
      }
    }

    // Allow large batches to support next-day consolidation (extension sends all pending at once)
    const MAX_EVENTS_PER_REQUEST = this.d.configMaxEventsPerRequest || 5000;
    const MAX_BUFFER_SIZE = this.d.configMaxBufferSize || 50_000;

    if (events.length > MAX_EVENTS_PER_REQUEST) {
      logEvent("warn", "track_too_many_events", { count: events.length, max: MAX_EVENTS_PER_REQUEST });
      return json(
        { ok: false, error: "too_many_events", max: MAX_EVENTS_PER_REQUEST, message: `Max ${MAX_EVENTS_PER_REQUEST} events per request.` },
        { status: 400 }
      );
    }

    // =========================================================================
    // LAYER 2: EVENT SIZE VALIDATION (Prevent memory exhaustion via oversized payloads)
    // =========================================================================
    const MAX_EVENT_SIZE_BYTES = 10 * 1024; // 10KB per event
    const encoder = new TextEncoder();
    for (const ev of events) {
      try {
        const eventSize = encoder.encode(JSON.stringify(ev)).length;
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

    if (this.d.buffer.length + events.length > MAX_BUFFER_SIZE) {
      logEvent("warn", "track_buffer_full", { bufferSize: this.d.buffer.length, incoming: events.length, max: MAX_BUFFER_SIZE });
      return json(
        { ok: false, error: "buffer_full", bufferSize: this.d.buffer.length },
        { status: 503 }
      );
    }

    // =========================================================================
    // LAYER 3: ROBUST IDEMPOTENCY (Set-based O(1) lookup + timestamp validation)
    // =========================================================================
    // const MAX_PROCESSED_IDS = 5000;
    const MAX_FUTURE_DRIFT_MS = 7 * 24 * 60 * 60 * 1000; // used for clamping, not rejection

    // Use Set for O(1) lookup
    const processedSet = new Set(this.d.processedIds);
    let acceptedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    const acceptedIds: string[] = [];
    const duplicateIds: string[] = [];
    const invalidIds: string[] = [];
    const acceptedSeqs: Array<[string, number]> = [];

    for (const ev of events) {
      // ----- VALIDATION: Event ID required -----
      const hasValidId =
        typeof ev.id === "string" && ev.id.length >= 6 && ev.id.length <= 200;
      if (!hasValidId) {
        if (this.d.configAllowLegacyEvents) {
          ev.id = generateEventId();
        } else {
          invalidCount++;
          if (typeof ev.id === "string") invalidIds.push(ev.id);
          continue;
        }
      }
      const eventId = typeof ev.id === "string" ? ev.id : undefined;
      if (!eventId) {
        invalidCount++;
        continue;
      }

      // ----- IDEMPOTENCY: Skip duplicates -----
      if (processedSet.has(eventId)) {
        duplicateCount++;
        duplicateIds.push(eventId);
        continue;
      }

      // ----- VALIDATION: Timestamp sanity -----
      if (typeof ev.timestamp !== "number" || !Number.isFinite(ev.timestamp)) {
        ev.timestamp = now;
      }
      if (ev.timestamp > now + MAX_FUTURE_DRIFT_MS) {
        ev.timestamp = now;
      }

      // ----- VALIDATION: Required fields -----
      if (!ev.status || (ev.status !== "success" && ev.status !== "fail" && ev.status !== "cancelled")) {
        invalidCount++;
        invalidIds.push(eventId);
        continue;
      }

      // Add to processed set and array
      processedSet.add(eventId);
      this.d.processedIds.push(eventId);

      this.d.eventSeq += 1;
      ev.seq = this.d.eventSeq;

      // Hydrate country from CF geo if missing
      if (!ev.country && countryFromRequest) {
        ev.country = countryFromRequest;
      }

      // Sanitize high-cardinality fields to prevent unbounded growth
      ev.file_type = sanitizeString(ev.file_type, 24, FIELD_PATTERNS.generic);
      ev.browser = sanitizeString(ev.browser, 24, FIELD_PATTERNS.generic);
      ev.os = sanitizeString(ev.os, 24, FIELD_PATTERNS.generic);
      ev.language = sanitizeString(ev.language, 10, FIELD_PATTERNS.language);
      if (ev.error_type) {
        ev.error_type = sanitizeString(ev.error_type, 32, FIELD_PATTERNS.generic);
      }
      if (ev.source) {
        ev.source = sanitizeString(ev.source, 32, FIELD_PATTERNS.generic);
      }
      if (ev.country) {
        ev.country = sanitizeString(ev.country, 2, FIELD_PATTERNS.language);
      }

      // PRIVACY: Never persist IPs. Strip any client-provided ip_address.
      delete ev.ip_address;

      this.d.buffer.push(ev);
      this.d.totalEvents += 1;
      acceptedCount++;
      acceptedIds.push(eventId);
      acceptedSeqs.push([eventId, ev.seq]);
      
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

    this.maybeCompactBuffer();
    await this.persist();

    // Size-based flush to Oracle
    const maxBatch =
      parseInt(this.env.MAX_BATCH_EVENTS || "10000", 10) || 10000;

    if (this.d.buffer.length >= maxBatch) {
      await this.flushToOracle(false);
    }

    return json({ 
      ok: true, 
      accepted: acceptedCount,
      duplicates: duplicateCount,
      invalid: invalidCount,
      acceptedIds,
      duplicateIds,
      invalidIds,
      acceptedSeqs,
      committedSeq: this.d.committedSeq ?? 0,
      clientBatchId,
      ackId: generateAckId(),
      receivedAt: now,
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
      configVersion: this.d.configVersion ?? CONFIG_VERSION,
      batchSize: this.d.configBatchSize ?? 50,
      maxDailyRequests: this.d.configMaxDailyRequests ?? 50,
      maxRetry: this.d.configMaxRetry ?? 5,
      maxEventsPerRequest: this.d.configMaxEventsPerRequest ?? 5000,
      maxBufferSize: this.d.configMaxBufferSize ?? 50000,
      flushMode: this.d.configFlushMode ?? 'next_day',
      timeFlushMinutes: this.d.configTimeFlushMinutes ?? { low: 1440, mid: 1440, high: 1440 },
      dailyFlushWindowStartUtc: this.d.configDailyFlushWindowStartUtc ?? DEFAULT_DAILY_FLUSH_WINDOW_START_UTC,
      dailyFlushWindowMinutes: this.d.configDailyFlushWindowMinutes ?? DEFAULT_DAILY_FLUSH_WINDOW_MINUTES,
      cancelHoldDelayMs: this.d.configCancelHoldDelayMs ?? 1000,
      allowLegacyEvents: this.d.configAllowLegacyEvents ?? true,
      remoteEnabledReason: "ok",
      hardRemoteOff: this.d.hardRemoteOff ?? false,
    };

    const remoteGate = computeRemoteEnabled(
      quota.remoteEnabled,
      this.d.buffer?.length ?? 0,
      remoteConfig.maxBufferSize,
      this.d.retryState ?? null,
    );
    quota.remoteEnabled = remoteGate.enabled;
    quota.remoteEnabledReason = remoteGate.reason;
    remoteConfig.remoteEnabledReason = remoteGate.reason;

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
      uniqueRequestsToday: this.d.uniqueRequestsToday ?? 0,
      // BACKWARDS COMPATIBILITY: Legacy dashboard uses uniqueIpsToday
      uniqueIpsToday: this.d.uniqueRequestsToday ?? 0,
      // IP tracking disabled -> unique counts are not approximated
      isApproximated: false,
      
      // NEW: Changelog data
      changelog: this.d.changelog,
      changelogConfig: this.d.changelogConfig,
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
    const remoteGate = computeRemoteEnabled(
      quota.remoteEnabled,
      this.d.buffer?.length ?? 0,
      this.d.configMaxBufferSize ?? 50000,
      this.d.retryState ?? null,
    );

    // Return all remote-controllable config values
    const config = {
      ok: true,
      configVersion: this.d.configVersion ?? CONFIG_VERSION,
      
      // Batching config
      batchSize: this.d.configBatchSize,
      maxDailyRequests: this.d.configMaxDailyRequests,
      maxRetry: this.d.configMaxRetry,
      maxEventsPerRequest: this.d.configMaxEventsPerRequest,
      
      // Flush mode: 'next_day' (default) or 'time_based'
      flushMode: this.d.configFlushMode,

      // Daily flush window (UTC)
      dailyFlushWindowStartUtc: this.d.configDailyFlushWindowStartUtc,
      dailyFlushWindowMinutes: this.d.configDailyFlushWindowMinutes,
      
      // Time-based flush intervals (only used if flushMode is 'time_based')
      timeFlushMinutes: this.d.configTimeFlushMinutes,
      
      // Remote enabled (can be disabled for emergencies or backpressure)
      remoteEnabled: remoteGate.enabled,
      remoteEnabledReason: remoteGate.reason,
      
      // Cancel hold delay: time before cancel becomes active (default 1000ms)
      cancelHoldDelayMs: this.d.configCancelHoldDelayMs,

      // Legacy acceptance flag (worker-side only, exposed for visibility)
      allowLegacyEvents: this.d.configAllowLegacyEvents,

      // Server UTC time for drift correction
      serverTimeUtc: Date.now(),

      // Highest committed event sequence
      committedSeq: this.d.committedSeq ?? 0,
      
      // Quota info for extension awareness
      quota,
      
      // NEW: Changelog config for extension
      changelogConfig: this.d.changelogConfig,
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
      configVersion: this.d.configVersion ?? CONFIG_VERSION,
      configBatchSize: this.d.configBatchSize ?? 50,
      configMaxDailyRequests: this.d.configMaxDailyRequests ?? 50,
      configMaxRetry: this.d.configMaxRetry ?? 5,
      configMaxEventsPerRequest: this.d.configMaxEventsPerRequest ?? 5000,
      configMaxBufferSize: this.d.configMaxBufferSize ?? 50000,
      configFlushMode: this.d.configFlushMode ?? 'next_day' as const,
      configDailyFlushWindowStartUtc: this.d.configDailyFlushWindowStartUtc ?? DEFAULT_DAILY_FLUSH_WINDOW_START_UTC,
      configDailyFlushWindowMinutes: this.d.configDailyFlushWindowMinutes ?? DEFAULT_DAILY_FLUSH_WINDOW_MINUTES,
      configTimeFlushMinutes: this.d.configTimeFlushMinutes ?? { low: 1440, mid: 1440, high: 1440 },
      configCancelHoldDelayMs: this.d.configCancelHoldDelayMs ?? 1000,
      configAllowLegacyEvents: this.d.configAllowLegacyEvents ?? true,
      
      // Preserve Changelog
      changelog: this.d.changelog ?? [],
      changelogConfig: this.d.changelogConfig ?? {
        customPill: false,
        showNotification: false,
        lastUpdated: Date.now(),
      },
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
      eventSeq: 0,
      committedSeq: 0,
      pendingBatches: [],
      ipCounts: {},
      ipCountsSize: 0,
      uniqueRequestsToday: 0,
      processedIds: [],
      burstCounts: {},
      loginAttempts: {},
      ipAllowlistEnabled: false,
      ipAllowlist: [],
      trackRates: {},
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
   *         timeFlushMinutes?: { low: number, mid: number, high: number },
   *         dailyFlushWindowStartUtc?: number, dailyFlushWindowMinutes?: number,
   *         cancelHoldDelayMs?: number, allowLegacyEvents?: boolean }
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

    if (!isPlainObject(body)) {
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const errors: string[] = [];
    const applyNumber = (
      key: string,
      min: number,
      max: number,
      setter: (value: number) => void,
    ) => {
      if (!(key in body)) return;
      const value = body[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        setter(Math.min(max, Math.max(min, Math.floor(value))));
        return;
      }
      errors.push(key);
    };
    const applyBool = (key: string, setter: (value: boolean) => void) => {
      if (!(key in body)) return;
      const value = body[key];
      if (typeof value === "boolean") {
        setter(value);
        return;
      }
      errors.push(key);
    };

    applyNumber("batchSize", 1, 1000, (value) => {
      this.d.configBatchSize = value;
    });
    applyNumber("maxDailyRequests", 1, 1000, (value) => {
      this.d.configMaxDailyRequests = value;
    });
    applyNumber("maxRetry", 0, 20, (value) => {
      this.d.configMaxRetry = value;
    });
    applyNumber("maxEventsPerRequest", 1, 50000, (value) => {
      this.d.configMaxEventsPerRequest = value;
    });
    applyNumber("maxBufferSize", 1, 500000, (value) => {
      this.d.configMaxBufferSize = value;
    });
    applyNumber("dailyFlushWindowStartUtc", 0, 23, (value) => {
      this.d.configDailyFlushWindowStartUtc = value;
    });
    applyNumber("dailyFlushWindowMinutes", 1, 24 * 60, (value) => {
      this.d.configDailyFlushWindowMinutes = value;
    });
    applyBool("allowLegacyEvents", (value) => {
      this.d.configAllowLegacyEvents = value;
    });

    if ("flushMode" in body) {
      if (body.flushMode === "next_day" || body.flushMode === "time_based") {
        this.d.configFlushMode = body.flushMode;
      } else {
        errors.push("flushMode");
      }
    }

    if ("timeFlushMinutes" in body) {
      if (isPlainObject(body.timeFlushMinutes)) {
        const tfm = body.timeFlushMinutes as Record<string, unknown>;
        if (
          typeof tfm.low === "number" &&
          typeof tfm.mid === "number" &&
          typeof tfm.high === "number" &&
          Number.isFinite(tfm.low) &&
          Number.isFinite(tfm.mid) &&
          Number.isFinite(tfm.high)
        ) {
          this.d.configTimeFlushMinutes = {
            low: Math.max(1, Math.min(10080, Math.floor(tfm.low))),   // 1 min to 7 days
            mid: Math.max(1, Math.min(10080, Math.floor(tfm.mid))),
            high: Math.max(1, Math.min(10080, Math.floor(tfm.high))),
          };
        } else {
          errors.push("timeFlushMinutes");
        }
      } else {
        errors.push("timeFlushMinutes");
      }
    }

    if ("cancelHoldDelayMs" in body) {
      applyNumber("cancelHoldDelayMs", 0, 10000, (value) => {
        this.d.configCancelHoldDelayMs = value;
      });
    }

    if (errors.length > 0) {
      return json({ ok: false, error: "invalid_config", fields: errors }, { status: 400 });
    }

    await this.persist();

    // Return current config state
    return json({
      ok: true,
      message: "Config updated. Extensions will pick up changes on next config fetch.",
      config: {
        configVersion: this.d.configVersion ?? CONFIG_VERSION,
        batchSize: this.d.configBatchSize,
        maxDailyRequests: this.d.configMaxDailyRequests,
        maxRetry: this.d.configMaxRetry,
        maxEventsPerRequest: this.d.configMaxEventsPerRequest,
        maxBufferSize: this.d.configMaxBufferSize,
        flushMode: this.d.configFlushMode,
        dailyFlushWindowStartUtc: this.d.configDailyFlushWindowStartUtc,
        dailyFlushWindowMinutes: this.d.configDailyFlushWindowMinutes,
        timeFlushMinutes: this.d.configTimeFlushMinutes,
        cancelHoldDelayMs: this.d.configCancelHoldDelayMs,
        allowLegacyEvents: this.d.configAllowLegacyEvents,
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

  private mergeCounts(target: Record<string, number>, source: Record<string, number>): Record<string, number> {
    for (const [key, val] of Object.entries(source)) {
      target[key] = (target[key] || 0) + (val || 0);
    }
    return target;
  }

  private mergeTimeBuckets(a: TimeBucket[], b: TimeBucket[]): TimeBucket[] {
    const map = new Map<string, TimeBucket>();
    const addBucket = (bucket: TimeBucket) => {
      const existing = map.get(bucket.bucketStart);
      if (!existing) {
        map.set(bucket.bucketStart, {
          bucketStart: bucket.bucketStart,
          bucketEnd: bucket.bucketEnd,
          totals: { ...bucket.totals },
          counters: { ...bucket.counters },
        });
        return;
      }
      existing.totals.totalEvents += bucket.totals.totalEvents;
      existing.totals.totalDownloads += bucket.totals.totalDownloads;
      existing.totals.totalSuccess += bucket.totals.totalSuccess;
      existing.totals.totalFail += bucket.totals.totalFail;
      this.mergeCounts(existing.counters.byStatus, bucket.counters.byStatus);
      this.mergeCounts(existing.counters.byType, bucket.counters.byType);
      this.mergeCounts(existing.counters.byBrowser, bucket.counters.byBrowser);
      this.mergeCounts(existing.counters.byOs, bucket.counters.byOs);
      this.mergeCounts(existing.counters.byExtVersion, bucket.counters.byExtVersion);
      this.mergeCounts(existing.counters.byLanguage, bucket.counters.byLanguage);
      this.mergeCounts(existing.counters.byCountry, bucket.counters.byCountry);
      this.mergeCounts(existing.counters.byErrorType, bucket.counters.byErrorType);
    };
    a.forEach(addBucket);
    b.forEach(addBucket);
    return Array.from(map.values()).sort((x, y) => x.bucketStart.localeCompare(y.bucketStart));
  }

  private mergePendingBatchesIfNeeded(): void {
    while (this.d.pendingBatches.length > MAX_PENDING_BATCHES) {
      const firstIdx = this.d.pendingBatches.findIndex((b) => (b.attempts ?? 0) === 0);
      const secondIdx = this.d.pendingBatches.findIndex(
        (b, idx) => idx > firstIdx && (b.attempts ?? 0) === 0,
      );
      if (firstIdx === -1 || secondIdx === -1) {
        // Avoid merging batches that have already been attempted (idempotency risk).
        break;
      }
      const [second] = this.d.pendingBatches.splice(secondIdx, 1);
      const [first] = this.d.pendingBatches.splice(firstIdx, 1);
      if (!first || !second) break;
      const mergedSummary = {
        totals: {
          totalEvents: first.batch.summary.totals.totalEvents + second.batch.summary.totals.totalEvents,
          totalDownloads: first.batch.summary.totals.totalDownloads + second.batch.summary.totals.totalDownloads,
          totalSuccess: first.batch.summary.totals.totalSuccess + second.batch.summary.totals.totalSuccess,
          totalFail: first.batch.summary.totals.totalFail + second.batch.summary.totals.totalFail,
        },
        browsers: this.mergeCounts({ ...first.batch.summary.browsers }, second.batch.summary.browsers),
        os: this.mergeCounts({ ...first.batch.summary.os }, second.batch.summary.os),
        countries: this.mergeCounts({ ...first.batch.summary.countries }, second.batch.summary.countries),
        languages: this.mergeCounts({ ...first.batch.summary.languages }, second.batch.summary.languages),
        versions: this.mergeCounts({ ...first.batch.summary.versions }, second.batch.summary.versions),
        types: this.mergeCounts({ ...first.batch.summary.types }, second.batch.summary.types),
        errorReasons: this.mergeCounts({ ...first.batch.summary.errorReasons }, second.batch.summary.errorReasons),
        topBrowser: "unknown",
        topOs: "unknown",
        topCountry: "unknown",
        topType: "unknown",
      };
      mergedSummary.topBrowser = this.getTopKey(mergedSummary.browsers);
      mergedSummary.topOs = this.getTopKey(mergedSummary.os);
      mergedSummary.topCountry = this.getTopKey(mergedSummary.countries);
      mergedSummary.topType = this.getTopKey(mergedSummary.types);

      const mergedBatch: OracleBatch = {
        batchId: `do-merge-${Date.now()}`,
        generatedAt: Date.now(),
        timeZone: "UTC",
        summary: mergedSummary,
        timeBuckets: this.mergeTimeBuckets(first.batch.timeBuckets, second.batch.timeBuckets),
        doState: first.batch.doState,
        uniqueIps: [],
      };
      const merged: PendingOracleBatch = {
        batch: mergedBatch,
        eventCount: first.eventCount + second.eventCount,
        maxSeq: Math.max(first.maxSeq, second.maxSeq),
        attempts: 0,
        createdAt: Date.now(),
      };
      this.d.pendingBatches.unshift(merged);
    }
  }

  private maybeCompactBuffer(): void {
    const maxBuffer = this.d.configMaxBufferSize || 50_000;
    if (this.d.buffer.length < Math.floor(maxBuffer * COMPACT_TRIGGER_UTIL)) {
      return;
    }

    const target = Math.floor(maxBuffer * COMPACT_TARGET_UTIL);
    const toCompact = this.d.buffer.length - target;
    if (toCompact <= 0) return;

    const sliceCount = Math.min(toCompact, COMPACT_MAX_BATCH);
    const events = this.d.buffer.slice(0, sliceCount);
    if (events.length === 0) return;

    const batchId = `do-compact-${Date.now()}-${events.length}ev`;
    const batch = this.buildOracleBatch(events, batchId);
    const maxSeq = events.reduce((m, ev) => Math.max(m, ev.seq || 0), this.d.committedSeq || 0);
    this.d.pendingBatches.push({
      batch,
      eventCount: events.length,
      maxSeq,
      attempts: 0,
      createdAt: Date.now(),
    });
    this.d.buffer = this.d.buffer.slice(sliceCount);

    this.mergePendingBatchesIfNeeded();
  }

  /**
   * Build an aggregated OracleBatch from raw events in buffer.
   * Groups events by hour and aggregates counters.
   */
  private buildOracleBatch(events: StoredEvent[], batchIdOverride?: string): OracleBatch {
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
    const batchId = batchIdOverride || `do-seq${this.d.batchSeq}-${events.length}ev`;

    // PRIVACY FIX: IP collection disabled per PRIVACY.md policy
    // The privacy policy states IPs are never stored, so we don't send them to Oracle
    // This disables the Geo Map feature but aligns code with documented privacy claims
    // To re-enable, update PRIVACY.md to disclose IP storage and uncomment the code below
    const uniqueIps: string[] = [];  // Disabled for privacy compliance

    // LEAN INGESTION: Only send summaries, NOT raw events or IPs
    // This reduces payload size and maintains privacy compliance
    return {
      batchId,
      generatedAt: now,
      timeZone: "UTC",
      summary,      // Aggregated counters
      timeBuckets,  // Hourly aggregates
      doState,      // DO health snapshot
      uniqueIps,    // Empty - IPs not collected per privacy policy
      // NOTE: Raw events intentionally excluded to reduce payload size
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

    if (!this.d.buffer.length && this.d.pendingBatches.length === 0) {
      // Nothing to flush; clear retry state + alarm.
      this.d.lastFlushAt = now;
      this.d.retryState = { ...DEFAULT_RETRY_STATE };
      await this.scheduleNextMidnightAlarm();
      await this.persist();
      return { ok: true, sent: 0 };
    }

    if (!this.env.ORACLE_ENDPOINT || !this.env.DO_SHARED_SECRET) {
      const msg = "ORACLE_ENDPOINT or DO_SHARED_SECRET not configured";
      if (!this.d.retryState) this.d.retryState = { ...DEFAULT_RETRY_STATE };
      this.d.retryState.lastError = msg;
      this.d.retryState.lastFlushAttemptAt = now;
      logEvent("error", "oracle_flush_misconfigured", { error: msg });
      // Don't schedule retries if endpoint is missing - just report error
      await this.state.storage.deleteAlarm();
      await this.persist();
      return { ok: false, sent: 0, error: msg };
    }

    const maxBatchEnv =
      parseInt(this.env.MAX_BATCH_EVENTS || "10000", 10) || 10000;
    // FIX: even "force" should chunk; force just means "try now / bypass gating"
    let eventsToFlush: StoredEvent[] = [];
    let oracleBatch: OracleBatch | null = null;
    let pendingMeta: PendingOracleBatch | null = null;

    if (this.d.pendingBatches.length > 0) {
      pendingMeta = this.d.pendingBatches[0];
      oracleBatch = pendingMeta.batch;
      pendingMeta.attempts = (pendingMeta.attempts ?? 0) + 1;
    } else {
      eventsToFlush = this.d.buffer.slice(0, maxBatchEnv);
      oracleBatch = this.buildOracleBatch(eventsToFlush);
    }

    // --- LOGGING for Debugging ---
    // HTTP mode note: Oracle free-tier deployment may be HTTP-only.
    // Keep transport protected via network controls if TLS is unavailable.
    const targetUrl = this.env.ORACLE_ENDPOINT + "/ingest-batch";
    console.log("------------------------------------------------");
    console.log("Attempting Flush to:", targetUrl);
    console.log("Secret Length:", this.env.DO_SHARED_SECRET ? this.env.DO_SHARED_SECRET.length : "MISSING");
    // ----------------------

    if (!this.d.retryState) this.d.retryState = { ...DEFAULT_RETRY_STATE };
    this.d.retryState.lastFlushAttemptAt = now;

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
        logEvent("warn", "oracle_flush_failed", { status: res.status, statusText: res.statusText });
        await this.scheduleRetry();
        await this.persist();
        return { ok: false, sent: 0, error: msg };
      }

      const ack = await res
        .json()
        .catch(() => null) as { ok?: boolean; batchId?: string; ingestedAt?: number } | null;
      if (!ack || ack.ok !== true) {
        const msg = "Oracle ACK invalid or missing ok=true";
        this.d.retryState.lastError = msg;
        this.d.retryState.consecutiveFailures += 1;
        logEvent("warn", "oracle_flush_ack_invalid", { error: msg });
        await this.scheduleRetry();
        await this.persist();
        return { ok: false, sent: 0, error: msg };
      }
      if (!ack.batchId || ack.batchId !== oracleBatch.batchId) {
        const msg = `Oracle ACK batchId mismatch (expected ${oracleBatch.batchId}, got ${ack.batchId || "missing"})`;
        this.d.retryState.lastError = msg;
        this.d.retryState.consecutiveFailures += 1;
        logEvent("warn", "oracle_flush_ack_mismatch", { error: msg });
        await this.scheduleRetry();
        await this.persist();
        return { ok: false, sent: 0, error: msg };
      }

      // Success: drop the sent events or pending batch and increment batch sequence
      if (pendingMeta) {
        this.d.pendingBatches.shift();
        this.d.pendingEvents = Math.max(0, this.d.pendingEvents - pendingMeta.eventCount);
        this.d.committedSeq = Math.max(this.d.committedSeq, pendingMeta.maxSeq);
      } else {
        const maxSeq = eventsToFlush.reduce((m, ev) => Math.max(m, ev.seq || 0), this.d.committedSeq || 0);
        this.d.buffer = this.d.buffer.slice(eventsToFlush.length);
        this.d.pendingEvents = Math.max(
          0,
          this.d.pendingEvents - eventsToFlush.length,
        );
        this.d.committedSeq = Math.max(this.d.committedSeq, maxSeq);
      }
      this.d.lastFlushAt = now;
      this.d.batchSeq += 1; // Increment so next batch gets new ID
      this.d.retryState = { ...DEFAULT_RETRY_STATE };
      await this.scheduleNextMidnightAlarm();
      await this.persist();

      return { ok: true, sent: pendingMeta ? pendingMeta.eventCount : eventsToFlush.length };
    } catch (err: unknown) {
      const msg = `Oracle flush error: ${String(err)}`;
      if (!this.d.retryState) this.d.retryState = { ...DEFAULT_RETRY_STATE };
      this.d.retryState.lastError = msg;
      this.d.retryState.consecutiveFailures += 1;
      logEvent("error", "oracle_flush_exception", { error: String(err) });
      await this.scheduleRetry();
      await this.persist();
      return { ok: false, sent: 0, error: msg };
    }
  }
  /**
   * Public endpoint for the extension to fetch the changelog.
   * Returns sorted entries and current config.
   */
  private async handleGetChangelog(): Promise<Response> {
    const sorted = [...this.d.changelog].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return json({
      ok: true,
      entries: sorted,
      config: this.d.changelogConfig,
    });
  }

  /**
   * Admin endpoint to update changelog or config.
   * Expects JSON body with `changelog` (array) or `config` (object) or both.
   */
  private async handleAdminUpdateChangelog(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    try {
      const body = await request.json() as { 
        changelog?: ChangelogEntry[]; 
        config?: ChangelogConfig;
      };

      let updated = false;

      if (Array.isArray(body.changelog)) {
        this.d.changelog = body.changelog;
        updated = true;
      }

      if (body.config) {
        this.d.changelogConfig = {
          ...this.d.changelogConfig,
          ...body.config,
          lastUpdated: Date.now(),
        };
        updated = true;
      }

      if (updated) {
        await this.persist();
      }

      return json({ ok: true, updated });
    } catch {
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
  }

  // ---------------------------------------------------------------------------
  // Login Rate Limiting
  // ---------------------------------------------------------------------------

  /**
   * Handles login attempt tracking for rate limiting.
   * POST /auth/login-attempt
   * Body: { ip: string, success: boolean }
   * 
   * On failed attempt: increment counter, check if blocked
   * On success: clear attempts for that IP
   * 
   * Returns: { allowed: boolean, attemptsRemaining?: number, blockedUntil?: number }
   */
  private async handleLoginAttempt(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    let body: { ip?: string; success?: boolean; checkOnly?: boolean };
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const ip = body.ip || request.headers.get("X-Client-IP") || "unknown";
    const isSuccess = body.success === true;
    const checkOnly = body.checkOnly === true;

    // Initialize if not present
    if (!this.d.loginAttempts) {
      this.d.loginAttempts = {};
    }

    const now = Date.now();
    const record = this.d.loginAttempts[ip];

    // Check-only mode: return current lockout state without mutating
    if (checkOnly) {
      if (record) {
        const elapsed = now - record.firstAttemptAt;
        if (elapsed >= LOCKOUT_DURATION_MS) {
          return json({
            ok: true,
            allowed: true,
            attemptsRemaining: MAX_ATTEMPTS,
          });
        }
        if (record.attempts >= MAX_ATTEMPTS) {
          const blockedUntil = record.firstAttemptAt + LOCKOUT_DURATION_MS;
          return json({
            ok: true,
            allowed: false,
            blockedUntil,
            blockedForSeconds: Math.ceil((blockedUntil - now) / 1000),
            message: "Too many failed login attempts. Try again later.",
          });
        }
        return json({
          ok: true,
          allowed: true,
          attemptsRemaining: MAX_ATTEMPTS - record.attempts,
        });
      }
      return json({
        ok: true,
        allowed: true,
        attemptsRemaining: MAX_ATTEMPTS,
      });
    }

    // On successful login, clear attempts
    if (isSuccess) {
      delete this.d.loginAttempts[ip];
      await this.persist();
      return json({ ok: true, allowed: true, attemptsRemaining: MAX_ATTEMPTS });
    }

    // Check if currently locked out
    if (record) {
      const elapsed = now - record.firstAttemptAt;
      
      // If lockout period expired, reset
      if (elapsed >= LOCKOUT_DURATION_MS) {
        this.d.loginAttempts[ip] = { attempts: 1, firstAttemptAt: now };
        await this.persist();
        return json({ 
          ok: true, 
          allowed: true, 
          attemptsRemaining: MAX_ATTEMPTS - 1 
        });
      }

      // Already at max attempts, deny
      if (record.attempts >= MAX_ATTEMPTS) {
        const blockedUntil = record.firstAttemptAt + LOCKOUT_DURATION_MS;
        return json({ 
          ok: true, 
          allowed: false, 
          blockedUntil,
          blockedForSeconds: Math.ceil((blockedUntil - now) / 1000),
          message: "Too many failed login attempts. Try again later."
        });
      }

      // Increment and check
      record.attempts += 1;
      await this.persist();

      if (record.attempts >= MAX_ATTEMPTS) {
        const blockedUntil = record.firstAttemptAt + LOCKOUT_DURATION_MS;
        return json({ 
          ok: true, 
          allowed: false, 
          blockedUntil,
          blockedForSeconds: Math.ceil((blockedUntil - now) / 1000),
          message: "Too many failed login attempts. Try again later."
        });
      }

      return json({ 
        ok: true, 
        allowed: true, 
        attemptsRemaining: MAX_ATTEMPTS - record.attempts 
      });
    }

    // First failed attempt for this IP
    this.d.loginAttempts[ip] = { attempts: 1, firstAttemptAt: now };
    await this.persist();
    
    return json({ 
      ok: true, 
      allowed: true, 
      attemptsRemaining: MAX_ATTEMPTS - 1 
    });
  }

  // ---------------------------------------------------------------------------
  // IP Allowlist Handlers
  // ---------------------------------------------------------------------------

  /**
   * Check if an IP is allowed to access the dashboard.
   * POST /auth/check-ip-allowlist
   * Body: { ip: string }
   * 
   * Returns: { allowed: boolean }
   */
  private async handleCheckIpAllowlist(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ allowed: false, error: "unauthorized" }, { status: 401 });
    }
    let body: { ip?: string };
    try {
      body = await request.json();
    } catch {
      return json({ allowed: true }); // Allow on parse error to prevent lockout
    }

    const ip = body.ip || "unknown";

    // If allowlist is disabled, allow all
    if (!this.d.ipAllowlistEnabled || this.d.ipAllowlist.length === 0) {
      return json({ allowed: true });
    }

    // Check exact match
    const isAllowed = this.d.ipAllowlist.includes(ip);
    
    return json({ allowed: isAllowed });
  }

  /**
   * Get current IP allowlist configuration.
   * GET /admin/ip-allowlist
   * Requires X-Admin-Secret
   */
  private async handleGetIpAllowlist(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // Get the client IP from request headers
    const clientIp = request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
      request.headers.get("X-Real-IP") ||
      "unknown";

    return json({
      ok: true,
      enabled: this.d.ipAllowlistEnabled,
      allowlist: this.d.ipAllowlist,
      yourIp: clientIp,
    });
  }

  /**
   * Update IP allowlist configuration.
   * POST /admin/ip-allowlist
   * Body: { enabled?: boolean, allowlist?: string[], add?: string, remove?: string }
   * Requires X-Admin-Secret
   */
  private async handleAdminIpAllowlist(request: Request): Promise<Response> {
    if (!this.isAuthorizedAdmin(request)) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let body: { 
      enabled?: boolean; 
      allowlist?: string[]; 
      add?: string; 
      remove?: string 
    };
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    let updated = false;

    // Set enabled state
    if (typeof body.enabled === "boolean") {
      this.d.ipAllowlistEnabled = body.enabled;
      updated = true;
    }

    // Replace entire allowlist
    if (Array.isArray(body.allowlist)) {
      this.d.ipAllowlist = body.allowlist.filter(ip => typeof ip === "string" && ip.length > 0);
      updated = true;
    }

    // Add single IP
    if (body.add && typeof body.add === "string" && !this.d.ipAllowlist.includes(body.add)) {
      this.d.ipAllowlist.push(body.add);
      updated = true;
    }

    // Remove single IP
    if (body.remove && typeof body.remove === "string") {
      const idx = this.d.ipAllowlist.indexOf(body.remove);
      if (idx !== -1) {
        this.d.ipAllowlist.splice(idx, 1);
        updated = true;
      }
    }

    if (updated) {
      await this.persist();
    }

    return json({
      ok: true,
      updated,
      enabled: this.d.ipAllowlistEnabled,
      allowlist: this.d.ipAllowlist,
    });
  }
}
