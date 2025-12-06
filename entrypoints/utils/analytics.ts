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
}

export interface LocalStats {
  /**
   * Successful downloads.
   * This is what your current popup UI uses as "total".
   */
  total: number;

  /**
   * Aggregated counts by normalized type.
   * (pdf, docs, sheets, slides, images, archive, etc.)
   */
  byType: Record<string, number>;

  /**
   * Extra fields for analysis only (not used in UI now).
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

// You can tune this if you want.
const BATCH_SIZE = 50;

// Replace with your real Worker endpoint.
const WORKER_URL = 'https://your-worker.your-name.workers.dev/track';

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
// Helpers: speed bucket + environment
// -------------------------------------------------------

function bucketDuration(durationMs: number): 'fast' | 'medium' | 'slow' {
  if (!Number.isFinite(durationMs) || durationMs < 0) return 'fast';
  if (durationMs <= 3000) return 'fast';
  if (durationMs <= 15000) return 'medium';
  return 'slow';
}

function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (ua.includes('Edg/')) return 'edge';
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'opera';
  if (ua.includes('Firefox/')) return 'firefox';
  if (ua.includes('Chrome/')) return 'chrome';
  return 'unknown';
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
  if (typeof navigator === 'undefined') return 'en-US';
  return navigator.language || 'en-US';
}

// -------------------------------------------------------
// Local aggregation – for your own analysis (not UI)
// -------------------------------------------------------

async function updateLocalStats(event: AnalyticsEvent): Promise<void> {
  // You can decide here: do you want to aggregate only success, or both?
  // For now:
  // - "total" + byType are success-only (matches your current UI).
  // - success/fail/attempts/buckets track everything.

  const stats = await loadStats();

  const isSuccess = event.status === 'success';

  if (isSuccess) {
    stats.success = (stats.success || 0) + 1;
    stats.total = (stats.total || 0) + 1; // keep UI compatible
  } else {
    stats.fail = (stats.fail || 0) + 1;
    const key = (event.error_type || 'UNKNOWN').toUpperCase();
    stats.failByErrorType![key] = (stats.failByErrorType![key] || 0) + 1;
  }

  stats.attempts = (stats.attempts || 0) + 1;

  // File type grouping (success-only, like your donut chart)
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
    // else: keep raw extension (.pdf, .exe, .mht, etc.)

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

  // Language (success only, so it reflects real usage)
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

async function sendBatchToCloudflare(events: AnalyticsEvent[]): Promise<boolean> {
  if (!events.length) return true;
  if (typeof fetch === 'undefined') return false;

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
// Public Analytics API
// -------------------------------------------------------

export const Analytics = {
  /**
   * Track a single download event.
   * This is the ONLY function your background code needs to call.
   */
  async track(
    event: Omit<
      AnalyticsEvent,
      'timestamp' | 'ext_version' | 'browser' | 'os' | 'language'
    >,
  ): Promise<void> {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.getManifest) {
        // Non-extension environment – silently ignore.
        return;
      }

      const manifest = chrome.runtime.getManifest();

      const fullEvent: AnalyticsEvent = {
        ...event,
        timestamp: Date.now(),
        ext_version: manifest.version || '0.0.0',
        browser: detectBrowser(),
        os: await detectOS(),
        language: detectLanguage(),
      };

      // 1) Enqueue event (queue = pending_events array)
      const queue = await loadQueue();
      queue.push(fullEvent);
      await saveQueue(queue);

      // 2) Update local stats (for popup / offline analysis)
      await updateLocalStats(fullEvent);

      console.log('[Analytics] Event tracked. Queue size:', queue.length);

      // 3) Optional: flush when threshold hit
      if (queue.length >= BATCH_SIZE) {
        await this.flush();
      }
    } catch (err) {
      console.error('[Analytics] Failed to track event:', err);
    }
  },

  /**
   * Flush queued events to Cloudflare in batches.
   * Only removes events if the Worker accepts them.
   */
  async flush(): Promise<void> {
    try {
      const queue = await loadQueue();
      if (!queue.length) return;

      console.log(`[Analytics] Flushing ${queue.length} events...`);

      let remaining = queue.slice();
      let flushedCount = 0;

      while (remaining.length) {
        const batch = remaining.slice(0, BATCH_SIZE);
        const ok = await sendBatchToCloudflare(batch);
        if (!ok) {
          // Stop on first failure – keep remaining events
          break;
        }
        flushedCount += batch.length;
        remaining = remaining.slice(BATCH_SIZE);
      }

      if (!flushedCount) {
        console.warn(
          '[Analytics] No batches accepted by server. Keeping full queue.',
        );
        return;
      }

      const newQueue = queue.slice(flushedCount);
      await saveQueue(newQueue);
      console.log(
        `[Analytics] Flush complete. Removed ${flushedCount}, remaining ${newQueue.length}.`,
      );
    } catch (err) {
      console.error('[Analytics] Flush failed:', err);
    }
  },
};

// Auto-flush once shortly after startup (best effort, no UI impact)
setTimeout(() => {
  Analytics.flush().catch(() => {
    /* ignore */
  });
}, 5000);
