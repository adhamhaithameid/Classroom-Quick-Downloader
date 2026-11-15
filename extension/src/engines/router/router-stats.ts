/**
 * Engine-outcome stats store (bead hhpa.1). Rolling per-mode × page-type
 * download outcomes plus a per-mode failure streak, persisted as one JSON
 * blob. Pure: storage, clock, and caps are injected, so policy decisions
 * (router-policy.ts) and the wiring (router-shadow.ts) stay testable.
 *
 * The local log is the routing source of truth (owner ideation 2026-10-27);
 * nothing here leaves the device except the aggregate decision events the
 * shadow wiring emits on state changes.
 */

import type { EngineMode } from '../types';
import type { AcquireOutcomeStatus } from '../../contracts/topics';

export const ROUTER_STATS_STORAGE_KEY = 'cqd_engine_router_stats_v1';

/** Settles that count as healthy for streaks and success rate. */
export function isHealthyOutcome(status: AcquireOutcomeStatus): boolean {
  return status === 'saved';
}

/** Cancelled outcomes are user intent, not engine health — excluded. */
export function isCountedOutcome(status: AcquireOutcomeStatus): boolean {
  return status !== 'cancelled';
}

export interface RouterObservation {
  mode: EngineMode;
  pageType: string;
  status: AcquireOutcomeStatus;
  at: number;
}

export interface ModeStats {
  attempts: number;
  saved: number;
  failed: number;
  successRate: number | null;
  /** Consecutive non-saved, non-cancelled settles, most recent first. */
  failureStreak: number;
}

export interface RouterStatsSnapshot {
  modes: Record<string, ModeStats>;
  totalObservations: number;
}

export interface RouterStatsState {
  /** Insertion-ordered ring per mode, oldest first. */
  ring: Record<string, RouterObservation[]>;
}

export const RING_CAP_PER_MODE = 50;
export const TOTAL_OBSERVATION_CAP = 400;

export interface RouterStatsDeps {
  load: () => Promise<RouterStatsState | null>;
  save: (state: RouterStatsState) => Promise<void>;
  ringCapPerMode?: number;
  totalCap?: number;
}

export interface RouterStats {
  record(observation: RouterObservation): Promise<void>;
  snapshot(): Promise<RouterStatsSnapshot>;
  failureStreak(mode: EngineMode): Promise<number>;
  reset(): Promise<void>;
}

function emptyState(): RouterStatsState {
  return { ring: {} };
}

function sanitizeState(raw: unknown, ringCap: number, totalCap: number): RouterStatsState {
  if (!raw || typeof raw !== 'object') return emptyState();
  const ringRaw = (raw as { ring?: unknown }).ring;
  if (!ringRaw || typeof ringRaw !== 'object') return emptyState();
  const ring: Record<string, RouterObservation[]> = {};
  let total = 0;
  for (const [mode, entries] of Object.entries(ringRaw as Record<string, unknown>)) {
    if (!Array.isArray(entries)) continue;
    const valid = entries.filter(
      (entry): entry is RouterObservation =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as RouterObservation).mode === 'string' &&
        typeof (entry as RouterObservation).pageType === 'string' &&
        typeof (entry as RouterObservation).status === 'string' &&
        typeof (entry as RouterObservation).at === 'number',
    );
    if (!valid.length) continue;
    ring[mode] = valid.slice(-ringCap);
    total += ring[mode].length;
    if (total >= totalCap) break;
  }
  return { ring };
}

export function createRouterStats(deps: RouterStatsDeps): RouterStats {
  const ringCap = deps.ringCapPerMode ?? RING_CAP_PER_MODE;
  const totalCap = deps.totalCap ?? TOTAL_OBSERVATION_CAP;
  let cache: RouterStatsState | null = null;
  // Serialized op chain: bursts of settles (queue concurrency) must not
  // race the cache load — last-writer-wins would drop observations.
  let opChain: Promise<unknown> = Promise.resolve();

  function enqueue<T>(op: () => Promise<T>): Promise<T> {
    const next = opChain.then(op, op);
    opChain = next.catch(() => undefined);
    return next;
  }

  async function state(): Promise<RouterStatsState> {
    if (cache === null) {
      cache = sanitizeState(await deps.load(), ringCap, totalCap);
    }
    return cache;
  }

  async function persist(stateValue: RouterStatsState): Promise<void> {
    cache = stateValue;
    await deps.save(stateValue);
  }

  function statsForRing(ring: RouterObservation[]): ModeStats {
    let saved = 0;
    let failed = 0;
    let streak = 0;
    let streakClosed = false;
    for (let i = ring.length - 1; i >= 0; i -= 1) {
      const status = ring[i].status;
      if (!isCountedOutcome(status)) continue;
      if (isHealthyOutcome(status)) saved += 1;
      else failed += 1;
      if (!streakClosed) {
        if (isHealthyOutcome(status)) streakClosed = true;
        else streak += 1;
      }
    }
    const attempts = saved + failed;
    return {
      attempts,
      saved,
      failed,
      successRate: attempts > 0 ? saved / attempts : null,
      failureStreak: streak,
    };
  }

  return {
    record(observation): Promise<void> {
      return enqueue(async () => {
        const current = await state();
        const ring = current.ring[observation.mode] ?? [];
        ring.push(observation);
        while (ring.length > ringCap) ring.shift();
        current.ring[observation.mode] = ring;
        // Total cap: drop oldest modes first (insertion order of the record).
        let total = Object.values(current.ring).reduce((sum, entries) => sum + entries.length, 0);
        for (const mode of Object.keys(current.ring)) {
          if (total <= totalCap) break;
          const entries = current.ring[mode];
          const drop = Math.min(entries.length, total - totalCap);
          entries.splice(0, drop);
          total -= drop;
          if (!entries.length) delete current.ring[mode];
        }
        await persist(current);
      });
    },

    snapshot(): Promise<RouterStatsSnapshot> {
      return enqueue(async () => {
        const current = await state();
        const modes: Record<string, ModeStats> = {};
        let totalObservations = 0;
        for (const [mode, ring] of Object.entries(current.ring)) {
          modes[mode] = statsForRing(ring);
          totalObservations += ring.length;
        }
        return { modes, totalObservations };
      });
    },

    failureStreak(mode): Promise<number> {
      return enqueue(async () => {
        const current = await state();
        return statsForRing(current.ring[mode] ?? []).failureStreak;
      });
    },

    reset(): Promise<void> {
      return enqueue(() => persist(emptyState()));
    },
  };
}
