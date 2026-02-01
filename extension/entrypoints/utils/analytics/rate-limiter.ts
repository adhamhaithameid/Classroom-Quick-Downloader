// filepath: extension/entrypoints/utils/analytics/rate-limiter.ts
/**
 * Client-side rate limiting for analytics requests.
 * Defense in depth - prevents excessive API calls.
 */

import { STORAGE_KEYS, MAX_DAILY_REQUESTS } from './constants';
import { storageGet, storageSet } from './storage';
import type { RateLimitState } from './types';

/**
 * Get the rate limit date string (resets at 1:00 AM local time).
 */
function getRateLimitDate(): string {
  const now = new Date();
  // If before 1:00 AM, use previous day
  if (now.getHours() < 1) {
    now.setDate(now.getDate() - 1);
  }
  return now.toISOString().slice(0, 10);
}

/**
 * Check if we can make a request today and increment counter.
 */
export async function checkAndIncrementRateLimit(): Promise<{
  allowed: boolean;
  remaining: number;
  isNewDay: boolean;
}> {
  const today = getRateLimitDate();
  const raw = await storageGet(STORAGE_KEYS.RATE_LIMIT);
  const state: RateLimitState = raw ?? { date: '', count: 0 };

  // New day - reset counter
  if (state.date !== today) {
    const newState: RateLimitState = { date: today, count: 1 };
    await storageSet({ [STORAGE_KEYS.RATE_LIMIT]: newState });
    return {
      allowed: true,
      remaining: MAX_DAILY_REQUESTS - 1,
      isNewDay: true,
    };
  }

  // Check if under limit
  if (state.count >= MAX_DAILY_REQUESTS) {
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
    remaining: MAX_DAILY_REQUESTS - state.count,
    isNewDay: false,
  };
}
