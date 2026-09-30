import { describe, expect, it } from 'vitest';
import { DownloadsDurable } from '../src/downloads_do';
import type { Env } from '../src/types';
import { TEST_DASHBOARD_PASSWORD, TEST_DANGER_PASSWORD, TEST_SHARED_SECRET } from './helpers/dummy-secrets';

// Direct unit coverage for the shared per-IP per-minute limiter that gates
// /track, /api/public/website/events, and the uninstall submit endpoint.
// With empty storage the constructor's load() builds the default state,
// including the empty rate-limit buckets the limiter mutates.

function makeDo(): { instance: DownloadsDurable; ready: Promise<void> } {
  const state = {
    storage: {
      get: async () => undefined,
      put: async () => undefined,
      delete: async () => undefined,
      deleteAll: async () => undefined,
      deleteAlarm: async () => undefined,
      setAlarm: async () => undefined,
      getAlarm: async () => null,
    },
  } as unknown as DurableObjectState;
  const env = {
    DO_SHARED_SECRET: TEST_SHARED_SECRET,
    DASHBOARD_PASSWORD: TEST_DASHBOARD_PASSWORD,
    DANGER_PASSWORD: TEST_DANGER_PASSWORD,
  } as unknown as Env;
  const instance = new DownloadsDurable(state, env);
  return { instance, ready: (instance as unknown as { loaded: Promise<void> }).loaded };
}

interface Limiter {
  checkWebsiteEventsRateLimit: (ip: string, now: number) => { allowed: boolean; retryAfterSec?: number };
  checkUninstallRateLimit: (ip: string, now: number) => { allowed: boolean; retryAfterSec?: number };
  checkTrackRateLimit: (ip: string, now: number) => { allowed: boolean; retryAfterSec?: number };
}

const BASE_MINUTE_MS = 1_700_000_000_000;

async function limiter(): Promise<Limiter> {
  const { instance, ready } = makeDo();
  await ready;
  return instance as unknown as Limiter;
}

describe('DO per-IP per-minute rate limiting', () => {
  it('allows requests up to the website events limit then returns retry window', async () => {
    const l = await limiter();
    const t0 = BASE_MINUTE_MS;
    for (let i = 0; i < 30; i++) {
      expect(l.checkWebsiteEventsRateLimit('1.2.3.4', t0).allowed).toBe(true);
    }
    const blocked = l.checkWebsiteEventsRateLimit('1.2.3.4', t0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('limits uninstall submissions to a small per-minute allowance', async () => {
    const l = await limiter();
    const t0 = BASE_MINUTE_MS;
    expect(l.checkUninstallRateLimit('2.3.4.5', t0).allowed).toBe(true);
    expect(l.checkUninstallRateLimit('2.3.4.5', t0).allowed).toBe(true);
    expect(l.checkUninstallRateLimit('2.3.4.5', t0).allowed).toBe(true);
    expect(l.checkUninstallRateLimit('2.3.4.5', t0).allowed).toBe(false);
  });

  it('keeps buckets independent per endpoint and per IP', async () => {
    const l = await limiter();
    const t0 = BASE_MINUTE_MS;
    for (let i = 0; i < 30; i++) {
      expect(l.checkWebsiteEventsRateLimit('5.6.7.8', t0).allowed).toBe(true);
    }
    // A different endpoint's bucket is untouched.
    expect(l.checkUninstallRateLimit('5.6.7.8', t0).allowed).toBe(true);
    expect(l.checkTrackRateLimit('5.6.7.8', t0).allowed).toBe(true);
    // A different IP shares neither bucket.
    expect(l.checkWebsiteEventsRateLimit('9.9.9.9', t0).allowed).toBe(true);
  });

  it('resets the window on the next minute boundary', async () => {
    const l = await limiter();
    const t0 = BASE_MINUTE_MS;
    for (let i = 0; i < 30; i++) {
      l.checkWebsiteEventsRateLimit('7.7.7.7', t0);
    }
    expect(l.checkWebsiteEventsRateLimit('7.7.7.7', t0).allowed).toBe(false);
    expect(l.checkWebsiteEventsRateLimit('7.7.7.7', t0 + 60_000).allowed).toBe(true);
  });

  it('prunes stale keys so the buckets cannot grow without bound', async () => {
    const { instance, ready } = makeDo();
    await ready;
    const l = instance as unknown as Limiter & {
      data: { websiteEventRates: Record<string, { count: number; minute: number }> };
    };
    // Track one IP that goes stale, then exceed the key cap with fresh IPs.
    l.checkWebsiteEventsRateLimit('stale.ip', BASE_MINUTE_MS);
    const later = BASE_MINUTE_MS + 30 * 60_000; // 30 minutes later: stale
    for (let i = 0; i < 5001; i++) {
      l.checkWebsiteEventsRateLimit(`10.0.0.${i % 256}-${i}`, later);
    }
    expect(Object.keys(l.data.websiteEventRates).includes('stale.ip')).toBe(false);
    expect(Object.keys(l.data.websiteEventRates).length).toBeLessThanOrEqual(5001);
  });
});
