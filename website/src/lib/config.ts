const DEFAULT_SITE_URL = 'https://adhamhaithameid.github.io/Classroom-Quick-Downloader';
const DEFAULT_WORKER_URL = 'https://cqd-analytics.adhamhaithameid.workers.dev';

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

const env = import.meta.env;

export const SITE_URL = ensureUrl(env.PUBLIC_SITE_URL ?? '', DEFAULT_SITE_URL);
export const ORACLE_API_BASE_URL = cleanBaseUrl(env.PUBLIC_ORACLE_API_BASE_URL ?? '');
export const WORKER_BASE_URL = ensureUrl(env.PUBLIC_WORKER_BASE_URL ?? '', DEFAULT_WORKER_URL);

export const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/1nB95r35O_h98odg8Y6_OrfYdjKGBqhrUCb_wFHA-RA8/viewform';

export const STORE_LINKS = {
  chrome:
    'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid',
  firefox: 'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/',
  edge:
    'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn',
  github: 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader'
} as const;
