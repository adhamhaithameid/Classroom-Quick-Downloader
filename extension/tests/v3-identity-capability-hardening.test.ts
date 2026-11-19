// filepath: extension/tests/v3-identity-capability-hardening.test.ts
/**
 * Mutation hardening for src/engines/v3/api/capability.ts (chat 7, 2026-11-19).
 *
 * The 2026-11-19 baseline mutation run scored the probe 72.62% with 20
 * survivors + 3 NoCoverage mutants. Every test here is written to kill a
 * named survivor cluster or execute a named uncovered line — the mutation
 * AFTER run is the kill proof (score column per file).
 *
 * Contract additions pinned here (all consistent with ADR-0010):
 *   - Safari wins over every brand marker: a Safari UA with Brave brands
 *     stays 'none' (Safari hosts no identity API — MDN BCD).
 *   - Brands are authoritative over the UA heuristic for Google-Chrome-ness.
 *   - Edge/Opera/Brave/Firefox detection is per-marker (one marker alone
 *     must route to webAuthFlow).
 *   - relayAvailable alone (content-script csaa.7 shape) reaches webAuthFlow.
 *   - A non-string or whitespace-only userAgent answers 'none'.
 *   - An unrecognizable host answers 'none' (never getAuthToken).
 */
import { describe, expect, it } from 'vitest';
import { probeIdentityCapability } from '../src/engines/v3/api/capability';

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CHROMIUM_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/130.0.0.0 Safari/537.36';
const EDGE_UA = `${CHROME_UA} Edg/131.0.2903.86`;
const FIREFOX_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0';
const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';
/** Legacy Opera separator ('Opera/9.80') and space-separated variant. */
const OPERA_LEGACY_UA = `${CHROME_UA} Opera/9.80`;
const OPERA_SPACE_UA = `${CHROME_UA} Opera 12.00`;

describe('probeIdentityCapability — mutation hardening (chat 7)', () => {
  it("Safari wins over Brave brands: Safari UA with Brave brands stays 'none'", () => {
    // Kills isSafari body/condition survivors: if the Safari short-circuit
    // dies, the Brave brand marker would route this UA to webAuthFlow.
    expect(
      probeIdentityCapability({
        userAgent: SAFARI_UA,
        apis: {},
        brands: ['Chromium', 'Brave'],
        relayAvailable: true,
      }),
    ).toEqual({ identity: 'none' });
  });

  it('Edge UA answers webAuthFlow even when getAuthToken exists (never Chrome)', () => {
    // Kills the disabled-compound survivors on the Edge/Opera/Brave/Firefox
    // branch: a dead branch would drop Edge into the Chrome UA heuristic and
    // answer getAuthToken.
    expect(
      probeIdentityCapability({ userAgent: EDGE_UA, apis: { getAuthToken: () => {}, launchWebAuthFlow: () => {} } }),
    ).toEqual({ identity: 'webAuthFlow' });
  });

  it('legacy Opera/9.80 UA answers webAuthFlow (slash separator)', () => {
    // Kills the /OPR\/|Opera[\s/]/ regex survivors that drop the slash form.
    expect(
      probeIdentityCapability({ userAgent: OPERA_LEGACY_UA, apis: { getAuthToken: () => {}, launchWebAuthFlow: () => {} } }),
    ).toEqual({ identity: 'webAuthFlow' });
  });

  it("legacy 'Opera 12' UA answers webAuthFlow (space separator)", () => {
    // Kills the regex survivors that drop the space form.
    expect(
      probeIdentityCapability({ userAgent: OPERA_SPACE_UA, apis: { getAuthToken: () => {}, launchWebAuthFlow: () => {} } }),
    ).toEqual({ identity: 'webAuthFlow' });
  });

  it('Brave brand alone on an unknown UA reaches webAuthFlow', () => {
    // Kills the 'Brave' → '' literal survivor: without the brand marker the
    // unknown host would answer 'none'.
    expect(
      probeIdentityCapability({
        userAgent: 'plain-agent/1.0',
        apis: {},
        brands: ['Brave'],
        relayAvailable: true,
      }),
    ).toEqual({ identity: 'webAuthFlow' });
  });

  it('Firefox UA with ONLY the background relay reaches webAuthFlow', () => {
    // Kills the compound-gate survivors (&& forms) and the relayAvailable
    // '=== true' survivor: the relay-only content-script shape must count.
    expect(
      probeIdentityCapability({ userAgent: FIREFOX_UA, apis: {}, relayAvailable: true }),
    ).toEqual({ identity: 'webAuthFlow' });
  });

  it('brands are authoritative: Chromium-branded non-Google UA never answers getAuthToken', () => {
    // Kills the isGoogleChromeBrand survivors: brand presence must gate the
    // UA heuristic, and the Chrome-vs-Chromium tokens must both matter.
    expect(
      probeIdentityCapability({
        userAgent: CHROMIUM_UA,
        apis: { getAuthToken: () => {}, launchWebAuthFlow: () => {} },
        brands: ['Chromium'],
      }),
    ).toEqual({ identity: 'webAuthFlow' });
    expect(
      probeIdentityCapability({
        userAgent: CHROME_UA,
        apis: { getAuthToken: () => {}, launchWebAuthFlow: () => {} },
        brands: ['Chromium', 'Not ABrand'],
      }),
    ).toEqual({ identity: 'webAuthFlow' });
  });

  it('a non-string userAgent answers none (never throws)', () => {
    // Kills the typeof guard survivor and covers the '' fallback line.
    expect(
      probeIdentityCapability({
        userAgent: 42 as unknown as string,
        apis: { getAuthToken: () => {} },
      }),
    ).toEqual({ identity: 'none' });
  });

  it('a whitespace-only userAgent answers none even with Brave markers', () => {
    // Kills the trim survivors: the trimmed-empty short-circuit must fire
    // before any brand heuristic.
    expect(
      probeIdentityCapability({
        userAgent: '   ',
        apis: {},
        brands: ['Brave'],
        relayAvailable: true,
      }),
    ).toEqual({ identity: 'none' });
  });

  it('an unrecognizable host answers none even when getAuthToken exists', () => {
    // Covers the final 'none' return and kills the Chrome-branch-true
    // survivor (a dead Chrome check would route the unknown host through the
    // webAuthFlow fallback instead of 'none').
    expect(
      probeIdentityCapability({
        userAgent: 'MysteryBot/2.0',
        apis: { getAuthToken: () => {} },
        relayAvailable: true,
      }),
    ).toEqual({ identity: 'none' });
  });
});
