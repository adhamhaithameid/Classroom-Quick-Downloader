/**
 * Shadow router policy (bead hhpa.2). Scores engine modes from the local
 * stats store (hhpa.1) plus availability, with stickiness (hysteresis) and
 * a switch cooldown against oscillation. PURE and advisory: the shadow
 * wiring (router-shadow.ts) logs the decision and NEVER applies it —
 * activation is hhpa.3 behind an explicit opt-in, and default-on awaits
 * owner review of shadow data.
 */

import type { EngineMode } from '../types';

export type RouterCandidateMode = Extract<EngineMode, 'legacy' | 'v2' | 'v3'>;

export interface CandidateInput {
  mode: RouterCandidateMode;
  /** false excludes the candidate (e.g. v3 without the API configured). */
  available: boolean;
  attempts: number;
  saved: number;
  failureStreak: number;
}

export interface ScoredCandidate {
  mode: RouterCandidateMode;
  score: number;
  reasons: string[];
}

export interface PolicyInput {
  candidates: CandidateInput[];
  currentMode: RouterCandidateMode | null;
  /** Epoch ms of the last applied switch, if any (cooldown window). */
  lastSwitchAt: number | null;
  now: number;
}

export interface PolicyDecision {
  /** Ranked candidates, best first. Unavailable candidates are excluded. */
  ranking: ScoredCandidate[];
  /** The mode the policy WOULD apply, or null when nothing qualifies. */
  chosen: RouterCandidateMode | null;
  /** What the activation layer may do. Shadow wiring never applies. */
  action: 'keep' | 'switch' | 'none';
  reason: string;
}

export const STICKINESS_BONUS = 10;
export const FAILURE_STREAK_PENALTY = 15;
export const CONFIDENCE_POINTS = 20;
export const CONFIDENCE_SAMPLE = 20;
export const SWITCH_COOLDOWN_MS = 10 * 60 * 1000;
export const MIN_ATTEMPTS = 5;

export function scoreCandidate(
  candidate: CandidateInput,
  currentMode: RouterCandidateMode | null,
): ScoredCandidate {
  const reasons: string[] = [];
  let score = 0;

  if (candidate.attempts > 0) {
    const rate = candidate.saved / candidate.attempts;
    score += rate * 100;
    reasons.push(`success ${(rate * 100).toFixed(0)}%`);
  } else {
    // Unproven: neutral base, never above a proven-healthy mode.
    score += 50;
    reasons.push('unproven baseline');
  }

  const confidence = Math.min(candidate.attempts, CONFIDENCE_SAMPLE) / CONFIDENCE_SAMPLE;
  score += confidence * CONFIDENCE_POINTS;

  if (candidate.failureStreak > 0) {
    const penalty = candidate.failureStreak * FAILURE_STREAK_PENALTY;
    score -= penalty;
    reasons.push(`streak -${penalty}`);
  }

  if (candidate.mode === currentMode) {
    score += STICKINESS_BONUS;
    reasons.push('current');
  }

  return { mode: candidate.mode, score, reasons };
}

export function decideRoute(input: PolicyInput): PolicyDecision {
  const available = input.candidates.filter((candidate) => candidate.available);
  if (!available.length) {
    return { ranking: [], chosen: null, action: 'none', reason: 'no candidate available' };
  }
  const ranking = available
    .map((candidate) => scoreCandidate(candidate, input.currentMode))
    .sort((a, b) => b.score - a.score);

  const best = ranking[0];
  if (input.currentMode === null) {
    return {
      ranking,
      chosen: best.mode,
      action: 'switch',
      reason: 'no current mode',
    };
  }

  const current = available.find((candidate) => candidate.mode === input.currentMode);
  if (!current) {
    return {
      ranking,
      chosen: best.mode,
      action: 'switch',
      reason: `current mode ${input.currentMode} unavailable`,
    };
  }

  const inCooldown =
    input.lastSwitchAt !== null && input.now - input.lastSwitchAt < SWITCH_COOLDOWN_MS;
  if (inCooldown) {
    return {
      ranking,
      chosen: input.currentMode,
      action: 'keep',
      reason: 'switch cooldown active',
    };
  }

  const currentScored = ranking.find((entry) => entry.mode === input.currentMode)!;
  if (best.mode === input.currentMode) {
    return { ranking, chosen: input.currentMode, action: 'keep', reason: 'already best' };
  }

  // Demote the current mode only when it is genuinely unhealthy; a healthy
  // current mode never loses to a marginal difference (hysteresis).
  const currentUnhealthy =
    current.failureStreak > 0 ||
    (current.attempts >= MIN_ATTEMPTS && current.saved / current.attempts < 0.8);
  if (!currentUnhealthy) {
    return {
      ranking,
      chosen: input.currentMode,
      action: 'keep',
      reason: 'current mode healthy',
    };
  }
  if (best.score <= currentScored.score) {
    return {
      ranking,
      chosen: input.currentMode,
      action: 'keep',
      reason: 'no better candidate',
    };
  }
  return {
    ranking,
    chosen: best.mode,
    action: 'switch',
    reason: `current unhealthy (streak ${current.failureStreak}, attempts ${current.attempts})`,
  };
}
