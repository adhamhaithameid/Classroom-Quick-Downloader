/**
 * Fixture chrome — a globalThis.chrome the real popup can run against.
 *
 * Adapted from extension/tests/setup.ts (mockChrome) and extended into a
 * live store: callback + promise duality, storage.onChanged fan-out, and
 * runtime.sendMessage handlers that serve the current fixture. Production
 * code paths run unchanged against this surface (settings store, checksummed
 * stats record, queue/history messages).
 */

import { clearMilestonePending } from '../../../extension/src/history/download-stats';
import { firstRunFixture, type FixtureState } from './fixture-state';

type ChangeRecord = Record<string, { oldValue?: unknown; newValue: unknown }>;
type StorageListener = (changes: ChangeRecord, area: string) => void;
type FixtureListener = () => void;

let current: FixtureState = firstRunFixture();
const storageListeners = new Set<StorageListener>();
const fixtureListeners = new Set<FixtureListener>();

/** The fixture the simulated chrome currently serves. */
export function fixture(): FixtureState {
  return current;
}

/** Subscribe to fixture (non-storage) mutations, e.g. queue edits. */
export function subscribeFixture(listener: FixtureListener): () => void {
  fixtureListeners.add(listener);
  return () => fixtureListeners.delete(listener);
}

export function notifyFixtureChanged(): void {
  for (const listener of [...fixtureListeners]) listener();
}

function pickStorage(
  keys: string | string[] | Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const store = current.storage;
  if (keys === null || keys === undefined) return { ...store };
  if (typeof keys === 'string') {
    return keys in store ? { [keys]: store[keys] } : {};
  }
  const wanted = Array.isArray(keys) ? keys : Object.keys(keys);
  const out: Record<string, unknown> = {};
  for (const key of wanted) {
    if (key in store) out[key] = store[key];
  }
  return out;
}

function emitStorageChanges(items: Record<string, unknown>): void {
  const changes: ChangeRecord = {};
  for (const [key, value] of Object.entries(items)) {
    changes[key] = { newValue: value };
  }
  for (const listener of [...storageListeners]) listener(changes, 'local');
}

function respond<T>(cb: ((res: T) => void) | undefined, res: T): void {
  if (typeof cb === 'function') {
    queueMicrotask(() => cb(res));
  }
}

/**
 * The cached changelog the offline verdict serves: a ChangelogData-shaped
 * record for the installed version, so the overlay renders its entries with
 * the "Current" tag under the offline warn line (production's cache holds
 * the same shape in cqd_changelog_v1).
 */
function cachedChangelogData(): Record<string, unknown> {
  return {
    entries: [
      {
        id: 'sim-cached-1.9.1',
        version: '1.9.1',
        date: '2026-09-15T00:00:00.000Z',
        changes: ['Cached entry served while the changelog oracle is unreachable.'],
      },
    ],
    config: { rules: [] },
    revisionToken: 'sim-cache-1',
    lastFetched: Date.now() - 3_600_000,
  };
}

async function handleMessage(msg: { type?: string } & Record<string, unknown>): Promise<unknown> {
  switch (msg?.type) {
    case 'CQD_QUEUE_SNAPSHOT':
      return { ok: true, rows: current.queueRows, paused: current.queuePaused };
    case 'CQD_QUEUE_PAUSE':
      current.queuePaused = Boolean(msg.paused);
      notifyFixtureChanged();
      return { ok: true };
    case 'CQD_CANCEL_DOWNLOAD':
      current.queueRows = current.queueRows.filter((row) => row.requestId !== msg.requestId);
      notifyFixtureChanged();
      return { ok: true };
    case 'CQD_HISTORY_GET': {
      if (current.historyFails) return { ok: false };
      const query = String(msg.query ?? '').toLowerCase();
      const rows = query
        ? current.historyRows.filter((row) => row.filename.toLowerCase().includes(query))
        : current.historyRows;
      return { ok: true, rows };
    }
    case 'CQD_HISTORY_CLEAR':
      current.historyRows = [];
      notifyFixtureChanged();
      return { ok: true };
    case 'CQD_HISTORY_REDOWNLOAD':
      return { ok: true };
    // The real background clears the pending milestone on its serialized
    // chain. The simulator runs the REAL clear against the fixture record.
    case 'CQD_STATS_CLEAR_MILESTONE':
      await clearMilestonePending();
      return { ok: true };
    default:
      return { ok: false };
  }
}

/** Point the simulated chrome at a fresh fixture and expose it globally. */
export function installFixtureChrome(next: FixtureState): void {
  current = next;
  storageListeners.clear();

  const chromeMock = {
    storage: {
      local: {
        get(
          keys: string | string[] | Record<string, unknown> | null,
          cb?: (res: Record<string, unknown>) => void,
        ) {
          const res = pickStorage(keys);
          if (typeof cb === 'function') {
            queueMicrotask(() => cb(res));
            return;
          }
          return Promise.resolve(res);
        },
        set(items: Record<string, unknown>, cb?: () => void) {
          Object.assign(current.storage, items);
          emitStorageChanges(items);
          if (typeof cb === 'function') queueMicrotask(() => cb());
          return Promise.resolve();
        },
        remove(keys: string | string[], cb?: () => void) {
          const list = Array.isArray(keys) ? keys : [keys];
          for (const key of list) delete current.storage[key];
          if (typeof cb === 'function') queueMicrotask(() => cb());
          return Promise.resolve();
        },
      },
      onChanged: {
        addListener: (listener: StorageListener) => storageListeners.add(listener),
        removeListener: (listener: StorageListener) => storageListeners.delete(listener),
      },
    },
    runtime: {
      sendMessage(msg: { type?: string }, cb?: (res: unknown) => void) {
        void handleMessage(msg).then((res) => respond(cb, res));
      },
      getManifest() {
        return {
          version: current.version,
          oauth2: current.apiConfigured
            ? { client_id: 'simulator-client-id.apps.googleusercontent.com' }
            : undefined,
        };
      },
      onMessage: { addListener: () => {}, removeListener: () => {} },
      openOptionsPage(cb?: () => void) {
        respond(cb, undefined);
      },
      getURL(path: string) {
        return `chrome-extension://cqd-simulator/${path}`;
      },
      lastError: null as unknown,
    },
    tabs: {
      query(_query: unknown, cb?: (tabs: Array<{ id: number; url: string }>) => void) {
        respond(cb, [{ id: 7, url: current.tabUrl }]);
      },
      create(_options: unknown, cb?: () => void) {
        respond(cb, undefined);
      },
      sendMessage(_tabId: number, _msg: unknown, cb?: () => void) {
        respond(cb, undefined);
      },
      onUpdated: { addListener: () => {}, removeListener: () => {} },
      onActivated: { addListener: () => {}, removeListener: () => {} },
    },
    downloads: {
      download: () => {},
      cancel: (_id: number, cb?: () => void) => cb?.(),
      erase: (_filter: object, cb?: () => void) => cb?.(),
      onDeterminingFilename: { addListener: () => {} },
      onCreated: { addListener: () => {} },
      onChanged: { addListener: () => {} },
    },
    alarms: {
      create: () => {},
      clear: () => {},
      get: () => {},
      onAlarm: { addListener: () => {} },
    },
    action: { setIcon: () => {} },
    ...(current.apiConfigured
      ? {
          identity: {
            getAuthToken: (_opts: unknown, cb?: (token: string) => void) => cb?.('sim-token'),
          },
        }
      : {}),
  };

  (globalThis as { chrome?: unknown }).chrome = chromeMock;

  // The changelog seam (vite.config transform) consults this override on
  // every fetch. Reset it per fixture so 'real' behaves like production;
  // 'offline' answers the cache-fallback verdict with a cached entry.
  (globalThis as { __cqdChangelogOverride?: unknown }).__cqdChangelogOverride =
    current.changelog === 'fail'
      ? () => ({
          data: null,
          status: 'error',
          error: 'Simulator: the changelog fetch failed.',
        })
      : current.changelog === 'offline'
        ? () => ({
            data: cachedChangelogData(),
            status: 'cache-fallback',
            error: 'Simulator: Oracle unreachable — serving the cached changelog.',
          })
        : undefined;

  notifyFixtureChanged();
}
