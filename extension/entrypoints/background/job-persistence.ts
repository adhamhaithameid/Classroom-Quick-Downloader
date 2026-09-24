// filepath: extension/entrypoints/background/job-persistence.ts
/**
 * Durable mirror of the in-flight download registry (bead 0h4d.1.1).
 *
 * The authoritative registry lives in `state.ts` and is intentionally
 * dependency-free; this module attaches to it as a RegistryListener and
 * mirrors every register/bind/unregister into `chrome.storage.local` under
 * a single key. When the MV3 service worker is killed and restarted, the
 * in-memory maps are gone — `reconcilePersistedJobs()` reloads the records
 * on boot: downloads still in progress are rebound into the registry with
 * a fresh stall deadline; interrupted, missing, never-started, and stale
 * records are dropped honestly.
 *
 * Persistence is best-effort: every storage failure is logged and
 * swallowed. The in-memory registry remains the single source of truth.
 */

import type { PendingDownload } from './types';
import type { RegistryListener } from './state';
import {
  bindDownloadId,
  registerPending,
  PENDING_DOWNLOAD_TTL_MS,
} from './state';

const PENDING_JOBS_KEY = 'cqd_pending_jobs_v1';

type JobMap = Record<string, PendingDownload>;

type StorageLike = {
  get: (key: string, callback: (result: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>, callback?: () => void) => void;
};

type DownloadsLike = {
  search: (
    query: { id?: number },
    callback: (items: Array<{ id: number; state?: string }>) => void
  ) => void;
};

function storage(): StorageLike | null {
  const c = (globalThis as { chrome?: { storage?: { local?: StorageLike } } }).chrome;
  return c?.storage?.local ?? null;
}

function downloads(): DownloadsLike | null {
  const c = (globalThis as { chrome?: { downloads?: DownloadsLike } }).chrome;
  return c?.downloads ?? null;
}

function getJobs(): Promise<JobMap> {
  const s = storage();
  if (!s) return Promise.resolve({});
  return new Promise((resolve) => {
    try {
      s.get(PENDING_JOBS_KEY, (result) => {
        const raw = result?.[PENDING_JOBS_KEY];
        resolve(raw && typeof raw === 'object' ? (raw as JobMap) : {});
      });
    } catch (error) {
      console.warn('[cqd] job-persistence: read failed', error);
      resolve({});
    }
  });
}

function setJobs(jobs: JobMap): void {
  const s = storage();
  if (!s) return;
  try {
    s.set({ [PENDING_JOBS_KEY]: jobs }, () => {
      // best-effort: a quota or transient failure is logged, never thrown
      const err = (globalThis as { chrome?: { runtime?: { lastError?: { message?: string } } } }).chrome?.runtime?.lastError;
      if (err) console.warn('[cqd] job-persistence: write failed', err.message);
    });
  } catch (error) {
    console.warn('[cqd] job-persistence: write threw', error);
  }
}

/** RegistryListener mirroring registry mutations into storage. */
export function createStoragePersistence(): RegistryListener {
  let write: Promise<JobMap> = Promise.resolve({});
  const upsert = (pending: PendingDownload): void => {
    write = write
      .then((jobs) => {
        const next = { ...jobs, [pending.requestId]: pending };
        setJobs(next);
        return next;
      })
      .catch(() => ({}));
  };
  return {
    onRegister: upsert,
    onBind: upsert,
    onUnregister: (requestId) => {
      write = write
        .then((jobs) => {
          if (!(requestId in jobs)) return jobs;
          const next = { ...jobs };
          delete next[requestId];
          setJobs(next);
          return next;
        })
        .catch(() => ({}));
    },
  };
}

export type ReconcileDeps = {
  now?: () => number;
  search?: DownloadsLike['search'];
};

/**
 * Reload persisted job records after a worker restart and reconcile them
 * with the live browser download state. Safe to call at every boot.
 */
export async function reconcilePersistedJobs(deps: ReconcileDeps = {}): Promise<{
  rebound: number;
  dropped: number;
}> {
  const now = deps.now ?? Date.now;
  const dl = deps.search ? { search: deps.search } : downloads();
  const search = deps.search ?? dl?.search?.bind(dl);
  const jobs = await getJobs();
  let rebound = 0;
  let dropped = 0;

  for (const [requestId, pending] of Object.entries(jobs)) {
    if (!pending || typeof pending !== 'object' || !pending.requestId) {
      delete jobs[requestId];
      dropped += 1;
      continue;
    }
    if (now() - pending.startTime > PENDING_DOWNLOAD_TTL_MS) {
      delete jobs[requestId];
      dropped += 1;
      continue;
    }
    if (pending.currentDownloadId == null) {
      // Never started before the worker died; nothing to correlate.
      delete jobs[requestId];
      dropped += 1;
      continue;
    }
    const item = await new Promise<{ id: number; state?: string } | undefined>((resolve) => {
      if (!search) return resolve(undefined);
      try {
        search({ id: pending.currentDownloadId }, (items) => resolve(items?.[0]));
      } catch {
        resolve(undefined);
      }
    });
    if (item && item.state === 'in_progress') {
      registerPending(pending);
      bindDownloadId(pending, pending.currentDownloadId);
      rebound += 1;
    } else {
      // interrupted/complete (settled while dead) or no longer known.
      delete jobs[requestId];
      dropped += 1;
    }
  }

  setJobs(jobs);
  if (rebound + dropped > 0) {
    console.info(`[cqd] job-persistence: reconciled ${rebound} rebound, ${dropped} dropped`);
  }
  return { rebound, dropped };
}
