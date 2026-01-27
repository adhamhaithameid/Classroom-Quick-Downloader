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
   * Unique event ID for idempotency (deduplication on worker).
   * Format: "ext-<timestamp>-<random>"
   */
  id?: string;

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
 * For LOCAL TESTING: use http://localhost:8787/track
 * For PRODUCTION: use https://cqd-analytics.adhamhaithameid.workers.dev/track
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
 * All these values are remotely controllable from Cloudflare dashboard.
 */
type AnalyticsConfig = {
  batchSize: number;
  maxDailyRequests: number;  // Max requests per day (default: 50)
  maxRetry: number;          // Max retries before dropping event (default: 5)
  flushMode: 'next_day' | 'time_based';
  lowUsageFlushMinutes: number;  // queue < 15 (only used if flushMode is 'time_based')
  midUsageFlushMinutes: number;  // 15 <= queue < 35
  highUsageFlushMinutes: number; // 35 <= queue < 50
  remoteEnabled: boolean;
};

/**
 * Default values when there's no config/meta yet.
 * flushMode: 'next_day' means events are sent once daily at 1:00 AM local time.
 */
const DEFAULT_CONFIG: AnalyticsConfig = {
  batchSize: BATCH_SIZE,
  maxDailyRequests: 50,
  maxRetry: MAX_RETRY,
  flushMode: 'next_day',
  lowUsageFlushMinutes: 1440,  // 24h = next day
  midUsageFlushMinutes: 1440,
  highUsageFlushMinutes: 1440,
  remoteEnabled: REMOTE_ENABLED,
};

/**
 * Meta info for time-based flush and backoff.
 */
type AnalyticsMeta = {
  lastFlushAt: number | null;
  nextRetryAt: number | null;
  backoffIndex: number;
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
    if (typeof chrome !== 'undefined') {
      const v = chrome.runtime.getManifest().version;
      cachedVersion = v || '0.0.0';
      return cachedVersion!;
    }
  } catch {
    // ignore
  }
  return '0.0.0';
}

/**
 * Generate a cryptographically strong unique event ID for idempotency.
 * Format: ext-<timestamp>-<random12chars>
 * Uses Web Crypto API for stronger randomness when available.
 */
function generateEventId(): string {
  const ts = Date.now();
  let rand: string;
  
  // Try to use crypto API for stronger randomness
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    rand = Array.from(arr, b => b.toString(36).padStart(2, '0')).join('').substring(0, 12);
  } else {
    // Fallback to Math.random (less secure but functional)
    rand = Math.random().toString(36).substring(2, 14);
  }
  
  return `ext-${ts}-${rand}`;
}

// -------------------------------------------------------
// Extension-side Rate Limiting (defense in depth)
// -------------------------------------------------------

const STORAGE_KEY_RATE_LIMIT = 'cqd_rate_limit_v1';
const MAX_DAILY_REQUESTS = 50;

interface RateLimitState {
  date: string; // YYYY-MM-DD UTC
  count: number;
}

/**
 * Check if we can make a request today and increment counter.
 * Also returns isNewDay flag for consolidation logic.
 * 
 * Day resets at 1:00 AM LOCAL TIME (not midnight UTC).
 * This ensures consistent behavior for users in all timezones.
 */
async function checkAndIncrementRateLimit(): Promise<{ 
  allowed: boolean; 
  remaining: number;
  isNewDay: boolean;
}> {
  // Get current date adjusted for 1:00 AM reset
  // If it's before 1:00 AM, treat as previous day
  const now = new Date();
  const localHour = now.getHours();
  
  // If before 1:00 AM, use yesterday's date for the "day"
  let effectiveDate: string;
  if (localHour < 1) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    effectiveDate = yesterday.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  } else {
    effectiveDate = now.toLocaleDateString('en-CA');
  }
  
  const raw = await storageGet(STORAGE_KEY_RATE_LIMIT);
  let state: RateLimitState = raw[STORAGE_KEY_RATE_LIMIT];
  
  const isNewDay = !state || state.date !== effectiveDate;
  
  if (isNewDay) {
    state = { date: effectiveDate, count: 0 };
  }
  
  if (state.count >= MAX_DAILY_REQUESTS) {
    return { allowed: false, remaining: 0, isNewDay };
  }
  
  state.count += 1;
  await storageSet({ [STORAGE_KEY_RATE_LIMIT]: state });
  
  return { allowed: true, remaining: MAX_DAILY_REQUESTS - state.count, isNewDay };
}

// -------------------------------------------------------
// Storage Integrity Protection
// -------------------------------------------------------

const INTEGRITY_KEY = 'cqd_integrity_v1';

/**
 * Simple checksum for tamper detection.
 * Not cryptographically secure, but detects accidental/casual tampering.
 */
function computeChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

async function saveQueueWithIntegrity(queue: AnalyticsEvent[]): Promise<void> {
  const data = JSON.stringify(queue);
  const checksum = computeChecksum(data);
  await storageSet({ 
    [STORAGE_KEY_QUEUE]: queue,
    [INTEGRITY_KEY]: { checksum, count: queue.length, timestamp: Date.now() },
  });
}

async function loadQueueWithIntegrity(): Promise<{ queue: AnalyticsEvent[]; valid: boolean }> {
  const raw = await storageGet(STORAGE_KEY_QUEUE);
  const integrityRaw = await storageGet(INTEGRITY_KEY);
  
  const queue = raw[STORAGE_KEY_QUEUE];
  const integrity = integrityRaw[INTEGRITY_KEY];
  
  if (!Array.isArray(queue)) {
    return { queue: [], valid: true };
  }
  
  // Verify integrity
  if (integrity && typeof integrity === 'object') {
    const data = JSON.stringify(queue);
    const expectedChecksum = computeChecksum(data);
    
    if (integrity.checksum !== expectedChecksum || integrity.count !== queue.length) {
      console.warn('[Analytics] Storage integrity check failed! Data may have been tampered with.');
      return { queue: queue as AnalyticsEvent[], valid: false };
    }
  }
  
  return { queue: queue as AnalyticsEvent[], valid: true };
}

// -------------------------------------------------------
// Storage helpers (Promisified for Firefox 'chrome' namespace support)
// -------------------------------------------------------

function storageGet(key: string): Promise<any> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve({});
      return;
    }
    chrome.storage.local.get(key, (result) => {
      // In Firefox/Chrome callback, result is the object
      if (chrome.runtime.lastError) {
        // ignore error
        resolve({});
      } else {
        resolve(result || {});
      }
    });
  });
}

function storageSet(items: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        // ignore
      }
      resolve();
    });
  });
}

async function loadQueue(): Promise<AnalyticsEvent[]> {
  const { queue } = await loadQueueWithIntegrity();
  return queue;
}

async function saveQueue(queue: AnalyticsEvent[]): Promise<void> {
  await saveQueueWithIntegrity(queue);
}

// --- Config/meta helpers ---

async function loadConfig(): Promise<AnalyticsConfig> {
  const raw = await storageGet(STORAGE_KEY_CONFIG);
  const stored = raw[STORAGE_KEY_CONFIG] as Partial<AnalyticsConfig> | undefined;
  if (!stored || typeof stored !== 'object') return DEFAULT_CONFIG;
  return {
    batchSize:
      typeof stored.batchSize === 'number' && stored.batchSize > 0
        ? stored.batchSize
        : DEFAULT_CONFIG.batchSize,
    maxDailyRequests:
      typeof stored.maxDailyRequests === 'number' && stored.maxDailyRequests > 0
        ? stored.maxDailyRequests
        : DEFAULT_CONFIG.maxDailyRequests,
    maxRetry:
      typeof stored.maxRetry === 'number' && stored.maxRetry >= 0
        ? stored.maxRetry
        : DEFAULT_CONFIG.maxRetry,
    flushMode:
      stored.flushMode === 'next_day' || stored.flushMode === 'time_based'
        ? stored.flushMode
        : DEFAULT_CONFIG.flushMode,
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
  await storageSet({ [STORAGE_KEY_CONFIG]: cfg });
}

async function loadMeta(): Promise<AnalyticsMeta> {
  const raw = await storageGet(STORAGE_KEY_META);
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
  await storageSet({ [STORAGE_KEY_META]: meta });
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
        : (raw.total || 0) + (raw.fail || 0),
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
  const raw = await storageGet(STORAGE_KEY_STATS);
  return normalizeStats(raw[STORAGE_KEY_STATS]);
}

async function saveStats(stats: LocalStats): Promise<void> {
  await storageSet({ [STORAGE_KEY_STATS]: stats });
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

/**
 * Enhanced response type from worker.
 */
interface WorkerResponse {
  ok: boolean;
  error?: string; // 'rate_limit_exceeded' | 'buffer_full' | 'too_many_events' | ...
  message?: string;
  accepted?: number;
}

/**
 * Result type for sendBatchToCloudflare with detailed status.
 */
interface FlushResult {
  success: boolean;
  rateLimited?: boolean;
  serverOverloaded?: boolean;
  accepted?: number;
  error?: string;
}

async function sendBatchToCloudflare(
  events: AnalyticsEvent[],
): Promise<FlushResult> {
  if (!events.length) return { success: true, accepted: 0 };

  // If remote is globally disabled or URL not configured → simulate success.
  if (!REMOTE_ENABLED || !TRACK_URL) {
    console.log(
      '[Analytics] Remote endpoint not configured. Simulating flush of',
      events.length,
      'events.',
    );
    return { success: true, accepted: events.length };
  }

  if (typeof fetch === 'undefined') {
    console.warn('[Analytics] fetch() not available in this context.');
    return { success: false, error: 'fetch_unavailable' };
  }

  try {
    const res = await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });

    // Parse response body regardless of status
    let json: WorkerResponse = { ok: false };
    try {
      json = await res.json();
    } catch {
      // If we can't parse JSON, continue with status code checks
    }

    // Rate limited by worker (429)
    if (res.status === 429 || json.error === 'rate_limit_exceeded') {
      console.warn('[Analytics] Rate limited by worker:', json.message || res.status);
      return { 
        success: false, 
        rateLimited: true, 
        error: json.error || 'rate_limit_exceeded',
      };
    }

    // Server overloaded (503 buffer_full)
    if (res.status === 503 || json.error === 'buffer_full') {
      console.warn('[Analytics] Worker buffer full:', json.message || res.status);
      return { 
        success: false, 
        serverOverloaded: true, 
        error: json.error || 'buffer_full',
      };
    }

    // Other non-OK status
    if (!res.ok) {
      console.warn(
        '[Analytics] Cloudflare Worker returned non-200:',
        res.status,
        json,
      );
      return { success: false, error: `http_${res.status}` };
    }

    // Response indicates failure
    if (json && json.ok === false) {
      console.warn('[Analytics] Cloudflare Worker ok=false:', json);
      return { success: false, error: json.error || 'worker_rejected' };
    }

    // Success!
    return { 
      success: true, 
      accepted: json.accepted ?? events.length,
    };
  } catch (err) {
    console.error('[Analytics] Error sending batch to Cloudflare:', err);
    return { success: false, error: String(err) };
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
    'timestamp' | 'ext_version' | 'browser' | 'os' | 'language' | 'retryCount' | 'id'
  >,
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getManifest) {
    // Not in a real extension env – silently ignore
    return;
  }

  const fullEvent: AnalyticsEvent = {
    ...event,
    id: generateEventId(), // Unique ID for idempotency
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

  // 1) Enqueue in persistent queue (LOCAL FIRST - fail-safe layer)
  queue.push(fullEvent);
  await saveQueue(queue);

  // 2) Update local stats (for popup + analysis) - LOCAL FIRST
  await updateLocalStats(fullEvent);

  console.log('[Analytics] Event tracked (id:', fullEvent.id, '). Queue size:', queue.length);

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


  // =========================================================================
  // EXTENSION-SIDE RATE LIMIT CHECK (50 requests/day)
  // =========================================================================
  const rateLimit = await checkAndIncrementRateLimit();
  if (!rateLimit.allowed) {
    console.warn(
      '[Analytics] Daily request limit reached (50/day). Events saved locally, will send tomorrow.',
    );
    // Don't update backoff - this is intentional hold, not a failure
    return;
  }

  // =========================================================================
  // NEW DAY CONSOLIDATION: Send ALL pending events in ONE request
  // This saves Cloudflare requests by combining everything accumulated overnight
  // =========================================================================
  let batch: AnalyticsEvent[];
  let rest: AnalyticsEvent[];
  
  if (rateLimit.isNewDay && queue.length > 0) {
    // New day! Consolidate ALL pending events into one request
    // This is the most efficient use of our daily 50 request quota
    console.log(
      `[Analytics] New day detected! Consolidating ${queue.length} pending events into ONE request.`,
    );
    batch = queue; // Send everything
    rest = [];
  } else {
    // Normal batching: send up to batchSize (50) events
    const effectiveBatchSize = cfg.batchSize || BATCH_SIZE;
    batch = queue.slice(0, effectiveBatchSize);
    rest = queue.slice(effectiveBatchSize);
  }
  
  console.log(
    `[Analytics] Sending ${batch.length} events (${rateLimit.remaining} requests remaining today).`,
  );

  const result = await sendBatchToCloudflare(batch);

  if (result.success) {
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
      result.accepted ?? batch.length,
      'events. Remaining in queue:',
      rest.length,
    );
    return;
  }

  // --- FAIL-SAFE: Handle different failure modes ---
  
  // Rate limited → longer backoff (jump to 1 hour minimum)
  let backoffMultiplier = 1;
  if (result.rateLimited) {
    console.warn('[Analytics] Rate limited! Applying extended backoff.');
    backoffMultiplier = 3; // Triple the backoff time
  }

  // Server overloaded → also back off harder
  if (result.serverOverloaded) {
    console.warn('[Analytics] Server buffer full! Applying moderate backoff.');
    backoffMultiplier = 2;
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
  const baseDelaySec = BACKOFF_STEPS_SECONDS[idx];
  const delaySec = baseDelaySec * backoffMultiplier;
  const nextRetryAt = now + delaySec * 1000;

  const newMeta: AnalyticsMeta = {
    lastFlushAt: meta.lastFlushAt ?? null,
    nextRetryAt,
    backoffIndex: meta.backoffIndex + 1,
  };
  await saveMeta(newMeta);

  console.warn(
    '[Analytics] Flush failed (', result.error, '). Backing off for',
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
      'timestamp' | 'ext_version' | 'browser' | 'os' | 'language' | 'retryCount'
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
  const { type, status, source, duration_ms, bypass_used, error_type } = input;

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
    //   maxDailyRequests: number,
    //   maxRetry: number,
    //   flushMode: 'next_day' | 'time_based',
    //   timeFlushMinutes: { low, mid, high },
    //   remoteEnabled: boolean,
    //   quota: { ... }
    // }
    if (!data || data.ok === false) {
      throw new Error('config ok=false');
    }

    const cfg: AnalyticsConfig = {
      batchSize:
        typeof data.batchSize === 'number'
          ? data.batchSize
          : data.quota?.batchSizeSuggestion ?? DEFAULT_CONFIG.batchSize,
      maxDailyRequests:
        typeof data.maxDailyRequests === 'number'
          ? data.maxDailyRequests
          : DEFAULT_CONFIG.maxDailyRequests,
      maxRetry:
        typeof data.maxRetry === 'number'
          ? data.maxRetry
          : DEFAULT_CONFIG.maxRetry,
      flushMode:
        data.flushMode === 'next_day' || data.flushMode === 'time_based'
          ? data.flushMode
          : DEFAULT_CONFIG.flushMode,
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
      '[Analytics] /config updated: batchSize=', cfg.batchSize,
      'maxDailyRequests=', cfg.maxDailyRequests,
      'flushMode=', cfg.flushMode,
      'remoteEnabled=', cfg.remoteEnabled,
    );
  } catch (err) {
    console.warn(
      '[Analytics] /config fetch failed, falling back to defaults',
      err,
    );
    await saveConfig(DEFAULT_CONFIG);
  }
}