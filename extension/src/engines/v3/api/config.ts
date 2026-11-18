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
 * This module imports nothing — it only reads the chrome globals — so both
 * the engine registry and the popup entrypoint can depend on it without
 * dragging the v3 stack (or any browser abstraction) into their bundles.
 *
 * Note the semantics: TRUE means CONFIGURED (capable), not consented. Consent
 * is the user's explicit Engine Mode selection (cqdV2Mode 'v3', #398); token
 * acquisition stays non-interactive and happens only on student-work views
 * while v3 is active.
 */

/** What the oauth2 manifest section looks like when present. */
interface ManifestOauth2 {
  client_id?: string;
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

/**
 * Google Chrome only: Edge/Brave/Opera ship the identity permission surface
 * in the manifest, but getAuthToken is Chrome-specific (it never answers on
 * the other Chromium brands).
 */
function isGoogleChromeBrand(): boolean {
  try {
    const uaData = (navigator as Navigator & { userAgentData?: UserAgentData })?.userAgentData;
    return Array.isArray(uaData?.brands) &&
      uaData.brands.some((brand) => brand?.brand === 'Google Chrome');
  } catch {
    return false;
  }
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

  // Background path: chrome.identity works here — check it directly.
  if (typeof chrome.identity?.getAuthToken === 'function') return hasClientId;

  // Content-script path (csaa.7): chrome.identity does not exist there and
  // the whole v3 engine runs in one. The manifest identity permission, the
  // oauth2 client_id, and the Google Chrome brand decide instead — the
  // token request itself relays to the background (CQD_API_TOKEN).
  const hasIdentityPermission = Array.isArray(manifest.permissions) &&
    manifest.permissions.includes('identity');
  if (!hasIdentityPermission) return false;
  if (!hasClientId) return false;
  return isGoogleChromeBrand();
}
