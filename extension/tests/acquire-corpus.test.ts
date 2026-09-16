// filepath: extension/tests/acquire-corpus.test.ts
/**
 * Download-outcome corpus (no-dead-ends program) — the differential contract:
 *
 * Every case encodes a REAL failure shape, the DESIRED terminal outcome, and
 * the user-visible message class. Each case runs TWICE:
 *
 *   1. PURE — the event sequence through nextAcquireState (the machine that
 *      Phase 3 wires into production), asserting the settle outcome.
 *   2. PRODUCTION — the scripted browser host through the real background
 *      listeners, asserting the terminal status call the user's button sees.
 *
 * Production and machine must AGREE. A case that fails on either side is a
 * dead end a user could hit. Cases marked RED today encode the Phase-2
 * hardening contract (transient retries, per-class messages, deadlines,
 * Firefox honesty) and go green as those land.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  nextAcquireState,
  type AcquireEvent,
  type AcquireMachineState,
} from '../src/core/acquire/state-machine';
import type { AcquireOutcomeStatus } from '../src/contracts/topics';
import {
  loadFlowHarness,
  DRIVE_BASE,
  EXTERNAL_URL,
  type FlowHarness,
} from './helpers/background-flow';

// ── Case vocabulary ─────────────────────────────────────────────────────────

interface CorpusCase {
  id: string;
  /** What the user should see when the dust settles. */
  expected: {
    outcome: AcquireOutcomeStatus;
    /** The button's terminal status string sent to the tab. */
    buttonStatus: 'success' | 'error' | 'cancelled' | 'trying';
    /** errorCode on the terminal error call, where the taxonomy defines one. */
    errorCode?: string;
    /** Number of download attempts the engine may make (upper bound). */
    maxAttempts: number;
  };
  /** Pure-machine event sequence from the `requested` phase. */
  machineEvents: AcquireEvent[];
  /** Browser-host failure script for the production side (optional). */
  script?: ('id' | 'lastError' | 'never')[];
  /** Drive the production harness. Receives the loaded harness. */
  drive: (h: FlowHarness) => void;
}

const interrupted = (error: string) => (id: number) => ({
  id,
  state: { current: 'interrupted' },
  error: { current: error },
});

const complete = (id: number) => ({ id, state: { current: 'complete' } });

async function runPure(caseDef: CorpusCase): Promise<AcquireOutcomeStatus | null> {
  let state: AcquireMachineState = {
    phase: 'requested',
    requestId: 'req-corpus',
    file: {
      fileId: 'FILE123',
      url: DRIVE_BASE,
    },
    nameHint: { preferredStem: 'lecture', ext: 'pdf', source: 'aria' },
    isDrive: true,
    attemptedAuthUsers: [],
  } as AcquireMachineState;
  let settle: AcquireOutcomeStatus | null = null;
  for (const event of caseDef.machineEvents) {
    const result = nextAcquireState(state, event);
    state = result.state;
    for (const effect of result.effects) {
      if (effect.type === 'settle') settle = effect.outcome.status;
    }
  }
  return settle;
}

// ── The corpus ──────────────────────────────────────────────────────────────

const CASES: CorpusCase[] = [
  {
    id: 'validator-reject-is-blocked',
    expected: { outcome: 'blocked', buttonStatus: 'error', errorCode: 'INVALID_URL', maxAttempts: 0 },
    machineEvents: [{ type: 'validate', ok: false, reason: 'UNSAFE_SCHEME' }],
    drive: (h) => {
      h.requestDownload('javascript:alert(1)');
    },
  },
  {
    id: 'forbidden-sweep-exhausts-to-auth-exhausted',
    expected: { outcome: 'auth-exhausted', buttonStatus: 'error', errorCode: 'AUTH_ALL_FAILED', maxAttempts: 11 },
    machineEvents: [
      { type: 'plan', isDrive: true, strategies: ['direct', 'drive-auth'] },
      { type: 'strategy-started', strategy: 'direct' },
      { type: 'download-started', downloadId: 1 },
      ...Array.from({ length: 11 }, () => ({ type: 'forbidden-confirmed' } as AcquireEvent)),
    ],
    drive: (h) => {
      h.requestDownload();
      // Attempt ids 1000..1010: each interrupted forbidden → next account.
      for (let i = 0; i < 11; i++) h.dispatchDownloadChange(interrupted('SERVER_FORBIDDEN')(1000 + i));
    },
  },
  {
    id: 'sweep-success-midway-is-saved',
    expected: { outcome: 'saved', buttonStatus: 'success', maxAttempts: 4 },
    machineEvents: [
      { type: 'plan', isDrive: true, strategies: ['direct', 'drive-auth'] },
      { type: 'download-started', downloadId: 1 },
      { type: 'auth-attempt-failed' },
      { type: 'auth-attempt-failed' },
      { type: 'auth-attempt-failed' },
      { type: 'saved', downloadId: 9 },
    ],
    drive: (h) => {
      h.requestDownload();
      for (let i = 0; i < 3; i++) h.dispatchDownloadChange(interrupted('SERVER_FORBIDDEN')(1000 + i));
      h.dispatchDownloadChange(complete(1003));
    },
  },
  {
    id: 'transient-network-retries-then-saves',
    expected: { outcome: 'saved', buttonStatus: 'success', maxAttempts: 3 },
    machineEvents: [
      { type: 'plan', isDrive: true, strategies: ['direct', 'drive-auth'] },
      { type: 'download-started', downloadId: 1 },
      // Phase-2/3 contract: transient interrupts retry in place, not fail.
      { type: 'auth-attempt-failed' },
      { type: 'saved', downloadId: 2 },
    ],
    drive: (h) => {
      h.requestDownload();
      h.dispatchDownloadChange(interrupted('NETWORK_FAILED')(1000));
      vi.advanceTimersByTime(2_000); // retry fires
      h.dispatchDownloadChange(complete(1001));
    },
  },
  {
    id: 'transient-server-5xx-retries-then-saves',
    expected: { outcome: 'saved', buttonStatus: 'success', maxAttempts: 3 },
    machineEvents: [
      { type: 'plan', isDrive: true, strategies: ['direct', 'drive-auth'] },
      { type: 'download-started', downloadId: 1 },
      { type: 'auth-attempt-failed' },
      { type: 'saved', downloadId: 2 },
    ],
    drive: (h) => {
      h.requestDownload();
      h.dispatchDownloadChange(interrupted('SERVER_FAILED')(1000));
      vi.advanceTimersByTime(2_000); // retry fires
      h.dispatchDownloadChange(complete(1001));
    },
  },
  {
    id: 'permanent-file-failed-fails-fast',
    expected: { outcome: 'failed', buttonStatus: 'error', errorCode: 'FILE_FAILED', maxAttempts: 1 },
    machineEvents: [
      { type: 'plan', isDrive: true, strategies: ['direct', 'drive-auth'] },
      { type: 'download-started', downloadId: 1 },
      { type: 'interrupted', detail: 'FILE_FAILED' },
    ],
    drive: (h) => {
      h.requestDownload();
      h.dispatchDownloadChange(interrupted('FILE_FAILED')(1000));
    },
  },
  {
    id: 'storage-full-has-its-own-message',
    expected: { outcome: 'failed', buttonStatus: 'error', errorCode: 'STORAGE_FULL', maxAttempts: 1 },
    machineEvents: [
      { type: 'plan', isDrive: true, strategies: ['direct', 'drive-auth'] },
      { type: 'download-started', downloadId: 1 },
      { type: 'interrupted', detail: 'STORAGE_FULL' },
    ],
    drive: (h) => {
      h.requestDownload();
      h.dispatchDownloadChange(interrupted('STORAGE_FULL')(1000));
    },
  },
  {
    id: 'browser-user-cancel-is-cancelled-not-error',
    expected: { outcome: 'cancelled', buttonStatus: 'cancelled', maxAttempts: 1 },
    machineEvents: [
      { type: 'plan', isDrive: true, strategies: ['direct', 'drive-auth'] },
      { type: 'download-started', downloadId: 1 },
      { type: 'cancel' },
    ],
    drive: (h) => {
      h.requestDownload();
      // The USER cancelled from the browser's own download shelf.
      h.dispatchDownloadChange(interrupted('USER_CANCELED')(1000));
    },
  },
  {
    id: 'stalled-download-times-out',
    expected: { outcome: 'timeout', buttonStatus: 'error', errorCode: 'TIMEOUT', maxAttempts: 1 },
    machineEvents: [
      { type: 'plan', isDrive: true, strategies: ['direct', 'drive-auth'] },
      { type: 'download-started', downloadId: 1 },
      { type: 'timeout' },
    ],
    script: ['never'],
    drive: (h) => {
      h.requestDownload();
      h.firePendingExpired('req-corpus');
    },
  },
  {
    id: 'browser-start-failure-retries-then-guides',
    expected: { outcome: 'browser-fail', buttonStatus: 'error', errorCode: 'BROWSER_START_FAIL', maxAttempts: 2 },
    machineEvents: [
      { type: 'plan', isDrive: true, strategies: ['direct', 'drive-auth'] },
      { type: 'strategy-started', strategy: 'direct' },
      { type: 'start-failed' },
      { type: 'start-failed' },
    ],
    script: ['lastError', 'lastError'],
    drive: (h) => {
      h.requestDownload();
      vi.advanceTimersByTime(5_000);
    },
  },
  {
    id: 'non-drive-html-is-blocked-not-saved',
    expected: { outcome: 'failed', buttonStatus: 'error', errorCode: 'HTML_RESPONSE', maxAttempts: 1 },
    machineEvents: [
      { type: 'validate', ok: true },
      { type: 'plan', isDrive: false, strategies: ['direct'] },
      { type: 'strategy-started', strategy: 'direct' },
      { type: 'download-started', downloadId: 1 },
      { type: 'html-interstitial-seen' },
    ],
    drive: (h) => {
      h.requestDownload(EXTERNAL_URL, 'req-corpus', { name: 'page', ext: 'pdf' });
      h.dispatchDeterminingFilename({
        id: 1000,
        url: EXTERNAL_URL,
        finalUrl: EXTERNAL_URL,
        filename: 'sign-in.html',
        mime: 'text/html',
      });
    },
  },
];

// ── Runners ─────────────────────────────────────────────────────────────────

describe('acquire corpus — PURE machine side', () => {
  for (const caseDef of CASES) {
    it(caseDef.id, async () => {
      const settle = await runPure(caseDef);
      expect(settle).not.toBeNull();
      expect(settle).toBe(caseDef.expected.outcome);
    });
  }
});

describe('acquire corpus — PRODUCTION side (must agree with the machine)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  for (const caseDef of CASES) {
    it(caseDef.id, async () => {
      const h = await loadFlowHarness({ downloadScript: caseDef.script });
      caseDef.drive(h);

      const last = h.lastStatus();
      const attempts = h.downloadCalls.length;
      expect(attempts, 'attempt count within budget').toBeLessThanOrEqual(caseDef.expected.maxAttempts);

      if (caseDef.expected.buttonStatus === 'success') {
        expect(last?.status).toBe('success');
      } else if (caseDef.expected.buttonStatus === 'cancelled') {
        expect(last?.status).toBe('cancelled');
      } else {
        expect(last?.status).toBe('error');
        if (caseDef.expected.errorCode) {
          expect(last?.errorCode).toBe(caseDef.expected.errorCode);
        }
      }
      // No dead end: every failure tells the user SOMETHING.
      if (caseDef.expected.buttonStatus === 'error') {
        expect(last?.userMessage?.length ?? 0).toBeGreaterThan(0);
      }
      void caseDef;
    });
  }
});
