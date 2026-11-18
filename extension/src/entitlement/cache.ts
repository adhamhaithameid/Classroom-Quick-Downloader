/**
 * ============================================================================
 * ENTITLEMENT CACHE — verified-token cache over an injected storage port
 * (bead 0h4d.2.3)
 * ============================================================================
 *
 * One record at cqd_entitlement_v1: the signed entitlement token (as the
 * worker minted it) + fetchedAt. The record NEVER contains the raw license
 * key (separate storage key, see config.ts) and NEVER a pre-decoded payload
 * copy — reads verify the signature EVERY time, then decode. A tampered or
 * corrupt record reads as locked (integrity posture mirrors the
 * checksummed history store).
 *
 * Pure storage-port style: no chrome.* imports. The default port binds to
 * chrome.storage.local through the same guarded-globalThis pattern the rest
 * of src/ uses (download-stats.ts); tests inject their own port.
 */

import { ENTITLEMENT_CACHE_KEY, ENTITLEMENT_VERIFY_KEY } from './config';
import {
  verifyEntitlementToken,
  splitEntitlementToken,
  type EntitlementState,
} from './verify';

/** Minimal async KV surface the cache needs (chrome.storage.local shape). */
export interface EntitlementStoragePort {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(kv: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

/** Persisted cache record (schema-checked on read; corrupt → absent). */
export interface EntitlementCacheRecord {
  schemaVersion: 1;
  /** The exact "<payloadB64>.<sigB64>" token from the worker. */
  entitlement: string;
  /** Epoch ms of the successful fetch that stored the token. */
  fetchedAt: number;
}

export const ENTITLEMENT_CACHE_SCHEMA_VERSION = 1;

/**
 * Default port: chrome.storage.local via guarded globalThis (no chrome
 * import). Missing storage or failing calls resolve to empty — the cache
 * degrades to "no cached entitlement", never throws into a free path.
 */
export function createChromeLocalStoragePort(): EntitlementStoragePort {
  const storage = (): chrome.storage.LocalStorageArea | undefined =>
    (globalThis as { chrome?: { storage?: { local?: chrome.storage.LocalStorageArea } } })
      .chrome?.storage?.local;
  return {
    get(keys) {
      return new Promise((resolve) => {
        const s = storage();
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
    },
    set(kv) {
      return new Promise((resolve) => {
        const s = storage();
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
    },
    remove(keys) {
      return new Promise((resolve) => {
        const s = storage();
        if (!s) return resolve();
        try {
          s.remove(keys, () => {
            void (globalThis as { chrome?: { runtime?: { lastError?: unknown } } }).chrome?.runtime
              ?.lastError;
            resolve();
          });
        } catch {
          resolve();
        }
      });
    },
  };
}

/** Coerce an unknown stored value into a cache record; null when unusable. */
export function sanitizeCacheRecord(raw: unknown): EntitlementCacheRecord | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== ENTITLEMENT_CACHE_SCHEMA_VERSION) return null;
  if (typeof r.entitlement !== 'string' || !splitEntitlementToken(r.entitlement)) return null;
  if (typeof r.fetchedAt !== 'number' || !Number.isFinite(r.fetchedAt)) return null;
  return {
    schemaVersion: ENTITLEMENT_CACHE_SCHEMA_VERSION,
    entitlement: r.entitlement,
    fetchedAt: r.fetchedAt,
  };
}

/**
 * Read the cached entitlement and return its CURRENT state. The signature
 * is verified on EVERY read (tamper → locked, never silently accepted);
 * expired-but-within-grace still serves grace; past grace reads locked
 * until an online revalidation renews the record. No record → null (the
 * caller treats that as unlicensed/unknown).
 */
export async function loadCachedEntitlementState(
  storage: EntitlementStoragePort,
  verifyKey: string = ENTITLEMENT_VERIFY_KEY,
  now: number = Date.now(),
): Promise<EntitlementState | null> {
  let raw: Record<string, unknown>;
  try {
    raw = await storage.get([ENTITLEMENT_CACHE_KEY]);
  } catch {
    return null;
  }
  const record = sanitizeCacheRecord(raw[ENTITLEMENT_CACHE_KEY]);
  if (!record) return null;
  return verifyEntitlementToken(record.entitlement, verifyKey, now);
}

/** Persist a freshly minted token from a successful validate/activate. */
export async function saveCachedEntitlement(
  storage: EntitlementStoragePort,
  entitlement: string,
  fetchedAt: number = Date.now(),
): Promise<void> {
  const record: EntitlementCacheRecord = {
    schemaVersion: ENTITLEMENT_CACHE_SCHEMA_VERSION,
    entitlement,
    fetchedAt,
  };
  try {
    await storage.set({ [ENTITLEMENT_CACHE_KEY]: record });
  } catch {
    // Cache writes never throw into the caller: a failed write means the
    // next read starts from no-cache (online revalidation path).
  }
}

/** Drop the cached token (logout/lock cleanup paths). */
export async function clearCachedEntitlement(
  storage: EntitlementStoragePort,
): Promise<void> {
  try {
    await storage.remove([ENTITLEMENT_CACHE_KEY]);
  } catch {
    // Same never-throw contract as the write path.
  }
}
