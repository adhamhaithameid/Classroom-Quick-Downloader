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
  return new Response(JSON.stringify(obj), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...(init.headers ?? {}),
    },
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
