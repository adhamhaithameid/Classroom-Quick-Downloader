/**
 * ============================================================================
 * BACKGROUND ENTITLEMENT WIRING — ports, install id, analytics, startup check
 * (bead 0h4d.2.3; pure logic lives in src/entitlement/, no chrome imports there)
 * ============================================================================
 *
 * Module surface for Pro gating: `entitlement` (the controller) and
 * `isPro()`. The Pro build wave (3.x) adds the call sites; this bead only
 * checks on startup/install and exposes the surface. A lock NEVER disables
 * free features — isPro() false must behave exactly like the pre-module
 * extension in outcomes.
 *
 * Install id: reuses the EXISTING per-install id (the stats record's
 * installId, created once and stable, src/history/download-stats.ts). When
 * the stats record does not exist yet (fresh install), a standalone UUID is
 * derived once and persisted at cqd_install_id_v1 so the id is stable from
 * the very first license call. Opaque to the worker either way.
 *
 * Analytics: `entitlement_check` events carry opaque outcome codes only —
 * no key, no install id, no payload. GATED OFF on Firefox so the manifest's
 * data_collection: none stays honest (no new transmitted data).
 */

import { Analytics } from '../utils/analytics';
import { IS_FIREFOX } from './state';
import { WORKER_BASE_URL } from '../utils/analytics/constants';
import { loadDownloadStats } from '../../src/history/download-stats';
import { createEntitlementController, type EntitlementCheckEvent } from '../../src/entitlement/activate';
import { createChromeLocalStoragePort } from '../../src/entitlement/cache';

/** Standalone install id for installs whose stats record does not exist yet. */
export const INSTALL_ID_STORAGE_KEY = 'cqd_install_id_v1';

let cachedInstallId: string | null = null;

function makeRandomId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (typeof c?.randomUUID === 'function') return c.randomUUID();
  } catch {
    // fall through to the manual id
  }
  return `cqd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function storageGet(keys: string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (res) => {
        void chrome.runtime?.lastError;
        resolve((res ?? {}) as Record<string, unknown>);
      });
    } catch {
      resolve({});
    }
  });
}

function storageSet(kv: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(kv, () => {
        void chrome.runtime?.lastError;
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

/**
 * Resolve the opaque install id ONCE per service-worker life: the stats
 * record's existing installId when valid, else the persisted standalone
 * id (created and stored on first need).
 */
export async function resolveInstallId(): Promise<string> {
  if (cachedInstallId) return cachedInstallId;
  try {
    const { stats, valid } = await loadDownloadStats();
    if (valid && stats.installId) {
      cachedInstallId = stats.installId;
      return cachedInstallId;
    }
  } catch {
    // Stats record unreadable — fall through to the standalone id.
  }
  const stored = await storageGet([INSTALL_ID_STORAGE_KEY]);
  const existing = stored[INSTALL_ID_STORAGE_KEY];
  if (typeof existing === 'string' && existing) {
    cachedInstallId = existing;
    return cachedInstallId;
  }
  const fresh = makeRandomId();
  await storageSet({ [INSTALL_ID_STORAGE_KEY]: fresh });
  cachedInstallId = fresh;
  return fresh;
}

/**
 * Analytics sink: `entitlement_check` events, opaque outcome codes only.
 * No-op on Firefox (data_collection: none — no new data ever transmitted).
 */
export function emitEntitlementCheck(event: EntitlementCheckEvent): void {
  if (IS_FIREFOX) return;
  try {
    Analytics.track({
      status:
        event.outcome === 'licensed' || event.outcome === 'grace'
          ? 'success'
          : event.source === 'none' || event.outcome === 'unlicensed'
            ? 'cancelled'
            : 'fail',
      file_type: 'entitlement_check',
      duration_ms: 0,
      bypass_used: false,
      error_type: event.errorCode ?? event.outcome,
      source: 'entitlement',
    });
  } catch {
    // Analytics must never break an entitlement check.
  }
}

/**
 * The background entitlement controller: cached-first, offline-tolerant
 * checks over the existing worker base URL and the shared verify config.
 */
export const entitlement = createEntitlementController({
  storage: createChromeLocalStoragePort(),
  http: (url, init) => fetch(url, init),
  getInstallId: resolveInstallId,
  workerBaseUrl: WORKER_BASE_URL,
  onCheck: emitEntitlementCheck,
});

/** Pro flag ONLY — licensed|grace; a lock never touches a free code path. */
export function isPro(): boolean {
  return entitlement.isPro();
}

/**
 * Startup/install check: cache serves instantly (offline-tolerant); a
 * background refresh converges the token when online. Never throws.
 */
export async function runStartupEntitlementCheck(): Promise<void> {
  try {
    await entitlement.checkEntitlement();
  } catch {
    // Entitlement problems must never break background startup.
  }
}
