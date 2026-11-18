/**
 * ============================================================================
 * ENTITLEMENT ACTIVATE — pure orchestration of validate/activate + cache
 * (bead 0h4d.2.3; wire contract: cloudflare-worker/src/licensing/routes.ts)
 * ============================================================================
 *
 * State machine: unlicensed → licensed(grace-expiry) → locked. A lock NEVER
 * disables free features: isPro() maps licensed|grace → true and everything
 * else → false, so every free code path behaves byte-for-byte as before the
 * module existed.
 *
 * Offline-tolerant: a cached licensed/grace token serves while offline
 * (airplane mode); locked only via tamper or expiry past grace. A missing
 * cache with no stored key means unlicensed — ONE attempt at most, no
 * retry storm.
 *
 * Retry policy note (deliberate): src/retry/backoff.ts is NOT reused here.
 * Every terminal server error (license_invalid, activation_limit_reached,
 * format errors) is final for the immediate call, and 429s carry an
 * authoritative retryAfterSec — blind exponential retries would distort
 * both. The rate-limit gate below honors retryAfterSec instead.
 *
 * Pure orchestration: storage, HTTP, clock, install id, and analytics sink
 * are all injected. Raw license keys and install IDs NEVER appear in a log
 * line, a thrown message, or an analytics event (the module does not log;
 * codes only).
 */

import {
  ENTITLEMENT_VERIFY_KEY,
  LICENSE_ACTIVATE_PATH,
  LICENSE_KEY_STORAGE_KEY,
  LICENSE_VALIDATE_PATH,
} from './config';
import {
  verifyEntitlementToken,
  type EntitlementState,
} from './verify';
import {
  loadCachedEntitlementState,
  saveCachedEntitlement,
  clearCachedEntitlement,
  type EntitlementStoragePort,
} from './cache';

/** Minimal HTTP surface (injectable fetch). */
export type EntitlementHttpPort = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<Response>;

/** Injected clock (epoch ms). */
export type EntitlementClock = () => number;

/** Opaque install-id source (never logged, never analyzed). */
export type EntitlementInstallIdSource = () => Promise<string>;

/** Opaque analytics sink: outcome codes only — no key, no install id. */
export type EntitlementCheckSink = (event: EntitlementCheckEvent) => void;

export interface EntitlementCheckEvent {
  /** Where the served state came from. */
  source: 'cache' | 'network' | 'none';
  /** Opaque state name or lock reason; no key, no install id, no payload. */
  outcome: string;
  /** Server error code when a network attempt failed; omitted otherwise. */
  errorCode?: string;
}

export interface EntitlementControllerDeps {
  storage: EntitlementStoragePort;
  http: EntitlementHttpPort;
  getInstallId: EntitlementInstallIdSource;
  /** Worker origin, e.g. "https://cqd-analytics...workers.dev" (no slash). */
  workerBaseUrl: string;
  verifyKey?: string;
  now?: EntitlementClock;
  onCheck?: EntitlementCheckSink;
}

/** User-facing copy for one server error code (product UI copy). */
export const ENTITLEMENT_ERROR_COPY: Record<string, string> = {
  license_invalid: 'That license key is not valid.',
  license_expired: 'This license has expired.',
  activation_limit_reached: 'This key reached its activation limit. Deactivate another device first.',
  license_key_format_invalid: 'That does not look like a valid license key.',
  install_id_format_invalid: 'Installation problem. Update the extension and try again.',
  install_id_required: 'Installation problem. Update the extension and try again.',
  license_key_required: 'Enter a license key first.',
  rate_limited: 'Too many attempts. Try again later.',
  rate_limit_unavailable: 'The license service is busy. Try again shortly.',
  storage_unavailable: 'The license service is temporarily unavailable.',
  signing_key_unconfigured: 'The license service is misconfigured. Try again later.',
  license_service_failed: 'The license service had an error. Try again later.',
  network: 'You appear to be offline. Licensed features stay available from cache.',
  bad_response: 'Unexpected answer from the license service. Try again later.',
};

export interface EntitlementActionResult {
  ok: boolean;
  /** Served state after the action (locked states included). */
  state: EntitlementState | null;
  /** Server error code, or a local code (network, bad_response). */
  code?: string;
  /** Ready-made user copy for the failure; undefined on success. */
  message?: string;
  /** Server-provided wait in seconds (429 responses). */
  retryAfterSec?: number;
}

const LICENSE_KEY_SANITIZE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

/** Client-side shape check mirroring the worker's LICENSE_KEY_PATTERN. */
export function isPlausibleLicenseKey(key: string): boolean {
  return typeof key === 'string' && LICENSE_KEY_SANITIZE_PATTERN.test(key.trim());
}

export function copyForCode(code: string, retryAfterSec?: number): string {
  const base = ENTITLEMENT_ERROR_COPY[code] ?? ENTITLEMENT_ERROR_COPY.bad_response;
  if (code === 'rate_limited' && typeof retryAfterSec === 'number' && retryAfterSec > 0) {
    return `Too many attempts. Try again in ${retryAfterSec} seconds.`;
  }
  return base;
}

/**
 * The entitlement controller. One instance per context (the background
 * service worker creates one at startup); all methods never throw.
 */
export interface EntitlementController {
  /**
   * Entry point for the future license-key UI: activate a raw key on this
   * install. Single network attempt; caches the minted token on success.
   */
  activate(licenseKey: string): Promise<EntitlementActionResult>;
  /**
   * Blocking single-attempt revalidate against the stored key. For pre-Pro
   * action gates that want a fresh authoritative answer.
   */
  revalidate(): Promise<EntitlementActionResult>;
  /**
   * Startup/pre-gate check: cache first (offline-tolerant), then one
   * non-blocking network refresh when a stored key exists and the rate
   * gate allows. Never blocks longer than the cache read.
   */
  checkEntitlement(): Promise<EntitlementState | null>;
  /** Current known state without any network or cache round-trip. */
  currentState(): EntitlementState | null;
  /** Pro flag ONLY: licensed|grace → true. Locks never touch free paths. */
  isPro(): boolean;
  /** Remove the stored key + cached token (future logout path). */
  deactivate(): Promise<void>;
}

export function createEntitlementController(
  deps: EntitlementControllerDeps,
): EntitlementController {
  const verifyKey = deps.verifyKey ?? ENTITLEMENT_VERIFY_KEY;
  const now = deps.now ?? (() => Date.now());
  const base = deps.workerBaseUrl.replace(/\/+$/, '');
  let current: EntitlementState | null = null;
  /** Epoch ms before which no new network attempt may start (429 gate). */
  let noNetworkBefore = 0;

  const emit = (event: EntitlementCheckEvent): void => {
    try {
      deps.onCheck?.(event);
    } catch {
      // A broken analytics sink must never break an entitlement check.
    }
  };

  async function readStoredLicenseKey(): Promise<string | null> {
    try {
      const stored = await deps.storage.get([LICENSE_KEY_STORAGE_KEY]);
      const raw = stored[LICENSE_KEY_STORAGE_KEY];
      if (typeof raw !== 'string' || !isPlausibleLicenseKey(raw)) return null;
      return raw;
    } catch {
      return null;
    }
  }

  async function persistStoredLicenseKey(key: string): Promise<void> {
    try {
      await deps.storage.set({ [LICENSE_KEY_STORAGE_KEY]: key });
    } catch {
      // Storage failures degrade to in-memory-only licensing.
    }
  }

  async function dropStoredLicenseKey(): Promise<void> {
    try {
      await deps.storage.remove([LICENSE_KEY_STORAGE_KEY]);
    } catch {
      // Best-effort.
    }
  }

  /** Verify a minted token, cache it, and update the in-memory state. */
  async function adoptToken(entitlement: string): Promise<EntitlementState | null> {
    const state = await verifyEntitlementToken(entitlement, verifyKey, now());
    if (state.state === 'locked') {
      // The service minted a token this build cannot trust — treat the
      // whole answer as a bad response, cache nothing.
      return null;
    }
    current = state;
    await saveCachedEntitlement(deps.storage, entitlement, now());
    return state;
  }

  function failure(code: string, retryAfterSec?: number): EntitlementActionResult {
    return {
      ok: false,
      state: current,
      code,
      message: copyForCode(code, retryAfterSec),
      retryAfterSec,
    };
  }

  /** One POST to a license endpoint; response envelopes stay untrusted. */
  async function postLicense(
    path: string,
    body: { licenseKey: string; installId?: string },
  ): Promise<EntitlementActionResult> {
    let installId: string;
    try {
      installId = await deps.getInstallId();
    } catch {
      return failure('install_id_required');
    }
    let res: Response;
    try {
      res = await deps.http(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, installId: body.installId ?? installId }),
      });
    } catch {
      return failure('network');
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    const envelope = (json ?? null) as
      | { ok?: unknown; status?: unknown; entitlement?: unknown; error?: unknown; retryAfterSec?: unknown; licenseStatus?: unknown }
      | null;
    if (!envelope || typeof envelope !== 'object') {
      return failure(res.ok ? 'bad_response' : 'license_service_failed');
    }
    if (envelope.ok !== true) {
      const code = typeof envelope.error === 'string' ? envelope.error : 'license_service_failed';
      const retryAfterSec =
        typeof envelope.retryAfterSec === 'number' && envelope.retryAfterSec > 0
          ? envelope.retryAfterSec
          : undefined;
      if (code === 'rate_limited') {
        const waitSec = retryAfterSec ?? 60;
        noNetworkBefore = now() + waitSec * 1000;
      }
      return failure(code, retryAfterSec);
    }
    if (
      (envelope.status !== 'active' && envelope.status !== 'grace') ||
      typeof envelope.entitlement !== 'string'
    ) {
      return failure('bad_response');
    }
    const adopted = await adoptToken(envelope.entitlement);
    if (!adopted) return failure('bad_response');
    return { ok: true, state: adopted };
  }

  async function activate(licenseKey: string): Promise<EntitlementActionResult> {
    if (!isPlausibleLicenseKey(licenseKey)) {
      return failure('license_key_format_invalid');
    }
    const result = await postLicense(LICENSE_ACTIVATE_PATH, {
      licenseKey: licenseKey.trim(),
    });
    if (result.ok) {
      await persistStoredLicenseKey(licenseKey.trim());
      emit({ source: 'network', outcome: result.state?.state ?? 'unknown' });
      return result;
    }
    emit({ source: 'network', outcome: 'failed', errorCode: result.code });
    // The stored key died authoritatively — stop reusing it. Rate limits
    // and transient errors keep the stored key.
    if (result.code === 'license_invalid' || result.code === 'license_expired') {
      await dropStoredLicenseKey();
      await clearCachedEntitlement(deps.storage);
      current = null;
      result.state = null;
    }
    return result;
  }

  async function revalidate(): Promise<EntitlementActionResult> {
    const storedKey = await readStoredLicenseKey();
    if (!storedKey) {
      return { ok: false, state: current, code: 'license_key_required' };
    }
    if (now() < noNetworkBefore) {
      return failure('rate_limited');
    }
    const result = await postLicense(LICENSE_VALIDATE_PATH, { licenseKey: storedKey });
    if (result.ok) {
      emit({ source: 'network', outcome: result.state?.state ?? 'unknown' });
      return result;
    }
    emit({ source: 'network', outcome: 'failed', errorCode: result.code });
    if (result.code === 'license_invalid' || result.code === 'license_expired') {
      await dropStoredLicenseKey();
      await clearCachedEntitlement(deps.storage);
      current =
        result.code === 'license_expired'
          ? { state: 'locked', reason: 'expired' }
          : null;
      result.state = current;
    }
    return result;
  }

  async function checkEntitlement(): Promise<EntitlementState | null> {
    const cached = await loadCachedEntitlementState(deps.storage, verifyKey, now());
    if (cached) {
      current = cached;
      // Refresh the token in the background so grace windows and revocations
      // converge on the next wake; the caller gets the cached answer NOW.
      void revalidate().catch(() => undefined);
      emit({
        source: 'cache',
        outcome: cached.state === 'locked' ? `locked-${cached.reason}` : cached.state,
      });
      return cached;
    }
    // No cache: a stored key gets ONE blocking attempt (rate-gated; a
    // failed/offline attempt returns unlicensed — never a retry storm).
    if (await readStoredLicenseKey()) {
      const result = await revalidate();
      if (result.ok) return result.state;
    }
    emit({ source: 'none', outcome: current ? stateName(current) : 'unlicensed' });
    return current;
  }

  function stateName(state: EntitlementState): string {
    return state.state === 'locked' ? `locked-${state.reason}` : state.state;
  }

  return {
    activate,
    revalidate,
    checkEntitlement,
    currentState: () => current,
    isPro: () => current?.state === 'licensed' || current?.state === 'grace',
    async deactivate() {
      await dropStoredLicenseKey();
      await clearCachedEntitlement(deps.storage);
      current = null;
    },
  };
}
