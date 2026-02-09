// filepath: extension/entrypoints/utils/analytics/rate-limiter.ts
/**
 * Client-side rate limiting for analytics requests.
 * Defense in depth - prevents excessive API calls.
 */

import { STORAGE_KEYS, MAX_DAILY_REQUESTS } from './constants';
import { storageGet, storageSet } from './storage';
import type { RateLimitState } from './types';

/**
 * Get the rate limit date string (resets at 1:00 AM UTC).
 */
function getRateLimitDate(): string {
  const now = new Date();
  // If before 1:00 AM UTC, use previous UTC day
  if (now.getUTCHours() < 1) {
    now.setUTCDate(now.getUTCDate() - 1);
  }
  return now.toISOString().slice(0, 10);
}

/**
 * Check if we can make a request today and increment counter.
 */
export async function checkAndIncrementRateLimit(maxDailyRequests = MAX_DAILY_REQUESTS): Promise<{
  allowed: boolean;
  remaining: number;
  isNewDay: boolean;
}> {
  const limit = Number.isFinite(maxDailyRequests)
    ? Math.max(1, Math.floor(maxDailyRequests))
    : MAX_DAILY_REQUESTS;
  const today = getRateLimitDate();
  const raw = await storageGet(STORAGE_KEYS.RATE_LIMIT);
  const state: RateLimitState = raw ?? { date: '', count: 0 };

  // New day - reset counter
  if (state.date !== today) {
    const newState: RateLimitState = { date: today, count: 1 };
    await storageSet({ [STORAGE_KEYS.RATE_LIMIT]: newState });
    return {
      allowed: true,
      remaining: limit - 1,
      isNewDay: true,
    };
  }

  // Check if under limit
  if (state.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      isNewDay: false,
    };
  }

  // Increment counter
  state.count++;
  await storageSet({ [STORAGE_KEYS.RATE_LIMIT]: state });

  return {
    allowed: true,
    remaining: limit - state.count,
    isNewDay: false,
  };
}
