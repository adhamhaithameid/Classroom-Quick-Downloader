// filepath: extension/tests/contracts/ports-conformance.test.ts
/**
 * Port conformance — design goal G4: any implementation can be swapped
 * without touching callers. Every fake in tests/fakes must satisfy the same
 * contract the real adapters satisfy, and the fakes' behavior must be
 * predictable enough for roles to be unit-tested against them.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type {
  BrowserPort,
  ClockPort,
  DomPort,
  NetworkPort,
  SchedulerPort,
} from '../../src/contracts/ports';
import { createFakeClock } from '../fakes/fake-clock';
import { createFakeBrowserPort } from '../fakes/fake-browser-port';
import { createFakeIdentityBrowserPort } from '../fakes/fake-identity-browser-port';
import { createFakeDomPort } from '../fakes/fake-dom-port';
import { createFakeNetworkPort } from '../fakes/fake-network-port';
import { createFakeSchedulerPort } from '../fakes/fake-scheduler-port';
import { createSystemClock } from '../../src/adapters/clock/system-clock';
import { createIdleScheduler } from '../../src/adapters/scheduler/idle-scheduler';
import { createMutationObserverDomPort } from '../../src/adapters/dom/mutation-observer-dom-port';
import { withIdentityToken } from '../../src/adapters/identity/chrome-identity-token-port';

describe('ClockPort', () => {
  it('is satisfied by the fake and the system adapter', () => {
    const fake: ClockPort = createFakeClock(1000);
    // The system adapter is constructed, not called, so the test stays fast.
    const real: ClockPort = createSystemClock();
    expect(fake).toBeDefined();
    expect(real).toBeDefined();
  });

  it('fake clock fires timers only when advanced, in schedule order', () => {
    const clock = createFakeClock(0);
    const fired: string[] = [];
    clock.setTimeout(() => fired.push('a'), 100);
    clock.setTimeout(() => fired.push('b'), 200);

    clock.advance(99);
    expect(fired).toEqual([]);
    clock.advance(1);
    expect(fired).toEqual(['a']);
    clock.advance(100);
    expect(fired).toEqual(['a', 'b']);
  });

  it('fake clock clearTimeout prevents firing', () => {
    const clock = createFakeClock(0);
    const fired = vi.fn();
    const handle = clock.setTimeout(fired, 50);
    clock.clearTimeout(handle);
    clock.advance(100);
    expect(fired).not.toHaveBeenCalled();
  });

  it('fake clock now() tracks the advanced time', () => {
    const clock = createFakeClock(500);
    expect(clock.now()).toBe(500);
    clock.advance(25);
    expect(clock.now()).toBe(525);
  });
});

describe('SchedulerPort', () => {
  it('fake scheduler collects idle callbacks until flushed, in order', () => {
    const scheduler = createFakeSchedulerPort();
    const ran: number[] = [];
    scheduler.scheduleIdle(() => ran.push(1));
    scheduler.scheduleIdle(() => ran.push(2));
    expect(ran).toEqual([]);
    scheduler.flush();
    expect(ran).toEqual([1, 2]);
  });

  it('idle-scheduler adapter is satisfied as a SchedulerPort', () => {
    const scheduler: SchedulerPort = createIdleScheduler();
    expect(scheduler).toBeDefined();
  });
});

describe('DomPort', () => {
  it('fake dom port queries elements inside its document', () => {
    const port = createFakeDomPort();
    const el = port.document.createElement('div');
    el.className = 'target';
    port.document.body.appendChild(el);

    expect(port.querySelectorAll('.target')).toHaveLength(1);
    expect(port.querySelectorAll('.missing')).toHaveLength(0);
  });

  it('fake dom port delivers mutation records to observer callbacks', () => {
    const port = createFakeDomPort();
    const seen: MutationRecord[] = [];
    port.observe({ childList: true, subtree: true }, (mutations) => seen.push(...mutations));

    const el = port.document.createElement('span');
    port.document.body.appendChild(el);
    port.flushMutations();

    expect(seen.length).toBeGreaterThan(0);
  });

  it('MutationObserver adapter is satisfied as a DomPort over a real document', () => {
    const doc = document.implementation.createHTMLDocument('probe');
    const port: DomPort = createMutationObserverDomPort(doc);
    expect(port.querySelectorAll('body')).toHaveLength(1);
  });
});

describe('NetworkPort', () => {
  it('fake network port returns scripted responses in order', async () => {
    const port: NetworkPort = createFakeNetworkPort([
      { status: 200, body: 'first' },
      { status: 403, body: 'no' },
    ]);

    const first = await port.fetch('https://example.com/a');
    expect(first.status).toBe(200);
    expect(await first.text()).toBe('first');

    const second = await port.fetch('https://example.com/b');
    expect(second.status).toBe(403);
  });

  it('fake network port records requested urls', async () => {
    const port = createFakeNetworkPort([{ status: 200, body: '' }]);
    await port.fetch('https://example.com/x');
    expect(port.requestedUrls).toEqual(['https://example.com/x']);
  });
});

describe('BrowserPort', () => {
  it('fake browser port satisfies the port and records download calls', async () => {
    const port = createFakeBrowserPort();
    const asPort: BrowserPort = port; // conformance: fake is assignable
    port.nextDownloadId = 42;

    const id = await port.download({ url: 'https://example.com/f.pdf' });
    expect(id).toBe(42);
    expect(port.downloadCalls).toEqual([{ url: 'https://example.com/f.pdf' }]);
    expect(asPort).toBeDefined();
  });

  it('fake browser port can simulate a start failure', async () => {
    const port = createFakeBrowserPort();
    port.failNextDownloadWith = 'BROWSER_BLOCKED';
    await expect(port.download({ url: 'https://example.com/f' })).rejects.toThrow(
      'BROWSER_BLOCKED',
    );
  });

  it('fake browser port delivers download change events to listeners', () => {
    const port = createFakeBrowserPort();
    const seen: Array<{ id: number; state?: string }> = [];
    const off = port.onDownloadChanged((event) =>
      seen.push({ id: event.id, state: event.state?.current }),
    );

    port.emitDownloadChanged({ id: 7, state: { current: 'complete' } });
    off();
    port.emitDownloadChanged({ id: 8, state: { current: 'complete' } });

    expect(seen).toEqual([{ id: 7, state: 'complete' }]);
  });

  it('fake browser port creates tabs and records them', async () => {
    const port = createFakeBrowserPort();
    const tab = await port.createTab({ url: 'https://drive.google.com/x', active: false });
    expect(tab.id).toBe(1);
    expect(port.createdTabs).toEqual([{ url: 'https://drive.google.com/x', active: false }]);
  });
});

// ===========================================================================
// S13 — the optional identity seam on BrowserPort.
//
// Conformance rule: BOTH the fake and the chrome.identity adapter answer the
// same three questions identically — a granted token resolves as a string;
// denial, absent API, and errors resolve as null (never a rejection); and
// implementations without identity support simply omit the method.
// ===========================================================================

type GetAuthTokenStub = (
  details: { interactive: boolean; scopes?: string[] },
  callback: (result?: string | { token?: string }) => void,
) => void;

/** Install a chrome.identity stub over the setup.ts chrome mock. */
function stubChromeIdentity(getAuthToken: GetAuthTokenStub): void {
  const host = globalThis as { chrome?: { identity?: unknown } };
  if (!host.chrome) host.chrome = {} as never;
  host.chrome.identity = { getAuthToken };
}

describe('BrowserPort.getIdentityToken (S13 optional seam)', () => {
  afterEach(() => {
    const host = globalThis as { chrome?: { identity?: unknown } };
    delete host.chrome?.identity;
  });

  it('the fake without the method and the fake with it are both BrowserPorts', () => {
    // The seam is optional: every pre-existing fake/adapter must still
    // conform with zero edits — that is why it is `getIdentityToken?`.
    const without: BrowserPort = createFakeBrowserPort();
    const withFake: BrowserPort = createFakeIdentityBrowserPort();
    expect(without).toBeDefined();
    expect(withFake).toBeDefined();
  });

  it('fake scripts tokens in queue order and denies once the queue is empty', async () => {
    const port = createFakeIdentityBrowserPort();
    port.identityTokenQueue.push('tok-1', null, 'tok-2');

    await expect(port.getIdentityToken!({ scopes: ['s'] })).resolves.toBe('tok-1');
    await expect(port.getIdentityToken!({ scopes: ['s'] })).resolves.toBeNull();
    await expect(port.getIdentityToken!({ scopes: ['s'] })).resolves.toBe('tok-2');
    // Empty queue = deny, never throw.
    await expect(port.getIdentityToken!({ scopes: ['s'] })).resolves.toBeNull();
  });

  it('fake records every requested scope set', async () => {
    const port = createFakeIdentityBrowserPort();
    port.identityTokenQueue.push('tok');
    await port.getIdentityToken!({ scopes: ['a', 'b'] });
    expect(port.identityTokenCalls).toEqual([{ scopes: ['a', 'b'] }]);
  });

  it('adapter is satisfied as a BrowserPort', () => {
    const port: BrowserPort = withIdentityToken(createFakeBrowserPort());
    expect(port).toBeDefined();
  });

  it('adapter resolves the token chrome grants', async () => {
    stubChromeIdentity((details, callback) => {
      expect(details.interactive).toBe(false);
      callback('tok-from-chrome');
    });
    const port = withIdentityToken(createFakeBrowserPort());
    await expect(port.getIdentityToken!({ scopes: [] })).resolves.toBe('tok-from-chrome');
  });

  it('adapter forwards non-empty scopes and omits empty ones', async () => {
    let seen: { interactive: boolean; scopes?: string[] } | null = null;
    stubChromeIdentity((details, callback) => {
      seen = details;
      callback('tok');
    });
    const port = withIdentityToken(createFakeBrowserPort());
    await port.getIdentityToken!({ scopes: ['scope.a'] });
    expect(seen).toEqual({ interactive: false, scopes: ['scope.a'] });

    seen = null;
    await port.getIdentityToken!({ scopes: [] });
    expect(seen).toEqual({ interactive: false });
  });

  it('adapter resolves null on chrome.runtime.lastError (denial)', async () => {
    stubChromeIdentity((_details, callback) => {
      const runtime = (globalThis as { chrome: { runtime: { lastError: unknown } } }).chrome.runtime;
      runtime.lastError = { message: 'OAuth2 not granted' };
      callback('');
      runtime.lastError = null;
    });
    const port = withIdentityToken(createFakeBrowserPort());
    await expect(port.getIdentityToken!({ scopes: [] })).resolves.toBeNull();
  });

  it('adapter resolves null when chrome.identity is absent', async () => {
    const port = withIdentityToken(createFakeBrowserPort());
    await expect(port.getIdentityToken!({ scopes: [] })).resolves.toBeNull();
  });

  it('adapter resolves null when getAuthToken throws', async () => {
    stubChromeIdentity(() => {
      throw new Error('sync host failure');
    });
    const port = withIdentityToken(createFakeBrowserPort());
    await expect(port.getIdentityToken!({ scopes: [] })).resolves.toBeNull();
  });

  it('adapter accepts the object-token shape older chrome builds emit', async () => {
    stubChromeIdentity((_details, callback) => {
      callback({ token: 'obj-token' });
    });
    const port = withIdentityToken(createFakeBrowserPort());
    await expect(port.getIdentityToken!({ scopes: [] })).resolves.toBe('obj-token');
  });
});
