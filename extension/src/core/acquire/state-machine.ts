// filepath: extension/src/core/acquire/state-machine.ts
/**
 * ============================================================================
 * ACQUISITION STATE MACHINE — the pure heart of the download engine
 * ============================================================================
 *
 * Spec: extension/docs/ENGINE_V4_SYSTEM_DESIGN.md §7. Replaces the nested
 * callback chains in entrypoints/background/download-handler.ts whose
 * implicit state produced the four pending maps and the pendingByUrl race
 * (#664).
 *
 * Contract:
 *  - `nextAcquireState` is a pure reducer over (state, event) → {state,
 *    effects}. No globals, no I/O, no clock — core rule ADR-0007.
 *  - The machine decides WHEN to try what; the AcquireEngine role performs
 *    each effect through BrowserPort and feeds the result back as an event.
 *    Effects are inert descriptions — no chrome.* knowledge lives here.
 *  - authuser rotation is data: candidates 0..9, attempted list in state.
 *  - Every path ends in exactly one settled outcome. There is no transition
 *    that ends in silence (design goal G6); the ClockPort deadline arrives
 *    as a `timeout` event and force-settles.
 *
 * Terminal phases (`blocked`, `settled`) ignore every event and return the
 * same state object, so replayed worker events cannot resurrect a download.
 */
import type {
  AcquireOutcome,
  AcquireStrategyName,
  FileRef,
  NameHint,
  RequestId,
} from '../../contracts/topics';

// ============================================================================
// DATA — the rotation table the worker used to carry as recursion
// ============================================================================

/** Authuser values cycled for multi-account Drive access. */
export const AUTHUSER_CANDIDATES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Wall-clock budget for ONE acquisition attempt before the deadline event. */
export const ATTEMPT_DEADLINE_MS = 30_000;

// ============================================================================
// STATE
// ============================================================================

interface AcquireCommon {
  requestId: RequestId;
  file: FileRef;
  nameHint: NameHint;
  isDrive: boolean;
  /** Authuser values already tried, in order. */
  attemptedAuthUsers: number[];
  /** Authuser carried in from the original URL, if any. */
  initialAuthUser?: number;
  /** Transient interrupts already retried in place (bounded to one). */
  transientRetried?: boolean;
  /** Browser start failures already retried (bounded to one). */
  startRetried?: boolean;
}

export type AcquireMachineState =
  | ({ phase: 'requested' } & AcquireCommon)
  | ({ phase: 'planned'; strategies: AcquireStrategyName[] } & AcquireCommon)
  | ({ phase: 'direct'; authUser?: number; downloadId?: number } & AcquireCommon)
  | ({ phase: 'drive-auth'; authUser?: number; downloadId?: number } & AcquireCommon)
  | ({ phase: 'bypass-tab'; tabId?: number } & AcquireCommon)
  | ({ phase: 'blocked'; outcome: AcquireOutcome } & AcquireCommon)
  | ({ phase: 'settled'; outcome: AcquireOutcome } & AcquireCommon);

// ============================================================================
// EVENTS
// ============================================================================

export type AcquireEvent =
  | { type: 'validate'; ok: boolean; reason?: string }
  | { type: 'plan'; isDrive: boolean; strategies: AcquireStrategyName[] }
  | { type: 'strategy-started'; strategy: AcquireStrategyName }
  | { type: 'download-started'; downloadId: number }
  | { type: 'start-failed' }
  | { type: 'html-interstitial-seen' }
  | { type: 'forbidden-confirmed' }
  | { type: 'auth-attempt-failed' }
  | { type: 'bypass-tab-opened'; tabId: number }
  | { type: 'saved'; downloadId?: number }
  | { type: 'transient-failed'; detail?: string }
  | { type: 'interrupted'; detail?: string }
  | { type: 'timeout' }
  | { type: 'cancel' };

// ============================================================================
// EFFECTS — inert descriptions the engine performs through BrowserPort
// ============================================================================

export type AcquireEffect =
  | { type: 'begin-strategy'; strategy: AcquireStrategyName; authUser?: number }
  | { type: 'open-bypass-tab' }
  | { type: 'set-deadline'; ms: number }
  | { type: 'clear-deadline' }
  | { type: 'settle'; outcome: AcquireOutcome };

// ============================================================================
// REDUCER
// ============================================================================

const ATTEMPT_PHASES = ['direct', 'drive-auth', 'bypass-tab'] as const;

function isAttemptPhase(state: AcquireMachineState): boolean {
  return (ATTEMPT_PHASES as readonly string[]).includes(state.phase);
}

function settled(state: AcquireMachineState, outcome: AcquireOutcome): AcquireEffect[] {
  return [
    ...(isAttemptPhase(state) ? [{ type: 'clear-deadline' } as const] : []),
    { type: 'settle', outcome },
  ];
}

/** Advance to drive-auth (or out of candidates) and emit the next attempt. */
function rotateAuthUser(state: AcquireMachineState): {
  state: AcquireMachineState;
  effects: AcquireEffect[];
} {
  const next = AUTHUSER_CANDIDATES.find((n) => !state.attemptedAuthUsers.includes(n));
  if (next == null) {
    return {
      state: { ...state, phase: 'settled', outcome: { status: 'auth-exhausted' } },
      effects: settled(state, { status: 'auth-exhausted' }),
    };
  }
  const attempted = [...state.attemptedAuthUsers, next];
  return {
    state: { ...state, phase: 'drive-auth', authUser: next, attemptedAuthUsers: attempted },
    effects: [
      { type: 'begin-strategy', strategy: 'drive-auth', authUser: next },
      { type: 'set-deadline', ms: ATTEMPT_DEADLINE_MS },
    ],
  };
}

// Stryker disable all: orphaned transition helper — since the zero-tab
// contract (S11) removed the bypass-tab fallback, no reducer path enters the
// bypass-tab phase, so this helper can never run and its mutants are
// unkillable dead code. Kept as Engine V4 design §7 scaffolding; the
// bypass-tab-opened event contract is exercised directly with a constructed
// state in tests/core/acquire/state-machine.test.ts.
function toBypassTab(state: AcquireMachineState): {
  state: AcquireMachineState;
  effects: AcquireEffect[];
} {
  return {
    state: { ...state, phase: 'bypass-tab' },
    effects: [{ type: 'open-bypass-tab' }, { type: 'set-deadline', ms: ATTEMPT_DEADLINE_MS }],
  };
}
// Stryker restore all

function saveOutcome(state: AcquireMachineState, downloadId?: number): AcquireOutcome {
  const inherited = state.phase === 'direct' || state.phase === 'drive-auth'
    ? state.downloadId
    : undefined;
  return { status: 'saved', downloadId: downloadId ?? inherited };
}

export function nextAcquireState(
  state: AcquireMachineState,
  event: AcquireEvent,
): { state: AcquireMachineState; effects: AcquireEffect[] } {
  if (state.phase === 'blocked' || state.phase === 'settled') {
    return { state, effects: [] };
  }

  switch (event.type) {
    case 'validate': {
      if (event.ok) return { state, effects: [] };
      const outcome: AcquireOutcome = { status: 'blocked', detail: event.reason };
      return { state: { ...state, phase: 'blocked', outcome }, effects: [{ type: 'settle', outcome }] };
    }

    case 'plan': {
      const planned = {
        ...state,
        phase: 'planned' as const,
        isDrive: event.isDrive,
        strategies: event.strategies,
      };
      const first = event.strategies[0];
      if (first == null) {
        const outcome: AcquireOutcome = { status: 'failed', detail: 'no strategy planned' };
        return { state: { ...planned, phase: 'settled', outcome }, effects: [{ type: 'settle', outcome }] };
      }
      return {
        state: planned,
        effects: [
          {
            type: 'begin-strategy',
            strategy: first,
            authUser: first === 'direct' ? state.initialAuthUser : undefined,
          },
          { type: 'set-deadline', ms: ATTEMPT_DEADLINE_MS },
        ],
      };
    }

    case 'strategy-started': {
      // The engine reports the planned strategy actually beginning — the
      // planned phase is never a dead state.
      if (state.phase !== 'planned') break;
      if (event.strategy === 'direct') {
        return {
          state: { ...state, phase: 'direct', authUser: state.initialAuthUser },
          effects: [],
        };
      }
      if (event.strategy === 'drive-auth') {
        return { state: { ...state, phase: 'drive-auth' }, effects: [] };
      }
      break;
    }

    case 'download-started': {
      if (state.phase === 'direct' || state.phase === 'drive-auth') {
        return { state: { ...state, downloadId: event.downloadId }, effects: [] };
      }
      return { state, effects: [] };
    }

    case 'start-failed': {
      if (state.phase !== 'direct') break;
      // Zero-tab contract: no bypass-tab fallback. Retry once — the browser
      // can transiently refuse a start — then settle with honest guidance.
      if (!state.startRetried) {
        return {
          state: { ...state, startRetried: true },
          effects: [
            { type: 'begin-strategy', strategy: 'direct', authUser: state.authUser },
            { type: 'set-deadline', ms: ATTEMPT_DEADLINE_MS },
          ],
        };
      }
      const outcome: AcquireOutcome = { status: 'browser-fail', detail: 'browser blocked download' };
      return { state: { ...state, phase: 'settled', outcome }, effects: settled(state, outcome) };
    }

    case 'html-interstitial-seen': {
      if (state.phase === 'drive-auth') return rotateAuthUser(state);
      if (state.phase === 'direct') {
        if (state.isDrive) return rotateAuthUser(state);
        const outcome: AcquireOutcome = { status: 'failed', detail: 'html-interstitial' };
        return { state: { ...state, phase: 'settled', outcome }, effects: settled(state, outcome) };
      }
      break;
    }

    case 'forbidden-confirmed': {
      // Zero-tab: the account sweep IS the fallback — no bypass tab. Drive
      // rotates to the next signed-in account; non-Drive has no account axis
      // and fails honestly.
      if (state.phase === 'direct' || state.phase === 'drive-auth') {
        if (state.isDrive) return rotateAuthUser(state);
        const outcome: AcquireOutcome = { status: 'failed', detail: 'forbidden' };
        return { state: { ...state, phase: 'settled', outcome }, effects: settled(state, outcome) };
      }
      break;
    }

    case 'transient-failed': {
      // NETWORK_FAILED / SERVER_FAILED class: one in-place retry with a fresh
      // deadline, then settle — transient failures are worth one more try,
      // never an unbounded loop.
      if (state.phase === 'direct' || state.phase === 'drive-auth') {
        if (!state.transientRetried) {
          return {
            state: { ...state, transientRetried: true },
            effects: [
              { type: 'begin-strategy', strategy: state.phase === 'direct' ? 'direct' : 'drive-auth', authUser: state.authUser },
              { type: 'set-deadline', ms: ATTEMPT_DEADLINE_MS },
            ],
          };
        }
        const outcome: AcquireOutcome = { status: 'failed', detail: event.detail ?? 'transient' };
        return { state: { ...state, phase: 'settled', outcome }, effects: settled(state, outcome) };
      }
      break;
    }

    case 'auth-attempt-failed': {
      if (state.phase === 'drive-auth') return rotateAuthUser(state);
      break;
    }

    case 'bypass-tab-opened': {
      if (state.phase === 'bypass-tab') {
        return { state: { ...state, tabId: event.tabId }, effects: [] };
      }
      break;
    }

    case 'saved': {
      const outcome = saveOutcome(state, event.downloadId);
      return { state: { ...state, phase: 'settled', outcome }, effects: settled(state, outcome) };
    }

    case 'interrupted': {
      const outcome: AcquireOutcome = { status: 'failed', detail: event.detail };
      return { state: { ...state, phase: 'settled', outcome }, effects: settled(state, outcome) };
    }

    case 'timeout': {
      const outcome: AcquireOutcome = { status: 'timeout', detail: 'no terminal state before deadline' };
      return { state: { ...state, phase: 'settled', outcome }, effects: settled(state, outcome) };
    }

    case 'cancel': {
      const outcome: AcquireOutcome = { status: 'cancelled' };
      return { state: { ...state, phase: 'settled', outcome }, effects: settled(state, outcome) };
    }
  }

  // Unhandled (state, event) pairs are inert — the machine never invents
  // transitions, and a stray late event cannot unseat a live attempt.
  return { state, effects: [] };
}
