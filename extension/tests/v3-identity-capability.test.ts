// filepath: extension/tests/v3-identity-capability.test.ts
/**
 * ADR-0010 — per-browser identity capability probe (pure function).
 *
 * Input: a user-agent string, the identity APIs the context exposes, and the
 * optional navigator.userAgentData brand names. Output:
 * { identity: 'getAuthToken' | 'webAuthFlow' | 'none' }.
 *
 * Pinned browser facts (docs/adr/0010-cross-browser-oauth-web-auth-flow.md):
 *   - Chrome answers getAuthToken (Google sign-in infrastructure),
 *   - Edge documents getAuthToken unsupported; launchWebAuthFlow is the
 *     documented alternate,
 *   - Brave/Opera are Chromium brands without Google sign-in — webAuthFlow,
 *   - Firefox exposes launchWebAuthFlow only (MDN),
 *   - Safari (macOS + iOS) exposes no identity API (MDN BCD: safari false).
 * 'none' means the engine stays on the V2 DOM path with no error shown.
 */
import { describe, expect, it } from 'vitest';
import { probeIdentityCapability } from '../src/engines/v3/api/capability';

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const EDGE_UA = `${CHROME_UA} Edg/131.0.2903.86`;
const OPERA_UA = `${CHROME_UA} OPR/116.0.0.0`;
const FIREFOX_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0';
const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';

const bothApis = {
  getAuthToken: () => {},
  launchWebAuthFlow: () => {},
};
const wafOnly = { launchWebAuthFlow: () => {} };

describe('probeIdentityCapability', () => {
  it('reports getAuthToken on Google Chrome', () => {
    expect(
      probeIdentityCapability({
        userAgent: CHROME_UA,
        apis: bothApis,
        brands: ['Chromium', 'Google Chrome'],
      }),
    ).toEqual({ identity: 'getAuthToken' });
  });

  it('never reports getAuthToken without an explicit Google Chrome brand (review #3)', () => {
    // Brave, Chromium and forks ship a Chrome-like UA; only brands can tell.
    expect(probeIdentityCapability({ userAgent: CHROME_UA, apis: bothApis })).toEqual({
      identity: 'webAuthFlow',
    });
    expect(
      probeIdentityCapability({
        userAgent: CHROME_UA,
        apis: { getAuthToken: () => {} },
        relayAvailable: true,
      }),
    ).toEqual({ identity: 'webAuthFlow' });
  });

  it('classifies Edge Android (EdgA/) as webAuthFlow, never getAuthToken (review #2)', () => {
    const edgeAndroid =
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 EdgA/131.0.2903.87';
    expect(
      probeIdentityCapability({ userAgent: edgeAndroid, apis: bothApis }),
    ).toEqual({ identity: 'webAuthFlow' });
    expect(
      probeIdentityCapability({
        userAgent: edgeAndroid,
        apis: { getAuthToken: () => {} },
      }),
    ).toEqual({ identity: 'none' });
  });

  it('reports webAuthFlow on Edge (getAuthToken unsupported per Microsoft docs)', () => {
    expect(
      probeIdentityCapability({
        userAgent: EDGE_UA,
        apis: bothApis,
        brands: ['Microsoft Edge'],
      }),
    ).toEqual({ identity: 'webAuthFlow' });
  });

  it('reports webAuthFlow on Brave (brands carry the only Brave marker)', () => {
    expect(
      probeIdentityCapability({
        userAgent: CHROME_UA, // Brave ships a Chrome-like UA without a Brave token
        apis: bothApis,
        brands: ['Chromium', 'Brave'],
      }),
    ).toEqual({ identity: 'webAuthFlow' });
  });

  it('reports webAuthFlow on Opera', () => {
    expect(
      probeIdentityCapability({
        userAgent: OPERA_UA,
        apis: bothApis,
        brands: ['Opera'],
      }),
    ).toEqual({ identity: 'webAuthFlow' });
  });

  it('reports webAuthFlow on Firefox when launchWebAuthFlow exists', () => {
    expect(probeIdentityCapability({ userAgent: FIREFOX_UA, apis: wafOnly })).toEqual({
      identity: 'webAuthFlow',
    });
  });

  it('reports none on Firefox without any identity API surface', () => {
    expect(probeIdentityCapability({ userAgent: FIREFOX_UA, apis: {} })).toEqual({
      identity: 'none',
    });
  });

  it('reports none on Safari (macOS and iOS) even with an API surface stubbed in', () => {
    for (const ua of [SAFARI_UA, `${SAFARI_UA} Mobile/15E148`]) {
      expect(probeIdentityCapability({ userAgent: ua, apis: bothApis })).toEqual({
        identity: 'none',
      });
    }
  });

  it('reports none when nothing is recognizable (unknown context)', () => {
    expect(probeIdentityCapability({ userAgent: '', apis: bothApis })).toEqual({
      identity: 'none',
    });
    expect(
      probeIdentityCapability({ userAgent: CHROME_UA, apis: {} }),
    ).toEqual({ identity: 'none' });
  });

  it('reports webAuthFlow for unbranded Chromium (no Google Chrome brand)', () => {
    expect(
      probeIdentityCapability({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/130.0.0.0 Safari/537.36',
        apis: bothApis,
        brands: ['Chromium'],
      }),
    ).toEqual({ identity: 'webAuthFlow' });
  });
});
