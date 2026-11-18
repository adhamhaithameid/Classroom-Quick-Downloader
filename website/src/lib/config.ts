import { WEBSITE_MANUAL_RELEASE_VERSION } from '#lib/content/release-version.manual.generated.ts';
import {
  PUBLIC_SITE_URL as ENV_SITE_URL,
  PUBLIC_API_BASE_URL as ENV_API_BASE_URL,
  PUBLIC_ORACLE_API_BASE_URL as ENV_ORACLE_API_BASE_URL,
  PUBLIC_WORKER_BASE_URL as ENV_WORKER_BASE_URL,
  PUBLIC_SITE_BACKEND_BASE_URL as ENV_SITE_BACKEND_BASE_URL,
  PUBLIC_APP_VERSION as ENV_APP_VERSION,
  PUBLIC_ENABLE_FEEDBACK_NAV as ENV_ENABLE_FEEDBACK_NAV,
  PUBLIC_GOOGLE_SITE_VERIFICATION as ENV_GOOGLE_SITE_VERIFICATION,
  PUBLIC_BING_SITE_VERIFICATION as ENV_BING_SITE_VERIFICATION,
  PUBLIC_INDEXNOW_KEY as ENV_INDEXNOW_KEY
} from '$app/env/public';

const DEFAULT_SITE_URL = 'https://classroom-quick-downloader.adhamhaithameid.is-a.dev';
const DEFAULT_WORKER_URL = 'https://cqd-analytics.adhamhaithameid.workers.dev';
const DEFAULT_PUBLIC_API_URL = DEFAULT_WORKER_URL;
const DEFAULT_APP_VERSION = WEBSITE_MANUAL_RELEASE_VERSION.websiteLabel;
const DEFAULT_GOOGLE_SITE_VERIFICATION = 'qoyovUKFViRL3vVnI2gPpk0kl_4TiLEdj94Co1JdrvI';

function cleanBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function ensureUrl(value: string, fallback: string): string {
  const candidate = cleanBaseUrl(value);
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    return cleanBaseUrl(parsed.origin + parsed.pathname);
  } catch {
    return fallback;
	}
}

function envBool(value: string | undefined, fallback = false): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function envText(value: string | undefined, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

// Deterministic on server and client: canonical/JSON-LD must not depend on the
// browser origin, or hydration sees different SEO tags (bead vsyk).
export const SITE_URL = ensureUrl(ENV_SITE_URL ?? '', DEFAULT_SITE_URL);
// Canonical base for public website data. The Cloudflare Worker serves this
// data itself (edge snapshot + live store stats); the legacy env name is still
// honored so existing deployments keep working.
export const PUBLIC_API_BASE_URL = ensureUrl(
  ENV_API_BASE_URL ?? ENV_ORACLE_API_BASE_URL ?? '',
  DEFAULT_PUBLIC_API_URL
);
/** @deprecated Use {@link PUBLIC_API_BASE_URL} — kept for backward compatibility. */
export const ORACLE_API_BASE_URL = PUBLIC_API_BASE_URL;
export const WORKER_BASE_URL = ensureUrl(ENV_WORKER_BASE_URL ?? '', DEFAULT_WORKER_URL);
export const SITE_BACKEND_BASE_URL = ensureUrl(ENV_SITE_BACKEND_BASE_URL ?? '', WORKER_BASE_URL);
export const APP_VERSION = (() => {
  const raw = (ENV_APP_VERSION ?? DEFAULT_APP_VERSION).trim();
  if (!raw) return DEFAULT_APP_VERSION;
  return raw.startsWith('v') ? raw : `v${raw}`;
})();
export const ENABLE_FEEDBACK_NAV = envBool(ENV_ENABLE_FEEDBACK_NAV, false);
export const GOOGLE_SITE_VERIFICATION = envText(ENV_GOOGLE_SITE_VERIFICATION, DEFAULT_GOOGLE_SITE_VERIFICATION);
export const BING_SITE_VERIFICATION = envText(ENV_BING_SITE_VERIFICATION);
export const INDEXNOW_KEY = envText(ENV_INDEXNOW_KEY);

export const STORE_LINKS = {
  chrome:
    'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/',
  edge:
    'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn',
  github: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader'
} as const;
