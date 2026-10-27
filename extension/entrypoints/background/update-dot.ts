// filepath: extension/entrypoints/background/update-dot.ts
/**
 * Update-available dot (bead 08fg.3). The worker's live GET /changelog is
 * the only source that can know about a version newer than the installed
 * bundle — the bundled changelog ships with the release. Checks are
 * staleness-gated to at most one fetch per 12h and run on service-worker
 * start plus a 12h alarm. Dismissal rides the existing changelog seen map,
 * so opening the changelog for the latest version clears the dot.
 */

import {
  latestVersionFrom,
  shouldShowDot,
  type SeenVersions,
} from '../../src/update/update-state';
import { repaintAllTabIcons, setIconDecorationPaths } from './icon-manager';
import { CHANGELOG_SEEN_KEY } from '../utils/update-state';
import { UPDATE_STATE_KEY, type UpdateState } from '../utils/update-state';
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
  return raw;
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
      const show = shouldShowDot({
        latestVersion: state?.latestVersion ?? null,
        installedVersion: installedVersion(),
        seenVersions: seen,
      });
      setIconDecorationPaths(show ? { color: DOT_COLOR_PATHS, gray: DOT_GRAY_PATHS } : null);
      repaintAllTabIcons();
    } catch {
      // Storage unavailable or failing — the dot keeps its previous state.
    }
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
      const next: UpdateState = { latestVersion: latest, checkedAt: now() };
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
  };
}

export function ensureUpdateCheckAlarm(): void {
  if (typeof chrome === 'undefined' || !chrome.alarms?.create) return;
  chrome.alarms.create(UPDATE_CHECK_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: ALARM_PERIOD_MINUTES,
  });
}
