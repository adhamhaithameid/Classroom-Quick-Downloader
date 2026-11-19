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

  it('is false on a non-Chrome brand that exposes getAuthToken (review #1)', () => {
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

  it('is false on an unbranded host that exposes getAuthToken (no userAgentData)', () => {
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
