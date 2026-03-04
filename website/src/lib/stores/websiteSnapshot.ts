import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import { fetchWebsiteSnapshotResult } from '$lib/api/publicSite';
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

let initRefCount = 0;
let refreshInFlight: Promise<WebsiteSnapshotStoreState> | null = null;
const SNAPSHOT_FORCE_APPLY_MAX_AGE_MS = 3 * 60 * 60 * 1000;

function nowUtc(): number {
  return Date.now();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Site snapshot is temporarily unavailable.';
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

export async function refreshWebsiteSnapshotStore(options: {
  force?: boolean;
  userInitiated?: boolean;
  applyToCurrentSession?: boolean;
} = {}): Promise<WebsiteSnapshotStoreState> {
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
      const result = await fetchWebsiteSnapshotResult({
        force: options.force === true,
        applyToCurrentSession: options.applyToCurrentSession === true
      });
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

export function initializeWebsiteSnapshotStore(): () => void {
  if (!browser) {
    return () => {};
  }

  initRefCount += 1;
  if (initRefCount === 1) {
    // 1) Hydrate from local snapshot instantly.
    // 2) Fetch latest snapshot in background.
    // 3) If current snapshot is old, apply immediately; otherwise keep session stable.
    void refreshWebsiteSnapshotStore({ force: false }).then((state) => {
      const snapshotAgeMs =
        typeof state.snapshot?.generatedAt === 'number' && state.snapshot.generatedAt > 0
          ? nowUtc() - state.snapshot.generatedAt
          : Number.POSITIVE_INFINITY;
      const applyFreshNow =
        !state.snapshot ||
        state.source === 'bootstrap-cache' ||
        snapshotAgeMs >= SNAPSHOT_FORCE_APPLY_MAX_AGE_MS;

      void refreshWebsiteSnapshotStore({
        force: true,
        applyToCurrentSession: applyFreshNow
      });
    });
  }

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    initRefCount = Math.max(0, initRefCount - 1);
  };
}

export function resetWebsiteSnapshotStoreForTests(): void {
  initRefCount = 0;
  refreshInFlight = null;
  snapshotStateStore.set(initialState);
}

export const websiteSnapshotStore = {
  subscribe: snapshotStateStore.subscribe
};
