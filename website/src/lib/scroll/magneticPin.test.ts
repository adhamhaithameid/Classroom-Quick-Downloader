import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ESCAPE_PX,
  HOLD_OFFSET_PX,
  INTENT_PX,
  PULL_BAND_PX,
  SETTLE_RATE,
  detentZone,
  inZone,
  settleStep
} from './magneticPin';

describe('detentZone', () => {
  it('spans the pull band above the pin and the escape run below the hold', () => {
    const zone = detentZone(4000);
    expect(zone.hold).toBe(4000 + HOLD_OFFSET_PX);
    expect(zone.lo).toBe(4000 - PULL_BAND_PX);
    expect(zone.hi).toBe(4000 + HOLD_OFFSET_PX + ESCAPE_PX);
  });

  it('never lets the escape window sit below the hold point', () => {
    const zone = detentZone(100, 56, 150, 0);
    expect(zone.hi).toBe(zone.hold);
  });
});

describe('inZone', () => {
  const zone = detentZone(1000);

  it('contains the band, the pin and the hold', () => {
    expect(inZone(1000 - PULL_BAND_PX, zone)).toBe(true);
    expect(inZone(1000, zone)).toBe(true);
    expect(inZone(1000 + HOLD_OFFSET_PX, zone)).toBe(true);
  });

  it('excludes scroll positions outside the capture band', () => {
    expect(inZone(1000 - PULL_BAND_PX - 1, zone)).toBe(false);
    expect(inZone(1000 + HOLD_OFFSET_PX + ESCAPE_PX + 1, zone)).toBe(false);
  });
});

describe('settleStep', () => {
  it('eases toward the target without overshooting', () => {
    expect(settleStep(3850, 4056, 1)).toBeLessThan(4056);
    expect(settleStep(3850, 4056, 1)).toBeGreaterThan(3850);
    expect(settleStep(3850, 4056, 60)).toBeCloseTo(4056, 0);
  });

  it('composes across frames: two steps equal one double-rate step', () => {
    const stepped = settleStep(settleStep(3850, 4056, 1), 4056, 1);
    expect(stepped).toBeCloseTo(settleStep(3850, 4056, 2), 6);
  });

  it('keeps the settled position when already at rest', () => {
    expect(settleStep(4056, 4056, 4)).toBe(4056);
  });
});

/* Source guards — the detent's safety contract is load-bearing, so pin the
   implementation, not just the math (house style: layout.shell.test.ts). */
describe('magneticPin source contract', () => {
  const source = readFileSync(new URL('./magneticPin.ts', import.meta.url), 'utf8');

  it('intercepts only cancelable wheel input — momentum is never fought', () => {
    // The catch and the engaged-branch prevention must both be gated on
    // cancelability; non-cancelable momentum falls through to native
    // scrolling and is absorbed by the takeover logic instead.
    expect(source).toMatch(/if \(!armed \|\| !event\.cancelable \|\| dy <= 0\) return;/);
    expect(source).toMatch(/if \(event\.cancelable\) \{\s*\n\s*event\.preventDefault\(\);/);
    expect(source).toContain("{ passive: true }"); // scroll listener stays passive
    // The holding branch counts native movement as signed intent (either
    // direction can break the hold).
    expect(source).toMatch(/if \(inside\) \{\s*\n\s*\/\* Native movement while held[\s\S]*?intent \+= dy;/);
  });

  it('holds firm: sustained push, separator beat, no release jump', () => {
    // Release threshold above one wheel tick (~105px).
    expect(INTENT_PX).toBeGreaterThanOrEqual(260);
    // A stale push starts over — tick-then-pause never releases.
    expect(source).toContain('INTENT_DECAY_MS');
    expect(source).toMatch(/if \(now - lastIntentAt > INTENT_DECAY_MS\) intent = 0;/);
    // The settle-in is the separator beat: no release while settling.
    expect(source).toMatch(/if \(phase === 'holding'\) \{\s*\n\s*if \(intent >= intentLimit\) release\(\);/);
    // Release hands back to native scrolling — no instant scrollTo jump.
    const releaseFn = source.match(/function release\(\): void \{[\s\S]*?\n  \}/);
    expect(releaseFn).toBeTruthy();
    expect(releaseFn?.[0]).not.toContain('scrollTo');
  });

  it('hands control back the moment the user moves (takeover abort)', () => {
    expect(source).toContain('TAKEOVER_PX');
    expect(source).toContain("phase = 'free'");
  });

  it('gates the catch on reduced motion and live eligibility', () => {
    expect(source).toContain('reduced.matches');
    expect(source).toContain('options.isEligible()');
  });

  it('re-arms only after the zone is left, so a release is never re-caught', () => {
    expect(source).toMatch(/if \(!inside\) \{[\s\S]*?armed = true/);
  });

  it('stays within the tuned detent envelope', () => {
    /* Hold sits exactly at the pin: the last section reads as the end of
       the page, zero footer visible at rest (user-approved contract). */
    expect(HOLD_OFFSET_PX).toBe(0);
    expect(INTENT_PX).toBeGreaterThan(50);
    expect(SETTLE_RATE).toBeLessThan(0.5);
  });
});
