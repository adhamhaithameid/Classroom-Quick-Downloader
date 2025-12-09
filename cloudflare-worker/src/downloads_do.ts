// filepath: cloudflare-worker/src/downloads_do.ts

import { Counters, RetryState, StatsResponse, ConfigResponse, QuotaDescriptor, StoredEvent } from "./types";

export interface Env {
  ORACLE_ENDPOINT: string;
  DO_SHARED_SECRET: string;
  MAX_BATCH_EVENTS: string;
}

type DurableStateShape = {
  totalEvents: number;
  totalDownloads: number;
  pendingEvents: number;
  lastEventAt: number | null;
  lastFlushAt: number | null;
  counters: Counters;
  retryState: RetryState | null;

  // NEW: daily request counting for quota awareness
  reqCountToday: number;
  reqCountDate: string | null; // "YYYY-MM-DD" UTC
  // For future admin "cut power" switch
  hardRemoteOff: boolean;

  // Buffered events waiting to be flushed to Oracle
  buffer: StoredEvent[];
};

// Reasonable defaults to be merged with whatever is persisted
const DEFAULT_COUNTERS: Counters = {
  byStatus: {},
  byType: {},
  byBrowser: {},
  byOs: {},
  byExtVersion: {},
  byLanguage: {},
};

const DEFAULT_RETRY_STATE: RetryState = {
  consecutiveFailures: 0,
};

// Quota thresholds (approx. Cloudflare daily request quotas)
const QUOTA_VERY_SOFT_LIMIT   = 30_000;
const QUOTA_SOFT_LIMIT        = 40_000;
const QUOTA_VERY_NORMAL_LIMIT = 50_000;
const QUOTA_NORMAL_LIMIT      = 60_000;
const QUOTA_HARD_NORMAL_LIMIT = 70_000;
const QUOTA_HARD_LIMIT        = 80_000;
const QUOTA_VERY_HARD_LIMIT   = 90_000;

// Storage key
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
    // Admin override or future "Danger Area" switch.
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

  private async load(): Promise<void> {
    const stored = await this.state.storage.get<DurableStateShape>(STORAGE_KEY);

    const base: DurableStateShape = {
      totalEvents: 0,
      totalDownloads: 0,
      pendingEvents: 0,
      lastEventAt: null,
      lastFlushAt: null,
      counters: { ...DEFAULT_COUNTERS },
      retryState: { ...DEFAULT_RETRY_STATE },

      reqCountToday: 0,
      reqCountDate: null,
      hardRemoteOff: false,

      buffer: [],
    };

    if (!stored) {
      this.data = base;
      return;
    }

    // Merge stored with defaults to be robust to schema changes.
    this.data = {
      totalEvents: stored.totalEvents ?? base.totalEvents,
      totalDownloads: stored.totalDownloads ?? base.totalDownloads,
      pendingEvents: stored.pendingEvents ?? base.pendingEvents,
      lastEventAt: stored.lastEventAt ?? base.lastEventAt,
      lastFlushAt: stored.lastFlushAt ?? base.lastFlushAt,
      counters: {
        byStatus: stored.counters?.byStatus ?? { ...DEFAULT_COUNTERS.byStatus },
        byType: stored.counters?.byType ?? { ...DEFAULT_COUNTERS.byType },
        byBrowser: stored.counters?.byBrowser ?? { ...DEFAULT_COUNTERS.byBrowser },
        byOs: stored.counters?.byOs ?? { ...DEFAULT_COUNTERS.byOs },
        byExtVersion: stored.counters?.byExtVersion ?? { ...DEFAULT_COUNTERS.byExtVersion },
        byLanguage: stored.counters?.byLanguage ?? { ...DEFAULT_COUNTERS.byLanguage },
      },
      retryState: stored.retryState ?? { ...DEFAULT_RETRY_STATE },

      reqCountToday: stored.reqCountToday ?? 0,
      reqCountDate: stored.reqCountDate ?? null,
      hardRemoteOff: stored.hardRemoteOff ?? false,

      buffer: Array.isArray(stored.buffer) ? stored.buffer : [],
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

  /**
   * Ensure reqCountToday is for the current UTC day. Resets counters
   * when the day changes.
   */
  private ensureRequestDay(): void {
    const today = todayUtcDate();
    if (this.d.reqCountDate !== today) {
      this.d.reqCountDate = today;
      this.d.reqCountToday = 0;
      // Note: hardRemoteOff is *not* reset here – this is a design choice.
      // You can decide later if it should reset daily or stay sticky.
    }
  }

  // --------------------------------------------------------
  // Core fetch router
  // --------------------------------------------------------
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
      return this.handleDebugFlush();
    }

    return new Response("Not found (DO)", { status: 404 });
  }

  // --------------------------------------------------------
  // Handlers
  // --------------------------------------------------------

  private async handleTrack(request: Request): Promise<Response> {
    // Update daily request counters
    this.ensureRequestDay();
    this.d.reqCountToday += 1;

    let body: { events?: StoredEvent[] } | null = null;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const events = body?.events;
    if (!Array.isArray(events) || events.length === 0) {
      await this.persist();
      return json({ ok: true, accepted: 0 }, { status: 202 });
    }

    // Append to buffer
    for (const ev of events) {
      this.d.buffer.push(ev);
      this.d.totalEvents += 1;
      if (ev.status === "success") {
        this.d.totalDownloads += 1;
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
      c.byExtVersion[extVersion] = (c.byExtVersion[extVersion] || 0) + 1;

      const lang = (ev.language || "unknown").toLowerCase();
      c.byLanguage[lang] = (c.byLanguage[lang] || 0) + 1;
    }

    await this.persist();

    // NOTE: actual flush-to-Oracle logic is assumed to live elsewhere
    // (e.g., time-based or size-based flush plus retryState updates).
    // We don't change that behavior in this step.

    return json({ ok: true, accepted: events.length }, { status: 202 });
  }

  private async handleStats(): Promise<Response> {
    const quota = computeQuotaDescriptor(this.d.reqCountToday, this.d.hardRemoteOff);

    const payload: StatsResponse = {
      ok: true,
      totalEvents: this.d.totalEvents,
      totalDownloads: this.d.totalDownloads,
      pendingEvents: this.d.pendingEvents,
      lastEventAt: this.d.lastEventAt,
      lastFlushAt: this.d.lastFlushAt,
      counters: this.d.counters,
      retryState: this.d.retryState,
      quota,
    };

    return json(payload);
  }

  /**
   * Config endpoint used by the extension (in a later step) to
   * adapt batching / flush behavior based on current quota state.
   */
  private async handleConfig(): Promise<Response> {
    const quota = computeQuotaDescriptor(this.d.reqCountToday, this.d.hardRemoteOff);

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
    return json({
      ok: true,
      pendingEvents: this.d.pendingEvents,
      lastEventAt: this.d.lastEventAt,
      lastFlushAt: this.d.lastFlushAt,
    });
  }

  private async handleDebugFlush(): Promise<Response> {
    // This just exposes current buffer size; real flush-to-Oracle
    // behavior is assumed to be implemented already.
    const before = this.d.buffer.length;
    // If you have actual flush logic, you would call it here.
    // For now we just report.
    return json({
      ok: true,
      message: "debug flush not implemented in this step",
      bufferSize: before,
    });
  }
}