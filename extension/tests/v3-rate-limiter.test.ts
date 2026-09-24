import { describe, expect, it } from 'vitest';
import {
  ClassroomApiRateLimiter,
  MAX_CALLS_PER_WINDOW,
} from '../src/engines/v3/api/rate-limiter';

describe('v3/api/rate-limiter', () => {
  it('allows calls up to the budget, then denies silently', () => {
    let now = 0;
    const limiter = new ClassroomApiRateLimiter({ now: () => now, maxCalls: 3 });

    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(true);
    expect(limiter.used()).toBe(3);
    // Over budget: the caller must skip the fetch (csaa.5 silent degrade).
    expect(limiter.acquire()).toBe(false);
    expect(limiter.used()).toBe(3);
  });

  it('recovers budget as calls age out of the rolling window', () => {
    let now = 0;
    const limiter = new ClassroomApiRateLimiter({ now: () => now, maxCalls: 2, windowMs: 1_000 });

    expect(limiter.acquire()).toBe(true);
    now = 500;
    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);

    // First call ages out; the window rolls.
    now = 1_200;
    expect(limiter.acquire()).toBe(true);
    expect(limiter.used()).toBe(2);
  });

  it('uses the documented default budget', () => {
    let now = 0;
    const limiter = new ClassroomApiRateLimiter({ now: () => now });

    let granted = 0;
    while (limiter.acquire()) granted += 1;
    expect(granted).toBe(MAX_CALLS_PER_WINDOW);
    expect(MAX_CALLS_PER_WINDOW).toBe(30);
  });

  it('reset drops every spent call', () => {
    let now = 0;
    const limiter = new ClassroomApiRateLimiter({ now: () => now, maxCalls: 1 });

    expect(limiter.acquire()).toBe(true);
    expect(limiter.acquire()).toBe(false);
    limiter.reset();
    expect(limiter.used()).toBe(0);
    expect(limiter.acquire()).toBe(true);
  });
});
