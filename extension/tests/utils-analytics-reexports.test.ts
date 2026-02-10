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
    const constants = await import('../entrypoints/utils/analytics/constants');
    expect(constants.WORKER_BASE_URL).toBe('https://worker.example');
    expect(constants.CONFIG_URL).toBe('https://worker.example/config');
    expect(constants.TRACK_URL).toBe('https://worker.example/track');
    vi.unstubAllEnvs();
  });
});
