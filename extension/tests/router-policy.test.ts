import { describe, expect, it } from 'vitest';
import {
  decideRoute,
  scoreCandidate,
  type CandidateInput,
} from '../src/engines/router/router-policy';

function candidate(overrides: Partial<CandidateInput>): CandidateInput {
  return { mode: 'v2', available: true, attempts: 20, saved: 20, failureStreak: 0, ...overrides };
}

describe('router policy (hhpa.2, shadow)', () => {
  it('ranks proven-healthy above unproven, and failing lowest', () => {
    const decision = decideRoute({
      candidates: [
        candidate({ mode: 'legacy', attempts: 20, saved: 20 }),
        candidate({ mode: 'v2', attempts: 0, saved: 0 }),
        candidate({ mode: 'v3', attempts: 10, saved: 0, failureStreak: 4 }),
      ],
      currentMode: null,
      lastSwitchAt: null,
      now: 0,
    });
    expect(decision.ranking.map((entry) => entry.mode)).toEqual(['legacy', 'v2', 'v3']);
    expect(decision.chosen).toBe('legacy');
    expect(decision.action).toBe('switch');
  });

  it('excludes unavailable candidates (v3 without API configured)', () => {
    const decision = decideRoute({
      candidates: [
        candidate({ mode: 'v2', attempts: 0, saved: 0 }),
        candidate({ mode: 'v3', available: false }),
      ],
      currentMode: null,
      lastSwitchAt: null,
      now: 0,
    });
    expect(decision.ranking.map((entry) => entry.mode)).toEqual(['v2']);
  });

  it('keeps a healthy current mode even against a higher raw score (hysteresis)', () => {
    const decision = decideRoute({
      candidates: [
        candidate({ mode: 'legacy', attempts: 10, saved: 10, failureStreak: 0 }),
        candidate({ mode: 'v2', attempts: 4, saved: 3, failureStreak: 0 }),
      ],
      currentMode: 'v2',
      lastSwitchAt: null,
      now: 0,
    });
    expect(decision.chosen).toBe('v2');
    expect(decision.reason).toBe('current mode healthy');
  });

  it('switches away when the current mode is on a failure streak', () => {
    const decision = decideRoute({
      candidates: [
        candidate({ mode: 'legacy', attempts: 10, saved: 10 }),
        candidate({ mode: 'v2', attempts: 10, saved: 2, failureStreak: 3 }),
      ],
      currentMode: 'v2',
      lastSwitchAt: null,
      now: 0,
    });
    expect(decision.chosen).toBe('legacy');
    expect(decision.action).toBe('switch');
    expect(decision.reason).toContain('unhealthy');
  });

  it('honors the switch cooldown', () => {
    const decision = decideRoute({
      candidates: [
        candidate({ mode: 'legacy' }),
        candidate({ mode: 'v2', attempts: 10, saved: 0, failureStreak: 5 }),
      ],
      currentMode: 'v2',
      lastSwitchAt: 0,
      now: 60_000,
    });
    expect(decision.action).toBe('keep');
    expect(decision.reason).toBe('switch cooldown active');
  });

  it('keeps the current mode when nothing beats it', () => {
    const decision = decideRoute({
      candidates: [candidate({ mode: 'v2' })],
      currentMode: 'v2',
      lastSwitchAt: null,
      now: 0,
    });
    expect(decision.chosen).toBe('v2');
    expect(decision.action).toBe('keep');
  });

  it('switches when the current mode becomes unavailable', () => {
    const decision = decideRoute({
      candidates: [candidate({ mode: 'v2', available: false }), candidate({ mode: 'legacy' })],
      currentMode: 'v2',
      lastSwitchAt: null,
      now: 0,
    });
    expect(decision.chosen).toBe('legacy');
    expect(decision.reason).toContain('unavailable');
  });

  it('reports none when nothing is available', () => {
    const decision = decideRoute({
      candidates: [candidate({ mode: 'v2', available: false })],
      currentMode: 'v2',
      lastSwitchAt: null,
      now: 0,
    });
    expect(decision).toMatchObject({ chosen: null, action: 'none' });
  });

  it('scores stickiness and streak penalties deterministically', () => {
    const base = candidate({ mode: 'v2', attempts: 20, saved: 20, failureStreak: 0 });
    const sticky = scoreCandidate(base, 'v2');
    const cold = scoreCandidate(base, 'legacy');
    expect(sticky.score).toBeCloseTo(cold.score + 10);
    const failing = scoreCandidate(candidate({ mode: 'v2', saved: 10, failureStreak: 2 }), 'legacy');
    expect(failing.score).toBeCloseTo(50 + 20 - 30);
    expect(failing.reasons).toContain('streak -30');
  });
});
