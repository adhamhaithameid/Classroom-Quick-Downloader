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
const MAX_EVENT_COUNT = 100_000;
const MAX_DURATION_MS = 86_400_000;

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
  idbPromise = new Promise<IDBDatabase>((resolve, reject) => {
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
  }).catch((err): never => {
    console.warn('[CQD Analytics] IndexedDB unavailable:', err);
    idbUnavailable = true;
    idbPromise = null;
    throw err;
  });
  return idbPromise;
}

function normalizeString(value: unknown, fallback: string, maxLen = 64): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

function normalizeTimestamp(value: unknown, fallbackNow: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallbackNow;
  if (value <= 0) return fallbackNow;
  return Math.floor(value);
}

function normalizeOptionalNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const next = Math.floor(value);
  if (next < min || next > max) return undefined;
  return next;
}

function sanitizeEvent(raw: unknown, fallbackNow: number): AnalyticsEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const ev = raw as Record<string, unknown>;
  const status =
    ev.status === 'success' || ev.status === 'fail' || ev.status === 'cancelled'
      ? ev.status
      : 'success';
  const id = typeof ev.id === 'string' && ev.id.length > 0 ? ev.id.slice(0, 128) : undefined;
  const retryCount = normalizeOptionalNumber(ev.retryCount, 0, 10_000);
  const commitSeq = normalizeOptionalNumber(ev.commitSeq, 0, Number.MAX_SAFE_INTEGER);
  const count = normalizeOptionalNumber(ev.count, 1, MAX_EVENT_COUNT);
  const duration = normalizeOptionalNumber(ev.duration_ms, 0, MAX_DURATION_MS) ?? 0;

  return {
    status,
    file_type: normalizeString(ev.file_type, 'unknown', 64),
    browser: normalizeString(ev.browser, 'unknown', 64),
    os: normalizeString(ev.os, 'unknown', 64),
    ext_version: normalizeString(ev.ext_version, 'unknown', 32),
    duration_ms: duration,
    bypass_used: ev.bypass_used === true,
    error_type: typeof ev.error_type === 'string' && ev.error_type.trim() ? ev.error_type.trim().slice(0, 128) : undefined,
    language: normalizeString(ev.language, 'unknown', 12),
    timestamp: normalizeTimestamp(ev.timestamp, fallbackNow),
    id,
    source: typeof ev.source === 'string' && ev.source.trim() ? ev.source.trim().slice(0, 64) : undefined,
    retryCount,
    commitSeq,
    count,
    rollup: ev.rollup === true,
  };
}

function sanitizeQueue(rawQueue: unknown): { queue: AnalyticsEvent[]; changed: boolean } {
  if (!Array.isArray(rawQueue)) return { queue: [], changed: true };
  const fallbackNow = Date.now();
  const queue: AnalyticsEvent[] = [];
  let changed = false;
  for (const raw of rawQueue) {
    const ev = sanitizeEvent(raw, fallbackNow);
    if (!ev) {
      changed = true;
      continue;
    }
    const candidate = raw as Record<string, unknown>;
    const same =
      candidate.status === ev.status &&
      candidate.file_type === ev.file_type &&
      candidate.browser === ev.browser &&
      candidate.os === ev.os &&
      candidate.ext_version === ev.ext_version &&
      candidate.duration_ms === ev.duration_ms &&
      candidate.bypass_used === ev.bypass_used &&
      candidate.error_type === ev.error_type &&
      candidate.language === ev.language &&
      candidate.timestamp === ev.timestamp &&
      candidate.id === ev.id &&
      candidate.source === ev.source &&
      candidate.retryCount === ev.retryCount &&
      candidate.commitSeq === ev.commitSeq &&
      candidate.count === ev.count &&
      candidate.rollup === ev.rollup;
    if (!same) changed = true;
    queue.push(ev);
  }
  queue.sort((a, b) => a.timestamp - b.timestamp);
  if (queue.length !== rawQueue.length) changed = true;
  return { queue, changed };
}

async function getQueueFromIdb(): Promise<AnalyticsEvent[] | null> {
  if (!isIndexedDbSupported()) return null;
  try {
    const db = await openQueueDb();
    const rawQueue = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_QUEUE, 'readonly');
      const store = tx.objectStore(IDB_STORE_QUEUE);
      const index = store.index('byTimestamp');
      const req = index.getAll();
      req.onsuccess = () => resolve((req.result || []) as unknown[]);
      req.onerror = () => reject(req.error);
    });
    return sanitizeQueue(rawQueue).queue;
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
    const avgDuration = Math.round(entry.totalDuration / entry.count);
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

  rollups.sort((a, b) => a.timestamp - b.timestamp);
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
    nextQueue.sort((a, b) => a.timestamp - b.timestamp);

    if (nextQueue.length <= QUEUE_BUDGET_EVENTS || preserve === 0) {
      if (nextQueue.length > QUEUE_BUDGET_EVENTS) {
        const coarseRollups = rollupEvents(compactable, true);
        nextQueue = [...coarseRollups, ...protectedEvents];
        nextQueue.sort((a, b) => a.timestamp - b.timestamp);
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
  const maxEventsPerRequestDefault = DEFAULT_CONFIG.maxEventsPerRequest as number;
  const maxEventsPerRequestInput = cfg.maxEventsPerRequest == null
    ? maxEventsPerRequestDefault
    : cfg.maxEventsPerRequest;
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
    maxEventsPerRequest: clampInt(maxEventsPerRequestInput, 1, 50_000, maxEventsPerRequestDefault),
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
  const migrated = await storageGet(STORAGE_KEYS.QUEUE_MIGRATED);
  if (idbQueue && Array.isArray(idbQueue)) {
    // Once migration is marked complete, IndexedDB is authoritative even when empty.
    if (idbQueue.length > 0 || migrated === true) {
      return { queue: idbQueue, valid: true };
    }
  }

  const stored = await loadQueueWithIntegrity();
  if (stored.queue.length > 0 && isIndexedDbSupported()) {
    const migratedToIdb = await replaceQueueInIdb(stored.queue);
    if (migratedToIdb) {
      const clearedLegacy = await storageSet({
        [STORAGE_KEYS.QUEUE]: [],
        [STORAGE_KEYS.INTEGRITY]: computeChecksum('[]'),
        [STORAGE_KEYS.QUEUE_MIGRATED]: true,
      });
      if (!clearedLegacy) {
        // Keep legacy queue in sync when clear fails, preventing stale replay fallback.
        await saveQueueWithIntegrity(stored.queue);
      }
    }
  }
  return stored;
}

export async function saveQueue(queue: AnalyticsEvent[]): Promise<void> {
  const sanitized = sanitizeQueue(queue).queue;
  const normalized = sanitized.map((ev) => {
    if (!ev.id) {
      return { ...ev, id: generateEventId(ev.timestamp) };
    }
    return ev;
  });
  normalized.sort((a, b) => a.timestamp - b.timestamp);
  const compacted = compactQueueForBudget(normalized);
  const nextQueue = compacted.queue;
  const savedToIdb = await replaceQueueInIdb(nextQueue);
  if (savedToIdb) {
    const clearedLegacy = await storageSet({
      [STORAGE_KEYS.QUEUE]: [],
      [STORAGE_KEYS.INTEGRITY]: computeChecksum('[]'),
      [STORAGE_KEYS.QUEUE_MIGRATED]: true,
    });
    if (!clearedLegacy) {
      // Keep legacy queue mirrored if clear fails, so fallback never replays stale data.
      await saveQueueWithIntegrity(nextQueue);
    }
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

export async function __resetStorageForTests(): Promise<void> {
  if (idbPromise) {
    try {
      const db = await idbPromise;
      db.close();
    } catch {
      // ignore
    }
  }
  idbPromise = null;
  idbUnavailable = false;
  inMemoryQueue = null;
  inMemoryChecksum = null;
}

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
  const sanitized = sanitizeQueue(raw);
  const sanitizedQueue = sanitized.queue;

  if (storedChecksum && storedChecksum !== computed) {
    console.warn('[CQD Analytics] Queue integrity check failed; keeping raw queue to avoid data loss');
    inMemoryQueue = sanitizedQueue.slice();
    inMemoryChecksum = computed;
    return { queue: sanitizedQueue, valid: false };
  }

  inMemoryQueue = sanitizedQueue.slice();
  inMemoryChecksum = computed;
  return { queue: sanitizedQueue, valid: !sanitized.changed };
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
  const source = raw && typeof raw === 'object' ? raw : {};
  const byType = source.byType && typeof source.byType === 'object' ? source.byType : {};
  const bySpeed = source.bySpeed && typeof source.bySpeed === 'object' ? source.bySpeed : {};
  const failByErrorType = source.failByErrorType && typeof source.failByErrorType === 'object'
    ? source.failByErrorType
    : {};
  const byLanguage = source.byLanguage && typeof source.byLanguage === 'object' ? source.byLanguage : {};

  return {
    total: typeof source.total === 'number' ? source.total : 0,
    byType,
    success: typeof source.success === 'number' ? source.success : 0,
    fail: typeof source.fail === 'number' ? source.fail : 0,
    cancelled: typeof source.cancelled === 'number' ? source.cancelled : 0,
    attempts: typeof source.attempts === 'number' ? source.attempts : 0,
    bySpeed: {
      fast: typeof bySpeed.fast === 'number' ? bySpeed.fast : 0,
      medium: typeof bySpeed.medium === 'number' ? bySpeed.medium : 0,
      slow: typeof bySpeed.slow === 'number' ? bySpeed.slow : 0,
    },
    bypassCount: typeof source.bypassCount === 'number' ? source.bypassCount : 0,
    failByErrorType,
    byLanguage,
    lastUpdated: typeof source.lastUpdated === 'number' ? source.lastUpdated : Date.now(),
  };
}

export async function loadStats(): Promise<LocalStats> {
  const raw = await storageGet(STORAGE_KEYS.STATS);
  return normalizeStats(raw);
}

export async function saveStats(stats: LocalStats): Promise<void> {
  await storageSet({ [STORAGE_KEYS.STATS]: stats });
}

// Test-only exports for deterministic branch coverage of private helpers.
export const __storageTestInternals = {
  openQueueDb,
  sanitizeEvent,
  sanitizeQueue,
  getEventCount,
  buildRollupKey,
  rollupEvents,
  clampInt,
  normalizeConfig,
  migrateConfig,
  computeChecksum,
  saveQueueWithIntegrity,
  loadQueueWithIntegrity,
};
