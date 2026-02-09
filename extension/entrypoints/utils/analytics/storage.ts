// filepath: extension/entrypoints/utils/analytics/storage.ts
/**
 * Analytics storage utilities.
 * Promisified wrappers for Chrome storage API.
 */

import type { AnalyticsEvent, LocalStats, AnalyticsConfig, AnalyticsMeta } from './types';
import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_META, CONFIG_VERSION } from './constants';

// --- Core Storage Helpers ---

export async function storageGet(key: string): Promise<any> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime?.lastError) {
          console.warn('[CQD Analytics] storageGet failed:', chrome.runtime.lastError.message);
          resolve(undefined);
          return;
        }
        resolve(result?.[key]);
      });
    } catch {
      resolve(undefined);
    }
  });
}

export async function storageSet(items: Record<string, any>): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime?.lastError) {
          console.warn('[CQD Analytics] storageSet failed:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

// --- Config Migration / Normalization ---

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function normalizeConfig(cfg: AnalyticsConfig): AnalyticsConfig {
  return {
    ...cfg,
    configVersion: CONFIG_VERSION,
    batchSize: clampInt(cfg.batchSize, 1, 1000, DEFAULT_CONFIG.batchSize),
    maxDailyRequests: clampInt(cfg.maxDailyRequests, 1, 1000, DEFAULT_CONFIG.maxDailyRequests),
    maxRetry: clampInt(cfg.maxRetry, 0, 20, DEFAULT_CONFIG.maxRetry),
    flushMode: cfg.flushMode === 'time_based' ? 'time_based' : 'next_day',
    lowUsageFlushMinutes: clampInt(cfg.lowUsageFlushMinutes, 1, 10080, DEFAULT_CONFIG.lowUsageFlushMinutes),
    midUsageFlushMinutes: clampInt(cfg.midUsageFlushMinutes, 1, 10080, DEFAULT_CONFIG.midUsageFlushMinutes),
    highUsageFlushMinutes: clampInt(cfg.highUsageFlushMinutes, 1, 10080, DEFAULT_CONFIG.highUsageFlushMinutes),
    remoteEnabled: typeof cfg.remoteEnabled === 'boolean' ? cfg.remoteEnabled : DEFAULT_CONFIG.remoteEnabled,
    cancelHoldDelayMs: clampInt(cfg.cancelHoldDelayMs, 0, 10000, DEFAULT_CONFIG.cancelHoldDelayMs),
    dailyFlushWindowStartUtc: clampInt(
      cfg.dailyFlushWindowStartUtc,
      0,
      23,
      DEFAULT_CONFIG.dailyFlushWindowStartUtc
    ),
    dailyFlushWindowMinutes: clampInt(
      cfg.dailyFlushWindowMinutes,
      1,
      24 * 60,
      DEFAULT_CONFIG.dailyFlushWindowMinutes
    ),
    maxEventsPerRequest: clampInt(
      cfg.maxEventsPerRequest ?? DEFAULT_CONFIG.maxEventsPerRequest,
      1,
      50_000,
      DEFAULT_CONFIG.maxEventsPerRequest ?? 5000
    ),
  };
}

function migrateConfig(raw: any): AnalyticsConfig {
  const version = typeof raw?.configVersion === 'number' ? raw.configVersion : 0;
  const merged = {
    ...DEFAULT_CONFIG,
    ...(raw && typeof raw === 'object' ? raw : {}),
  } as AnalyticsConfig;

  const normalized = normalizeConfig(merged);
  if (version < CONFIG_VERSION) {
    return { ...normalized, configVersion: CONFIG_VERSION };
  }
  return normalized;
}

// --- Queue Helpers ---

export async function loadQueue(): Promise<AnalyticsEvent[]> {
  const { queue } = await loadQueueWithIntegrity();
  return queue;
}

export async function saveQueue(queue: AnalyticsEvent[]): Promise<void> {
  await saveQueueWithIntegrity(queue);
}

// --- Integrity Protection ---

function computeChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

let inMemoryQueue: AnalyticsEvent[] | null = null;
let inMemoryChecksum: string | null = null;

async function saveQueueWithIntegrity(queue: AnalyticsEvent[]): Promise<void> {
  const data = JSON.stringify(queue);
  const checksum = computeChecksum(data);
  const ok = await storageSet({
    [STORAGE_KEYS.QUEUE]: queue,
    [STORAGE_KEYS.INTEGRITY]: checksum,
  });
  if (!ok) {
    inMemoryQueue = queue.slice();
    inMemoryChecksum = checksum;
  } else {
    inMemoryQueue = null;
    inMemoryChecksum = null;
  }
}

async function loadQueueWithIntegrity(): Promise<{ queue: AnalyticsEvent[]; valid: boolean }> {
  const raw = await storageGet(STORAGE_KEYS.QUEUE);
  const storedChecksum = await storageGet(STORAGE_KEYS.INTEGRITY);

  if (!raw || !Array.isArray(raw)) {
    if (inMemoryQueue) {
      return { queue: inMemoryQueue.slice(), valid: inMemoryChecksum != null };
    }
    return { queue: [], valid: true };
  }

  const data = JSON.stringify(raw);
  const computed = computeChecksum(data);

  if (storedChecksum && storedChecksum !== computed) {
    console.warn('[CQD Analytics] Queue integrity check failed; keeping raw queue to avoid data loss');
    inMemoryQueue = raw.slice();
    inMemoryChecksum = computed;
    return { queue: raw, valid: false };
  }

  inMemoryQueue = raw.slice();
  inMemoryChecksum = computed;
  return { queue: raw, valid: true };
}

// --- Config/Meta Helpers ---

export async function loadConfig(): Promise<AnalyticsConfig> {
  const raw = await storageGet(STORAGE_KEYS.CONFIG);
  if (!raw) return { ...DEFAULT_CONFIG };
  return migrateConfig(raw);
}

export async function saveConfig(cfg: AnalyticsConfig): Promise<void> {
  await storageSet({ [STORAGE_KEYS.CONFIG]: normalizeConfig(cfg) });
}

export async function loadMeta(): Promise<AnalyticsMeta> {
  const raw = await storageGet(STORAGE_KEYS.META);
  if (!raw) return { ...DEFAULT_META };
  return { ...DEFAULT_META, ...raw };
}

export async function saveMeta(meta: AnalyticsMeta): Promise<void> {
  await storageSet({ [STORAGE_KEYS.META]: meta });
}

// --- Stats Helpers ---

export function normalizeStats(raw: any): LocalStats {
  const stats: LocalStats = {
    total: 0,
    byType: {},
    success: 0,
    fail: 0,
    cancelled: 0,
    attempts: 0,
    bySpeed: { fast: 0, medium: 0, slow: 0 },
    bypassCount: 0,
    failByErrorType: {},
    byLanguage: {},
    lastUpdated: Date.now(),
  };

  if (!raw) return stats;

  if (typeof raw.total === 'number') stats.total = raw.total;
  if (raw.byType && typeof raw.byType === 'object') stats.byType = raw.byType;
  if (typeof raw.success === 'number') stats.success = raw.success;
  if (typeof raw.fail === 'number') stats.fail = raw.fail;
  if (typeof raw.cancelled === 'number') stats.cancelled = raw.cancelled;
  if (typeof raw.attempts === 'number') stats.attempts = raw.attempts;
  if (raw.bySpeed && typeof raw.bySpeed === 'object') {
    stats.bySpeed = {
      fast: raw.bySpeed.fast ?? 0,
      medium: raw.bySpeed.medium ?? 0,
      slow: raw.bySpeed.slow ?? 0,
    };
  }
  if (typeof raw.bypassCount === 'number') stats.bypassCount = raw.bypassCount;
  if (raw.failByErrorType && typeof raw.failByErrorType === 'object') {
    stats.failByErrorType = raw.failByErrorType;
  }
  if (raw.byLanguage && typeof raw.byLanguage === 'object') {
    stats.byLanguage = raw.byLanguage;
  }
  if (typeof raw.lastUpdated === 'number') stats.lastUpdated = raw.lastUpdated;

  return stats;
}

export async function loadStats(): Promise<LocalStats> {
  const raw = await storageGet(STORAGE_KEYS.STATS);
  return normalizeStats(raw);
}

export async function saveStats(stats: LocalStats): Promise<void> {
  await storageSet({ [STORAGE_KEYS.STATS]: stats });
}
