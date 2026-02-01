// filepath: extension/entrypoints/utils/analytics/detection.ts
/**
 * Browser, OS, and extension detection utilities.
 */

let cachedVersion: string | null = null;

/**
 * Detect browser from user agent.
 */
export function detectBrowser(): string {
  const ua = navigator?.userAgent ?? '';
  if (/Edg\//i.test(ua)) return 'edge';
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'opera';
  if (/Firefox/i.test(ua)) return 'firefox';
  if (/Chrome/i.test(ua)) return 'chrome';
  if (/Safari/i.test(ua)) return 'safari';
  return 'unknown';
}

/**
 * Detect OS from platform hints or user agent.
 */
export async function detectOS(): Promise<string> {
  try {
    if ((navigator as any).userAgentData?.getHighEntropyValues) {
      const { platform } = await (navigator as any).userAgentData.getHighEntropyValues(['platform']);
      if (platform) return platform.toLowerCase();
    }
  } catch { /* ignore */ }
  const ua = navigator?.userAgent ?? '';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(ua)) return 'macos';
  if (/Android/i.test(ua)) return 'android';
  if (/Linux/i.test(ua)) return 'linux';
  if (/iOS|iPhone|iPad/i.test(ua)) return 'ios';
  return 'unknown';
}

/**
 * Detect user language.
 */
export function detectLanguage(): string {
  const lang = navigator?.language ?? 'unknown';
  const short = lang.split('-')[0].toLowerCase();
  if (!short || short.length > 5) return 'unknown';
  return short;
}

/**
 * Get extension version from manifest.
 */
export function getExtensionVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const manifest = chrome?.runtime?.getManifest?.();
    if (manifest?.version) {
      cachedVersion = manifest.version;
      return cachedVersion;
    }
  } catch { /* ignore */ }
  return 'unknown';
}

/**
 * Bucket download duration into speed categories.
 */
export function bucketDuration(durationMs: number): 'fast' | 'medium' | 'slow' {
  if (durationMs < 2000) return 'fast';
  if (durationMs < 10000) return 'medium';
  return 'slow';
}

/**
 * Generate cryptographically strong unique event ID.
 * Format: ext-<timestamp>-<random12chars>
 */
export function generateEventId(): string {
  const ts = Date.now().toString(36);
  let rand = '';
  try {
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    rand = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
  } catch {
    rand = Math.random().toString(36).slice(2, 14);
  }
  return `ext-${ts}-${rand}`;
}
