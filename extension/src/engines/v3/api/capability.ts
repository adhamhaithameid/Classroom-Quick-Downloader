// filepath: extension/src/engines/v3/api/capability.ts
/**
 * ============================================================================
 * IDENTITY CAPABILITY PROBE — which token source can this browser serve?
 * ============================================================================
 *
 * ADR-0010 (docs/adr/0010-cross-browser-oauth-web-auth-flow.md). Pure
 * function: a user-agent string, the identity APIs the current context
 * exposes, optional navigator.userAgentData brand names, and whether this
 * context can relay token requests to the background (chrome.runtime exists)
 * decide the answer:
 *
 *   'getAuthToken' — Google Chrome (explicit userAgentData brand only): getAuthToken
 *                    answers there (Chrome docs).
 *   'webAuthFlow'  — Edge (getAuthToken documented unsupported; MS docs name
 *                    launchWebAuthFlow the alternate), Brave, Opera (Chromium
 *                    brands without Google sign-in; Brave's only marker is in
 *                    userAgentData brands — its UA mimics Chrome), Firefox
 *                    (launchWebAuthFlow only, per MDN), and any of those
 *                    contexts where only the background relay can reach the
 *                    API (content scripts — the csaa.7 stand-in).
 *   'none'         — Safari (MDN browser-compat-data: identity API false on
 *                    macOS and iOS), Edge iOS (EdgiOS/: a WebKit shell with no
 *                    extension host; Edge Android EdgA/ is Chromium and stays
 *                    webAuthFlow), non-extension hosts (Chrome on Android),
 *                    and anything unrecognizable. The engine stays on the V2
 *                    DOM path with no error shown.
 *
 * Imports nothing. Consumers: v3/api/config.ts (the isApiConfigured gate)
 * and, later, the background relay's token-source selection (rollout step).
 */

export type IdentityCapability = 'getAuthToken' | 'webAuthFlow' | 'none';

export interface IdentityApiSurface {
  getAuthToken?: unknown;
  launchWebAuthFlow?: unknown;
}

export interface IdentityCapabilityInput {
  userAgent: string;
  apis: IdentityApiSurface;
  /** navigator.userAgentData brand names (Chromium only). */
  brands?: readonly string[];
  /** Whether token requests can relay to the background (chrome.runtime). */
  relayAvailable?: boolean;
}

export interface IdentityCapabilityResult {
  identity: IdentityCapability;
}

function isFirefox(ua: string): boolean {
  return /Firefox\/\d/.test(ua) && !/Seamonkey/i.test(ua);
}

function isSafari(ua: string): boolean {
  return /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua);
}

/**
 * THE one Google Chrome test, shared with v3/api/config.ts. Only an explicit
 * 'Google Chrome' entry in navigator.userAgentData.brands counts. A Chrome-like
 * UA proves nothing: Brave, Chromium and forks all send one. Real Chrome 90+
 * always exposes userAgentData in secure contexts (service worker, https
 * content script), so the safe default costs nothing there; a host without it
 * is served by webAuthFlow (ADR-0010, "Google Chrome brand rule").
 */
export function isGoogleChromeBrand(brands: readonly string[]): boolean {
  return Array.isArray(brands) && brands.includes('Google Chrome');
}

/**
 * Fallback for a context with NO navigator.userAgentData object at all (Chrome
 * older than 90, an insecure context): a Chrome UA with no other brand marker.
 * Used by config.ts ONLY when userAgentData is absent; present-but-empty or
 * present-without-Google-Chrome brands never reach it. Chromium forks all ship
 * userAgentData, so this stays safe for Brave, Edge and Opera (their UA markers
 * are also rejected here), plus HeadlessChrome, SamsungBrowser, YaBrowser, Whale
 * and Vivaldi (Arc sends no UA token, so it cannot be named here). Brave sends
 * NO UA token: without userAgentData brands it cannot be told
 * apart from Chrome, which is why this fallback is for contexts with no
 * userAgentData at all (ADR-0010).
 */
export function isPlainChromeUserAgent(ua: string): boolean {
  return typeof ua === 'string' && /Chrome\/\d/.test(ua) &&
    !/Edg[A-Za-z]*\/|OPR\/|Opera[\s/]|Brave\/|Chromium\/|Firefox\/|HeadlessChrome\/|SamsungBrowser\/|YaBrowser\/|Whale\/|Vivaldi\//.test(ua);
}

export function probeIdentityCapability(input: IdentityCapabilityInput): IdentityCapabilityResult {
  const ua = typeof input.userAgent === 'string' ? input.userAgent : '';
  if (ua.trim().length === 0) return { identity: 'none' };

  const apis = input.apis ?? {};
  const hasGetAuthToken = typeof apis.getAuthToken === 'function';
  const hasWebAuthFlow = typeof apis.launchWebAuthFlow === 'function';
  const relay = input.relayAvailable === true;
  const brands = Array.isArray(input.brands) ? input.brands : [];
  const webFlowReachable = hasWebAuthFlow || relay;

  // Edge iOS (EdgiOS/) is a WebKit shell: no extension host, no identity API.
  // Decided before the Edge branch so the answer is explicit, not incidental.
  if (/EdgiOS\//.test(ua)) return { identity: 'none' };

  // Safari hosts no identity API at all (MDN BCD: safari false, iOS mirror).
  if (isSafari(ua)) return { identity: 'none' };

  // Chromium brands without Google sign-in, plus Firefox: webAuthFlow or
  // nothing. Edge is pinned by Microsoft's supported-APIs table; the token
  // covers desktop (Edg/) and Android (EdgA/) builds. EdgiOS/ left above.
  if (/Edg(?:A)?\//.test(ua) || /OPR\/|Opera[\s/]/.test(ua) || brands.includes('Brave') ||
    /Brave\//.test(ua) || isFirefox(ua)) {
    return { identity: webFlowReachable ? 'webAuthFlow' : 'none' };
  }

  // Chrome family: getAuthToken ONLY on an explicit Google Chrome brand; any
  // other Chromium UA (unbranded, Brave-like, forks) is webAuthFlow or none.
  if (/Chrome\/|Chromium\//.test(ua)) {
    if (hasGetAuthToken && isGoogleChromeBrand(brands)) {
      return { identity: 'getAuthToken' };
    }
    return { identity: webFlowReachable ? 'webAuthFlow' : 'none' };
  }

  // Unrecognizable host: none — the engine stays on V2 DOM, no error shown.
  return { identity: 'none' };
}
