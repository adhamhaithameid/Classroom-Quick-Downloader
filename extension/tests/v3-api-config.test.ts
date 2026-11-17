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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isApiConfigured } from '../src/engines/v3/api/config';

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
});
