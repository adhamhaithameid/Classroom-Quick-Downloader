export type BalloonsRunState = 'idle' | 'running' | 'coolingDown' | 'done';

export interface BalloonSpawnPreset {
  waves: number;
  balloonsPerWave: number;
  waveSpacingSeconds: number;
}

export interface BalloonViewport {
  width: number;
  height: number;
}

export interface BalloonPhysicsConfig {
  gravity: number;
  ambientLift: number;
  minBuoyancy: number;
  maxBuoyancy: number;
  minDrag: number;
  maxDrag: number;
  minWindStrength: number;
  maxWindStrength: number;
  minWindFrequency: number;
  maxWindFrequency: number;
  minWobbleAmplitude: number;
  maxWobbleAmplitude: number;
  minWobbleFrequency: number;
  maxWobbleFrequency: number;
  maxFallSpeed: number;
  maxRiseSpeed: number;
}

export interface BalloonTimingConfig {
  dtMin: number;
  dtMax: number;
  entryFadeSeconds: number;
  topFadeBandRatio: number;
  cooldownMs: number;
}

export interface BalloonVisualConfig {
  minDepth: number;
  maxDepth: number;
  minSize: number;
  maxSize: number;
  minScale: number;
  maxScale: number;
  minSpin: number;
  maxSpin: number;
  minStringLength: number;
  maxStringLength: number;
  edgePaddingMin: number;
  edgePaddingMax: number;
  edgePaddingRatio: number;
  simpleGradients: boolean;
}

export interface BalloonsEngineConfig {
  enabled: boolean;
  reducedMotion: boolean;
  viewport: BalloonViewport;
  spawn: BalloonSpawnPreset;
  physics: BalloonPhysicsConfig;
  timing: BalloonTimingConfig;
  visual: BalloonVisualConfig;
  palette: readonly string[];
}

export interface BalloonParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  depth: number;
  rotation: number;
  spinVelocity: number;
  scale: number;
  baseScale: number;
  opacity: number;
  launchDelay: number;
  buoyancy: number;
  drag: number;
  windStrength: number;
  windFrequency: number;
  windPhase: number;
  wobbleAmplitude: number;
  wobbleFrequency: number;
  wobblePhase: number;
  stringLength: number;
  color: string;
  accentColor: string;
  shadowColor: string;
  stringColor: string;
  simpleGradients: boolean;
}

export interface BalloonsStepOptions {
  hidden?: boolean;
}

export interface BalloonsEngine {
  start(seed?: number): BalloonsRunState;
  step(now: number, options?: BalloonsStepOptions): BalloonsRunState;
  stop(): void;
  setViewport(viewport: BalloonViewport): void;
  getParticles(): readonly BalloonParticle[];
  getState(): BalloonsRunState;
}
