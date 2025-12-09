// filepath: extension/entrypoints/utils/analytics.ts

export interface AnalyticsEvent {
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

  /**
   * Optional: where this came from ("download_all", "single", etc.)
   * Currently not used in your UI, but forwarded to Cloudflare.
   */
  source?: string;

  /**
   * Internal only – how many times this event has been included in a
   * failed flush. Used for "poison pill" protection.
   */
  retryCount?: number;
}

export interface LocalStats {
  /**
   * Successful downloads (what your current popup UI uses as "total").
   */
  total: number;

  /**
   * Aggregated counts by normalized type (pdf, docs, sheets, slides, images, etc.).
   */
  byType: Record<string, number>;

  /**
   * Extra analysis fields (not shown in current UI).
   */
  success?: number;
  fail?: number;
  attempts?: number;
  bySpeed?: {
    fast: number;
    medium: number;
    slow: number;
  };
  bypassCount?: number;
  failByErrorType?: Record<string, number>;
  byLanguage?: Record<string, number>;
  lastUpdated?: number;
}

const STORAGE_KEY_QUEUE = 'pending_events';
const STORAGE_KEY_STATS = 'local_stats';

// NEW: dynamic config + meta keys
const STORAGE_KEY_CONFIG = 'cqd_analytics_config_v1';
const STORAGE_KEY_META = 'cqd_analytics_meta_v1';

/**
 * Default / baseline batch size when no config is available.
 */
const BATCH_SIZE = 50;

/**
 * How many failed flush attempts an event can survive
 * before we consider it a "poison pill" and drop it.
 */
const MAX_RETRY = 5;

/**
 * Step 1: remote sending is enabled with your Worker URL.
 * (You can later switch this to an env variable via Vite.)
 */
const WORKER_URL =
  'https://cqd-analytics.adhamhaithameid.workers.dev/track';
const REMOTE_ENABLED = WORKER_URL.length > 0;

// Derived URLs
const TRACK_URL = WORKER_URL;
const WORKER_BASE_URL = WORKER_URL.replace(/\/+track$/, '');
const CONFIG_URL = WORKER_BASE_URL ? `${WORKER_BASE_URL}/config` : '';

/**
 * Config pulled from Worker /config.
 */
type AnalyticsConfig = {
  batchSize: number;
  lowUsageFlushMinutes: number; // queue < 15
  midUsageFlushMinutes: number; // 15 <= queue < 35
  highUsageFlushMinutes: number; // 35 <= queue < 50
  remoteEnabled: boolean;
};

/**
 * Meta info for time-based flush and backoff.
 */
type AnalyticsMeta = {
  lastFlushAt: number | null;
  nextRetryAt: number | null;
  backoffIndex: number;
};

/**
 * Default values when there's no config/meta yet.
 */
const DEFAULT_CONFIG: AnalyticsConfig = {
  batchSize: BATCH_SIZE,
  lowUsageFlushMinutes: 120,
  midUsageFlushMinutes: 60,
  highUsageFlushMinutes: 30,
  remoteEnabled: REMOTE_ENABLED,
};

const DEFAULT_META: AnalyticsMeta = {
  lastFlushAt: null,
  nextRetryAt: null,
  backoffIndex: 0,
};

/**
 * Backoff steps in seconds for retry after /track failure.
 * 1 min → 5 → 15 → 30 → 1h → 3h → 6h → 12h → 1d
 */
const BACKOFF_STEPS_SECONDS = [
  60,
  300,
  900,
  1800,
  3600,
  10_800,
  21_600,
  43_200,
  86_400,
];

// -------------------------------------------------------
// Small helpers
// -------------------------------------------------------

function bucketDuration(durationMs: number): 'fast' | 'medium' | 'slow' {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'fast';
  if (durationMs <= 3000) return 'fast';
  if (durationMs <= 15000) return 'medium';
  return 'slow';
}

function detectBrowser(): string {
  try {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent || '';
    if (ua.includes('Edg/')) return 'edge';
    if (ua.includes('OPR/') || ua.includes('Opera')) return 'opera';
    if (ua.includes('Firefox/')) return 'firefox';
    if (ua.includes('Chrome/')) return 'chrome';
    if (ua.includes('Safari/')) return 'safari';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function detectOS(): Promise<string> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getPlatformInfo) {
    return 'unknown';
  }
  try {
    const info = await new Promise<chrome.runtime.PlatformInfo>((resolve) => {
      chrome.runtime.getPlatformInfo((pi) => resolve(pi));
    });
    return info.os;
  } catch {
    return 'unknown';
  }
}

function detectLanguage(): string {
  try {
    if (typeof navigator === 'undefined') return 'en-US';
    return navigator.language || 'en-US';
  } catch {
    return 'en-US';
  }
}

let cachedVersion: string | null = null;
function getExtensionVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
      const v = chrome.runtime.getManifest().version;
      cachedVersion = v || '0.0.0';
      return cachedVersion;
    }
  } catch {
    // ignore
  }
  return '0.0.0';
}

// -------------------------------------------------------
// Storage helpers
// -------------------------------------------------------

async function loadQueue(): Promise<AnalyticsEvent[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return [];
  const raw = await chrome.storage.local.get(STORAGE_KEY_QUEUE);
  const queue = raw[STORAGE_KEY_QUEUE];
  if (!Array.isArray(queue)) return [];
  return queue as AnalyticsEvent[];
}

async function saveQueue(queue: AnalyticsEvent[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [STORAGE_KEY_QUEUE]: queue });
}

// --- Config/meta helpers ---

async function loadConfig(): Promise<AnalyticsConfig> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return DEFAULT_CONFIG;
  }
  const raw = await chrome.storage.local.get(STORAGE_KEY_CONFIG);
  const stored = raw[STORAGE_KEY_CONFIG] as Partial<AnalyticsConfig> | undefined;
  if (!stored || typeof stored !== 'object') return DEFAULT_CONFIG;
  return {
    batchSize: typeof stored.batchSize === 'number' && stored.batchSize > 0
      ? stored.batchSize
      : DEFAULT_CONFIG.batchSize,
    lowUsageFlushMinutes:
      typeof stored.lowUsageFlushMinutes === 'number'
        ? stored.lowUsageFlushMinutes
        : DEFAULT_CONFIG.lowUsageFlushMinutes,
    midUsageFlushMinutes:
      typeof stored.midUsageFlushMinutes === 'number'
        ? stored.midUsageFlushMinutes
        : DEFAULT_CONFIG.midUsageFlushMinutes,
    highUsageFlushMinutes:
      typeof stored.highUsageFlushMinutes === 'number'
        ? stored.highUsageFlushMinutes
        : DEFAULT_CONFIG.highUsageFlushMinutes,
    remoteEnabled:
      typeof stored.remoteEnabled === 'boolean'
        ? stored.remoteEnabled
        : DEFAULT_CONFIG.remoteEnabled,
  };
}

async function saveConfig(cfg: AnalyticsConfig): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [STORAGE_KEY_CONFIG]: cfg });
}

async function loadMeta(): Promise<AnalyticsMeta> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return DEFAULT_META;
  }
  const raw = await chrome.storage.local.get(STORAGE_KEY_META);
  const meta = raw[STORAGE_KEY_META] as Partial<AnalyticsMeta> | undefined;
  if (!meta || typeof meta !== 'object') return DEFAULT_META;
  return {
    lastFlushAt:
      typeof meta.lastFlushAt === 'number' ? meta.lastFlushAt : null,
    nextRetryAt:
      typeof meta.nextRetryAt === 'number' ? meta.nextRetryAt : null,
    backoffIndex:
      typeof meta.backoffIndex === 'number' ? meta.backoffIndex : 0,
  };
}

async function saveMeta(meta: AnalyticsMeta): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [STORAGE_KEY_META]: meta });
}

function normalizeStats(raw: any): LocalStats {
  const base: LocalStats = {
    total: 0,
    byType: {},
    success: 0,
    fail: 0,
    attempts: 0,
    bySpeed: { fast: 0, medium: 0, slow: 0 },
    bypassCount: 0,
    failByErrorType: {},
    byLanguage: {},
    lastUpdated: Date.now(),
  };

  if (!raw || typeof raw !== 'object') return base;

  return {
    total: typeof raw.total === 'number' ? raw.total : 0,
    byType: raw.byType && typeof raw.byType === 'object' ? raw.byType : {},
    success: typeof raw.success === 'number' ? raw.success : raw.total || 0,
    fail: typeof raw.fail === 'number' ? raw.fail : 0,
    attempts:
      typeof raw.attempts === 'number'
        ? raw.attempts
        : ((raw.total || 0) + (raw.fail || 0)),
    bySpeed: {
      fast: raw.bySpeed?.fast ?? 0,
      medium: raw.bySpeed?.medium ?? 0,
      slow: raw.bySpeed?.slow ?? 0,
    },
    bypassCount: typeof raw.bypassCount === 'number' ? raw.bypassCount : 0,
    failByErrorType:
      raw.failByErrorType && typeof raw.failByErrorType === 'object'
        ? raw.failByErrorType
        : {},
    byLanguage:
      raw.byLanguage && typeof raw.byLanguage === 'object'
        ? raw.byLanguage
        : {},
    lastUpdated:
      typeof raw.lastUpdated === 'number' ? raw.lastUpdated : Date.now(),
  };
}

async function loadStats(): Promise<LocalStats> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return normalizeStats(null);
  }
  const raw = await chrome.storage.local.get(STORAGE_KEY_STATS);
  return normalizeStats(raw[STORAGE_KEY_STATS]);
}

async function saveStats(stats: LocalStats): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  stats.lastUpdated = Date.now();
  await chrome.storage.local.set({ [STORAGE_KEY_STATS]: stats });
}

// -------------------------------------------------------
// Local aggregation – analysis only (UI still uses total/byType)
// -------------------------------------------------------

async function updateLocalStats(event: AnalyticsEvent): Promise<void> {
  const stats = await loadStats();
  const isSuccess = event.status === 'success';

  if (isSuccess) {
    stats.success = (stats.success || 0) + 1;
    stats.total = (stats.total || 0) + 1; // keep popup compatible
  } else {
    stats.fail = (stats.fail || 0) + 1;
    const key = (event.error_type || 'UNKNOWN').toUpperCase();
    if (!stats.failByErrorType) stats.failByErrorType = {};
    stats.failByErrorType[key] = (stats.failByErrorType[key] || 0) + 1;
  }

  stats.attempts = (stats.attempts || 0) + 1;

  // File-type buckets (success only – same semantics as your donut)
  if (isSuccess) {
    let type = (event.file_type || 'unknown').trim().toLowerCase();
    if (!type) type = 'unknown';

    if (['doc', 'docx', 'txt', 'rtf'].includes(type)) type = 'docs';
    else if (['xls', 'xlsx', 'csv'].includes(type)) type = 'sheets';
    else if (['ppt', 'pptx'].includes(type)) type = 'slides';
    else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(type))
      type = 'images';
    else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(type)) type = 'archive';
    else if (['mp4', 'mov', 'avi', 'mkv'].includes(type)) type = 'video';
    else if (['mp3', 'wav', 'aac'].includes(type)) type = 'audio';
    // else: keep raw extension – pdf, exe, mht, etc.

    stats.byType[type] = (stats.byType[type] || 0) + 1;
  }

  // Speed buckets (all attempts)
  if (!stats.bySpeed) {
    stats.bySpeed = { fast: 0, medium: 0, slow: 0 };
  }
  const bucket = bucketDuration(event.duration_ms || 0);
  stats.bySpeed[bucket] = (stats.bySpeed[bucket] || 0) + 1;

  // Bypass count (all attempts where bypass_used = true)
  stats.bypassCount = (stats.bypassCount || 0) + (event.bypass_used ? 1 : 0);

  // Language (success only, reflects real usage)
  if (isSuccess) {
    if (!stats.byLanguage) stats.byLanguage = {};
    const lang = (event.language || 'unknown').toLowerCase();
    stats.byLanguage[lang] = (stats.byLanguage[lang] || 0) + 1;
  }

  await saveStats(stats);
}

// -------------------------------------------------------
// Network flush
// -------------------------------------------------------

async function sendBatchToCloudflare(
  events: AnalyticsEvent[],
): Promise<boolean> {
  if (!events.length) return true;

  // If remote is globally disabled or URL not configured → simulate success.
  if (!REMOTE_ENABLED || !TRACK_URL) {
    console.log(
      '[Analytics] Remote endpoint not configured. Simulating flush of',
      events.length,
      'events.',
    );
    return true;
  }

  if (typeof fetch === 'undefined') {
    console.warn('[Analytics] fetch() not available in this context.');
    return false;
  }

  try {
    const res = await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });

    if (!res.ok) {
      console.warn(
        '[Analytics] Cloudflare Worker returned non-200:',
        res.status,
      );
      return false;
    }

    const json = await res.json().catch(() => ({} as any));
    if (json && json.ok === false) {
      console.warn('[Analytics] Cloudflare Worker ok=false:', json);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Analytics] Error sending batch to Cloudflare:', err);
    return false;
  }
}

/**
 * Helper: should we flush right now based on:
 * - queue length vs batchSize
 * - time-based thresholds (120 / 60 / 30 minutes)
 */
function shouldFlushNowForTimeAndSize(
  cfg: AnalyticsConfig,
  meta: AnalyticsMeta,
  queueLength: number,
): boolean {
  if (!cfg.remoteEnabled) return false;
  if (queueLength === 0) return false;

  const now = Date.now();
  const last = meta.lastFlushAt ?? 0;
  const ageMinutes = last === 0 ? Infinity : (now - last) / 60000;

  // Immediate flush when queue >= target batch size
  if (queueLength >= cfg.batchSize) return true;

  // Time-based flush rules (for low-activity users)
  if (queueLength < 15 && ageMinutes >= cfg.lowUsageFlushMinutes) return true;
  if (
    queueLength >= 15 &&
    queueLength < 35 &&
    ageMinutes >= cfg.midUsageFlushMinutes
  )
    return true;
  if (
    queueLength >= 35 &&
    queueLength < 50 &&
    ageMinutes >= cfg.highUsageFlushMinutes
  )
    return true;

  return false;
}

// -------------------------------------------------------
// INTERNAL OP QUEUE (prevents race conditions)
// -------------------------------------------------------

let opChain: Promise<void> = Promise.resolve();

function enqueueOp(op: () => Promise<void>): void {
  opChain = opChain
    .then(op)
    .catch((err) => {
      console.error('[Analytics] Operation failed:', err);
    });
}

// -------------------------------------------------------
// internalTrack / internalFlush with poison-pill + backoff
// -------------------------------------------------------

async function internalTrack(
  event: Omit<
    AnalyticsEvent,
    | 'timestamp'
    | 'ext_version'
    | 'browser'
    | 'os'
    | 'language'
    | 'retryCount'
  >,
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getManifest) {
    // Not in a real extension env – silently ignore
    return;
  }

  const fullEvent: AnalyticsEvent = {
    ...event,
    timestamp: Date.now(),
    ext_version: getExtensionVersion(),
    browser: detectBrowser(),
    os: await detectOS(),
    language: detectLanguage(),
    // retryCount intentionally left undefined; set only on failure
  };

  // Load config + meta + queue so we can decide flush behavior.
  const [cfg, meta, queue] = await Promise.all([
    loadConfig(),
    loadMeta(),
    loadQueue(),
  ]);

  // 1) Enqueue in persistent queue
  queue.push(fullEvent);
  await saveQueue(queue);

  // 2) Update local stats (for popup + analysis)
  await updateLocalStats(fullEvent);

  console.log('[Analytics] Event tracked. Queue size:', queue.length);

  // 3) If conditions are met (size/time), schedule a flush.
  if (shouldFlushNowForTimeAndSize(cfg, meta, queue.length)) {
    Analytics.flush();
  }
}

/**
 * Flush logic with:
 * - Time-based thresholds handled via shouldFlushNowForTimeAndSize()
 *   (we call internalFlush() periodically from background alarms).
 * - Backoff when /track fails:
 *     1 min → 5 → 15 → 30 → 1h → 3h → 6h → 12h → 1d
 * - Poison-pill protection:
 *     retryCount > MAX_RETRY → drop that event.
 */
async function internalFlush(): Promise<void> {
  const [cfg, meta, queue] = await Promise.all([
    loadConfig(),
    loadMeta(),
    loadQueue(),
  ]);
  if (!queue.length) return;

  // If remote is disabled (emergency mode), keep everything local, no flush.
  if (!cfg.remoteEnabled) {
    console.log(
      '[Analytics] Remote disabled by config; keeping',
      queue.length,
      'events local.',
    );
    return;
  }

  const now = Date.now();

  // Respect backoff schedule: if it's not time yet, skip.
  if (meta.nextRetryAt && now < meta.nextRetryAt) {
    return;
  }

  // Also respect time-based thresholds + batch size; if it's "too early",
  // we just skip – alarms will keep calling this.
  if (!shouldFlushNowForTimeAndSize(cfg, meta, queue.length)) {
    return;
  }

  const effectiveBatchSize = cfg.batchSize || BATCH_SIZE;
  const batch = queue.slice(0, effectiveBatchSize);
  const rest = queue.slice(effectiveBatchSize);

  console.log(
    `[Analytics] Attempting flush. Sending ${batch.length} events of ${queue.length} queued.`,
  );

  const ok = await sendBatchToCloudflare(batch);

  if (ok) {
    // Remote accepted → remove those items.
    await saveQueue(rest);

    const newMeta: AnalyticsMeta = {
      lastFlushAt: now,
      nextRetryAt: null,
      backoffIndex: 0,
    };
    await saveMeta(newMeta);

    console.log(
      '[Analytics] Flush succeeded. Sent',
      batch.length,
      'events. Remaining in queue:',
      rest.length,
    );
    return;
  }

  // Flush failed → poison-pill & schedule backoff
  const updatedBatch: AnalyticsEvent[] = batch.map((ev) => {
    const prev = typeof ev.retryCount === 'number' ? ev.retryCount : 0;
    return { ...ev, retryCount: prev + 1 };
  });

  const survivors = updatedBatch.filter(
    (ev) => (ev.retryCount ?? 0) <= MAX_RETRY,
  );

  if (survivors.length < updatedBatch.length) {
    console.warn(
      '[Analytics] Dropped',
      updatedBatch.length - survivors.length,
      'poison events after exceeding retry limit',
    );
  }

  const newQueue = survivors.concat(rest);
  await saveQueue(newQueue);

  const idx = Math.min(meta.backoffIndex, BACKOFF_STEPS_SECONDS.length - 1);
  const delaySec = BACKOFF_STEPS_SECONDS[idx];
  const nextRetryAt = now + delaySec * 1000;

  const newMeta: AnalyticsMeta = {
    lastFlushAt: meta.lastFlushAt ?? null,
    nextRetryAt,
    backoffIndex: meta.backoffIndex + 1,
  };
  await saveMeta(newMeta);

  console.warn(
    '[Analytics] Flush failed. Backing off for',
    delaySec,
    'seconds. Queue size now:',
    newQueue.length,
  );
}

// -------------------------------------------------------
// Public API
// -------------------------------------------------------

export const Analytics = {
  /**
   * Fire-and-forget tracking.
   * Download logic & UI don't wait for this.
   * All operations are serialized via the internal op queue.
   */
  track(
    event: Omit<
      AnalyticsEvent,
      | 'timestamp'
      | 'ext_version'
      | 'browser'
      | 'os'
      | 'language'
      | 'retryCount'
    >,
  ): void {
    enqueueOp(() => internalTrack(event));
  },

  /**
   * Best-effort flush. Also serialized with track operations.
   * Called by:
   * - our download logic when queue conditions are met
   * - chrome.alarms (every 5 minutes) from background.ts
   */
  flush(): void {
    enqueueOp(() => internalFlush());
  },
};

// NOTE: The old `setTimeout(() => Analytics.flush(), 5000);`
// remains removed in favor of a chrome.alarms-based flush
// that lives in background.ts (so it still fires when the
// MV3 service worker wakes up periodically).

// -------------------------------------------------------
// High-level helper for “real download finished”
// -------------------------------------------------------

export type DownloadSource = 'download_all' | 'single' | 'other' | string;

export interface RecordDownloadEventInput {
  /**
   * File extension / type. Example: "pdf", "pptx", "zip", ...
   */
  type: string;

  /**
   * "success" → file actually finished downloading.
   * "fail"    → file definitely failed (interrupted, blocked, etc.).
   */
  status: 'success' | 'fail';

  /**
   * Optional tag: where this came from (download_all, single, etc.).
   * Currently only forwarded to Cloudflare; dashboard can use it later.
   */
  source?: DownloadSource;

  /**
   * Optional duration of the attempt (ms).
   * If omitted, defaults to 0.
   */
  duration_ms?: number;

  /**
   * Whether the Drive bypass was used.
   */
  bypass_used?: boolean;

  /**
   * Optional error code / reason for fails.
   * Example: "BROWSER_START_FAIL", "AUTH_ALL_FAILED", etc.
   */
  error_type?: string;
}

/**
 * High-level helper: record a completed download attempt.
 *
 * Internally this just calls Analytics.track(...) so it
 * reuses the same queue / flush / poison-pill logic.
 */
export function recordDownloadEvent(input: RecordDownloadEventInput): void {
  const {
    type,
    status,
    source,
    duration_ms,
    bypass_used,
    error_type,
  } = input;

  Analytics.track({
    status,
    file_type: type || 'unknown',
    duration_ms: duration_ms ?? 0,
    bypass_used: !!bypass_used,
    error_type,
    source,
  });
}

/**
 * Public: refresh remote analytics config from Worker /config.
 * Called by background.ts:
 *  - once on startup
 *  - every 3 hours via chrome.alarms
 */
export async function refreshRemoteAnalyticsConfig(): Promise<void> {
  if (!CONFIG_URL) {
    // No config endpoint configured – keep defaults.
    await saveConfig(DEFAULT_CONFIG);
    return;
  }

  try {
    const res = await fetch(CONFIG_URL, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`config HTTP ${res.status}`);
    }
    const data = await res.json();

    // Expected shape from Worker:
    // {
    //   ok: true,
    //   batchSize: number,
    //   timeFlushMinutes: { low, mid, high },
    //   remoteEnabled: boolean,
    //   quota: { batchSizeSuggestion, remoteEnabled, ... }
    // }
    if (!data || data.ok === false) {
      throw new Error('config ok=false');
    }

    const cfg: AnalyticsConfig = {
      batchSize:
        typeof data.batchSize === 'number'
          ? data.batchSize
          : data.quota?.batchSizeSuggestion ?? DEFAULT_CONFIG.batchSize,
      lowUsageFlushMinutes:
        data.timeFlushMinutes?.low ?? DEFAULT_CONFIG.lowUsageFlushMinutes,
      midUsageFlushMinutes:
        data.timeFlushMinutes?.mid ?? DEFAULT_CONFIG.midUsageFlushMinutes,
      highUsageFlushMinutes:
        data.timeFlushMinutes?.high ?? DEFAULT_CONFIG.highUsageFlushMinutes,
      remoteEnabled:
        typeof data.remoteEnabled === 'boolean'
          ? data.remoteEnabled
          : data.quota?.remoteEnabled ?? DEFAULT_CONFIG.remoteEnabled,
    };

    await saveConfig(cfg);
    console.log(
      '[Analytics] /config updated:',
      cfg.batchSize,
      cfg.lowUsageFlushMinutes,
      cfg.midUsageFlushMinutes,
      cfg.highUsageFlushMinutes,
      'remoteEnabled=',
      cfg.remoteEnabled,
    );
  } catch (err) {
    console.warn(
      '[Analytics] /config fetch failed, falling back to defaults',
      err,
    );
    await saveConfig(DEFAULT_CONFIG);
  }
}