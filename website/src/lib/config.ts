import { env } from '$env/dynamic/public';

const DEFAULT_SITE_URL = 'https://classroom-quick-downloader-website.pages.dev';
const DEFAULT_WORKER_URL = 'https://cqd-analytics.adhamhaithameid.workers.dev';
const DEFAULT_ORACLE_URL = DEFAULT_WORKER_URL;

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

export const SITE_URL = ensureUrl(env.PUBLIC_SITE_URL ?? '', DEFAULT_SITE_URL);
export const ORACLE_API_BASE_URL = ensureUrl(env.PUBLIC_ORACLE_API_BASE_URL ?? '', DEFAULT_ORACLE_URL);
export const WORKER_BASE_URL = ensureUrl(env.PUBLIC_WORKER_BASE_URL ?? '', DEFAULT_WORKER_URL);

export const STORE_LINKS = {
  chrome:
    'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/',
  edge:
    'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn',
  github: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader'
} as const;
