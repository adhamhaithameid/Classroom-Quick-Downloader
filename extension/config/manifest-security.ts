const DEFAULT_WORKER_TRACK_URL = 'https://cqd-analytics.adhamhaithameid.workers.dev/track';
const DEFAULT_WORKER_ORIGIN = new URL(DEFAULT_WORKER_TRACK_URL).origin;

const STATIC_HOST_PERMISSIONS = [
  'https://drive.google.com/*',
  'https://classroom.google.com/*',
  'https://drive.usercontent.google.com/*',
  'https://accounts.google.com/*',
];

const STATIC_CONNECT_SRC_ORIGINS = [
  'https://drive.google.com',
  'https://classroom.google.com',
  'https://drive.usercontent.google.com',
  'https://accounts.google.com',
];

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function parseOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.origin;
    }
    return null;
  } catch {
    return null;
  }
}

export function resolveWorkerOrigin(workerUrl = process.env.VITE_WORKER_URL): string {
  const raw = (workerUrl ?? '').trim();
  if (!raw) return DEFAULT_WORKER_ORIGIN;
  return parseOrigin(raw) ?? DEFAULT_WORKER_ORIGIN;
}

export function buildHostPermissions(workerUrl = process.env.VITE_WORKER_URL): string[] {
  const workerOrigin = resolveWorkerOrigin(workerUrl);
  return dedupe([
    ...STATIC_HOST_PERMISSIONS,
    `${workerOrigin}/*`,
  ]);
}

export function buildExtensionPagesCsp(workerUrl = process.env.VITE_WORKER_URL): string {
  const workerOrigin = resolveWorkerOrigin(workerUrl);
  const connectSrc = dedupe([
    '\'self\'',
    workerOrigin,
    ...STATIC_CONNECT_SRC_ORIGINS,
  ]);

  return [
    'default-src \'self\';',
    'script-src \'self\';',
    'object-src \'self\';',
    `connect-src ${connectSrc.join(' ')};`,
  ].join(' ');
}
