// filepath: extension/tests/acquire-properties.test.ts
/**
 * No-dead-ends program — property-based invariants (fast-check).
 *
 * Hand-written tests assert chosen paths; these properties assert the
 * INVARIANTS that make dead ends impossible, over random event sequences:
 *
 *   P1 Terminal absorption: blocked/settled states ignore every event —
 *      a replayed or late event can never resurrect or mutate a download.
 *   P2 Sweep boundedness: authuser rotation is monotonic and bounded —
 *      no event sequence can loop the sweep past AUTHUSER_CANDIDATES.
 *   P3 Deadline closure: from any attempt phase, a `timeout` event settles
 *      — the machine has no state from which silence is unavoidable.
 *   P4 Effect discipline: settle effects carry exactly one outcome; attempt
 *      phases always re-arm a deadline after rotation.
 *   P5 Determinism of the simulator resolver and totality of the outcome
 *      mapper — pure functions that must never throw or drift.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  AUTHUSER_CANDIDATES,
  ATTEMPT_DEADLINE_MS,
  nextAcquireState,
  type AcquireEvent,
  type AcquireMachineState,
} from '../src/core/acquire/state-machine';
import type { AcquireOutcome, AcquireOutcomeStatus } from '../src/contracts/topics';
import { resolveSimulatedResponse } from '../../tests/simulator/origins';
import type { Scenario } from '../../tests/simulator/scenario';
import { createScenario, streamPath } from '../../tests/simulator/scenario';
import { mapStatusToOutcome } from '../entrypoints/background/bridge-download-service';

// ── Generators ──────────────────────────────────────────────────────────────

const FILE = {
  fileId: 'FILE123',
  url: 'https://drive.usercontent.google.com/download?id=FILE123&export=download&confirm=t',
};
const HINT = { preferredStem: 'lecture', ext: 'pdf', source: 'aria' as const };

const baseState = {
  requestId: 'req-prop',
  file: FILE,
  nameHint: HINT,
  isDrive: true,
  attemptedAuthUsers: [] as number[],
};

const EVENT_ARBS = {
  validate: fc.record({ ok: fc.boolean(), reason: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }) }),
  'download-started': fc.record({ downloadId: fc.integer({ min: 1, max: 100000 }) }),
  'interrupted': fc.record({ detail: fc.option(fc.constantFrom('NETWORK_FAILED', 'SERVER_FAILED', 'FILE_FAILED', 'STORAGE_FULL', 'CRASH'), { nil: undefined }) }),
  'saved-id': fc.option(fc.integer({ min: 1, max: 100000 }), { nil: undefined }),
  'bypass-tab': fc.integer({ min: 1, max: 5000 }),
} as const;

/** Any event, drawn fresh each time — arbitrary event sequences. */
const arbEvent = (): fc.Arbitrary<AcquireEvent> =>
  fc.constantFrom(
    { type: 'validate', ok: true } as AcquireEvent,
    { type: 'validate', ok: false, reason: 'bad host' } as AcquireEvent,
    { type: 'plan', isDrive: true, strategies: ['direct', 'drive-auth'] } as AcquireEvent,
    { type: 'plan', isDrive: false, strategies: ['direct'] } as AcquireEvent,
    { type: 'plan', isDrive: true, strategies: [] } as AcquireEvent,
    { type: 'start-failed' } as AcquireEvent,
    { type: 'html-interstitial-seen' } as AcquireEvent,
    { type: 'forbidden-confirmed' } as AcquireEvent,
    { type: 'auth-attempt-failed' } as AcquireEvent,
    { type: 'saved' } as AcquireEvent,
    { type: 'interrupted', detail: 'NETWORK_FAILED' } as AcquireEvent,
    { type: 'timeout' } as AcquireEvent,
    { type: 'cancel' } as AcquireEvent,
  );

const arbAttemptState = (): fc.Arbitrary<AcquireMachineState> =>
  fc.constantFrom(
    { ...baseState, phase: 'requested' } as AcquireMachineState,
    { ...baseState, phase: 'planned', strategies: ['direct', 'drive-auth'] } as AcquireMachineState,
    { ...baseState, phase: 'direct', downloadId: 42 } as AcquireMachineState,
    { ...baseState, phase: 'direct', isDrive: false } as AcquireMachineState,
    { ...baseState, phase: 'drive-auth', authUser: 3, attemptedAuthUsers: [0, 3], downloadId: 7 } as AcquireMachineState,
    { ...baseState, phase: 'bypass-tab', tabId: 9 } as AcquireMachineState,
    { ...baseState, phase: 'blocked', outcome: { status: 'blocked' } } as AcquireMachineState,
    { ...baseState, phase: 'settled', outcome: { status: 'saved', downloadId: 5 } } as AcquireMachineState,
  );

/** Drive a random event sequence through the machine from a given state. */
function runSequence(state: AcquireMachineState, events: AcquireEvent[]): {
  final: AcquireMachineState;
  outcomes: AcquireOutcome[];
  effects: number;
} {
  let current = state;
  const outcomes: AcquireOutcome[] = [];
  let effects = 0;
  for (const event of events) {
    const result = nextAcquireState(current, event);
    current = result.state;
    effects += result.effects.length;
    for (const effect of result.effects) {
      if (effect.type === 'settle') outcomes.push(effect.outcome);
    }
  }
  return { final: current, outcomes, effects };
}

// ── P1 Terminal absorption ──────────────────────────────────────────────────

describe('P1 terminal absorption', () => {
  it('blocked and settled states ignore every event, for every event sequence', () => {
    fc.assert(
      fc.property(
        arbAttemptState(),
        fc.array(arbEvent(), { maxLength: 12 }),
        (terminalAny, events) => {
          // Force a terminal by settling from whatever state we drew.
          let terminal = terminalAny;
          if (terminal.phase !== 'blocked' && terminal.phase !== 'settled') {
            const r = nextAcquireState(terminal, { type: 'interrupted', detail: 'force' });
            terminal = r.state;
          }
          expect(terminal.phase === 'blocked' || terminal.phase === 'settled').toBe(true);

          for (const event of events) {
            const { state, effects } = nextAcquireState(terminal, event);
            expect(state).toBe(terminal); // same reference — nothing changed
            expect(effects).toEqual([]);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ── P2 Sweep boundedness ────────────────────────────────────────────────────

describe('P2 authuser sweep boundedness', () => {
  it('rotation is monotonic, bounded by the candidate table, and exhausts to auth-exhausted', () => {
    fc.assert(
      fc.property(
        fc.set(fc.integer({ min: 0, max: 9 }), { minLength: 0, maxLength: 10 }),
        fc.array(fc.constantFrom<AcquireEvent>({ type: 'auth-attempt-failed' }, { type: 'html-interstitial-seen' }), { maxLength: 15 }),
        (preAttempted, events) => {
          let state: AcquireMachineState = {
            ...baseState,
            phase: 'drive-auth',
            attemptedAuthUsers: [...preAttempted],
          };
          const seen: number[] = [];
          for (const event of events) {
            const before = state.attemptedAuthUsers.length;
            const result = nextAcquireState(state, event);
            state = result.state;
            if (state.phase === 'drive-auth' && state.attemptedAuthUsers.length > before) {
              const added = state.attemptedAuthUsers[state.attemptedAuthUsers.length - 1];
              // Monotonic: never repeats, always from the candidate table.
              expect(state.attemptedAuthUsers.slice(0, -1)).not.toContain(added);
              expect(AUTHUSER_CANDIDATES).toContain(added);
              seen.push(added);
              // Rotation re-arms the attempt deadline.
              expect(result.effects).toContainEqual({ type: 'set-deadline', ms: ATTEMPT_DEADLINE_MS });
            }
          }
          // Bounded: no sequence produces more rotations than candidates.
          expect(state.attemptedAuthUsers.length).toBeLessThanOrEqual(AUTHUSER_CANDIDATES.length);
          void seen;
        },
      ),
      { numRuns: 300 },
    );
  });

  it('exhausting every candidate settles with auth-exhausted exactly once', () => {
    fc.assert(
      fc.property(fc.set(fc.integer({ min: 0, max: 9 }), { minLength: 0, maxLength: 10 }), (preAttempted) => {
        let state: AcquireMachineState = {
          ...baseState,
          phase: 'drive-auth',
          attemptedAuthUsers: [...preAttempted],
        };
        let settles = 0;
        for (let i = 0; i < 15; i++) {
          const result = nextAcquireState(state, { type: 'auth-attempt-failed' });
          state = result.state;
          settles += result.effects.filter((e) => e.type === 'settle').length;
          if (state.phase === 'settled') break;
        }
        expect(state.phase).toBe('settled');
        if (state.phase !== 'settled') throw new Error('unreachable');
        expect(state.outcome.status).toBe('auth-exhausted');
        expect(settles).toBe(1);
        // Extra events after settling change nothing.
        const after = nextAcquireState(state, { type: 'auth-attempt-failed' });
        expect(after.state).toBe(state);
      }),
      { numRuns: 200 },
    );
  });
});

// ── P3 Deadline closure ─────────────────────────────────────────────────────

describe('P3 deadline closure — no state escapes a timeout', () => {
  it('a timeout event settles every non-terminal phase, for every drawn state', () => {
    fc.assert(
      fc.property(arbAttemptState(), (stateAny) => {
        const { state, effects } = nextAcquireState(stateAny, { type: 'timeout' });
        if (stateAny.phase === 'blocked' || stateAny.phase === 'settled') {
          expect(state).toBe(stateAny);
          expect(effects).toEqual([]);
        } else {
          expect(state.phase).toBe('settled');
          if (state.phase !== 'settled') throw new Error('unreachable');
          expect(state.outcome.status).toBe('timeout');
          expect(effects.filter((e) => e.type === 'settle')).toHaveLength(1);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('random walks always terminate when the clock keeps ticking', () => {
    fc.assert(
      fc.property(
        fc.array(arbEvent(), { minLength: 1, maxLength: 60 }),
        fc.integer({ min: 0, max: 7 }),
        (events, seed) => {
          let state: AcquireMachineState = { ...baseState, phase: 'requested' };
          let i = 0;
          let guard = 0;
          while (state.phase !== 'settled' && state.phase !== 'blocked' && guard < 200) {
            // Faithful clock model: a timeout fires every 3rd tick no matter
            // what else happens — deadlines do not wait for other events.
            const event: AcquireEvent =
              i % 3 === 2 ? { type: 'timeout' } : events[i % events.length];
            state = nextAcquireState(state, event).state;
            i += 1 + (seed % 2);
            guard += 1;
          }
          // The walk must ALWAYS reach a terminal — no livelock.
          expect(state.phase === 'settled' || state.phase === 'blocked').toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ── P4 Effect discipline ────────────────────────────────────────────────────

describe('P4 effect discipline', () => {
  it('every settle effect carries a valid outcome status; at most one settle per event', () => {
    const VALID: AcquireOutcomeStatus[] = [
      'saved', 'blocked', 'auth-exhausted', 'browser-fail', 'timeout', 'cancelled', 'failed',
    ];
    fc.assert(
      fc.property(
        arbAttemptState(),
        fc.array(arbEvent(), { maxLength: 15 }),
        (stateAny, events) => {
          let state = stateAny;
          for (const event of events) {
            const result = nextAcquireState(state, event);
            const settles = result.effects.filter((e) => e.type === 'settle');
            expect(settles.length).toBeLessThanOrEqual(1);
            for (const s of settles) {
              expect(VALID).toContain((s as { outcome: AcquireOutcome }).outcome.status);
            }
            state = result.state;
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ── P5 Pure-function determinism/totality ───────────────────────────────────

describe('P5 resolver determinism and mapper totality', () => {
  const scenario: Scenario = createScenario({
    locale: 'en',
    dir: 'ltr',
    theme: 'light',
    initialPath: streamPath(),
    routes: [
      {
        path: streamPath(),
        kind: 'stream',
        posts: [{ id: 'p1', attachments: [{ kind: 'drive', id: 'FILE123', name: 'lecture.pdf' }] }],
      },
    ],
  });
  const ctx = {
    appDocument: '<html><body>sim</body></html>',
    files: new Map([['FILE123', { id: 'FILE123', filename: 'lecture.pdf', bytesKind: 'pdf' as const }]]),
  };

  it('resolveSimulatedResponse is deterministic for arbitrary URLs', () => {
    const urlArb = fc.constantFrom(
      'https://drive.usercontent.google.com/download?id=FILE123&export=download&confirm=t',
      'https://drive.usercontent.google.com/download?id=srvfail-1&export=download&confirm=t',
      'https://drive.usercontent.google.com/download?id=quota-1&export=download&confirm=t',
      'https://drive.usercontent.google.com/download?id=missing-1&export=download&confirm=t',
      'https://classroom.google.com/u/0/c/1',
      'https://example.com/nope',
      'not-a-url',
    );
    fc.assert(
      fc.property(urlArb, (url) => {
        const a = resolveSimulatedResponse(url, ctx);
        const b = resolveSimulatedResponse(url, ctx);
        expect(a.status).toBe(b.status);
        expect(a.contentType).toBe(b.contentType);
        expect(Buffer.compare(Buffer.from(a.body as never), Buffer.from(b.body as never))).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('mapStatusToOutcome is total over every status/errorCode pair', () => {
    const statuses = ['success', 'complete', 'error', 'interrupted', 'blocked_html', 'trying'] as const;
    const codes = [undefined, 'AUTH_ALL_FAILED', 'NETWORK_FAILED', 'anything'] as const;
    fc.assert(
      fc.property(fc.constantFrom(...statuses), fc.option(fc.constantFrom(...codes), { nil: undefined }), (status, code) => {
        const outcome = mapStatusToOutcome(status as never, 'detail', code);
        expect(['saved', 'auth-exhausted', 'failed', 'blocked']).toContain(outcome.status);
      }),
      { numRuns: 100 },
    );
  });
});
