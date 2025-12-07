// filepath: utils/analytics.ts

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
   * Used internally to protect against "poison" events that
   * always fail to send to the server.
   */
  retryCount?: number;
}

export interface LocalStats {
  /**
   * Number of successful downloads (what the popup charts use as "total").
   */
  total: number;

  /**
   * Successful downloads.
   */
  success: number;

  /**
   * Failed downloads.
   */
  fail: number;

  /**
   * Total attempts (success + fail).
   */
  attempts: number;

  /**
   * How many times a Drive bypass was used.
   */
  bypassCount: number;

  /**
   * Successful downloads grouped by normalized file type
   * (e.g., pdf, docs, sheets, slides, images, archive, video, audio, unknown).
   */
  byType: Record<string, number>;

  /**
   * Successful downloads grouped by browser language (lowercased).
   */
  byLanguage: Record<string, number>;

  /**
   * Successful downloads grouped by speed bucket.
   */
  bySpeed: {
    fast: number;
    medium: number;
    slow: number;
  };

  /**
   * Failed downloads grouped by error_type.
   */
  failByErrorType: Record<string, number>;

  /**
   * Last time stats were updated (ms since epoch).
   */
  lastUpdated: number;
}

const STORAGE_KEY_QUEUE = 'pending_events';
const STORAGE_KEY_STATS = 'local_stats';

/**
 * Max number of events we send in a single network request.
 * IMPORTANT: this is a *maximum* batch size, not a minimum.
 * - track(): if queue.length >= BATCH_SIZE → schedule a flush
 * - alarms: flush whatever is there, even 1 event
 */
const BATCH_SIZE = 50;

/**
 * Maximum number of times we will retry an individual event
 * before dropping it as a "poison pill" (so it can't block
 * newer, valid events behind it).
 */
const MAX_RETRY = 5;

/**
 * Step 1 preparation:
 * - When you are ready to actually send data to your Cloudflare Worker,
 *   set WORKER_URL to your real endpoint.
 * - While WORKER_URL is empty, flush() will "pretend" success and clear
 *   the queue (no remote traffic, keeps storage small).
 */
const WORKER_URL = ''; // e.g. 'https://your-worker.your-name.workers.dev/track'
const REMOTE_ENABLED = WORKER_URL.length > 0;

/**
 * Simple serialized operation chain to prevent concurrent reads/writes
 * to chrome.storage.local from racing against each other.
 *
 * All public Analytics methods (track/flush) are funneled through this.
 */
let opChain: Promise<void> = Promise.resolve();

function enqueueOp(op: () => Promise<void>): Promise<void> {
  opChain = opChain
    .then(() => op())
    .catch((err) => {
      // Do NOT break the chain on error; just log and continue.
      console.warn('[Analytics] Operation failed but chain preserved:', err);
    });
  return opChain;
}

/* -------------------------------------------------------------------------- */
/* Helpers: default stats, normalization, speed buckets                       */
/* -------------------------------------------------------------------------- */

function defaultLocalStats(): LocalStats {
  return {
    total: 0,
    success: 0,
    fail: 0,
    attempts: 0,
    bypassCount: 0,
    byType: {},
    byLanguage: {},
    bySpeed: {
      fast: 0,
      medium: 0,
      slow: 0,
    },
    failByErrorType: {},
    lastUpdated: 0,
  };
}

/**
 * Normalize file extensions into semantic buckets for a cleaner UI.
 * The *raw* extension is still stored in event.file_type.
 */
function normalizeFileType(raw: string): string {
  let type = (raw || 'unknown').trim().toLowerCase();
  if (!type) type = 'unknown';

  if (['doc', 'docx', 'txt', 'rtf'].includes(type)) return 'docs';
  if (['xls', 'xlsx', 'csv'].includes(type)) return 'sheets';
  if (['ppt', 'pptx'].includes(type)) return 'slides';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(type)) return 'images';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(type)) return 'archive';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(type)) return 'video';
  if (['mp3', 'wav', 'aac'].includes(type)) return 'audio';

  return type;
}

/**
 * Coarse speed buckets for UX-friendly analysis.
 */
function getSpeedBucket(durationMs: number): 'fast' | 'medium' | 'slow' {
  const ms = durationMs || 0;
  if (ms <= 2500) return 'fast';
  if (ms <= 7000) return 'medium';
  return 'slow';
}

/* -------------------------------------------------------------------------- */
/* Public Analytics object                                                    */
/* -------------------------------------------------------------------------- */

export const Analytics = {
  /**
   * Main entry point from the background script.
   * Called once per download completion / failure.
   *
   * This only changes analytics; it does NOT affect download behavior.
   */
  async track(
    event: Omit<
      AnalyticsEvent,
      'browser' | 'os' | 'ext_version' | 'language' | 'timestamp' | 'retryCount'
    >,
  ): Promise<void> {
    return enqueueOp(() => trackInternal(event));
  },

  /**
   * Flush the in-memory / on-disk queue:
   * - Send up to BATCH_SIZE events to the server (when enabled)
   * - On success → remove them from the queue
   * - On failure → increment retryCount, drop "poison" events (retryCount > MAX_RETRY)
   *
   * This is triggered:
   * - implicitly when queue length >= BATCH_SIZE (bulk activity)
   * - explicitly by chrome.alarms every minute (low activity)
   */
  async flush(): Promise<void> {
    return enqueueOp(() => flushInternal());
  },

  /**
   * Public wrapper if you ever want to manually recompute stats
   * or ingest synthetic events. Normally only trackInternal uses this.
   */
  async updateLocalStats(event: AnalyticsEvent): Promise<void> {
    return enqueueOp(() => updateLocalStatsInternal(event));
  },

  detectBrowser,
  async detectOS(): Promise<string> {
    return detectOS();
  },
};

/* -------------------------------------------------------------------------- */
/* Internal track() implementation                                            */
/* -------------------------------------------------------------------------- */

async function trackInternal(
  baseEvent: Omit<
    AnalyticsEvent,
    'browser' | 'os' | 'ext_version' | 'language' | 'timestamp' | 'retryCount'
  >,
): Promise<void> {
  try {
    const now = Date.now();

    let extVersion = '0.0.0';
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
        extVersion = chrome.runtime.getManifest().version || extVersion;
      }
    } catch {
      // ignore
    }

    const browser = detectBrowser();
    const os = await detectOS();
    const language = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

    const fullEvent: AnalyticsEvent = {
      ...baseEvent,
      ext_version: extVersion,
      browser,
      os,
      language,
      timestamp: now,
    };

    // 1) Push to persistent queue (for Step 1 / remote analytics)
    const rawQueue = await chrome.storage.local.get(STORAGE_KEY_QUEUE);
    const queue: AnalyticsEvent[] = rawQueue[STORAGE_KEY_QUEUE] || [];
    queue.push(fullEvent);
    await chrome.storage.local.set({ [STORAGE_KEY_QUEUE]: queue });

    // 2) Update local stats (for popup + debugging)
    await updateLocalStatsInternal(fullEvent);

    // 3) If the queue is "heavy", schedule an immediate flush (bulk sync).
    //    We do *not* await it here; it gets serialized by opChain and runs after this op.
    if (queue.length >= BATCH_SIZE) {
      Analytics.flush();
    }
  } catch (err) {
    console.warn('[Analytics] trackInternal failed:', err);
  }
}

/* -------------------------------------------------------------------------- */
/* Internal stats updater                                                     */
/* -------------------------------------------------------------------------- */

async function updateLocalStatsInternal(event: AnalyticsEvent): Promise<void> {
  try {
    const raw = await chrome.storage.local.get(STORAGE_KEY_STATS);
    const stats: LocalStats = raw[STORAGE_KEY_STATS] || defaultLocalStats();

    stats.lastUpdated = event.timestamp || Date.now();
    stats.attempts = (stats.attempts || 0) + 1;

    if (event.bypass_used) {
      stats.bypassCount = (stats.bypassCount || 0) + 1;
    }

    if (event.status === 'success') {
      stats.success = (stats.success || 0) + 1;
      // "total" is simply the count of successful downloads
      stats.total = (stats.total || 0) + 1;

      const typeKey = normalizeFileType(event.file_type);
      stats.byType[typeKey] = (stats.byType[typeKey] || 0) + 1;

      const langKey = (event.language || 'unknown').toLowerCase();
      stats.byLanguage[langKey] = (stats.byLanguage[langKey] || 0) + 1;

      const bucket = getSpeedBucket(event.duration_ms);
      stats.bySpeed[bucket] = (stats.bySpeed[bucket] || 0) + 1;
    } else {
      stats.fail = (stats.fail || 0) + 1;
      const errKey = (event.error_type || 'UNKNOWN').toLowerCase();
      stats.failByErrorType[errKey] = (stats.failByErrorType[errKey] || 0) + 1;
    }

    await chrome.storage.local.set({ [STORAGE_KEY_STATS]: stats });
  } catch (err) {
    console.warn('[Analytics] Failed to update local stats:', err);
  }
}

/* -------------------------------------------------------------------------- */
/* Internal flush() implementation                                            */
/* -------------------------------------------------------------------------- */

async function flushInternal(): Promise<void> {
  try {
    const raw = await chrome.storage.local.get(STORAGE_KEY_QUEUE);
    const queue: AnalyticsEvent[] = raw[STORAGE_KEY_QUEUE] || [];
    if (!queue.length) {
      return;
    }

    // We send at most BATCH_SIZE events in one HTTP request.
    const batch = queue.slice(0, BATCH_SIZE);
    const rest = queue.slice(BATCH_SIZE);

    const ok = await sendBatchToCloudflare(batch);

    if (ok) {
      // Remote accepted → remove those items from the queue.
      await chrome.storage.local.set({ [STORAGE_KEY_QUEUE]: rest });
      console.log(
        '[Analytics] Flush succeeded. Sent',
        batch.length,
        'events. Remaining in queue:',
        rest.length,
      );
    } else {
      // Remote rejected / network error.
      // Poison-pill protection: increment retryCount and drop events that exceeded MAX_RETRY.
      const updatedBatch: AnalyticsEvent[] = batch.map((ev) => {
        const prev = typeof ev.retryCount === 'number' ? ev.retryCount : 0;
        return {
          ...ev,
          retryCount: prev + 1,
        };
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
      await chrome.storage.local.set({ [STORAGE_KEY_QUEUE]: newQueue });

      console.warn(
        '[Analytics] Flush failed. Retrying later. Queue size now:',
        newQueue.length,
      );
    }
  } catch (err) {
    console.warn('[Analytics] flushInternal failed:', err);
  }
}

/**
 * Step 1 hook: when WORKER_URL is set, this will actually send data to your
 * Cloudflare Worker. For now, to keep Step 0 clean and not generate network
 * calls, we *simulate* success if WORKER_URL is empty.
 */
async function sendBatchToCloudflare(batch: AnalyticsEvent[]): Promise<boolean> {
  if (!batch.length) return true;

  // STEP 0: no real network; just simulate success and drop events
  if (!REMOTE_ENABLED) {
    // This keeps local storage from growing unbounded while you’re still
    // building the remote pipeline.
    console.log(
      '[Analytics] Remote endpoint not configured. Simulating flush of',
      batch.length,
      'events.',
    );
    return true;
  }

  // STEP 1: real implementation for Cloudflare Worker.
  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });

    if (!res.ok) {
      console.warn('[Analytics] Remote flush failed with status', res.status);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Analytics] Remote flush error:', err);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Environment detection helpers                                              */
/* -------------------------------------------------------------------------- */

function detectBrowser(): string {
  try {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
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
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getPlatformInfo) {
      const info = await chrome.runtime.getPlatformInfo();
      return info?.os || 'unknown';
    }
  } catch {
    // ignore
  }
  return 'unknown';
}

// NOTE: The old `setTimeout(() => Analytics.flush(), 5000);`
// has been removed in favor of chrome.alarms in the background script.