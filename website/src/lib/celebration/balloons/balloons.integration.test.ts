import { describe, expect, it } from 'vitest';
import { canStartCelebration, nextCooldownUntil } from './controller';
import { createBalloonsEngineConfig } from './config';
import { createBalloonsEngine } from './engine';

describe('balloons integration behavior', () => {
  it('prevents duplicate starts while active and enforces cooldown/session gate', () => {
    const now = 1000;

    expect(
      canStartCelebration({
        nowMs: now,
        reducedMotion: false,
        active: false,
        sessionPlayed: false,
        cooldownUntilMs: now - 1
      })
    ).toBe(true);

    expect(
      canStartCelebration({
        nowMs: now,
        reducedMotion: false,
        active: true,
        sessionPlayed: false,
        cooldownUntilMs: now - 1
      })
    ).toBe(false);

    expect(
      canStartCelebration({
        nowMs: now,
        reducedMotion: false,
        active: false,
        sessionPlayed: true,
        cooldownUntilMs: now - 1
      })
    ).toBe(false);

    expect(nextCooldownUntil(now, 1200)).toBe(2200);
  });

  it('pauses updates while hidden and resumes without jump spikes', () => {
    const config = createBalloonsEngineConfig({
      viewport: { width: 1280, height: 720 },
      tier: 'desktop',
      reducedMotion: false,
      enabled: true
    });

    const engine = createBalloonsEngine(config);
    engine.start(1234);
    engine.step(1000);
    engine.step(1016);

    const before = engine.getParticles()[0];
    expect(before).toBeDefined();
    if (!before) return;

    engine.step(5000, { hidden: true });
    engine.step(5016, { hidden: false });

    const after = engine.getParticles()[0];
    expect(after).toBeDefined();
    if (!after) return;

    const deltaY = Math.abs(after.y - before.y);
    expect(deltaY).toBeLessThan(30);
  });
});
