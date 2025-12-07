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

/**
 * Max events per HTTP request.
 * - track(): if queue.length >= BATCH_SIZE → trigger a flush
 * - alarm: flush whatever is there, even 1 event
 */
const BATCH_SIZE = 50;

/**
 * How many failed flush attempts an event can survive
 * before we consider it a "poison pill" and drop it.
 */
const MAX_RETRY = 5;

/**
 * Step 0: remote sending is effectively disabled by default.
 * When you move to Step 1, set this to your real Worker URL.
 *
 * If WORKER_URL === '', sendBatchToCloudflare() will "pretend success"
 * and just drain the queue to keep local storage clean.
 */
const WORKER_URL =
  'https://cqd-analytics.adhamhaithameid.workers.dev/track';
const REMOTE_ENABLED = WORKER_URL.length > 0;

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
// Network flush (Step 0: effectively disabled, but wired)
// -------------------------------------------------------

async function sendBatchToCloudflare(
  events: AnalyticsEvent[],
): Promise<boolean> {
  if (!events.length) return true;

  // STEP 0: remote disabled → simulate success & drop events.
  if (!REMOTE_ENABLED || !WORKER_URL) {
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
    const res = await fetch(WORKER_URL, {
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

    return true;
  } catch (err) {
    console.error('[Analytics] Error sending batch to Cloudflare:', err);
    return false;
  }
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
// internalTrack / internalFlush with poison-pill protection
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

  // 1) Enqueue in persistent queue
  const queue = await loadQueue();
  queue.push(fullEvent);
  await saveQueue(queue);

  // 2) Update local stats (for popup + analysis)
  await updateLocalStats(fullEvent);

  console.log('[Analytics] Event tracked. Queue size:', queue.length);

  // 3) If queue is large, attempt a flush under the same lock
  if (queue.length >= BATCH_SIZE) {
    await internalFlush();
  }
}

/**
 * Flush logic with "poison pill" protection:
 * - Take up to BATCH_SIZE events from the head of the queue.
 * - Try to send them.
 *   - If success → drop them from queue.
 *   - If failure:
 *       - Increment retryCount for those events.
 *       - If retryCount > MAX_RETRY → drop event permanently.
 *       - Re-queue surviving events at the front.
 *
 * This way:
 * - One bad event can't jam everything forever.
 * - New events can move forward as old poisoned ones are trimmed.
 */
async function internalFlush(): Promise<void> {
  const queue = await loadQueue();
  if (!queue.length) return;

  console.log(
    `[Analytics] Attempting flush. Current queue size: ${queue.length}`,
  );

  // We only deal with the *front* window here; repeated alarms will
  // keep chewing through the queue over time.
  const batch = queue.slice(0, BATCH_SIZE);
  const rest = queue.slice(BATCH_SIZE);

  const ok = await sendBatchToCloudflare(batch);

  if (ok) {
    // Remote accepted → remove those items.
    await saveQueue(rest);
    console.log(
      '[Analytics] Flush succeeded. Sent',
      batch.length,
      'events. Remaining in queue:',
      rest.length,
    );
    return;
  }

  // Flush failed → poison-pill handling
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

  console.warn(
    '[Analytics] Flush failed. Will retry later. Queue size now:',
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
   * - our download logic when queue >= BATCH_SIZE
   * - chrome.alarms (every 1 minute) from background.ts
   */
  flush(): void {
    enqueueOp(() => internalFlush());
  },
};

// NOTE: The old `setTimeout(() => Analytics.flush(), 5000);`
// has been removed in favor of a chrome.alarms-based flush
// that lives in background.ts (so it still fires when the
// MV3 service worker wakes up periodically).

// -------------------------------------------------------
// Small convenience wrapper for “real download finished”
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