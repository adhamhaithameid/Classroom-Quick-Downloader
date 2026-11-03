// filepath: extension/entrypoints/background/update-dot.ts
/**
 * Update-available dot (bead 08fg.3). The dot covers every update signal:
 * - "available": the worker's live GET /changelog knows a newer release
 *   (checked at most once per 12h, on service-worker start plus an alarm).
 * - "updated": the browser just applied an update (runtime.onInstalled,
 *   reason "update").
 * - "scheduled": the browser detected and scheduled an update
 *   (runtime.onUpdateAvailable).
 * Dismissal rides the existing changelog seen map, so opening the
 * changelog for the target version clears the dot. Storage and network
 * failures never reject — the dot keeps its previous state.
 */

import {
  latestVersionFrom,
  updateTarget,
  type SeenVersions,
  type UpdateReason,
} from '../../src/update/update-state';
import { repaintAllTabIcons, setIconDecorationPaths } from './icon-manager';
import { CHANGELOG_SEEN_KEY, UPDATE_STATE_KEY, type UpdateState } from '../utils/update-state';
import { CHANGELOG_URL } from '../utils/analytics/constants';

export const UPDATE_CHECK_ALARM = 'cqd-update-check';
const ALARM_PERIOD_MINUTES = 720;
const MIN_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

const SIZE_KEYS = [16, 32, 48, 96, 128] as const;

function buildDotPaths(dir: string): Record<number, string> {
  const map: Record<number, string> = {};
  for (const size of SIZE_KEYS) map[size] = `icon/${dir}/${size}.png`;
  return map;
}

export const DOT_COLOR_PATHS = buildDotPaths('dot');
export const DOT_GRAY_PATHS = buildDotPaths('dot-gray');

export interface UpdateDotDeps {
  fetchImpl?: (url: string) => Promise<Response>;
  now?: () => number;
}

export interface UpdateDotController {
  checkNow(force?: boolean): Promise<void>;
  evaluate(): Promise<void>;
  onAlarm(name: string): Promise<void>;
  onStorageChanged(key: string): Promise<void>;
  onInstalled(details: { reason?: string; previousVersion?: string }): Promise<void>;
  onRuntimeUpdateAvailable(version?: string): Promise<void>;
}

function storageAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local?.get;
}

async function readSeen(): Promise<SeenVersions> {
  if (!storageAvailable()) return {};
  const got = await chrome.storage.local.get(CHANGELOG_SEEN_KEY);
  const raw = got?.[CHANGELOG_SEEN_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as SeenVersions;
}

async function readState(): Promise<UpdateState | null> {
  if (!storageAvailable()) return null;
  const got = await chrome.storage.local.get(UPDATE_STATE_KEY);
  const raw = got?.[UPDATE_STATE_KEY] as UpdateState | undefined;
  if (!raw || typeof raw.checkedAt !== 'number') return null;
  if (typeof raw.latestVersion !== 'string' && raw.latestVersion !== null) return null;
  // v1 states predate the pending fields; normalize on read.
  return {
    ...raw,
    pendingVersion: typeof raw.pendingVersion === 'string' ? raw.pendingVersion : null,
    pendingReason: (raw.pendingReason ?? null) as UpdateReason | null,
  };
}

function installedVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return '';
  }
}

export function createUpdateDotController(deps: UpdateDotDeps = {}): UpdateDotController {
  const fetchImpl = deps.fetchImpl ?? ((url: string) => fetch(url));
  const now = deps.now ?? (() => Date.now());

  const evaluate = async (): Promise<void> => {
    try {
      const [state, seen] = await Promise.all([readState(), readSeen()]);
      const target = updateTarget({
        pendingVersion: state?.pendingVersion ?? null,
        latestVersion: state?.latestVersion ?? null,
        installedVersion: installedVersion(),
        seenVersions: seen,
      });
      setIconDecorationPaths(target.version ? { color: DOT_COLOR_PATHS, gray: DOT_GRAY_PATHS } : null);
      repaintAllTabIcons();
    } catch {
      // Storage unavailable or failing — the dot keeps its previous state.
    }
  };

  /** Merges a pending version into the stored state and re-evaluates. */
  const setPending = async (version: string, reason: UpdateReason): Promise<void> => {
    const state = await readState();
    const next: UpdateState = {
      latestVersion: state?.latestVersion ?? null,
      checkedAt: state?.checkedAt ?? 0,
      pendingVersion: version,
      pendingReason: reason,
    };
    await chrome.storage.local.set({ [UPDATE_STATE_KEY]: next });
    await evaluate();
  };

  const checkNow = async (force = false): Promise<void> => {
    if (!storageAvailable() || !CHANGELOG_URL) return;
    try {
      const state = await readState();
      if (!force && state && now() - state.checkedAt < MIN_CHECK_INTERVAL_MS) return;
      let latest: string | null;
      try {
        const resp = await fetchImpl(CHANGELOG_URL);
        if (!resp.ok) return;
        const json = (await resp.json()) as {
          ok?: boolean;
          entries?: Array<{ version?: string }>;
        };
        if (!json?.ok || !Array.isArray(json.entries)) return;
        latest = latestVersionFrom(json.entries);
      } catch {
        return; // keep the previous state; the next wake retries
      }
      const next: UpdateState = {
        ...(state ?? { pendingVersion: null, pendingReason: null }),
        latestVersion: latest,
        checkedAt: now(),
      };
      await chrome.storage.local.set({ [UPDATE_STATE_KEY]: next });
      await evaluate();
    } catch {
      // Storage failing must never reject into the service worker void.
      return;
    }
  };

  return {
    checkNow,
    evaluate,
    onAlarm(name: string): Promise<void> {
      if (name !== UPDATE_CHECK_ALARM) return Promise.resolve();
      return checkNow();
    },
    onStorageChanged(key: string): Promise<void> {
      if (key !== CHANGELOG_SEEN_KEY) return Promise.resolve();
      return evaluate();
    },
    onInstalled(details): Promise<void> {
      // "install" is a fresh start (no prior version to celebrate);
      // "update" means the browser just moved us to a new version.
      if (details?.reason !== 'update') return Promise.resolve();
      return setPending(installedVersion(), 'updated').catch(() => undefined);
    },
    onRuntimeUpdateAvailable(version?: string): Promise<void> {
      if (!version) return Promise.resolve();
      return setPending(version, 'scheduled').catch(() => undefined);
    },
  };
}

export function ensureUpdateCheckAlarm(): void {
  if (typeof chrome === 'undefined' || !chrome.alarms?.create) return;
  chrome.alarms.create(UPDATE_CHECK_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: ALARM_PERIOD_MINUTES,
  });
}
