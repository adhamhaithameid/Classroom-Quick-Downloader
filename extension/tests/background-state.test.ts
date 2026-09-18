import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingDownload } from '../entrypoints/background/types';

function makePending(overrides: Partial<PendingDownload> = {}): PendingDownload {
  return {
    requestId: 'req-state-test',
    startTime: Date.now(),
    originalUrl: 'https://example.com/file.pdf',
    baseUrl: 'https://example.com/file.pdf',
    isDrive: false,
    attemptedAuthUsers: [],
    isCancelled: false,
    ...overrides,
  };
}

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function restoreNavigator() {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
  }
}

async function loadStateModuleWithNavigator(userAgent?: string) {
  vi.resetModules();
  if (typeof userAgent === 'string') {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent },
      configurable: true,
    });
  } else {
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      configurable: true,
    });
  }
  return import('../entrypoints/background/state');
}

describe('background state module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    restoreNavigator();
  });

  it('initializes all pending maps and sets', async () => {
    const state = await loadStateModuleWithNavigator('Mozilla/5.0 Chrome/120');
    expect(state.pendingByRequestId).toBeInstanceOf(Map);
    expect(state.pendingByDownloadId).toBeInstanceOf(Map);
    expect(state.pendingByUrl).toBeInstanceOf(Map);
    expect(state.cancelledByUs).toBeInstanceOf(Set);
    expect(state.recentDownloads).toBeInstanceOf(Map);
  });

  it('exports expected constants and classroom URL pattern', async () => {
    const state = await loadStateModuleWithNavigator('Mozilla/5.0 Chrome/120');
    expect(state.AUTHUSER_CANDIDATES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(state.PENDING_DOWNLOAD_TTL_MS).toBe(10 * 60 * 1000);
    expect(state.CLEANUP_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(state.CLASSROOM_URL_PATTERN.test('https://classroom.google.com/u/0/h')).toBe(true);
    expect(state.CLASSROOM_URL_PATTERN.test('https://example.com')).toBe(false);
  });

  it('detects Firefox user agent at module load', async () => {
    const state = await loadStateModuleWithNavigator('Mozilla/5.0 Firefox/123');
    expect(state.IS_FIREFOX).toBe(true);
  });

  it('handles missing navigator safely', async () => {
    const state = await loadStateModuleWithNavigator();
    expect(state.IS_FIREFOX).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pendingByUrlAdd
  // ─────────────────────────────────────────────────────────────────────────

  describe('pendingByUrlAdd', () => {
    it('creates a new bucket and adds the pending', async () => {
      const { pendingByUrl, pendingByUrlAdd } = await loadStateModuleWithNavigator('Chrome/120');
      const p = makePending();
      pendingByUrlAdd('https://example.com/a.pdf', p);
      expect(pendingByUrl.get('https://example.com/a.pdf')?.has(p)).toBe(true);
    });

    it('adds to an existing bucket without replacing it', async () => {
      const { pendingByUrlAdd, pendingByUrl } = await loadStateModuleWithNavigator('Chrome/120');
      const p1 = makePending({ requestId: 'req-1' });
      const p2 = makePending({ requestId: 'req-2' });
      pendingByUrlAdd('https://example.com/shared.pdf', p1);
      pendingByUrlAdd('https://example.com/shared.pdf', p2);
      const bucket = pendingByUrl.get('https://example.com/shared.pdf')!;
      expect(bucket.has(p1)).toBe(true);
      expect(bucket.has(p2)).toBe(true);
      expect(bucket.size).toBe(2);
    });

    it('allows same pending registered under multiple URLs', async () => {
      const { pendingByUrlAdd, pendingByUrl } = await loadStateModuleWithNavigator('Chrome/120');
      const p = makePending();
      pendingByUrlAdd('https://example.com/original.pdf', p);
      pendingByUrlAdd('https://bypass.example.com/file', p);
      expect(pendingByUrl.get('https://example.com/original.pdf')?.has(p)).toBe(true);
      expect(pendingByUrl.get('https://bypass.example.com/file')?.has(p)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pendingByUrlRemove
  // ─────────────────────────────────────────────────────────────────────────

  describe('pendingByUrlRemove', () => {
    it('removes pending from its URL bucket and deletes the key when bucket is empty', async () => {
      const { pendingByUrlAdd, pendingByUrlRemove, pendingByUrl } = await loadStateModuleWithNavigator('Chrome/120');
      const p = makePending();
      pendingByUrlAdd('https://example.com/a.pdf', p);
      pendingByUrlRemove(p);
      expect(pendingByUrl.has('https://example.com/a.pdf')).toBe(false);
    });

    it('leaves other pendings in the bucket when removing one of many', async () => {
      const { pendingByUrlAdd, pendingByUrlRemove, pendingByUrl } = await loadStateModuleWithNavigator('Chrome/120');
      const p1 = makePending({ requestId: 'req-1' });
      const p2 = makePending({ requestId: 'req-2' });
      pendingByUrlAdd('https://example.com/shared.pdf', p1);
      pendingByUrlAdd('https://example.com/shared.pdf', p2);
      pendingByUrlRemove(p1);
      const bucket = pendingByUrl.get('https://example.com/shared.pdf')!;
      expect(bucket.has(p1)).toBe(false);
      expect(bucket.has(p2)).toBe(true);
    });

    it('removes pending from ALL URL buckets it was registered under', async () => {
      const { pendingByUrlAdd, pendingByUrlRemove, pendingByUrl } = await loadStateModuleWithNavigator('Chrome/120');
      const p = makePending();
      pendingByUrlAdd('https://example.com/original.pdf', p);
      pendingByUrlAdd('https://bypass.example.com/file', p);
      pendingByUrlRemove(p);
      expect(pendingByUrl.has('https://example.com/original.pdf')).toBe(false);
      expect(pendingByUrl.has('https://bypass.example.com/file')).toBe(false);
    });

    it('does nothing for a pending not in any bucket', async () => {
      const { pendingByUrlRemove, pendingByUrl } = await loadStateModuleWithNavigator('Chrome/120');
      const p = makePending();
      expect(() => pendingByUrlRemove(p)).not.toThrow();
      expect(pendingByUrl.size).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // pendingByUrlGet
  // ─────────────────────────────────────────────────────────────────────────

  describe('pendingByUrlGet', () => {
    it('returns undefined for unknown URL', async () => {
      const { pendingByUrlGet } = await loadStateModuleWithNavigator('Chrome/120');
      expect(pendingByUrlGet('https://unknown.com/file.pdf')).toBeUndefined();
    });

    it('returns the pending when bucket has one entry with no download ID', async () => {
      const { pendingByUrlAdd, pendingByUrlGet } = await loadStateModuleWithNavigator('Chrome/120');
      const p = makePending();
      pendingByUrlAdd('https://example.com/a.pdf', p);
      expect(pendingByUrlGet('https://example.com/a.pdf')).toBe(p);
    });

    it('prefers entry without download ID over entry that has one', async () => {
      const { pendingByUrlAdd, pendingByUrlGet } = await loadStateModuleWithNavigator('Chrome/120');
      const withId = makePending({ requestId: 'req-with-id', currentDownloadId: 42 });
      const withoutId = makePending({ requestId: 'req-without-id' });
      pendingByUrlAdd('https://example.com/shared.pdf', withId);
      pendingByUrlAdd('https://example.com/shared.pdf', withoutId);
      expect(pendingByUrlGet('https://example.com/shared.pdf')).toBe(withoutId);
    });

    it('returns undefined when ALL entries in the bucket already have download IDs', async () => {
      const { pendingByUrlAdd, pendingByUrlGet } = await loadStateModuleWithNavigator('Chrome/120');
      const p1 = makePending({ requestId: 'req-1', currentDownloadId: 10 });
      const p2 = makePending({ requestId: 'req-2', currentDownloadId: 11 });
      pendingByUrlAdd('https://example.com/shared.pdf', p1);
      pendingByUrlAdd('https://example.com/shared.pdf', p2);
      expect(pendingByUrlGet('https://example.com/shared.pdf')).toBeUndefined();
    });

    it('returns undefined after all pendings are removed from bucket', async () => {
      const { pendingByUrlAdd, pendingByUrlRemove, pendingByUrlGet } = await loadStateModuleWithNavigator('Chrome/120');
      const p = makePending();
      pendingByUrlAdd('https://example.com/a.pdf', p);
      pendingByUrlRemove(p);
      expect(pendingByUrlGet('https://example.com/a.pdf')).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D11 — single authoritative registry: pendingByRequestId owns the truth,
// the other maps are indexes maintained only through registry functions.
// ─────────────────────────────────────────────────────────────────────────

describe('D11 pending registry', () => {
  it('registers a pending in the authoritative map and the URL index', async () => {
    const { registerPending, pendingByRequestId, pendingByUrl, pendingByDownloadId } =
      await loadStateModuleWithNavigator('Chrome/120');
    const p = makePending({ requestId: 'reg-1' });
    registerPending(p);
    expect(pendingByRequestId.get('reg-1')).toBe(p);
    expect(pendingByUrl.get(p.baseUrl)?.has(p)).toBe(true);
    // Registering must not invent correlation keys that do not exist yet.
    expect(pendingByDownloadId.size).toBe(0);
  });

  it('binds a download id only for a pending that is still authoritative (the race)', async () => {
    const { registerPending, unregisterPending, bindDownloadId, getPendingByDownloadId, pendingByRequestId } =
      await loadStateModuleWithNavigator('Chrome/120');
    const p = makePending({ requestId: 'bind-1' });
    registerPending(p);
    expect(bindDownloadId(p, 101)).toBe(true);
    expect(getPendingByDownloadId(101)).toBe(p);
    expect(p.currentDownloadId).toBe(101);

    // TTL cleanup removed the authoritative entry; a late callback must not
    // resurrect a zombie index entry for it.
    unregisterPending(p);
    expect(pendingByRequestId.has('bind-1')).toBe(false);
    expect(bindDownloadId(p, 202)).toBe(false);
    expect(getPendingByDownloadId(202)).toBeUndefined();
  });

  it('keeps indexes consistent when unregistering (every index over one truth)', async () => {
    const {
      registerPending, bindDownloadId,
      unregisterPending, getPendingByDownloadId, pendingByRequestId,
      pendingByDownloadId, pendingByUrl,
    } = await loadStateModuleWithNavigator('Chrome/120');
    const p = makePending({ requestId: 'unreg-1', baseUrl: 'https://example.com/base.pdf' });
    registerPending(p);
    bindDownloadId(p, 55);

    unregisterPending(p);

    expect(pendingByRequestId.has('unreg-1')).toBe(false);
    expect(getPendingByDownloadId(55)).toBeUndefined();
    expect(pendingByDownloadId.size).toBe(0);
    expect(pendingByUrl.has('https://example.com/base.pdf')).toBe(false);
  });

  it('unbinds a single download id without dropping the pending (HTML intercept)', async () => {
    const { registerPending, bindDownloadId, unbindDownloadId, getPendingByDownloadId, pendingByRequestId } =
      await loadStateModuleWithNavigator('Chrome/120');
    const p = makePending({ requestId: 'unbind-1' });
    registerPending(p);
    bindDownloadId(p, 77);
    unbindDownloadId(77);
    expect(getPendingByDownloadId(77)).toBeUndefined();
    expect(pendingByRequestId.get('unbind-1')).toBe(p); // still tracked
  });

  it('refuses to bind a download id that is already correlated to another pending', async () => {
    const { registerPending, bindDownloadId, getPendingByDownloadId } =
      await loadStateModuleWithNavigator('Chrome/120');
    const p1 = makePending({ requestId: 'dup-1' });
    const p2 = makePending({ requestId: 'dup-2' });
    registerPending(p1);
    registerPending(p2);
    expect(bindDownloadId(p1, 900)).toBe(true);
    expect(bindDownloadId(p2, 900)).toBe(false); // the cross-claim guard
    expect(getPendingByDownloadId(900)).toBe(p1);
  });

  it('does not re-claim a bound pending via the URL index (same-URL concurrency)', async () => {
    const { registerPending, bindDownloadId, getUnclaimedPendingByUrl } =
      await loadStateModuleWithNavigator('Chrome/120');
    const p1 = makePending({ requestId: 'same-1' });
    const p2 = makePending({ requestId: 'same-2' });
    registerPending(p1);
    registerPending(p2);
    expect(getUnclaimedPendingByUrl(p1.baseUrl)).toBe(p1);
    bindDownloadId(p1, 11);
    expect(getUnclaimedPendingByUrl(p1.baseUrl)).toBe(p2);
    bindDownloadId(p2, 12);
    expect(getUnclaimedPendingByUrl(p1.baseUrl)).toBeUndefined();
  });

  it('answers registry membership and lookup queries from the authoritative map', async () => {
    const { registerPending, unregisterPending, isRegistered, getPendingByRequestId } =
      await loadStateModuleWithNavigator('Chrome/120');
    const p = makePending({ requestId: 'lookup-1' });
    expect(isRegistered('lookup-1')).toBe(false);
    expect(getPendingByRequestId('lookup-1')).toBeUndefined();
    registerPending(p);
    expect(isRegistered('lookup-1')).toBe(true);
    expect(getPendingByRequestId('lookup-1')).toBe(p);
    unregisterPending(p);
    expect(isRegistered('lookup-1')).toBe(false);
    expect(getPendingByRequestId('lookup-1')).toBeUndefined();
  });

  it('unregistering a pending that already lost authority leaves the registry alone', async () => {
    const { registerPending, unregisterPending, pendingByRequestId } =
      await loadStateModuleWithNavigator('Chrome/120');
    const keeper = makePending({ requestId: 'ghost-guard' });
    registerPending(keeper);
    const stale = makePending({ requestId: 'ghost-stale' });
    expect(() => unregisterPending(stale)).not.toThrow();
    expect(pendingByRequestId.get('ghost-guard')).toBe(keeper);
    expect(pendingByRequestId.has('ghost-stale')).toBe(false);
  });

  it('sweeps stale same-request download-id bindings when unregistering the authoritative pending', async () => {
    const { registerPending, bindDownloadId, unregisterPending, getPendingByDownloadId } =
      await loadStateModuleWithNavigator('Chrome/120');
    const first = makePending({ requestId: 'zombie-1' });
    registerPending(first);
    expect(bindDownloadId(first, 301)).toBe(true);
    const replacement = makePending({ requestId: 'zombie-1' });
    registerPending(replacement);
    expect(bindDownloadId(replacement, 302)).toBe(true);
    // An unrelated pending's binding must survive the same sweep untouched.
    const unrelated = makePending({ requestId: 'zombie-other' });
    registerPending(unrelated);
    expect(bindDownloadId(unrelated, 303)).toBe(true);

    unregisterPending(replacement);

    // The id bound to the replaced object shares the correlation id, so it
    // must be swept together with the authoritative one — no zombie bindings.
    expect(getPendingByDownloadId(301)).toBeUndefined();
    expect(getPendingByDownloadId(302)).toBeUndefined();
    expect(getPendingByDownloadId(303)).toBe(unrelated);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Stall deadline (no-dead-ends): every registered pending gets a hard
// deadline; the injected hook must fire only for pendings the authoritative
// registry still tracks.
// ─────────────────────────────────────────────────────────────────────────

describe('pending expiry deadline hook', () => {
  it('fires the injected hook when a pending is still registered at its deadline', async () => {
    vi.useFakeTimers();
    try {
      const state = await loadStateModuleWithNavigator('Chrome/120');
      const expired: string[] = [];
      state.setPendingExpiredHook((p) => expired.push(p.requestId));
      const p = makePending({ requestId: 'deadline-hit' });
      state.registerPending(p);
      vi.advanceTimersByTime(state.PENDING_DEADLINE_MS);
      expect(expired).toEqual(['deadline-hit']);
      // The hook decides the outcome; the registry itself is untouched.
      expect(state.isRegistered('deadline-hit')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not fire the hook for a pending the TTL sweep already reaped', async () => {
    vi.useFakeTimers();
    try {
      const state = await loadStateModuleWithNavigator('Chrome/120');
      const expired: string[] = [];
      state.setPendingExpiredHook((p) => expired.push(p.requestId));
      const p = makePending({ requestId: 'deadline-reaped' });
      state.registerPending(p);
      state.unregisterPending(p);
      vi.advanceTimersByTime(state.PENDING_DEADLINE_MS);
      expect(expired).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not fire the hook when the registry moved on to a different pending object', async () => {
    vi.useFakeTimers();
    try {
      const state = await loadStateModuleWithNavigator('Chrome/120');
      const expired: string[] = [];
      state.setPendingExpiredHook((p) => expired.push(p.requestId));
      const stale = makePending({ requestId: 'deadline-replaced' });
      state.registerPending(stale);
      // The authoritative entry was replaced (retry re-registered a fresh
      // object under the same correlation id); the stale deadline must no-op.
      const fresh = makePending({ requestId: 'deadline-replaced' });
      state.pendingByRequestId.set('deadline-replaced', fresh);
      vi.advanceTimersByTime(state.PENDING_DEADLINE_MS);
      expect(expired).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the hook when it is reset to null', async () => {
    vi.useFakeTimers();
    try {
      const state = await loadStateModuleWithNavigator('Chrome/120');
      const expired: string[] = [];
      state.setPendingExpiredHook((p) => expired.push(p.requestId));
      state.setPendingExpiredHook(null);
      const p = makePending({ requestId: 'deadline-cleared' });
      state.registerPending(p);
      vi.advanceTimersByTime(state.PENDING_DEADLINE_MS);
      expect(expired).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips deadline scheduling entirely when timers are unavailable', async () => {
    const state = await loadStateModuleWithNavigator('Chrome/120');
    vi.stubGlobal('setTimeout', undefined as unknown as typeof setTimeout);
    try {
      expect(() => state.registerPending(makePending({ requestId: 'deadline-no-timer' }))).not.toThrow();
      expect(state.isRegistered('deadline-no-timer')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
