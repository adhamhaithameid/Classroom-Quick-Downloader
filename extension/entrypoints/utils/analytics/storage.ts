// filepath: extension/entrypoints/utils/analytics/storage.ts
/**
 * Analytics storage utilities.
 * Promisified wrappers for Chrome storage API.
 */

import type { AnalyticsEvent, LocalStats, AnalyticsConfig, AnalyticsMeta } from './types';
import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_META, CONFIG_VERSION } from './constants';
import { generateEventId } from './detection';

const IDB_DB_NAME = 'cqd_analytics_db_v1';
const IDB_DB_VERSION = 1;
const IDB_STORE_QUEUE = 'queue';

// Offline queue compaction thresholds (approx. "500 downloads" budget)
const QUEUE_BUDGET_EVENTS = 500;
const QUEUE_PRESERVE_RECENT = 200;
const ROLLUP_BUCKET_MS = 60 * 60 * 1000; // 1h buckets for rollups

let idbPromise: Promise<IDBDatabase> | null = null;
let idbUnavailable = false;

function isIndexedDbSupported(): boolean {
  return typeof indexedDB !== 'undefined' && !idbUnavailable;
}

function openQueueDb(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_QUEUE)) {
          const store = db.createObjectStore(IDB_STORE_QUEUE, { keyPath: 'id' });
          store.createIndex('byTimestamp', 'timestamp');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  }).catch((err) => {
    console.warn('[CQD Analytics] IndexedDB unavailable:', err);
    idbUnavailable = true;
    idbPromise = null;
    throw err;
  });
  return idbPromise;
}

async function getQueueFromIdb(): Promise<AnalyticsEvent[] | null> {
  if (!isIndexedDbSupported()) return null;
  try {
    const db = await openQueueDb();
    const queue = await new Promise<AnalyticsEvent[]>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_QUEUE, 'readonly');
      const store = tx.objectStore(IDB_STORE_QUEUE);
      const index = store.index('byTimestamp');
      const req = index.getAll();
      req.onsuccess = () => resolve((req.result || []) as AnalyticsEvent[]);
      req.onerror = () => reject(req.error);
    });
    queue.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return queue;
  } catch (err) {
    console.warn('[CQD Analytics] getQueueFromIdb failed:', err);
    return null;
  }
}

async function replaceQueueInIdb(queue: AnalyticsEvent[]): Promise<boolean> {
  if (!isIndexedDbSupported()) return false;
  try {
    const db = await openQueueDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(IDB_STORE_QUEUE);
      const clearReq = store.clear();
      clearReq.onerror = () => reject(clearReq.error);
      clearReq.onsuccess = () => {
        for (const ev of queue) {
          store.put(ev);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (err) {
    console.warn('[CQD Analytics] replaceQueueInIdb failed:', err);
    return false;
  }
}

function getEventCount(ev: AnalyticsEvent): number {
  const count = typeof ev.count === 'number' ? Math.floor(ev.count) : 1;
  return count > 0 ? count : 1;
}

function getRollupBucket(ts: number): number {
  return Math.floor(ts / ROLLUP_BUCKET_MS) * ROLLUP_BUCKET_MS;
}

function buildRollupKey(ev: AnalyticsEvent, bucketStart: number, coarse = false): string {
  const status = ev.status || 'success';
  const type = ev.file_type || 'unknown';
  const error = ev.error_type || '';
  if (coarse) {
    return [bucketStart, status, type, error].join('|');
  }
  const browser = ev.browser || 'unknown';
  const os = ev.os || 'unknown';
  const lang = ev.language || 'unknown';
  const version = ev.ext_version || '0.0.0';
  const source = ev.source || '';
  const bypass = ev.bypass_used ? '1' : '0';
  return [bucketStart, status, type, browser, os, lang, version, error, source, bypass].join('|');
}

function rollupEvents(events: AnalyticsEvent[], coarse = false): AnalyticsEvent[] {
  const map = new Map<string, {
    sample: AnalyticsEvent;
    count: number;
    totalDuration: number;
    earliest: number;
  }>();

  for (const ev of events) {
    const ts = typeof ev.timestamp === 'number' ? ev.timestamp : Date.now();
    const bucketStart = coarse ? new Date(ts).setUTCHours(0, 0, 0, 0) : getRollupBucket(ts);
    const key = buildRollupKey(ev, bucketStart, coarse);
    const weight = getEventCount(ev);
    const duration = typeof ev.duration_ms === 'number' ? ev.duration_ms : 0;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        sample: ev,
        count: weight,
        totalDuration: duration * weight,
        earliest: ts,
      });
    } else {
      existing.count += weight;
      existing.totalDuration += duration * weight;
      if (ts < existing.earliest) existing.earliest = ts;
    }
  }

  const rollups: AnalyticsEvent[] = [];
  for (const entry of map.values()) {
    const avgDuration = entry.count > 0 ? Math.round(entry.totalDuration / entry.count) : 0;
    const sample = entry.sample;
    rollups.push({
      status: sample.status,
      file_type: sample.file_type || 'unknown',
      browser: coarse ? 'mixed' : (sample.browser || 'unknown'),
      os: coarse ? 'mixed' : (sample.os || 'unknown'),
      ext_version: coarse ? 'mixed' : (sample.ext_version || '0.0.0'),
      duration_ms: avgDuration,
      bypass_used: sample.bypass_used ?? false,
      error_type: sample.error_type,
      language: coarse ? 'mixed' : (sample.language || 'unknown'),
      timestamp: entry.earliest,
      id: generateEventId(entry.earliest),
      retryCount: 0,
      source: coarse ? 'rollup' : sample.source,
      count: entry.count,
      rollup: true,
    });
  }

  rollups.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return rollups;
}

export function compactQueueForBudget(queue: AnalyticsEvent[]): { queue: AnalyticsEvent[]; compacted: boolean } {
  if (queue.length <= QUEUE_BUDGET_EVENTS) {
    return { queue, compacted: false };
  }

  const protectedEvents = queue.filter((ev) => typeof ev.commitSeq === 'number');
  const compactable = queue.filter((ev) => typeof ev.commitSeq !== 'number');
  if (compactable.length === 0) {
    return { queue, compacted: false };
  }

  let preserve = Math.min(QUEUE_PRESERVE_RECENT, compactable.length);

  while (true) {
    const newer = compactable.slice(-preserve);
    const older = compactable.slice(0, compactable.length - preserve);
    const rollups = rollupEvents(older, false);
    let nextQueue = [...rollups, ...protectedEvents, ...newer];
    nextQueue.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    if (nextQueue.length <= QUEUE_BUDGET_EVENTS || preserve === 0) {
      if (nextQueue.length > QUEUE_BUDGET_EVENTS) {
        const coarseRollups = rollupEvents(compactable, true);
        nextQueue = [...coarseRollups, ...protectedEvents];
        nextQueue.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      }
      return { queue: nextQueue, compacted: true };
    }

    preserve = Math.floor(preserve / 2);
  }
}

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

export async function loadQueue(): Promise<{ queue: AnalyticsEvent[]; valid: boolean }> {
  const idbQueue = await getQueueFromIdb();
  if (idbQueue && Array.isArray(idbQueue) && idbQueue.length > 0) {
    return { queue: idbQueue, valid: true };
  }

  const stored = await loadQueueWithIntegrity();
  if (stored.queue.length > 0 && isIndexedDbSupported()) {
    const migrated = await replaceQueueInIdb(stored.queue);
    if (migrated) {
      await storageSet({
        [STORAGE_KEYS.QUEUE]: [],
        [STORAGE_KEYS.INTEGRITY]: computeChecksum('[]'),
        [STORAGE_KEYS.QUEUE_MIGRATED]: true,
      });
    }
  }
  return stored;
}

export async function saveQueue(queue: AnalyticsEvent[]): Promise<void> {
  const normalized = queue.map((ev) => {
    if (!ev.id) {
      return { ...ev, id: generateEventId(ev.timestamp) };
    }
    return ev;
  });
  const compacted = compactQueueForBudget(normalized);
  const nextQueue = compacted.queue;
  const savedToIdb = await replaceQueueInIdb(nextQueue);
  if (savedToIdb) {
    await storageSet({
      [STORAGE_KEYS.QUEUE]: [],
      [STORAGE_KEYS.INTEGRITY]: computeChecksum('[]'),
      [STORAGE_KEYS.QUEUE_MIGRATED]: true,
    });
    return;
  }
  await saveQueueWithIntegrity(nextQueue);
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
