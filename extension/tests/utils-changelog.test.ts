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
    expect(result).toEqual(cached);
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
    expect(await mod.fetchChangelog()).toEqual(cached);
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
    expect(await mod.fetchChangelog(true)).toEqual(cached);
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

  it('matches notification rules and computes css classes', async () => {
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

    expect(mod.getRuleClasses(null, false)).toBe('');
    expect(mod.getRuleClasses({ id: 'r', target: 'all', priority: 'minor', effect: 'none' }, true)).toBe('');
    expect(mod.getRuleClasses({ id: 'r', target: 'all', priority: 'minor', effect: 'glow' }, false)).toContain('cqd-effect-glow-blue');
    expect(mod.getRuleClasses({ id: 'r', target: 'all', priority: 'major', effect: 'pulse' }, false)).toContain('cqd-effect-pulse-red');
  });
});
