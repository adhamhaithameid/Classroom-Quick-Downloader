// filepath: cloudflare-worker/src/downloads_do/helpers.ts
/**
 * Helper functions for the Durable Object.
 */

/**
 * Get today's date in UTC as YYYY-MM-DD string.
 */
export function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Create a JSON Response with proper headers.
 */
export function json<T>(obj: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Response(JSON.stringify(obj), {
    ...init,
    headers,
  });
}

/**
 * Get the start of the current hour as ISO string.
 */
export function getCurrentHourStart(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now.toISOString();
}

/**
 * Get the end of the current hour as ISO string.
 */
export function getCurrentHourEnd(): string {
  const now = new Date();
  now.setMinutes(59, 59, 999);
  return now.toISOString();
}

/**
 * Mask an IP address for privacy (keep first two octets only for IPv4).
 */
export function maskIpAddress(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  // IPv6 or other - just take first segment
  return ip.split(':')[0] + ':*';
}

/**
 * Generates a random string using cryptographically secure random values.
 * Uses lowercase alphanumeric characters (a-z, 0-9).
 *
 * @param length The length of the string to generate
 */
export function generateSecureRandomString(length: number): string {
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

/**
 * Generates a random number in the range [0, 1) using
 * cryptographically secure random values.
 * Use this as a secure drop-in replacement for Math.random().
 */
export function secureRandom(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / (0xffffffff + 1);
}
