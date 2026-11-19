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
 *   'getAuthToken' — Google Chrome: getAuthToken answers there (Chrome docs).
 *   'webAuthFlow'  — Edge (getAuthToken documented unsupported; MS docs name
 *                    launchWebAuthFlow the alternate), Brave, Opera (Chromium
 *                    brands without Google sign-in; Brave's only marker is in
 *                    userAgentData brands — its UA mimics Chrome), Firefox
 *                    (launchWebAuthFlow only, per MDN), and any of those
 *                    contexts where only the background relay can reach the
 *                    API (content scripts — the csaa.7 stand-in).
 *   'none'         — Safari (MDN browser-compat-data: identity API false on
 *                    macOS and iOS), non-extension hosts (Chrome on Android),
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
 * Google Chrome brand: userAgentData says so when present; otherwise a
 * Chrome UA without a Chromium token stands in (Edge/Opera/Brave UAs carry
 * their own markers and are classified above this heuristic).
 */
function isGoogleChromeBrand(ua: string, brands: readonly string[]): boolean {
  if (brands.length > 0) return brands.includes('Google Chrome');
  return /Chrome\//.test(ua) && !/Chromium\//.test(ua);
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

  // Safari hosts no identity API at all (MDN BCD: safari false, iOS mirror).
  if (isSafari(ua)) return { identity: 'none' };

  // Chromium brands without Google sign-in, plus Firefox: webAuthFlow or
  // nothing. Edge is pinned by Microsoft's supported-APIs table.
  if (/Edg\//.test(ua) || /OPR\/|Opera[\s/]/.test(ua) || brands.includes('Brave') ||
    /Brave\//.test(ua) || isFirefox(ua)) {
    return { identity: webFlowReachable ? 'webAuthFlow' : 'none' };
  }

  // Chrome family: getAuthToken when the brand (or a Chrome-only UA) says so.
  if (/Chrome\/|Chromium\//.test(ua)) {
    if (hasGetAuthToken && isGoogleChromeBrand(ua, brands)) {
      return { identity: 'getAuthToken' };
    }
    return { identity: webFlowReachable ? 'webAuthFlow' : 'none' };
  }

  // Unrecognizable host: none — the engine stays on V2 DOM, no error shown.
  return { identity: 'none' };
}
