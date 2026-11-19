// filepath: extension/tests/v3-api-config.test.ts
/**
 * S13 Task 3 — isApiConfigured(): the consent/activation gate probe.
 *
 * This single boolean decides three things (docs/engine/api-assist-setup.md):
 *   1. engine-registry: mode 'v3' activates EngineV3 only when true, else the
 *      V1+V2 shadow fallback,
 *   2. popup: the 'API (beta)' Engine Mode option is enabled only when true,
 *   3. the owner's setup docs: the feature turns on EXACTLY when the manifest
 *      carries both the `identity` permission and an oauth2 client_id.
 *
 * The helper reads only the chrome globals — no browser-specific imports — so
 * the unit tests stub `chrome` wholesale.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NON_CHROME_TOKEN_SOURCE_WIRED,
  isApiConfigured,
  setNonChromeTokenSourceWired,
} from '../src/engines/v3/api/config';
import { setEngineBase } from '../src/engines/engine-base';

function stubChrome(chromeShape: unknown) {
  vi.stubGlobal('chrome', chromeShape);
}

describe('isApiConfigured (S13 consent gate)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setEngineBase('v2');
  });

  it('is false when chrome is unavailable (tests, non-extension contexts)', () => {
    vi.stubGlobal('chrome', undefined);
    expect(isApiConfigured()).toBe(false);
  });

  it('is false when the identity API is absent (no chrome.identity.getAuthToken)', () => {
    stubChrome({
      runtime: {
        getManifest: () => ({ oauth2: { client_id: 'id.apps.googleusercontent.com' } }),
      },
      // identity missing entirely
    });
    expect(isApiConfigured()).toBe(false);
  });

  it('is false when identity exists but the manifest declares no oauth2 section', () => {
    stubChrome({
      identity: { getAuthToken: () => {} },
      runtime: { getManifest: () => ({ name: 'CQD' }) },
    });
    expect(isApiConfigured()).toBe(false);
  });

  it('is false when oauth2 exists but has no client_id', () => {
    stubChrome({
      identity: { getAuthToken: () => {} },
      runtime: { getManifest: () => ({ oauth2: {} }) },
    });
    expect(isApiConfigured()).toBe(false);
  });

  it('is false when the client_id is blank', () => {
    stubChrome({
      identity: { getAuthToken: () => {} },
      runtime: { getManifest: () => ({ oauth2: { client_id: '   ' } }) },
    });
    expect(isApiConfigured()).toBe(false);
  });

  it('is true only when identity exists AND oauth2.client_id is configured', () => {
    vi.stubGlobal('navigator', { userAgentData: { brands: [{ brand: 'Google Chrome' }] } });
    stubChrome({
      identity: { getAuthToken: () => {} },
      runtime: {
        getManifest: () => ({
          oauth2: { client_id: 'cqd-extension.apps.googleusercontent.com' },
        }),
      },
    });
    expect(isApiConfigured()).toBe(true);
  });

  // Content scripts never see chrome.identity, and the engines run in one.
  // There the manifest permission + the Google Chrome brand stand in for it.
  describe('in a content script (no chrome.identity)', () => {
    const manifest = {
      permissions: ['downloads', 'identity'],
      oauth2: { client_id: 'cqd-extension.apps.googleusercontent.com' },
    };
    const stubBrands = (...brands: string[]) =>
      vi.stubGlobal('navigator', { userAgentData: { brands: brands.map((brand) => ({ brand })) } });

    it('is true on Google Chrome with the identity permission and a client_id', () => {
      stubChrome({ runtime: { getManifest: () => manifest } });
      stubBrands('Chromium', 'Google Chrome');
      expect(isApiConfigured()).toBe(true);
    });

    it('is false on Chromium browsers whose getAuthToken does not work (Edge, Brave, Opera)', () => {
      stubChrome({ runtime: { getManifest: () => manifest } });
      for (const brand of ['Microsoft Edge', 'Brave', 'Opera']) {
        stubBrands('Chromium', brand);
        expect(isApiConfigured()).toBe(false);
      }
    });

    it('is false where userAgentData does not exist (Firefox)', () => {
      stubChrome({ runtime: { getManifest: () => manifest } });
      vi.stubGlobal('navigator', {});
      expect(isApiConfigured()).toBe(false);
    });

    it('is false without the identity permission', () => {
      stubChrome({ runtime: { getManifest: () => ({ ...manifest, permissions: ['downloads'] }) } });
      stubBrands('Google Chrome');
      expect(isApiConfigured()).toBe(false);
    });
  });

  it('is false on a non-Chrome brand that exposes getAuthToken (review #1, flag ON)', () => {
    setEngineBase('v3');
    for (const brand of ['Microsoft Edge', 'Brave', 'Opera']) {
      vi.stubGlobal('navigator', { userAgentData: { brands: [{ brand: 'Chromium' }, { brand }] } });
      stubChrome({
        identity: { getAuthToken: () => {} },
        runtime: {
          getManifest: () => ({
            permissions: ['identity'],
            oauth2: { client_id: 'cqd-extension.apps.googleusercontent.com' },
          }),
        },
      });
      expect(isApiConfigured()).toBe(false);
    }
  });

  // Review round 2, finding 7: a context without navigator.userAgentData at all
  // (Chrome older than 90, an insecure context) but with a plain Chrome UA is
  // real Google Chrome on every shipped build, so the base behavior holds.
  describe('Google Chrome without userAgentData (review round 2, finding 7)', () => {
    const CHROME_UA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    const stubBackground = (userAgent: string, userAgentData?: unknown) => {
      vi.stubGlobal('navigator', { userAgent, userAgentData });
      stubChrome({
        identity: { getAuthToken: () => {} },
        runtime: {
          getManifest: () => ({
            permissions: ['identity'],
            oauth2: { client_id: 'cqd-extension.apps.googleusercontent.com' },
          }),
        },
      });
    };

    it('stays true on a plain Chrome UA with no userAgentData (flag ON)', () => {
      setEngineBase('v3');
      stubBackground(CHROME_UA);
      expect(isApiConfigured()).toBe(true);
    });

    it('stays false on Edge, Opera and Brave UAs with no userAgentData (flag ON)', () => {
      setEngineBase('v3');
      for (const marker of ['Edg/131.0.2903.86', 'OPR/115.0.0.0', 'Brave/1.70']) {
        stubBackground(`${CHROME_UA} ${marker}`);
        expect(isApiConfigured()).toBe(false);
      }
    });

    it('stays false when userAgentData EXISTS but lists no Google Chrome brand (flag ON)', () => {
      setEngineBase('v3');
      stubBackground(CHROME_UA, { brands: [{ brand: 'Chromium' }] });
      expect(isApiConfigured()).toBe(false);
    });

    // Review round 5, finding 1 (supersedes round 4, finding 6): only a context
    // with NO userAgentData object takes the UA fallback. Present-but-empty or
    // brand-less data is a browser answering "no Google Chrome brand": a non-Google
    // Chromium fork with a plain Chrome UA must not pass as Google Chrome.
    it('empty or missing brands do NOT take the plain-UA fallback (flag ON)', () => {
      setEngineBase('v3');
      for (const uaData of [{ brands: [] }, {}]) {
        stubBackground(CHROME_UA, uaData);
        expect(isApiConfigured()).toBe(false);
      }
    });

    it('only an absent userAgentData takes the plain-UA fallback (flag ON)', () => {
      setEngineBase('v3');
      stubBackground(CHROME_UA);
      expect(isApiConfigured()).toBe(true);
      stubBackground(`${CHROME_UA} Vivaldi/6.9.3447.54`);
      expect(isApiConfigured()).toBe(false);
    });

    it('flag OFF ignores empty brands: client id alone decides (finding 6)', () => {
      setEngineBase('v2');
      stubBackground(`${CHROME_UA} Edg/131.0.2903.86`, { brands: [] });
      expect(isApiConfigured()).toBe(true);
    });
  });

  it('is false on an unbranded host that exposes getAuthToken (no userAgentData, flag ON)', () => {
    setEngineBase('v3');
    vi.stubGlobal('navigator', {});
    stubChrome({
      identity: { getAuthToken: () => {} },
      runtime: {
        getManifest: () => ({
          permissions: ['identity'],
          oauth2: { client_id: 'cqd-extension.apps.googleusercontent.com' },
        }),
      },
    });
    expect(isApiConfigured()).toBe(false);
  });

  // Review round 3, finding 1: flag OFF ('v2') must answer EXACTLY what
  // origin/fix/api-engine-token-relay answered. The brand/UA gate is new and
  // applies only when engineBase is 'v3'. BASE_ORACLE is a verbatim copy of the
  // base implementation's decision logic.
  describe('flag OFF parity with the pre-ADR-0010 base (review round 3, finding 1)', () => {
    const CHROME_UA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    const manifest = {
      permissions: ['identity'],
      oauth2: { client_id: 'cqd-extension.apps.googleusercontent.com' },
    };

    function baseOracle(): boolean {
      const c = (globalThis as unknown as { chrome: any }).chrome;
      const m = c.runtime.getManifest();
      const id = m.oauth2?.client_id;
      const hasClientId = typeof id === 'string' && id.trim().length > 0;
      if (typeof c.identity?.getAuthToken === 'function') return hasClientId;
      if (!(Array.isArray(m.permissions) && m.permissions.includes('identity'))) return false;
      if (!hasClientId) return false;
      const uaData = (navigator as any)?.userAgentData;
      return Array.isArray(uaData?.brands) &&
        uaData.brands.some((b: any) => b?.brand === 'Google Chrome');
    }

    const navigators: Array<[string, unknown]> = [
      ['Chrome brand', { userAgent: CHROME_UA, userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Google Chrome' }] } }],
      ['Edge brand', { userAgent: `${CHROME_UA} Edg/131.0`, userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Microsoft Edge' }] } }],
      ['Brave brand', { userAgent: CHROME_UA, userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Brave' }] } }],
      ['Opera brand', { userAgent: `${CHROME_UA} OPR/115.0`, userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Opera' }] } }],
      ['Chrome UA, no userAgentData', { userAgent: CHROME_UA }],
      ['Edge UA, no userAgentData', { userAgent: `${CHROME_UA} Edg/131.0` }],
      ['empty navigator', {}],
    ];
    const shapes: Array<[string, () => unknown]> = [
      ['background (getAuthToken)', () => ({
        identity: { getAuthToken: () => {} },
        runtime: { getManifest: () => manifest },
      })],
      ['content script (no identity)', () => ({ runtime: { getManifest: () => manifest } })],
    ];

    afterEach(() => setEngineBase('v2'));

    for (const [shapeName, makeChrome] of shapes) {
      for (const [navName, nav] of navigators) {
        it(`${shapeName} / ${navName}: flag OFF equals the base answer`, () => {
          setEngineBase('v2');
          stubChrome(makeChrome());
          vi.stubGlobal('navigator', nav);
          expect(isApiConfigured()).toBe(baseOracle());
        });
      }
    }

    it('flag OFF: Edge/Brave/Opera backgrounds with getAuthToken stay TRUE (base)', () => {
      setEngineBase('v2');
      stubChrome({ identity: { getAuthToken: () => {} }, runtime: { getManifest: () => manifest } });
      for (const [name, nav] of navigators.slice(0, 4)) {
        vi.stubGlobal('navigator', nav);
        expect(isApiConfigured(), name).toBe(true);
      }
    });

    it('flag OFF: a Chrome UA without userAgentData in a content script stays FALSE (base)', () => {
      setEngineBase('v2');
      stubChrome({ runtime: { getManifest: () => manifest } });
      vi.stubGlobal('navigator', { userAgent: CHROME_UA });
      expect(isApiConfigured()).toBe(false);
    });
  });

  it('survives a throwing getManifest (never breaks a caller)', () => {
    stubChrome({
      identity: { getAuthToken: () => {} },
      runtime: {
        getManifest: () => {
          throw new Error('no manifest in this context');
        },
      },
    });
    expect(isApiConfigured()).toBe(false);
  });

  // ADR-0010 — non-Chrome browsers configure ONLY through the web-auth-flow
  // path: a web client id in the manifest AND the engineBase flag ON. The
  // default (no web client id, flag OFF) stays false everywhere.
  describe('web-auth-flow path (ADR-0010, non-Chrome browsers)', () => {
    const webManifest = (webClientId?: string) => ({
      permissions: ['downloads', 'identity'],
      oauth2: {
        client_id: 'cqd-extension.apps.googleusercontent.com',
        ...(webClientId ? { web_client_id: webClientId } : {}),
      },
    });
    const stubNonChrome = (
      userAgent: string,
      manifest: ReturnType<typeof webManifest>,
      opts: { sendMessage?: boolean } = {},
    ) => {
      stubChrome({
        runtime: {
          getManifest: () => manifest,
          ...(opts.sendMessage ? { sendMessage: () => {} } : {}),
        },
        identity: { launchWebAuthFlow: () => {} },
      });
      vi.stubGlobal('navigator', { userAgent, userAgentData: undefined });
    };

    beforeEach(() => {
      setNonChromeTokenSourceWired(true); // the rollout PR flips the default
    });

    afterEach(() => {
      setEngineBase('v2'); // never leak the flag into other tests
      setNonChromeTokenSourceWired(false);
    });

    it('the wiring seam is a no-op outside the test build (review round 5, finding 5)', () => {
      setNonChromeTokenSourceWired(false);
      vi.stubEnv('MODE', 'production');
      try {
        setNonChromeTokenSourceWired(true);
        stubNonChrome(EDGE_UA, webManifest('test-web-client.apps.googleusercontent.com'), {
          sendMessage: true,
        });
        setEngineBase('v3');
        expect(isApiConfigured()).toBe(false);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('ships with NO non-Chrome token source wired: configured stays false (review #4)', () => {
      expect(NON_CHROME_TOKEN_SOURCE_WIRED).toBe(false);
      setNonChromeTokenSourceWired(false);
      stubNonChrome(EDGE_UA, webManifest('test-web-client.apps.googleusercontent.com'), {
        sendMessage: true,
      });
      setEngineBase('v3');
      expect(isApiConfigured()).toBe(false);
    });

    const EDGE_UA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86';
    const FIREFOX_UA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0';
    const SAFARI_UA =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';

    it('is false by default — no web client id, flag OFF', () => {
      stubNonChrome(EDGE_UA, webManifest());
      expect(isApiConfigured()).toBe(false);
    });

    it('is false with the flag OFF even when a web client id exists', () => {
      stubNonChrome(EDGE_UA, webManifest('test-web-client.apps.googleusercontent.com'));
      expect(isApiConfigured()).toBe(false);
    });

    it('is false with the flag ON but no web client id', () => {
      stubNonChrome(EDGE_UA, webManifest());
      setEngineBase('v3');
      expect(isApiConfigured()).toBe(false);
    });

    it('is false when the web client id is blank', () => {
      stubNonChrome(EDGE_UA, webManifest('   '));
      setEngineBase('v3');
      expect(isApiConfigured()).toBe(false);
    });

    it('is true on Edge with web client id + flag ON (relay-capable context)', () => {
      stubNonChrome(EDGE_UA, webManifest('test-web-client.apps.googleusercontent.com'), {
        sendMessage: true,
      });
      setEngineBase('v3');
      expect(isApiConfigured()).toBe(true);
    });

    it('is true on Firefox with web client id + flag ON (relay-capable context)', () => {
      stubNonChrome(FIREFOX_UA, webManifest('test-web-client.apps.googleusercontent.com'), {
        sendMessage: true,
      });
      setEngineBase('v3');
      expect(isApiConfigured()).toBe(true);
    });

    it('is false on Safari even with web client id + flag ON (no identity host)', () => {
      stubNonChrome(SAFARI_UA, webManifest('test-web-client.apps.googleusercontent.com'), {
        sendMessage: true,
      });
      setEngineBase('v3');
      expect(isApiConfigured()).toBe(false);
    });

    it('is false without the relay AND without a direct launchWebAuthFlow surface', () => {
      // Content-script shape: no chrome.identity, no sendMessage — no token
      // source is reachable, so the gate must stay false.
      stubChrome({
        runtime: {
          getManifest: () =>
            webManifest('test-web-client.apps.googleusercontent.com'),
        },
      });
      vi.stubGlobal('navigator', { userAgent: EDGE_UA, userAgentData: undefined });
      setEngineBase('v3');
      expect(isApiConfigured()).toBe(false);
    });
  });
});
