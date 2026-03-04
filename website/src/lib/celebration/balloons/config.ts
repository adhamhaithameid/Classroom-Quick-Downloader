import type { BalloonViewport, BalloonsEngineConfig, BalloonSpawnPreset } from './types';

export type BalloonDeviceTier = 'desktop' | 'mobile' | 'low-end';

export interface BalloonRuntimeHints {
  viewport: BalloonViewport;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  userAgent?: string;
}

const DEFAULT_PALETTE = [
  '#1d9bf0', '#f91880', '#ffad1f', '#00ba7c', '#7856ff',
  '#ff6b6b', '#2dd4bf', '#60a5fa', '#f472b6', '#f59e0b',
  '#38bdf8', '#fb7185'
] as const;

function createSpawnPreset(tier: BalloonDeviceTier): BalloonSpawnPreset {
  if (tier === 'mobile') {
    return { waves: 4, balloonsPerWave: 6, waveSpacingSeconds: 0.22 };
  }
  if (tier === 'low-end') {
    return { waves: 4, balloonsPerWave: 4, waveSpacingSeconds: 0.24 };
  }
  return { waves: 4, balloonsPerWave: 10, waveSpacingSeconds: 0.22 };
}

export function detectBalloonDeviceTier(hints: BalloonRuntimeHints): BalloonDeviceTier {
  const width = hints.viewport.width;
  const ua = (hints.userAgent || '').toLowerCase();
  const isMobileUA = /android|iphone|ipad|ipod|mobile/.test(ua);
  const isSmallViewport = width < 900;
  const cpu = hints.hardwareConcurrency ?? 8;
  const memory = hints.deviceMemory ?? 8;

  if (cpu <= 4 || memory <= 4) return 'low-end';
  if (isMobileUA || isSmallViewport) return 'mobile';
  return 'desktop';
}

export interface BalloonsConfigOptions {
  viewport: BalloonViewport;
  enabled?: boolean;
  reducedMotion?: boolean;
  tier: BalloonDeviceTier;
}

export function createBalloonsEngineConfig(options: BalloonsConfigOptions): BalloonsEngineConfig {
  const { viewport, tier } = options;

  return {
    enabled: options.enabled ?? true,
    reducedMotion: options.reducedMotion ?? false,
    viewport,
    spawn: createSpawnPreset(tier),
    physics: {
      gravity: 9.8,
      ambientLift: -24,
      minBuoyancy: -27,
      maxBuoyancy: -17,
      minDrag: 0.0012,
      maxDrag: 0.0023,
      minWindStrength: 8,
      maxWindStrength: tier === 'low-end' ? 12 : 22,
      minWindFrequency: 0.07,
      maxWindFrequency: 0.22,
      minWobbleAmplitude: 3,
      maxWobbleAmplitude: tier === 'mobile' ? 8 : 10,
      minWobbleFrequency: 0.4,
      maxWobbleFrequency: 1.5,
      maxFallSpeed: 52,
      maxRiseSpeed: -220
    },
    timing: {
      dtMin: 0.001,
      dtMax: 0.033,
      entryFadeSeconds: 0.55,
      topFadeBandRatio: 0.22,
      cooldownMs: 160
    },
    visual: {
      minDepth: 0.78,
      maxDepth: 1.22,
      minSize: tier === 'mobile' ? 30 : 34,
      maxSize: tier === 'mobile' ? 56 : 64,
      minScale: 0.84,
      maxScale: 1.14,
      minSpin: 3.8,
      maxSpin: 12.6,
      minStringLength: 18,
      maxStringLength: 36,
      edgePaddingMin: 28,
      edgePaddingMax: 72,
      edgePaddingRatio: 0.05,
      simpleGradients: tier === 'low-end'
    },
    palette: DEFAULT_PALETTE
  };
}
