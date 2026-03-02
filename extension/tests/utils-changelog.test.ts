import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangelogConfig } from '../entrypoints/utils/changelog';

async function loadChangelogModule(changeLogUrl = 'https://worker.example/changelog') {
  vi.resetModules();
  vi.doMock('../entrypoints/utils/analytics/constants', () => ({
    CHANGELOG_URL: changeLogUrl,
  }));
  vi.doMock('../entrypoints/utils/analytics/detection', () => ({
    getExtensionVersion: vi.fn(() => '1.3.0'),
  }));
  return import('../entrypoints/utils/changelog');
}

describe('changelog utils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    chrome.storage.local.get = vi.fn(async () => ({})) as never;
    chrome.storage.local.set = vi.fn(async () => {}) as never;
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns cached changelog when cache is still valid and force=false', async () => {
    const mod = await loadChangelogModule();
    const cached = {
      entries: [{ id: '1', version: '1.3.0', date: '2026-01-01', changes: ['A'] }],
      config: { rules: [] },
      lastFetched: Date.now() + 1,
    };
    chrome.storage.local.get = vi.fn(async () => ({ cqd_changelog_v1: cached })) as never;
    const result = await mod.fetchChangelog(false);
    expect(result?.entries[0]?.id).toBe('1');
    expect(result?.entries[0]?.version).toBe('1.3.0');
    expect(result?.revisionToken).toBeTruthy();
    expect(result?.lastFetched).toBe(cached.lastFetched);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to cache/null when changelog URL is empty', async () => {
    const mod = await loadChangelogModule('');
    const cached = {
      entries: [{ id: 'c1', version: '1.2.0', date: '2025-01-01', changes: ['Old'] }],
      config: { rules: [] },
      lastFetched: Date.now(),
    };
    chrome.storage.local.get = vi.fn(async () => ({ cqd_changelog_v1: cached })) as never;
    const result = await mod.fetchChangelog();
    expect(result?.entries[0]?.id).toBe('c1');
    expect(result?.revisionToken).toBeTruthy();
  });

  it('fetches, validates, and stores changelog payload from network', async () => {
    const mod = await loadChangelogModule();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      entries: [{ id: 'n1', version: '1.3.0', date: '2026-02-10', changes: ['Fixes'] }],
      config: { rules: [{ id: 'r1', target: 'all', priority: 'normal', effect: 'none' }] },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await mod.fetchChangelog(true);
    expect(result?.entries[0]?.id).toBe('n1');
    expect(fetch).toHaveBeenCalled();
    const [calledUrl, calledInit] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('https://worker.example/changelog');
    expect(calledUrl).toContain('_=');
    expect(calledInit.cache).toBe('no-store');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('returns cached data when network fetch fails', async () => {
    const mod = await loadChangelogModule();
    const cached = {
      entries: [{ id: 'c2', version: '1.2.1', date: '2025-02-01', changes: ['Cached'] }],
      config: { rules: [] },
      lastFetched: 1,
    };
    chrome.storage.local.get = vi.fn(async () => ({ cqd_changelog_v1: cached })) as never;
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    const result = await mod.fetchChangelog(true);
    expect(result?.entries[0]?.id).toBe('c2');
    expect(result?.revisionToken).toBeTruthy();
  });

  it('handles latest change extraction and seen version tracking', async () => {
    const mod = await loadChangelogModule();
    expect(mod.getLatestChange(null)).toBeNull();
    expect(mod.getLatestChange({ entries: [], config: { rules: [] }, lastFetched: Date.now() })).toBeNull();
    expect(mod.getLatestChange({
      entries: [{ id: 'x', version: '1.0.0', date: '2026-01-01', changes: ['First change'] }],
      config: { rules: [] },
      lastFetched: Date.now(),
    })).toBe('First change');

    chrome.storage.local.get = vi.fn(async () => ({ cqd_changelog_seen_v1: ['1.0.0'] })) as never;
    await mod.markAsSeen('1.1.0');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ cqd_changelog_seen_v1: ['1.0.0', '1.1.0'] });
    expect(await mod.isVersionSeen('1.0.0')).toBe(true);
    expect(await mod.isVersionSeen('2.0.0')).toBe(false);
    expect(await mod.isVersionSeen('')).toBe(false);
  });

  it('matches notification rules', async () => {
    const mod = await loadChangelogModule();
    const cfg: ChangelogConfig = {
      rules: [
        { id: 'r1', target: '1.3.0', priority: 'major', effect: 'pulse' as const },
        { id: 'r2', target: 'all', priority: 'minor', effect: 'glow' as const },
      ],
    };
    expect(mod.getMatchingRule(cfg, '1.3.0')?.id).toBe('r1');
    expect(mod.getMatchingRule(cfg, '9.9.9')?.id).toBe('r2');
    expect(mod.getMatchingRule(undefined, '1.0.0')).toBeNull();
  });

  describe('getRuleClasses', () => {
    it('returns empty string if rule is null', async () => {
      const mod = await loadChangelogModule();
      expect(mod.getRuleClasses(null, false)).toBe('');
      expect(mod.getRuleClasses(null, true)).toBe('');
    });

    it('returns empty string if seen is true', async () => {
      const mod = await loadChangelogModule();
      const rule = { id: 'r', target: 'all', priority: 'major' as const, effect: 'pulse' as const };
      expect(mod.getRuleClasses(rule, true)).toBe('');
    });

    it('adds priority classes correctly', async () => {
      const mod = await loadChangelogModule();
      const base = { id: 'r', target: 'all', effect: 'none' as const };

      expect(mod.getRuleClasses({ ...base, priority: 'minor' }, false)).toContain('cqd-pill-minor');
      expect(mod.getRuleClasses({ ...base, priority: 'major' }, false)).toContain('cqd-pill-major');

      const normalClasses = mod.getRuleClasses({ ...base, priority: 'normal' }, false);
      expect(normalClasses).not.toContain('cqd-pill-minor');
      expect(normalClasses).not.toContain('cqd-pill-major');
    });

    it('adds glow effect classes with correct colors', async () => {
      const mod = await loadChangelogModule();
      const base = { id: 'r', target: 'all', effect: 'glow' as const };

      // Major -> Red
      expect(mod.getRuleClasses({ ...base, priority: 'major' }, false)).toContain('cqd-effect-glow-red');

      // Minor/Normal -> Blue
      expect(mod.getRuleClasses({ ...base, priority: 'minor' }, false)).toContain('cqd-effect-glow-blue');
      expect(mod.getRuleClasses({ ...base, priority: 'normal' }, false)).toContain('cqd-effect-glow-blue');
    });

    it('adds pulse effect classes with correct colors', async () => {
      const mod = await loadChangelogModule();
      const base = { id: 'r', target: 'all', effect: 'pulse' as const };

      // Major -> Red
      expect(mod.getRuleClasses({ ...base, priority: 'major' }, false)).toContain('cqd-effect-pulse-red');

      // Minor/Normal -> Blue
      expect(mod.getRuleClasses({ ...base, priority: 'minor' }, false)).toContain('cqd-effect-pulse-blue');
      expect(mod.getRuleClasses({ ...base, priority: 'normal' }, false)).toContain('cqd-effect-pulse-blue');
    });

    it('handles combinations of priority and effect', async () => {
      const mod = await loadChangelogModule();
      const res = mod.getRuleClasses({ id: 'r', target: 'all', priority: 'minor', effect: 'glow' }, false);
      expect(res).toContain('cqd-pill-minor');
      expect(res).toContain('cqd-effect-glow-blue');

      const res2 = mod.getRuleClasses({ id: 'r', target: 'all', priority: 'major', effect: 'pulse' }, false);
      expect(res2).toContain('cqd-pill-major');
      expect(res2).toContain('cqd-effect-pulse-red');
    });
  });
});
