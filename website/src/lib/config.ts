import { env } from '$env/dynamic/public';

const DEFAULT_SITE_URL = 'https://classroom-quick-downloader-website.pages.dev';
const DEFAULT_WORKER_URL = 'https://cqd-analytics.adhamhaithameid.workers.dev';
const DEFAULT_ORACLE_URL = 'https://oracle.classroom-quick-downloader.com';
const DEFAULT_APP_VERSION = 'v1.3.8';

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

function resolveDefaultSiteUrl(): string {
	if (typeof window !== 'undefined') {
		try {
			const origin = cleanBaseUrl(window.location.origin);
			if (origin.startsWith('https://') || origin.startsWith('http://')) {
				return origin;
			}
		} catch {
			// fall through to static fallback
		}
	}
	return DEFAULT_SITE_URL;
}

function envBool(value: string | undefined, fallback = false): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export const SITE_URL = ensureUrl(env.PUBLIC_SITE_URL ?? '', resolveDefaultSiteUrl());
export const ORACLE_API_BASE_URL = ensureUrl(env.PUBLIC_ORACLE_API_BASE_URL ?? '', DEFAULT_ORACLE_URL);
export const WORKER_BASE_URL = ensureUrl(env.PUBLIC_WORKER_BASE_URL ?? '', DEFAULT_WORKER_URL);
export const APP_VERSION = (() => {
  const raw = (env.PUBLIC_APP_VERSION ?? DEFAULT_APP_VERSION).trim();
  if (!raw) return DEFAULT_APP_VERSION;
  return raw.startsWith('v') ? raw : `v${raw}`;
})();
export const ENABLE_FEEDBACK_NAV = envBool(env.PUBLIC_ENABLE_FEEDBACK_NAV, false);

export const STORE_LINKS = {
  chrome:
    'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/',
  edge:
    'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn',
  github: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader'
} as const;
