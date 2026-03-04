import { describe, expect, it, vi } from 'vitest';

describe('utils/analytics re-exports', () => {
  it('re-exports runtime helpers from modular analytics index', async () => {
    vi.resetModules();
    const analytics = await import('../entrypoints/utils/analytics');
    expect(typeof analytics.recordDownloadEvent).toBe('function');
    expect(typeof analytics.refreshRemoteAnalyticsConfig).toBe('function');
    expect(typeof analytics.getCancelHoldDelayMs).toBe('function');
  });

  it('builds worker URLs from VITE_WORKER_URL env', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_WORKER_URL', 'https://worker.example/track');
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://example.com/cqd');
    const constants = await import('../entrypoints/utils/analytics/constants');
    expect(constants.WORKER_BASE_URL).toBe('https://worker.example');
    expect(constants.CONFIG_URL).toBe('https://worker.example/config');
    expect(constants.TRACK_URL).toBe('https://worker.example/track');
    expect(constants.WEBSITE_BASE_URL).toBe('https://example.com/cqd');
    expect(constants.CHANGELOG_SITE_URL).toBe('https://example.com/cqd/changelog');
    expect(constants.UNINSTALL_SITE_URL).toBe('https://example.com/cqd/uninstall');
    vi.unstubAllEnvs();
  });

  it('falls back to production worker URL when VITE_WORKER_URL is missing', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_WORKER_URL', '');
    const constants = await import('../entrypoints/utils/analytics/constants');
    expect(constants.WORKER_BASE_URL).toBe('https://cqd-analytics.adhamhaithameid.workers.dev');
    expect(constants.CONFIG_URL).toBe('https://cqd-analytics.adhamhaithameid.workers.dev/config');
    expect(constants.CHANGELOG_URL).toBe('https://cqd-analytics.adhamhaithameid.workers.dev/changelog');
    expect(constants.TRACK_URL).toBe('https://cqd-analytics.adhamhaithameid.workers.dev/track');
    vi.unstubAllEnvs();
  });

  it('falls back to manifest homepage url when site env is missing', async () => {
    vi.resetModules();
    vi.unstubAllEnvs();

    const runtimeRecord = chrome.runtime as unknown as Record<string, unknown>;
    const originalGetManifest = runtimeRecord.getManifest;
    runtimeRecord.getManifest = vi.fn(() => ({
      version: '1.3.0-test',
      homepage_url: 'https://manifest.example/site/',
    }));

    const constants = await import('../entrypoints/utils/analytics/constants');
    expect(constants.WEBSITE_BASE_URL).toBe('https://manifest.example/site');
    expect(constants.CHANGELOG_SITE_URL).toBe('https://manifest.example/site/changelog');
    expect(constants.UNINSTALL_SITE_URL).toBe('https://manifest.example/site/uninstall');

    runtimeRecord.getManifest = originalGetManifest;
  });
});
