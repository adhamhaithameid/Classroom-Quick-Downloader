import { describe, expect, it } from 'vitest';
import { createBalloonsEngineConfig } from './config';
import { createBalloonsEngine } from './engine';

function snapshotParticles(seed: number) {
  const config = createBalloonsEngineConfig({
    viewport: { width: 1280, height: 720 },
    tier: 'desktop',
    reducedMotion: false,
    enabled: true
  });

  const engine = createBalloonsEngine(config);
  engine.start(seed);
  engine.step(1000);
  engine.step(1016);
  engine.step(1032);

  return engine.getParticles().slice(0, 5).map((p) => ({
    x: Number(p.x.toFixed(4)),
    y: Number(p.y.toFixed(4)),
    vx: Number(p.vx.toFixed(4)),
    vy: Number(p.vy.toFixed(4)),
    opacity: Number(p.opacity.toFixed(4)),
    rotation: Number(p.rotation.toFixed(4))
  }));
}

describe('balloons engine', () => {
  it('is deterministic with the same seed', () => {
    expect(snapshotParticles(42)).toEqual(snapshotParticles(42));
  });

  it('keeps physics values inside expected bounds', () => {
    const config = createBalloonsEngineConfig({
      viewport: { width: 1366, height: 800 },
      tier: 'desktop',
      reducedMotion: false,
      enabled: true
    });

    const engine = createBalloonsEngine(config);
    engine.start(777);

    let now = 1000;
    engine.step(now);

    for (let frame = 0; frame < 240; frame++) {
      now += 16;
      engine.step(now);
    }

    for (const p of engine.getParticles()) {
      expect(p.vy).toBeGreaterThanOrEqual(config.physics.maxRiseSpeed);
      expect(p.vy).toBeLessThanOrEqual(config.physics.maxFallSpeed);
      expect(p.opacity).toBeGreaterThanOrEqual(0);
      expect(p.opacity).toBeLessThanOrEqual(1);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.rotation)).toBe(true);
    }
  });

  it('schedules waves with exact count and expected delay windows', () => {
    const config = createBalloonsEngineConfig({
      viewport: { width: 1200, height: 900 },
      tier: 'desktop',
      reducedMotion: false,
      enabled: true
    });

    const engine = createBalloonsEngine(config);
    engine.start(91);

    const particles = engine.getParticles();
    const expectedTotal = config.spawn.waves * config.spawn.balloonsPerWave;
    expect(particles).toHaveLength(expectedTotal);

    particles.forEach((particle, index) => {
      const waveIndex = Math.floor(index / config.spawn.balloonsPerWave);
      const minDelay = waveIndex * config.spawn.waveSpacingSeconds;
      const maxDelay = minDelay + 0.34;
      expect(particle.launchDelay).toBeGreaterThanOrEqual(minDelay);
      expect(particle.launchDelay).toBeLessThan(maxDelay);
    });
  });

  it('enters done state and clears particles after exit', () => {
    const config = createBalloonsEngineConfig({
      viewport: { width: 1280, height: 720 },
      tier: 'desktop',
      reducedMotion: false,
      enabled: true
    });

    const engine = createBalloonsEngine(config);
    let state = engine.start(11);
    let now = 1000;

    state = engine.step(now);
    for (let i = 0; i < 1200 && state !== 'done'; i++) {
      now += 33;
      state = engine.step(now);
    }

    expect(state).toBe('done');
    expect(engine.getParticles()).toHaveLength(0);
  });

  it('returns no particles in reduced-motion mode', () => {
    const config = createBalloonsEngineConfig({
      viewport: { width: 1280, height: 720 },
      tier: 'desktop',
      reducedMotion: true,
      enabled: true
    });

    const engine = createBalloonsEngine(config);
    const state = engine.start(33);
    expect(state).toBe('done');
    expect(engine.getParticles()).toHaveLength(0);
  });
});
