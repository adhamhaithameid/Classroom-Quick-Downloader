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

// ============================================================================
// MUTATION HARDENING (S12) — every remaining reducer branch pinned exactly.
// Each test asserts the FULL (state, effects) delta of one transition so a
// mutated branch, effect payload or outcome string cannot slip through.
// ============================================================================

describe('PLANNED phase — strategy-started and inert edges (S12)', () => {
  const planned = (overrides: Partial<AcquireMachineState> = {}): AcquireMachineState => ({
    phase: 'planned',
    requestId: 'req-1',
    file,
    nameHint,
    isDrive: true,
    attemptedAuthUsers: [],
    strategies: ['direct', 'drive-auth'],
    ...overrides,
  } as AcquireMachineState);

  it('strategy-started direct enters direct carrying the initial authuser, no effects', () => {
    const { state, effects } = nextAcquireState(
      planned({ initialAuthUser: 7 }),
      { type: 'strategy-started', strategy: 'direct' },
    );

    expect(state.phase).toBe('direct');
    if (state.phase === 'direct') expect(state.authUser).toBe(7);
    expect(effects).toEqual([]);
  });

  it('strategy-started drive-auth enters drive-auth', () => {
    const { state, effects } = nextAcquireState(planned(), {
      type: 'strategy-started',
      strategy: 'drive-auth',
    });

    expect(state.phase).toBe('drive-auth');
    expect(effects).toEqual([]);
  });

  it('strategy-started in a live attempt phase is inert (same state object)', () => {
    const direct = planned({ phase: 'direct' } as Partial<AcquireMachineState>);
    const { state, effects } = nextAcquireState(direct, {
      type: 'strategy-started',
      strategy: 'direct',
    });

    expect(state).toBe(direct);
    expect(effects).toEqual([]);
  });

  it('strategy-started from requested is inert', () => {
    const requested: AcquireMachineState = {
      phase: 'requested',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [],
    };
    const { state, effects } = nextAcquireState(requested, {
      type: 'strategy-started',
      strategy: 'direct',
    });

    expect(state).toBe(requested);
    expect(effects).toEqual([]);
  });

  it('download-started in planned is inert', () => {
    const p = planned();
    const { state, effects } = nextAcquireState(p, { type: 'download-started', downloadId: 3 });

    expect(state).toBe(p);
    expect(effects).toEqual([]);
  });

  it('transient-failed in planned is inert', () => {
    const p = planned();
    const { state, effects } = nextAcquireState(p, { type: 'transient-failed', detail: 'X' });

    expect(state).toBe(p);
    expect(effects).toEqual([]);
  });

  it('html-interstitial-seen in planned is inert', () => {
    const p = planned();
    const { state, effects } = nextAcquireState(p, { type: 'html-interstitial-seen' });

    expect(state).toBe(p);
    expect(effects).toEqual([]);
  });

  it('forbidden-confirmed in planned is inert', () => {
    const p = planned();
    const { state, effects } = nextAcquireState(p, { type: 'forbidden-confirmed' });

    expect(state).toBe(p);
    expect(effects).toEqual([]);
  });

  it('auth-attempt-failed outside drive-auth is inert', () => {
    const direct = planned({ phase: 'direct' } as Partial<AcquireMachineState>);
    const { state, effects } = nextAcquireState(direct, { type: 'auth-attempt-failed' });

    expect(state).toBe(direct);
    expect(effects).toEqual([]);
  });

  it('a plan with no strategies settles failed "no strategy planned" with a bare settle effect', () => {
    const { state, effects } = nextAcquireState(
      {
        phase: 'requested',
        requestId: 'req-1',
        file,
        nameHint,
        isDrive: true,
        attemptedAuthUsers: [],
      },
      { type: 'plan', isDrive: true, strategies: [] },
    );

    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') {
      expect(state.outcome.status).toBe('failed');
      expect(state.outcome.detail).toBe('no strategy planned');
    }
    expect(effects).toEqual([
      { type: 'settle', outcome: { status: 'failed', detail: 'no strategy planned' } },
    ]);
  });

  it('a plan whose first strategy is not direct begins it with no authuser', () => {
    const { effects } = nextAcquireState(
      {
        phase: 'requested',
        requestId: 'req-1',
        file,
        nameHint,
        isDrive: true,
        initialAuthUser: 2,
        attemptedAuthUsers: [2],
      },
      { type: 'plan', isDrive: true, strategies: ['drive-auth', 'direct'] },
    );

    expect(effects[0]).toEqual({ type: 'begin-strategy', strategy: 'drive-auth', authUser: undefined });
    expect(effects[1]).toEqual({ type: 'set-deadline', ms: 30000 });
  });

  it('bypass-tab-opened records the tabId', () => {
    const bypass: AcquireMachineState = {
      phase: 'bypass-tab',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [],
    };
    const { state, effects } = nextAcquireState(bypass, { type: 'bypass-tab-opened', tabId: 21 });

    expect(state.phase).toBe('bypass-tab');
    if (state.phase === 'bypass-tab') expect(state.tabId).toBe(21);
    expect(effects).toEqual([]);
  });

  it('bypass-tab-opened outside bypass-tab is inert', () => {
    const direct = planned({ phase: 'direct' } as Partial<AcquireMachineState>);
    const { state, effects } = nextAcquireState(direct, { type: 'bypass-tab-opened', tabId: 4 });

    expect(state).toBe(direct);
    expect(effects).toEqual([]);
  });
});

describe('DIRECT / DRIVE_AUTH — transient retries, inheritance, settle shape (S12)', () => {
  const direct = (overrides: Partial<AcquireMachineState> = {}): AcquireMachineState => ({
    phase: 'direct',
    requestId: 'req-1',
    file,
    nameHint,
    isDrive: false,
    attemptedAuthUsers: [],
    ...overrides,
  } as AcquireMachineState);

  it('a validated-ok request is a no-op with no effects', () => {
    const d = direct();
    const { state, effects } = nextAcquireState(d, { type: 'validate', ok: true });

    expect(state).toBe(d);
    expect(effects).toEqual([]);
  });

  it('a transient failure retries in place once, as direct, with a fresh deadline', () => {
    const { state, effects } = nextAcquireState(direct({ authUser: 5 }), {
      type: 'transient-failed',
      detail: 'NETWORK_FAILED',
    });

    expect(state.phase).toBe('direct');
    expect(state.transientRetried).toBe(true);
    expect(effects).toEqual([
      { type: 'begin-strategy', strategy: 'direct', authUser: 5 },
      { type: 'set-deadline', ms: 30000 },
    ]);
  });

  it('a drive-auth transient retries as drive-auth with the same authuser', () => {
    const state: AcquireMachineState = {
      phase: 'drive-auth',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [0],
      authUser: 0,
    };
    const { state: next, effects } = nextAcquireState(state, { type: 'transient-failed' });

    expect(next.phase).toBe('drive-auth');
    expect(next.transientRetried).toBe(true);
    expect(effects).toEqual([
      { type: 'begin-strategy', strategy: 'drive-auth', authUser: 0 },
      { type: 'set-deadline', ms: 30000 },
    ]);
  });

  it('a second transient failure settles failed with the engine detail', () => {
    const retried = direct({ transientRetried: true, downloadId: 8 });
    const { state, effects } = nextAcquireState(retried, {
      type: 'transient-failed',
      detail: 'SERVER_FAILED',
    });

    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') {
      expect(state.outcome.status).toBe('failed');
      expect(state.outcome.detail).toBe('SERVER_FAILED');
    }
    expect(effects).toEqual([
      { type: 'clear-deadline' },
      { type: 'settle', outcome: { status: 'failed', detail: 'SERVER_FAILED' } },
    ]);
  });

  it('a second transient failure without a detail settles failed "transient"', () => {
    const retried = direct({ transientRetried: true });
    const { state } = nextAcquireState(retried, { type: 'transient-failed' });

    if (state.phase === 'settled') {
      expect(state.outcome.status).toBe('failed');
      expect(state.outcome.detail).toBe('transient');
    }
  });

  it('saved inherits the downloadId recorded by download-started', () => {
    const withId = direct({ downloadId: 42 });
    const { state, effects } = nextAcquireState(withId, { type: 'saved' });

    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') {
      expect(state.outcome.status).toBe('saved');
      expect(state.outcome.downloadId).toBe(42);
    }
    expect(effects).toEqual([
      { type: 'clear-deadline' },
      { type: 'settle', outcome: { status: 'saved', downloadId: 42 } },
    ]);
  });

  it('an explicit saved downloadId wins over the inherited one', () => {
    const withId = direct({ downloadId: 42 });
    const { state } = nextAcquireState(withId, { type: 'saved', downloadId: 99 });

    if (state.phase === 'settled') expect(state.outcome.downloadId).toBe(99);
  });

  it('a drive-auth save inherits the downloadId recorded by download-started (S12)', () => {
    const da: AcquireMachineState = {
      phase: 'drive-auth',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [0],
      authUser: 0,
      downloadId: 77,
    };
    const { state } = nextAcquireState(da, { type: 'saved' });

    if (state.phase === 'settled') {
      expect(state.outcome.status).toBe('saved');
      expect(state.outcome.downloadId).toBe(77);
    }
  });

  it('strategy-started with an unknown strategy is inert from planned (S12)', () => {
    const p: AcquireMachineState = {
      phase: 'planned',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [],
      strategies: ['direct'],
    };
    const { state, effects } = nextAcquireState(p, {
      type: 'strategy-started',
      strategy: 'bypass-tab',
    });

    expect(state).toBe(p);
    expect(effects).toEqual([]);
  });

  it('saving from a non-attempt phase never inherits a downloadId', () => {
    const bypass: AcquireMachineState = {
      phase: 'bypass-tab',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [],
      downloadId: 7,
    } as unknown as AcquireMachineState;
    const { state } = nextAcquireState(bypass, { type: 'saved' });

    if (state.phase === 'settled') expect(state.outcome.downloadId).toBeUndefined();
  });

  it('settle from planned emits no clear-deadline; settle from direct does', () => {
    const p: AcquireMachineState = {
      phase: 'planned',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [],
      strategies: ['direct'],
    };
    const fromPlanned = nextAcquireState(p, { type: 'saved', downloadId: 1 });
    expect(fromPlanned.effects).toEqual([
      { type: 'settle', outcome: { status: 'saved', downloadId: 1 } },
    ]);

    const fromDirect = nextAcquireState(direct(), { type: 'saved', downloadId: 1 });
    expect(fromDirect.effects).toEqual([
      { type: 'clear-deadline' },
      { type: 'settle', outcome: { status: 'saved', downloadId: 1 } },
    ]);
  });

  it('a late html interstitial on a non-drive direct attempt fails honestly', () => {
    const { state, effects } = nextAcquireState(direct(), { type: 'html-interstitial-seen' });

    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') {
      expect(state.outcome.status).toBe('failed');
      expect(state.outcome.detail).toBe('html-interstitial');
    }
    expect(effects).toEqual([
      { type: 'clear-deadline' },
      { type: 'settle', outcome: { status: 'failed', detail: 'html-interstitial' } },
    ]);
  });

  it('a confirmed 403 on a non-drive direct attempt fails honestly', () => {
    const { state, effects } = nextAcquireState(direct(), { type: 'forbidden-confirmed' });

    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') {
      expect(state.outcome.status).toBe('failed');
      expect(state.outcome.detail).toBe('forbidden');
    }
    expect(effects).toEqual([
      { type: 'clear-deadline' },
      { type: 'settle', outcome: { status: 'failed', detail: 'forbidden' } },
    ]);
  });

  it('rotation skips already-attempted authusers', () => {
    const state: AcquireMachineState = {
      phase: 'drive-auth',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [0, 1, 3],
    };
    const { state: next, effects } = nextAcquireState(state, { type: 'html-interstitial-seen' });

    expect(next.phase).toBe('drive-auth');
    if (next.phase === 'drive-auth') {
      expect(next.authUser).toBe(2);
      expect(next.attemptedAuthUsers).toEqual([0, 1, 3, 2]);
    }
    expect(effects).toEqual([
      { type: 'begin-strategy', strategy: 'drive-auth', authUser: 2 },
      { type: 'set-deadline', ms: 30000 },
    ]);
  });

  it('timeout settles with the honest no-terminal detail', () => {
    const { state, effects } = nextAcquireState(direct(), { type: 'timeout' });

    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') {
      expect(state.outcome.status).toBe('timeout');
      expect(state.outcome.detail).toBe('no terminal state before deadline');
    }
    expect(effects).toEqual([
      { type: 'clear-deadline' },
      { type: 'settle', outcome: { status: 'timeout', detail: 'no terminal state before deadline' } },
    ]);
  });

  it('a start failure in a non-direct phase is inert', () => {
    const d = direct({ phase: 'drive-auth' } as Partial<AcquireMachineState>);
    const { state, effects } = nextAcquireState(d, { type: 'start-failed' });

    expect(state).toBe(d);
    expect(effects).toEqual([]);
  });

  it('a second start failure settles browser-fail with the honest detail', () => {
    const retried = direct({ startRetried: true });
    const { state, effects } = nextAcquireState(retried, { type: 'start-failed' });

    expect(state.phase).toBe('settled');
    if (state.phase === 'settled') {
      expect(state.outcome.status).toBe('browser-fail');
      expect(state.outcome.detail).toBe('browser blocked download');
    }
    expect(effects).toEqual([
      { type: 'clear-deadline' },
      { type: 'settle', outcome: { status: 'browser-fail', detail: 'browser blocked download' } },
    ]);
  });

  it('a start-failure retry emits the exact retry effect pair', () => {
    const { state, effects } = nextAcquireState(direct({ authUser: 4 }), { type: 'start-failed' });

    expect(state.phase).toBe('direct');
    expect(state.startRetried).toBe(true);
    expect(effects).toEqual([
      { type: 'begin-strategy', strategy: 'direct', authUser: 4 },
      { type: 'set-deadline', ms: 30000 },
    ]);
  });

  it('a drive-auth download-started records the id; settled phase ignores it', () => {
    const da: AcquireMachineState = {
      phase: 'drive-auth',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [0],
    };
    const first = nextAcquireState(da, { type: 'download-started', downloadId: 55 });
    expect(first.effects).toEqual([]);
    if (first.state.phase === 'drive-auth') expect(first.state.downloadId).toBe(55);

    const terminal: AcquireMachineState = {
      phase: 'settled',
      requestId: 'req-1',
      file,
      nameHint,
      isDrive: true,
      attemptedAuthUsers: [],
      outcome: { status: 'saved' },
    };
    const second = nextAcquireState(terminal, { type: 'download-started', downloadId: 56 });
    expect(second.state).toBe(terminal);
    expect(second.effects).toEqual([]);
  });
});
