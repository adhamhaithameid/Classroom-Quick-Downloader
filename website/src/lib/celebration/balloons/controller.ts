export interface CelebrationGateInput {
  nowMs: number;
  reducedMotion: boolean;
  active: boolean;
  sessionPlayed: boolean;
  cooldownUntilMs: number;
}

export function canStartCelebration(input: CelebrationGateInput): boolean {
  if (input.reducedMotion) return false;
  if (input.active) return false;
  if (input.sessionPlayed) return false;
  if (input.nowMs < input.cooldownUntilMs) return false;
  return true;
}

export function nextCooldownUntil(nowMs: number, cooldownMs: number): number {
  return nowMs + Math.max(0, cooldownMs);
}
