/**
 * ============================================================================
 * DOWNLOAD HISTORY — local-only, per-file, persisted
 * (bead 0h4d.1.6, plan docs/superpowers/plans/2026-09-28-download-history.md)
 * ============================================================================
 *
 * Checksummed like the analytics queue (computeChecksum below mirrors
 * entrypoints/utils/analytics/storage.ts): corrupt payloads sanitize to an
 * empty history with valid:false — never crash, never block the UI.
 *
 * Privacy posture: history is LOCAL-only (chrome.storage.local) and never
 * transmitted; the visible schema is PII-free (host, filename, size, date,
 * status). The full url rides the entry solely so popup re-download works —
 * the same data the browser's own download history keeps; any future export
 * path must strip it.
 */

export interface HistoryEntry {
  /** The download's requestId — dedupe key (one settle = one row). */
  id: string;
  ts: number;
  filename: string;
  ext?: string;
  bytes?: number;
  status: 'success' | 'failed';
  errorCode?: string;
  host: string;
  url: string;
}

export const HISTORY_KEY = 'cqd_history_v1';
export const HISTORY_INTEGRITY_KEY = 'cqd_history_integrity_v1';
export const HISTORY_CAP = 500;

/** Mirrors the analytics queue's djb2-style checksum. */
export function computeChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/** Append (idempotent per id) and trim oldest-first to HISTORY_CAP. */
export function appendEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry,
  cap: number = HISTORY_CAP,
): HistoryEntry[] {
  if (entries.some((e) => e.id === entry.id)) return entries;
  const next = [...entries, entry];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Case-insensitive filename substring search; empty query = everything. */
export function searchEntries(entries: HistoryEntry[], query: string): HistoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.filename.toLowerCase().includes(q));
}

function storage(): chrome.storage.LocalStorageArea | undefined {
  return (globalThis as { chrome?: { storage?: { local?: chrome.storage.LocalStorageArea } } })
    .chrome?.storage?.local;
}

function storageGet(keys: string[]): Promise<Record<string, unknown>> {
  const s = storage();
  return new Promise((resolve) => {
    if (!s) return resolve({});
    try {
      s.get(keys, (res) => {
        void (globalThis as { chrome?: { runtime?: { lastError?: unknown } } }).chrome?.runtime
          ?.lastError;
        resolve((res ?? {}) as Record<string, unknown>);
      });
    } catch {
      resolve({});
    }
  });
}

function storageSet(kv: Record<string, unknown>): Promise<void> {
  const s = storage();
  return new Promise((resolve) => {
    if (!s) return resolve();
    try {
      s.set(kv, () => {
        void (globalThis as { chrome?: { runtime?: { lastError?: unknown } } }).chrome?.runtime
          ?.lastError;
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

export async function loadHistory(): Promise<{ entries: HistoryEntry[]; valid: boolean }> {
  const raw = await storageGet([HISTORY_KEY, HISTORY_INTEGRITY_KEY]);
  const entries = raw[HISTORY_KEY];
  const checksum = raw[HISTORY_INTEGRITY_KEY];
  if (!Array.isArray(entries)) return { entries: [], valid: false };
  const serialized = JSON.stringify(entries);
  if (checksum !== computeChecksum(serialized)) {
    return { entries: [], valid: false };
  }
  return { entries: entries as HistoryEntry[], valid: true };
}

async function saveHistory(entries: HistoryEntry[]): Promise<void> {
  await storageSet({
    [HISTORY_KEY]: entries,
    [HISTORY_INTEGRITY_KEY]: computeChecksum(JSON.stringify(entries)),
  });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return (await loadHistory()).entries;
}

export async function clearHistory(): Promise<void> {
  await saveHistory([]);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * Record a terminal download outcome. Only success/failed terminals record —
 * cancelled and in-flight statuses are ignored. Safe to call on every settle;
 * the id-dedupe keeps one row per download.
 */
export async function recordDownloadHistory(
  pending: {
    requestId: string;
    baseUrl: string;
    originalUrl: string;
    fileMeta?: { name?: string; ext?: string };
    totalBytes?: number;
  },
  status: string,
  errorCode?: string,
): Promise<void> {
  if (status !== 'success' && status !== 'failed') return;
  const { entries } = await loadHistory();
  const entry: HistoryEntry = {
    id: pending.requestId,
    ts: Date.now(),
    filename: pending.fileMeta?.name || pending.originalUrl.split('/').pop() || pending.requestId,
    ...(pending.fileMeta?.ext ? { ext: pending.fileMeta.ext } : {}),
    ...(typeof pending.totalBytes === 'number' && pending.totalBytes > 0
      ? { bytes: pending.totalBytes }
      : {}),
    status,
    ...(errorCode ? { errorCode } : {}),
    host: hostOf(pending.baseUrl || pending.originalUrl),
    url: pending.originalUrl,
  };
  await saveHistory(appendEntry(entries, entry));
}
