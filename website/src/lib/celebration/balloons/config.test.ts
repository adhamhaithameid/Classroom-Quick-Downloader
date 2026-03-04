import { describe, expect, it } from 'vitest';
import { createBalloonsEngineConfig, detectBalloonDeviceTier } from './config';

describe('balloons config', () => {
  it('detects low-end tier for weak runtime hints', () => {
    const tier = detectBalloonDeviceTier({
      viewport: { width: 1366, height: 768 },
      hardwareConcurrency: 2,
      deviceMemory: 2,
      userAgent: 'Mozilla/5.0'
    });

    expect(tier).toBe('low-end');
  });

  it('creates desktop preset with 40 balloons total', () => {
    const config = createBalloonsEngineConfig({
      viewport: { width: 1400, height: 900 },
      tier: 'desktop',
      reducedMotion: false,
      enabled: true
    });

    expect(config.spawn.waves).toBe(4);
    expect(config.spawn.balloonsPerWave).toBe(10);
    expect(config.spawn.waves * config.spawn.balloonsPerWave).toBe(40);
  });

  it('creates mobile preset with reduced particle count', () => {
    const config = createBalloonsEngineConfig({
      viewport: { width: 390, height: 844 },
      tier: 'mobile',
      reducedMotion: false,
      enabled: true
    });

    expect(config.spawn.waves * config.spawn.balloonsPerWave).toBe(24);
    expect(config.visual.simpleGradients).toBe(false);
  });
});
