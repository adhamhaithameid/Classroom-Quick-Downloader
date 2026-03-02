import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { fetchWebsiteSnapshotResult, ORACLE_SNAPSHOT_REFRESH_MS } from '$lib/api/publicSite';
import type { WebsiteSnapshotStoreState } from '$lib/types/public';

const initialState: WebsiteSnapshotStoreState = {
  status: 'idle',
  snapshot: null,
  source: null,
  degraded: false,
  stale: false,
  isRefreshing: false,
  errorMessage: null,
  lastUpdatedAtUtc: null,
  lastFailureAtUtc: null,
  lastUserRefreshAtUtc: null
};

const snapshotStateStore = writable<WebsiteSnapshotStoreState>(initialState);

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let initRefCount = 0;
let refreshInFlight: Promise<WebsiteSnapshotStoreState> | null = null;

function nowUtc(): number {
  return Date.now();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Live Oracle snapshot is temporarily unavailable.';
}

function updateState(next: Partial<WebsiteSnapshotStoreState>): WebsiteSnapshotStoreState {
  const current = get(snapshotStateStore);
  const updated: WebsiteSnapshotStoreState = {
    ...current,
    ...next
  };
  snapshotStateStore.set(updated);
  return updated;
}

function stopRefreshTimer(): void {
  if (!browser) return;
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function startRefreshTimer(intervalMs = ORACLE_SNAPSHOT_REFRESH_MS): void {
  if (!browser) return;
  stopRefreshTimer();
  const safeInterval = Math.max(60_000, Math.floor(intervalMs));
  refreshTimer = setInterval(() => {
    void refreshWebsiteSnapshotStore({ force: true });
  }, safeInterval);
}

export async function refreshWebsiteSnapshotStore(options: { force?: boolean; userInitiated?: boolean } = {}): Promise<WebsiteSnapshotStoreState> {
  if (refreshInFlight) return refreshInFlight;

  const current = get(snapshotStateStore);
  const isInitialLoad = !current.snapshot;
  const startingStatus = isInitialLoad ? 'loading' : 'refreshing';

  updateState({
    status: startingStatus,
    isRefreshing: true,
    errorMessage: current.status === 'degraded' ? current.errorMessage : null,
    ...(options.userInitiated ? { lastUserRefreshAtUtc: nowUtc() } : {})
  });

  const runner = (async () => {
    try {
      const result = await fetchWebsiteSnapshotResult({ force: options.force === true });
      return updateState({
        status: result.degraded ? 'degraded' : 'ready',
        snapshot: result.snapshot,
        source: result.source,
        degraded: result.degraded,
        stale: result.stale,
        isRefreshing: false,
        errorMessage: result.errorMessage,
        lastUpdatedAtUtc: nowUtc(),
        ...(result.degraded ? { lastFailureAtUtc: nowUtc() } : {})
      });
    } catch (error) {
      const message = toErrorMessage(error);
      const latest = get(snapshotStateStore);
      if (latest.snapshot) {
        return updateState({
          status: 'degraded',
          degraded: true,
          stale: true,
          isRefreshing: false,
          errorMessage: message,
          lastFailureAtUtc: nowUtc()
        });
      }
      return updateState({
        status: 'error',
        snapshot: null,
        source: null,
        degraded: false,
        stale: false,
        isRefreshing: false,
        errorMessage: message,
        lastFailureAtUtc: nowUtc()
      });
    } finally {
      refreshInFlight = null;
    }
  })();

  refreshInFlight = runner;
  return runner;
}

export function initializeWebsiteSnapshotStore(options: { autoRefreshMs?: number } = {}): () => void {
  if (!browser) {
    return () => {};
  }

  initRefCount += 1;
  if (initRefCount === 1) {
    void refreshWebsiteSnapshotStore();
    startRefreshTimer(options.autoRefreshMs ?? ORACLE_SNAPSHOT_REFRESH_MS);
  }

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    initRefCount = Math.max(0, initRefCount - 1);
    if (initRefCount === 0) {
      stopRefreshTimer();
    }
  };
}

export function resetWebsiteSnapshotStoreForTests(): void {
  stopRefreshTimer();
  initRefCount = 0;
  refreshInFlight = null;
  snapshotStateStore.set(initialState);
}

export const websiteSnapshotStore = {
  subscribe: snapshotStateStore.subscribe
};
