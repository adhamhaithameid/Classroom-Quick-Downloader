import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangelogConfig } from '../entrypoints/utils/changelog';

async function loadChangelogModule() {
  vi.resetModules();
  return import('../entrypoints/utils/changelog');
}

describe('changelog utils (manual mode)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    chrome.storage.local.get = vi.fn(async () => ({})) as never;
    chrome.storage.local.set = vi.fn(async () => {}) as never;
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns manual changelog entries and expected fetch status', async () => {
    const mod = await loadChangelogModule();

    const passive = await mod.fetchChangelogDetailed(false);
    expect(passive.status).toBe('not-modified');
    expect(passive.data).toBeTruthy();
    expect(passive.data?.entries.length).toBeGreaterThan(0);
    expect(passive.data?.entries[0]?.version).toBe('1.3.9');

    const forced = await mod.fetchChangelogDetailed(true);
    expect(forced.status).toBe('fresh');
    expect(forced.data?.entries[0]?.id).toBe('manual-1.3.9-1');
  });

  it('does not perform network fetch in manual mode', async () => {
    const mod = await loadChangelogModule();
    await mod.fetchChangelog(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('persists robust cache envelope fields', async () => {
    const mod = await loadChangelogModule();

    await mod.fetchChangelog(true);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        cqd_changelog_v1: expect.objectContaining({
          schemaVersion: 2,
          cachedAt: expect.any(Number),
          lastSeenId: 'manual-1.3.9-1',
          cachedItems: expect.any(Array),
          cachedConfig: expect.objectContaining({
            rules: expect.arrayContaining([
              expect.objectContaining({ id: 'manual-pill-v137', target: '1.3.7', priority: 'major', effect: 'pulse' }),
              expect.objectContaining({ id: 'manual-pill-v138', target: '1.3.8', priority: 'major', effect: 'pulse' }),
            ]),
          }),
        }),
      }),
    );
  });

  it('handles latest change extraction and seen version tracking', async () => {
    const mod = await loadChangelogModule();
    const inMemoryStorage: Record<string, unknown> = {};
    chrome.storage.local.get = vi.fn(async (key?: string | string[] | Record<string, unknown>) => {
      if (typeof key === 'string') {
        return { [key]: inMemoryStorage[key] };
      }
      if (Array.isArray(key)) {
        return key.reduce<Record<string, unknown>>((acc, item) => {
          acc[item] = inMemoryStorage[item];
          return acc;
        }, {});
      }
      if (key && typeof key === 'object') {
        return Object.entries(key).reduce<Record<string, unknown>>((acc, [storageKey, fallback]) => {
          acc[storageKey] = storageKey in inMemoryStorage ? inMemoryStorage[storageKey] : fallback;
          return acc;
        }, {});
      }
      return { ...inMemoryStorage };
    }) as never;
    chrome.storage.local.set = vi.fn(async (next: Record<string, unknown>) => {
      Object.assign(inMemoryStorage, next);
    }) as never;

    const data = await mod.fetchChangelog(true);

    expect(mod.getLatestChange(null)).toBeNull();
    expect(mod.getLatestChange({ entries: [], config: { rules: [] }, revisionToken: 'rev-empty', lastFetched: Date.now() })).toBeNull();
    expect(mod.getLatestChange(data)).toContain('Summary:');

    await mod.markAsSeen('1.3.8', data);
    expect(await mod.isVersionSeen('1.3.8', data)).toBe(true);

    const changedRevision = data ? { ...data, revisionToken: `${data.revisionToken}-changed` } : data;
    expect(await mod.isVersionSeen('1.3.8', changedRevision)).toBe(false);
    expect(await mod.isVersionSeen('9.9.9', changedRevision)).toBe(false);
    expect(await mod.isVersionSeen('', changedRevision)).toBe(false);
  });

  it('matches notification rules in manual configuration', async () => {
    const mod = await loadChangelogModule();
    const cfg: ChangelogConfig = {
      rules: [
        { id: 'r1', target: 'v1.3.0', priority: 'major', effect: 'pulse' as const },
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
