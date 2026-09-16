// filepath: extension/tests/core/acquire/state-machine.test.ts
/**
 * Acquisition state machine — design §7. Pure reducer: REQUESTED → PLANNED →
 * DIRECT | DRIVE_AUTH | BYPASS_TAB → SETTLED, BLOCKED on failed validation.
 *
 * The contract under test:
 *  - every transition is a pure function of (state, event);
 *  - the machine decides WHEN, the engine decides HOW (effects are inert
 *    descriptions; no chrome.* knowledge lives here);
 *  - authuser rotation is data-driven over candidates 0..9;
 *  - every path ends in exactly one settled outcome — no silent deaths (G6);
 *  - timeout force-settles from any live state.
 */
import { describe, it, expect } from 'vitest';
import {
  nextAcquireState,
  AUTHUSER_CANDIDATES,
  type AcquireEvent,
  type AcquireMachineState,
} from '../../../src/core/acquire/state-machine';
import type { FileRef, NameHint } from '../../../src/contracts/topics';

const file: FileRef = { fileId: 'drive-1', url: 'https://drive.google.com/uc?id=drive-1' };
const nameHint: NameHint = { preferredStem: 'syllabus', ext: 'pdf', source: 'aria' };
const DRIVE_PLAN: AcquireEvent = {
  type: 'plan',
  isDrive: true,
  strategies: ['direct', 'drive-auth', 'bypass-tab'],
};
const NON_DRIVE_PLAN: AcquireEvent = {
  type: 'plan',
  isDrive: false,
  strategies: ['direct'],
};

function driveRequested(initialAuthUser?: number): AcquireMachineState {
  return nextAcquireState(
    {
      phase: 'requested',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      initialAuthUser,
      attemptedAuthUsers: initialAuthUser != null ? [initialAuthUser] : [],
    },
    DRIVE_PLAN,
  ).state;
}

describe('REQUESTED phase', () => {
  it('a failed validation settles blocked, with a settle effect', () => {
    const result = nextAcquireState(
      { phase: 'requested', requestId: 'req-1', file, nameHint, isDrive: true, attemptedAuthUsers: [] },
      { type: 'validate', ok: false, reason: 'not https' },
    );

    expect(result.state.phase).toBe('blocked');
    if (result.state.phase === 'blocked') {
      expect(result.state.outcome.status).toBe('blocked');
      expect(result.state.outcome.detail).toBe('not https');
    }
    expect(result.effects).toEqual([
      { type: 'settle', outcome: { status: 'blocked', detail: 'not https' } },
    ]);
  });

  it('planning moves to planned and orders the first strategy', () => {
    const { state, effects } = nextAcquireState(
      { phase: 'requested', requestId: 'req-1', file, nameHint, isDrive: true, attemptedAuthUsers: [] },
      DRIVE_PLAN,
    );

    expect(state.phase).toBe('planned');
    expect(effects[0]).toEqual({ type: 'begin-strategy', strategy: 'direct', authUser: undefined });
  });

  it('planning with an initial authuser attempts that authuser first', () => {
    const { effects } = nextAcquireState(
      {
        phase: 'requested',
        requestId: 'req-1',
        file,
        nameHint,
        isDrive: true,
        initialAuthUser: 3,
        attemptedAuthUsers: [3],
      },
      DRIVE_PLAN,
    );

    expect(effects[0]).toEqual({ type: 'begin-strategy', strategy: 'direct', authUser: 3 });
  });

  it('a bypass-first plan (Firefox) begins with the bypass strategy', () => {
    const { state, effects } = nextAcquireState(
      { phase: 'requested', requestId: 'req-1', file, nameHint, isDrive: true, attemptedAuthUsers: [] },
      { type: 'plan', isDrive: true, strategies: ['bypass-tab'] },
    );

    expect(state.phase).toBe('planned');
    expect(effects[0]).toEqual({ type: 'begin-strategy', strategy: 'bypass-tab' });
  });
});

describe('PLANNED → DIRECT phase', () => {
  it('a started download records the id and stays direct', () => {
    const direct = { ...driveRequested(), phase: 'direct' as const, authUser: undefined };
    const { state, effects } = nextAcquireState(direct, { type: 'download-started', downloadId: 11 });

    expect(state.phase).toBe('direct');
    if (state.phase === 'direct') expect(state.downloadId).toBe(11);
    expect(effects).toEqual([]);
  });

  it('an html interstitial on a drive file rotates into drive-auth', () => {
    const direct = { ...driveRequested(), phase: 'direct' as const };
    const { state, effects } = nextAcquireState(direct, { type: 'html-interstitial-seen' });

    expect(state.phase).toBe('drive-auth');
    expect(effects).toContainEqual({ type: 'begin-strategy', strategy: 'drive-auth', authUser: 0 });
    expect(effects).toContainEqual({ type: 'set-deadline', ms: 30000 });
  });

  it('a confirmed 403 rotates to the next signed-in account (zero-tab)', () => {
    const direct = { ...driveRequested(), phase: 'direct' as const };
    const { state, effects } = nextAcquireState(direct, { type: 'forbidden-confirmed' });

    expect(state.phase).toBe('drive-auth');
    expect(effects).toContainEqual({ type: 'begin-strategy', strategy: 'drive-auth', authUser: 0 });
  });

  it('a start failure on a drive file retries in place once (zero-tab)', () => {
    const direct = { ...driveRequested(), phase: 'direct' as const };
    const { state, effects } = nextAcquireState(direct, { type: 'start-failed' });

    expect(state.phase).toBe('direct');
    expect(effects).toContainEqual({ type: 'begin-strategy', strategy: 'direct', authUser: undefined });
  });

  it('a start failure on a non-drive file retries once, then settles browser-fail', () => {
    const state: AcquireMachineState = {
      phase: 'direct',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: false,
      attemptedAuthUsers: [],
    };
    // First failure: one in-place retry.
    const first = nextAcquireState(state, { type: 'start-failed' });
    expect(first.state.phase).toBe('direct');
    expect(first.state.startRetried).toBe(true);

    // Second failure: honest browser-fail terminal.
    const { state: next, effects } = nextAcquireState(first.state, { type: 'start-failed' });

    expect(next.phase).toBe('settled');
    if (next.phase === 'settled') expect(next.outcome.status).toBe('browser-fail');
    expect(effects).toContainEqual({
      type: 'settle',
      outcome: expect.objectContaining({ status: 'browser-fail' }),
    });
  });
});

describe('DRIVE_AUTH phase — authuser rotation is data', () => {
  it('a failed attempt moves to the next unused candidate', () => {
    const state: AcquireMachineState = {
      phase: 'drive-auth',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [0],
    };
    const { state: next, effects } = nextAcquireState(state, { type: 'auth-attempt-failed' });

    expect(next.phase).toBe('drive-auth');
    if (next.phase === 'drive-auth') expect(next.attemptedAuthUsers).toEqual([0, 1]);
    expect(effects).toContainEqual({ type: 'begin-strategy', strategy: 'drive-auth', authUser: 1 });
  });

  it('exhausting every candidate settles auth-exhausted', () => {
    let state: AcquireMachineState = {
      phase: 'drive-auth',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [...AUTHUSER_CANDIDATES],
    };
    const { state: next, effects } = nextAcquireState(state, { type: 'auth-attempt-failed' });

    expect(next.phase).toBe('settled');
    if (next.phase === 'settled') expect(next.outcome.status).toBe('auth-exhausted');
    expect(effects).toContainEqual({
      type: 'settle',
      outcome: expect.objectContaining({ status: 'auth-exhausted' }),
    });
  });

  it('candidates are 0 through 9 (ten accounts, matching the worker today)', () => {
    expect(AUTHUSER_CANDIDATES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('BYPASS_TAB phase', () => {
  it('a confirmed 403 from drive-auth rotates to the next account (zero-tab)', () => {
    const state: AcquireMachineState = {
      phase: 'drive-auth',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [0],
    };
    const { state: next, effects } = nextAcquireState(state, { type: 'forbidden-confirmed' });

    expect(next.phase).toBe('drive-auth');
    expect(next.attemptedAuthUsers).toEqual([0, 1]);
    expect(effects).toContainEqual({ type: 'begin-strategy', strategy: 'drive-auth', authUser: 1 });
  });

  it('a save settling from the bypass tab resolves saved', () => {
    const state: AcquireMachineState = {
      phase: 'bypass-tab',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [],
    };
    const { state: next, effects } = nextAcquireState(state, {
      type: 'saved',
      downloadId: 5,
    });

    expect(next.phase).toBe('settled');
    if (next.phase === 'settled') {
      expect(next.outcome.status).toBe('saved');
      expect(next.outcome.downloadId).toBe(5);
    }
    expect(effects).toContainEqual({
      type: 'settle',
      outcome: expect.objectContaining({ status: 'saved' }),
    });
    expect(effects).toContainEqual({ type: 'clear-deadline' });
  });
});

describe('terminal guarantees (G6 — no silent deaths)', () => {
  it('timeout force-settles from a live attempt', () => {
    const state: AcquireMachineState = {
      phase: 'drive-auth',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [0, 1],
    };
    const { state: next, effects } = nextAcquireState(state, { type: 'timeout' });

    expect(next.phase).toBe('settled');
    if (next.phase === 'settled') expect(next.outcome.status).toBe('timeout');
    expect(effects).toContainEqual({ type: 'clear-deadline' });
  });

  it('a user cancel settles cancelled', () => {
    const state: AcquireMachineState = {
      phase: 'bypass-tab',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [],
    };
    const { state: next } = nextAcquireState(state, { type: 'cancel' });

    expect(next.phase).toBe('settled');
    if (next.phase === 'settled') expect(next.outcome.status).toBe('cancelled');
  });

  it('an interrupted download settles failed with the detail', () => {
    const state: AcquireMachineState = {
      phase: 'direct',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: false,
      attemptedAuthUsers: [],
      downloadId: 9,
    };
    const { state: next, effects } = nextAcquireState(state, {
      type: 'interrupted',
      detail: 'NETWORK_ERROR',
    });

    expect(next.phase).toBe('settled');
    if (next.phase === 'settled') {
      expect(next.outcome.status).toBe('failed');
      expect(next.outcome.detail).toBe('NETWORK_ERROR');
    }
    expect(effects.some((e) => e.type === 'clear-deadline')).toBe(true);
  });

  it('events arriving after settle are ignored (terminal is idempotent)', () => {
    const settled: AcquireMachineState = {
      phase: 'settled',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [],
      outcome: { status: 'saved', downloadId: 5 },
    };
    const { state: next, effects } = nextAcquireState(settled, { type: 'timeout' });

    expect(next).toBe(settled);
    expect(effects).toEqual([]);
  });
});
