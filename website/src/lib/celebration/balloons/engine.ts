import { deriveBalloonPalette } from './color';
import type {
  BalloonParticle,
  BalloonViewport,
  BalloonsEngine,
  BalloonsEngineConfig,
  BalloonsRunState,
  BalloonsStepOptions
} from './types';

function createSeededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveEdgePadding(config: BalloonsEngineConfig): number {
  const width = config.viewport.width;
  const ratioPad = width * config.visual.edgePaddingRatio;
  return clamp(ratioPad, config.visual.edgePaddingMin, config.visual.edgePaddingMax);
}

function spawnParticles(config: BalloonsEngineConfig, rng: () => number): BalloonParticle[] {
  const viewW = Math.max(1, config.viewport.width);
  const viewH = Math.max(1, config.viewport.height);
  const edgePadding = resolveEdgePadding(config);
  const waves = config.spawn.waves;
  const perWave = config.spawn.balloonsPerWave;
  const total = waves * perWave;
  const particles: BalloonParticle[] = [];

  for (let i = 0; i < total; i++) {
    const wave = Math.floor(i / perWave);
    const depth = config.visual.minDepth + rng() * (config.visual.maxDepth - config.visual.minDepth);
    const size = (config.visual.minSize + rng() * (config.visual.maxSize - config.visual.minSize)) * depth;
    const launchDelay = wave * config.spawn.waveSpacingSeconds + rng() * 0.34;
    const baseScale = config.visual.minScale + rng() * (config.visual.maxScale - config.visual.minScale);

    const spread = edgePadding + rng() * Math.max(120, viewW - edgePadding * 2);
    const arcOffset = Math.sin((i / Math.max(1, total - 1)) * Math.PI * 2) * viewW * 0.07;
    const x = clamp(spread + arcOffset, edgePadding, viewW - edgePadding);
    const y = viewH + size * (0.8 + rng() * 0.9);

    const color = config.palette[i % config.palette.length] || '#1d9bf0';
    const palette = deriveBalloonPalette(color);

    const spin =
      (config.visual.minSpin + rng() * (config.visual.maxSpin - config.visual.minSpin)) *
      (rng() > 0.5 ? 1 : -1);

    particles.push({
      id: i + 1,
      x,
      y,
      vx: (rng() - 0.5) * 11,
      vy: -(46 + rng() * 22),
      size,
      depth,
      rotation: 0,
      spinVelocity: spin,
      scale: baseScale,
      baseScale,
      opacity: 0,
      launchDelay,
      buoyancy: config.physics.minBuoyancy + rng() * (config.physics.maxBuoyancy - config.physics.minBuoyancy),
      drag: config.physics.minDrag + rng() * (config.physics.maxDrag - config.physics.minDrag),
      windStrength: config.physics.minWindStrength + rng() * (config.physics.maxWindStrength - config.physics.minWindStrength),
      windFrequency: config.physics.minWindFrequency + rng() * (config.physics.maxWindFrequency - config.physics.minWindFrequency),
      windPhase: rng() * Math.PI * 2,
      wobbleAmplitude:
        config.physics.minWobbleAmplitude +
        rng() * (config.physics.maxWobbleAmplitude - config.physics.minWobbleAmplitude),
      wobbleFrequency:
        config.physics.minWobbleFrequency +
        rng() * (config.physics.maxWobbleFrequency - config.physics.minWobbleFrequency),
      wobblePhase: rng() * Math.PI * 2,
      stringLength: config.visual.minStringLength + rng() * (config.visual.maxStringLength - config.visual.minStringLength),
      color: palette.color,
      accentColor: palette.accentColor,
      shadowColor: palette.shadowColor,
      stringColor: palette.stringColor,
      simpleGradients: config.visual.simpleGradients
    });
  }

  return particles;
}

export function createBalloonsEngine(initialConfig: BalloonsEngineConfig): BalloonsEngine {
  let config = initialConfig;
  let particles: BalloonParticle[] = [];
  let runState: BalloonsRunState = 'idle';
  let startedAt = 0;
  let lastStepAt = 0;
  let coolingStartedAt = 0;

  const resetTimers = (): void => {
    startedAt = 0;
    lastStepAt = 0;
    coolingStartedAt = 0;
  };

  return {
    start(seed?: number): BalloonsRunState {
      if (!config.enabled || config.reducedMotion || config.viewport.width <= 0 || config.viewport.height <= 0) {
        particles = [];
        runState = 'done';
        resetTimers();
        return runState;
      }

      const rng = createSeededRandom(seed ?? Date.now());
      particles = spawnParticles(config, rng);
      runState = particles.length > 0 ? 'running' : 'done';
      resetTimers();
      return runState;
    },

    step(now: number, options?: BalloonsStepOptions): BalloonsRunState {
      if (runState === 'idle' || runState === 'done') return runState;
      if (!Number.isFinite(now) || now <= 0) return runState;

      if (options?.hidden) {
        lastStepAt = now;
        return runState;
      }

      if (startedAt === 0) {
        startedAt = now;
        lastStepAt = now;
        return runState;
      }

      const dt = clamp((now - lastStepAt) / 1000, config.timing.dtMin, config.timing.dtMax);
      lastStepAt = now;
      const elapsed = (now - startedAt) / 1000;
      const viewH = Math.max(1, config.viewport.height);
      let anyAlive = false;

      for (const particle of particles) {
        const t = elapsed - particle.launchDelay;
        if (t < 0) {
          anyAlive = true;
          continue;
        }

        const dragY = particle.drag * particle.vy * Math.abs(particle.vy);
        const accelY = config.physics.gravity + config.physics.ambientLift + particle.buoyancy - dragY;
        particle.vy += accelY * dt;
        particle.vy = clamp(particle.vy, config.physics.maxRiseSpeed, config.physics.maxFallSpeed);

        const gust =
          Math.sin((t + particle.windPhase) * Math.PI * 2 * particle.windFrequency) +
          0.32 *
            Math.sin((t * 1.8 + particle.windPhase * 0.6) * Math.PI * 2 * (particle.windFrequency * 0.65 + 0.04));

        const targetVx = gust * particle.windStrength;
        particle.vx += (targetVx - particle.vx) * Math.min(1, dt * 2.3);
        particle.vx *= 1 - Math.min(0.18, particle.drag * 14 * dt);

        const wobble = Math.sin((t + particle.wobblePhase) * Math.PI * 2 * particle.wobbleFrequency) * particle.wobbleAmplitude;
        particle.x += (particle.vx + wobble * 0.8) * dt;
        particle.y += particle.vy * dt;

        particle.spinVelocity *= 1 - Math.min(0.06, dt * 0.06);
        particle.rotation += (particle.spinVelocity + particle.vx * 0.05 + wobble * 0.18) * dt;
        particle.scale = particle.baseScale + Math.sin((t + particle.windPhase) * 1.9) * 0.03;

        if (t < config.timing.entryFadeSeconds) {
          particle.opacity = Math.min(1, t / config.timing.entryFadeSeconds);
        } else if (particle.y < viewH * 0.06) {
          const fadeRange = Math.max(80, viewH * config.timing.topFadeBandRatio);
          particle.opacity = clamp((particle.y + fadeRange) / fadeRange, 0, 1);
        } else {
          particle.opacity = 1;
        }

        if (particle.y + particle.size * 2.4 > -viewH * 0.12) anyAlive = true;
      }

      if (anyAlive) {
        runState = 'running';
        return runState;
      }

      if (runState === 'running') {
        runState = 'coolingDown';
        coolingStartedAt = now;
        return runState;
      }

      if (runState === 'coolingDown' && now - coolingStartedAt >= config.timing.cooldownMs) {
        runState = 'done';
        particles = [];
      }

      return runState;
    },

    stop(): void {
      particles = [];
      runState = 'done';
      resetTimers();
    },

    setViewport(viewport: BalloonViewport): void {
      config = {
        ...config,
        viewport: {
          width: Math.max(0, viewport.width),
          height: Math.max(0, viewport.height)
        }
      };
    },

    getParticles(): readonly BalloonParticle[] {
      return particles;
    },

    getState(): BalloonsRunState {
      return runState;
    }
  };
}
