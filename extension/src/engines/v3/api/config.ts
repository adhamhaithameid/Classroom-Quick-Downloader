// filepath: extension/src/engines/v3/api/config.ts
/**
 * ============================================================================
 * API CONFIG PROBE — is the Classroom-API assist configured on this install?
 * ============================================================================
 *
 * S13 Task 3: the single gate the registry and the popup both read. The API
 * engine may activate ONLY when the install can actually obtain a token:
 *
 *   1. `chrome.identity.getAuthToken` exists (the `identity` permission), and
 *   2. the manifest declares an oauth2 client_id (`oauth2.client_id`).
 *
 * Content scripts never see chrome.identity, and the engines run in one
 * (csaa.7). There the manifest identity permission + oauth2 client_id + the
 * Google Chrome brand decide instead; token requests relay to the background.
 *
 * Both are owner-side setup steps (docs/engine/api-assist-setup.md): without
 * them the token provider deterministically returns null and the API layer
 * would be inert — so instead of activating an engine that can never fetch,
 * the registry falls back to the V1+V2 shadow pair and the popup shows the
 * option disabled.
 *
 * ADR-0010 adds ONE branch: on non-Chrome browsers the API assist configures
 * ONLY when the manifest also carries a web client id (`oauth2.web_client_id`
 * — owner prerequisite) AND the engineBase flag is ON AND the identity
 * capability probe answers something other than 'none' (Safari and unknown
 * hosts stay on the V2 DOM path) AND NON_CHROME_TOKEN_SOURCE_WIRED is true.
 * getAuthToken counts ONLY on an explicit 'Google Chrome' userAgentData brand
 * (one shared test, capability.ts). The shipped defaults — no web client id,
 * flag 'v2', token source unwired — keep every non-Chrome browser false, so flipping this on is a rollout
 * decision, not a code surprise (docs/adr/0010-cross-browser-oauth-web-auth-flow.md).
 *
 * This module imports nothing from the v3 engine stack — only the pure
 * engine-base flag and the pure capability probe — so both the engine
 * registry and the popup entrypoint can depend on it without dragging the
 * v3 stack (or any browser API call) into their bundles.
 *
 * Note the semantics: TRUE means CONFIGURED (capable), not consented. Consent
 * is the user's explicit Engine Mode selection (cqdV2Mode 'v3', #398); token
 * acquisition stays non-interactive and happens only on student-work views
 * while v3 is active.
 */
import { getEngineBase } from '../../engine-base';
import { isGoogleChromeBrand, probeIdentityCapability } from './capability';

/** What the oauth2 manifest section looks like when present. */
interface ManifestOauth2 {
  client_id?: string;
  /** ADR-0010 owner prerequisite: the Web-application OAuth client id. */
  web_client_id?: string;
}

interface ManifestWithOauth2 {
  oauth2?: ManifestOauth2;
  permissions?: string[];
}

/** navigator.userAgentData (Chromium-only) brand entry. */
interface UserAgentBrand {
  brand?: string;
}

/** navigator.userAgentData (Chromium-only). */
interface UserAgentData {
  brands?: UserAgentBrand[];
}

/** navigator.userAgentData brand names, plain strings for the probe. */
function readBrandNames(): string[] {
  try {
    const uaData = (navigator as Navigator & { userAgentData?: UserAgentData })?.userAgentData;
    return Array.isArray(uaData?.brands) ? uaData.brands.map((brand) => brand?.brand ?? '') : [];
  } catch {
    return [];
  }
}

/**
 * ADR-0010 rollout switch: TRUE only once a non-Chrome token source is wired
 * into the engine (engine-v3 still builds ChromeIdentityTokenProvider; the
 * WebAuthFlowTokenSource has no caller). Until then non-Chrome browsers stay
 * "not configured" so the registry and popup never offer an API mode that can
 * never fetch. The rollout PR flips this default and its pinning test.
 */
export const NON_CHROME_TOKEN_SOURCE_WIRED = false;

let nonChromeTokenSourceWired: boolean = NON_CHROME_TOKEN_SOURCE_WIRED;

/** Test seam: open the non-Chrome gate (module-scoped, like engineBase). */
export function setNonChromeTokenSourceWired(wired: boolean): void {
  nonChromeTokenSourceWired = wired;
}

/**
 * Whether this install has everything the API assist needs to run.
 * Never throws: a hostile/absent chrome surface reads as "not configured".
 */
export function isApiConfigured(): boolean {
  if (typeof chrome === 'undefined') return false;
  if (!chrome.runtime?.getManifest) return false;

  let manifest: ManifestWithOauth2;
  try {
    manifest = chrome.runtime.getManifest() as ManifestWithOauth2;
  } catch {
    return false;
  }

  const clientId = manifest.oauth2?.client_id;
  const hasClientId = typeof clientId === 'string' && clientId.trim().length > 0;

  // Background path: chrome.identity works here — check it directly, but only
  // on an explicit Google Chrome brand. Edge/Brave/Opera expose the function
  // yet never answer it, so they fall through to the web gate below.
  const brandNames = readBrandNames();
  if (typeof chrome.identity?.getAuthToken === 'function' && isGoogleChromeBrand(brandNames)) {
    return hasClientId;
  }

  // Content-script path (csaa.7): chrome.identity does not exist there and
  // the whole v3 engine runs in one. The manifest identity permission, the
  // oauth2 client_id, and the Google Chrome brand decide instead — the
  // token request itself relays to the background (CQD_API_TOKEN).
  const hasIdentityPermission = Array.isArray(manifest.permissions) &&
    manifest.permissions.includes('identity');
  if (!hasIdentityPermission) return false;
  if (isGoogleChromeBrand(brandNames)) return hasClientId;

  // ADR-0010 — non-Chrome browsers: the web-auth-flow path. Configured ONLY
  // when a web client id is present AND the engineBase flag is ON AND the
  // capability probe says this browser can reach a launchWebAuthFlow source
  // (directly or through the background relay). Shipped defaults — no
  // web_client_id in the manifest, flag 'v2' — keep every browser false.
  if (!nonChromeTokenSourceWired) return false;
  const webClientId = manifest.oauth2?.web_client_id;
  const hasWebClientId = typeof webClientId === 'string' && webClientId.trim().length > 0;
  if (!hasWebClientId) return false;
  if (getEngineBase() !== 'v3') return false;
  const identity = chrome.identity as { launchWebAuthFlow?: unknown } | undefined;
  const probe = probeIdentityCapability({
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    apis: {
      getAuthToken: chrome.identity?.getAuthToken,
      launchWebAuthFlow: identity?.launchWebAuthFlow,
    },
    brands: brandNames,
    relayAvailable: typeof chrome.runtime?.sendMessage === 'function',
  });
  return probe.identity !== 'none';
}
