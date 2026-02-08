// filepath: extension/entrypoints/utils/analytics/storage.ts
/**
 * Analytics storage utilities.
 * Promisified wrappers for Chrome storage API.
 */

import type { AnalyticsEvent, LocalStats, AnalyticsConfig, AnalyticsMeta } from './types';
import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_META } from './constants';

// --- Core Storage Helpers ---

export async function storageGet(key: string): Promise<any> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([key], (result) => {
        resolve(result?.[key]);
      });
    } catch {
      resolve(undefined);
    }
  });
}

export async function storageSet(items: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(items, () => resolve());
    } catch {
      resolve();
    }
  });
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

async function saveQueueWithIntegrity(queue: AnalyticsEvent[]): Promise<void> {
  const data = JSON.stringify(queue);
  const checksum = computeChecksum(data);
  await storageSet({
    [STORAGE_KEYS.QUEUE]: queue,
    [STORAGE_KEYS.INTEGRITY]: checksum,
  });
}

async function loadQueueWithIntegrity(): Promise<{ queue: AnalyticsEvent[]; valid: boolean }> {
  const raw = await storageGet(STORAGE_KEYS.QUEUE);
  const storedChecksum = await storageGet(STORAGE_KEYS.INTEGRITY);

  if (!raw || !Array.isArray(raw)) {
    return { queue: [], valid: true };
  }

  const data = JSON.stringify(raw);
  const computed = computeChecksum(data);

  if (storedChecksum && storedChecksum !== computed) {
    console.warn('[CQD Analytics] Queue integrity check failed; keeping raw queue to avoid data loss');
    return { queue: raw, valid: false };
  }

  return { queue: raw, valid: true };
}

// --- Config/Meta Helpers ---

export async function loadConfig(): Promise<AnalyticsConfig> {
  const raw = await storageGet(STORAGE_KEYS.CONFIG);
  if (!raw) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...raw };
}

export async function saveConfig(cfg: AnalyticsConfig): Promise<void> {
  await storageSet({ [STORAGE_KEYS.CONFIG]: cfg });
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
