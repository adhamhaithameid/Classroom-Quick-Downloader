import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { WebsiteSnapshot, WebsiteSnapshotFetchResult } from '$lib/types/public';

vi.mock('$lib/api/publicSite', () => ({
  ORACLE_SNAPSHOT_REFRESH_MS: 6 * 60 * 60 * 1000,
  fetchWebsiteSnapshotResult: vi.fn()
}));

import { ORACLE_SNAPSHOT_REFRESH_MS, fetchWebsiteSnapshotResult } from '$lib/api/publicSite';
import {
  refreshWebsiteSnapshotStore,
  resetWebsiteSnapshotStoreForTests,
  websiteSnapshotStore
} from './websiteSnapshot';

const mockedFetchSnapshotResult = vi.mocked(fetchWebsiteSnapshotResult);

function createMockSnapshot(downloads = 120): WebsiteSnapshot {
  const now = Date.now();
  return {
    source: 'oracle',
    snapshotId: `snapshot-${downloads}`,
    generatedAt: now - 1_000,
    fetchedAtUtc: now,
    nextRefreshAtUtc: now + 60_000,
    overview: {
      schemaVersion: '1',
      ok: true,
      generatedAt: now - 1_000,
      totals: {
        downloads,
        success: Math.max(0, downloads - 1),
        fail: 1
      },
      installs: {
        usersTotal: downloads,
        lastSyncedAtUtc: now - 1_000,
        browsers: []
      },
      versions: {
        github: '1.0.0',
        chrome: '1.0.0',
        firefox: '1.0.0',
        edge: '1.0.0'
      },
      status: {
        systemLive: true,
        liveSinceUtc: now - 86_400_000,
        workerHealth: 'up'
      },
      links: {
        chrome: 'https://example.com/chrome',
        firefox: 'https://example.com/firefox',
        edge: 'https://example.com/edge',
        github: 'https://github.com/example/repo'
      }
    },
    map: {
      schemaVersion: '1',
      ok: true,
      generatedAt: now - 1_000,
      granularity: 'country',
      countries: [{ countryCode: 'US', count: downloads }],
      totals: { countries: 1, downloads },
      privacyNote: 'Country-level only'
    },
    changelog: {
      schemaVersion: '1',
      ok: true,
      generatedAt: now - 1_000,
      headline: 'Latest updates',
      description: 'Summary',
      entries: [],
      fullChangelogUrl: 'https://example.com/changelog',
      lastUpdatedAtUtc: now - 1_000
    },
    userChangelogSummary: {
      headline: 'Latest updates',
      description: 'Summary',
      entriesCount: 0,
      lastUpdatedAtUtc: now - 1_000,
      fullChangelogUrl: 'https://example.com/changelog'
    },
    privacy: {
      headline: 'Privacy',
      description: 'Summary',
      userPrivacyUrl: 'https://example.com/privacy',
      fullPrivacyUrl: 'https://example.com/privacy/full'
    }
  };
}

function createSuccessResult(snapshot: WebsiteSnapshot): WebsiteSnapshotFetchResult {
  return {
    snapshot,
    source: 'oracle',
    degraded: false,
    stale: false,
    errorMessage: null
  };
}

describe('websiteSnapshotStore', () => {
  beforeEach(() => {
    resetWebsiteSnapshotStoreForTests();
    mockedFetchSnapshotResult.mockReset();
  });

  it('stores a ready snapshot state after a successful refresh', async () => {
    const snapshot = createMockSnapshot(200);
    mockedFetchSnapshotResult.mockResolvedValueOnce(createSuccessResult(snapshot));

    await refreshWebsiteSnapshotStore({ force: true });

    const state = get(websiteSnapshotStore);
    expect(state.status).toBe('ready');
    expect(state.snapshot?.overview.totals.downloads).toBe(200);
    expect(state.degraded).toBe(false);
    expect(state.errorMessage).toBeNull();
  });

  it('derives the snapshot refresh window from ORACLE_SNAPSHOT_REFRESH_MS (6h)', async () => {
    const now = Date.now();
    const snapshot = createMockSnapshot(300);
    snapshot.fetchedAtUtc = now;
    snapshot.nextRefreshAtUtc = now + ORACLE_SNAPSHOT_REFRESH_MS;
    mockedFetchSnapshotResult.mockResolvedValueOnce(createSuccessResult(snapshot));

    await refreshWebsiteSnapshotStore({ force: true });

    const state = get(websiteSnapshotStore);
    expect(ORACLE_SNAPSHOT_REFRESH_MS).toBe(6 * 60 * 60 * 1000);
    const { snapshot: ready } = state;
    if (!ready) throw new Error('Expected a ready snapshot after forced refresh');
    expect(ready.nextRefreshAtUtc - ready.fetchedAtUtc).toBe(6 * 60 * 60 * 1000);
  });

  it('pins the production ORACLE_SNAPSHOT_REFRESH_MS to 6 hours', async () => {
    const actual = await vi.importActual<typeof import('$lib/api/publicSite')>('$lib/api/publicSite');
    expect(actual.ORACLE_SNAPSHOT_REFRESH_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('switches to degraded state and keeps last snapshot when refresh fails', async () => {
    const snapshot = createMockSnapshot(250);
    mockedFetchSnapshotResult.mockResolvedValueOnce(createSuccessResult(snapshot));
    await refreshWebsiteSnapshotStore({ force: true });

    mockedFetchSnapshotResult.mockRejectedValueOnce(new Error('Oracle unreachable'));
    await refreshWebsiteSnapshotStore({ force: true });

    const state = get(websiteSnapshotStore);
    expect(state.status).toBe('degraded');
    expect(state.degraded).toBe(true);
    expect(state.snapshot?.overview.totals.downloads).toBe(250);
    expect(state.errorMessage).toContain('Oracle unreachable');
  });
});
