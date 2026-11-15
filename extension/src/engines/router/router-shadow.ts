// filepath: extension/src/engines/router/router-shadow.ts
/**
 * Shadow router wiring (bead hhpa.2). Subscribes the page bus, feeds the
 * stats store, runs the policy every N counted settles, and LOGS the
 * decision —
 *
 *   HARD GATE: this module never calls engineRegistry.setMode and has no
 *   import that could. Decisions are data only. Activation lives in
 *   hhpa.3 as an explicit opt-in ('auto' stored mode) and the factory
 *   default stays 'v2' until the owner reviews shadow data.
 *
 * Decision records ride the existing batched /track queue on state changes
 * only (quota: new events are rare by construction — file_type
 * 'engine_router_decision', the compact decision in error_type).
 */

import type { EventBus } from '../../bus/event-bus';
import type { PageTopicMap } from '../../contracts/topics';
import type { EngineMode } from '../types';
import { isApiConfigured } from '../v3/api/config';
import {
  ROUTER_STATS_STORAGE_KEY,
  createRouterStats,
  isCountedOutcome,
  type RouterObservation,
  type RouterStats,
} from './router-stats';
import {
  decideRoute,
  type CandidateInput,
  type PolicyDecision,
  type RouterCandidateMode,
} from './router-policy';

export const DECISION_FILE_TYPE = 'engine_router_decision';
const EVALUATE_EVERY = 5;

export interface ShadowRouterDeps {
  bus: EventBus<PageTopicMap>;
  getMode: () => EngineMode;
  stats?: RouterStats;
  /** Default: chrome.storage.local JSON adapter (content-script safe). */
  statsStorage?: {
    load: () => Promise<unknown>;
    save: (state: unknown) => Promise<void>;
  };
  now?: () => number;
  /** Test seam: override candidate availability (default: v3 via isApiConfigured). */
  isModeAvailable?: (mode: RouterCandidateMode) => boolean;
  /**
   * Decision-event sink. src/ stays pure (no entrypoints imports), so the
   * bootstrap injects Analytics.track here; default is a console-only noop.
   */
  track?: (event: {
    status: 'success' | 'fail';
    file_type: string;
    error_type?: string;
    source?: string;
    duration_ms: number;
  }) => void;
  log?: (message: string) => void;
}

export interface ShadowRouter {
  stop(): void;
  /** Runs the policy now; exposed for tests and the popup debug readout. */
  evaluate(): Promise<PolicyDecision | null>;
}

function defaultStatsStorage(): { load: () => Promise<unknown>; save: (state: unknown) => Promise<void> } {
  return {
    async load() {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
      try {
        const got = await chrome.storage.local.get(ROUTER_STATS_STORAGE_KEY);
        return got?.[ROUTER_STATS_STORAGE_KEY] ?? null;
      } catch {
        return null;
      }
    },
    async save(state) {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
      try {
        await chrome.storage.local.set({ [ROUTER_STATS_STORAGE_KEY]: state });
      } catch {
        // Quota or context gone: the in-memory copy keeps working.
      }
    },
  };
}

function defaultTrack(_event: {
  status: 'success' | 'fail';
  file_type: string;
  error_type?: string;
  source?: string;
  duration_ms: number;
}): void {
  // Pure default: the bootstrap injects Analytics.track (src/ must not
  // import entrypoints/). Until then decisions stay console-only.
}

export function createShadowRouter(deps: ShadowRouterDeps): ShadowRouter {
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? ((message: string) => console.info(message));
  const track = deps.track ?? defaultTrack;
  const stats =
    deps.stats ??
    createRouterStats({
      load: async () => (await defaultStatsStorage().load()) as never,
      save: async (state) => void (await defaultStatsStorage().save(state)),
    });
  const isModeAvailable =
    deps.isModeAvailable ??
    ((mode: RouterCandidateMode) => (mode === 'v3' ? isApiConfigured() : true));

  let lastView = 'unknown';
  let countedSinceEvaluate = 0;
  let lastEmittedSignature: string | null = null;
  let stopped = false;

  const offRoute = deps.bus.subscribe('route:changed', ({ view }) => {
    lastView = String(view);
  });

  const offSettled = deps.bus.subscribe('download:settled', ({ outcome }) => {
    if (stopped || !isCountedOutcome(outcome.status)) return;
    const observation: RouterObservation = {
      mode: deps.getMode(),
      pageType: lastView,
      status: outcome.status,
      at: now(),
    };
    void stats
      .record(observation)
      .then(() => {
        countedSinceEvaluate += 1;
        if (countedSinceEvaluate >= EVALUATE_EVERY) {
          countedSinceEvaluate = 0;
          return evaluate();
        }
        return undefined;
      })
      .catch(() => undefined);
  });

  async function evaluate(): Promise<PolicyDecision | null> {
    const snapshot = await stats.snapshot();
    const modes: RouterCandidateMode[] = ['legacy', 'v2', 'v3'];
    const currentMode = deps.getMode();
    const candidates: CandidateInput[] = modes.map((mode) => {
        const modeStats = snapshot.modes[mode];
        return {
          mode,
          available: isModeAvailable(mode),
          attempts: modeStats?.attempts ?? 0,
          saved: modeStats?.saved ?? 0,
          failureStreak: modeStats?.failureStreak ?? 0,
        };
      });
    const decision = decideRoute({
      candidates,
      currentMode: (modes as string[]).includes(currentMode)
        ? (currentMode as RouterCandidateMode)
        : null,
      lastSwitchAt: null, // shadow phase never switches; cooldown is moot
      now: now(),
    });
    log(
      `[CQD Router] shadow decision: ${decision.action} ${decision.chosen ?? '-'} (${decision.reason}); ` +
        decision.ranking.map((entry) => `${entry.mode}=${entry.score.toFixed(0)}`).join(' '),
    );
    const signature = `${decision.action}:${decision.chosen ?? 'none'}`;
    if (signature !== lastEmittedSignature) {
      lastEmittedSignature = signature;
      try {
        track({
          status: 'success',
          file_type: DECISION_FILE_TYPE,
          error_type: signature.replace(/[^a-z0-9._-]/gi, '.').slice(0, 32),
          source: 'router',
          duration_ms: 0,
        });
      } catch {
        // Telemetry must never break the download path.
      }
    }
    return decision;
  }

  return {
    evaluate,
    stop(): void {
      stopped = true;
      offRoute();
      offSettled();
    },
  };
}
