// filepath: extension/src/strategies/acquire/strategy-chain.ts
/**
 * ============================================================================
 * ACQUISITION STRATEGY CHAIN — the pluggable download seam (no-dead-ends)
 * ============================================================================
 *
 * The chain is DATA, not code: each tier names a way to acquire a file and
 * the failure class it answers. The engine walks the chain in order; when a
 * tier fails with a class the NEXT tier can answer, the chain continues —
 * exhaustion of every tier that applies is the only terminal.
 *
 * Today's chain matches production: `direct` (the byte-serving endpoint)
 * then `drive-auth` (the signed-in-account sweep). The `api` tier is the
 * reserved third slot: Drive files.get via OAuth (see api-download-tier.md).
 * It stays OUT of the active chain until the consent model (#398) ships —
 * a strategy slot that is documented, tested at the type level, and
 * flag-gated off cannot surprise anyone.
 */
import type { AcquireStrategyName } from '../../contracts/topics';

/** The failure classes a strategy can report (mirrors AcquireOutcomeStatus). */
export type StrategyFailureClass =
  | 'forbidden'
  | 'transient'
  | 'permanent'
  | 'user'
  | 'browser';

export interface AcquireStrategy {
  name: AcquireStrategyName;
  /** Human-readable summary for the debug panel and decision traces. */
  describe: string;
  /** The failure classes this tier can meaningfully ANSWER (retry/succeed). */
  answers: StrategyFailureClass[];
  /** Whether the tier is allowed to activate today. */
  enabled: () => boolean;
}

/**
 * The active chain. Ordered: cheapest and least-surprising first.
 * The api tier is listed with `enabled: false` — its slot, contracts and
 * gating are part of this commit; its activation waits on #398 (OAuth
 * client id + `identity` permission + consent UX).
 */
export const ACQUIRE_STRATEGY_CHAIN: readonly AcquireStrategy[] = [
  {
    name: 'direct',
    describe: 'Byte-serving endpoint with the ambient session',
    answers: [],
    enabled: () => true,
  },
  {
    name: 'drive-auth',
    describe: 'Signed-in-account sweep (authuser rotation, zero-tab)',
    answers: ['forbidden'],
    enabled: () => true,
  },
  {
    name: 'api',
    describe: 'Drive API files.get?alt=media via OAuth token (reserved)',
    answers: ['forbidden'],
    enabled: () => false, // #398 consent model must ship first
  },
];

/** The next tier that can answer the given failure class, if any. */
export function nextStrategyFor(
  failureClass: StrategyFailureClass,
  failedStrategies: readonly AcquireStrategyName[],
): AcquireStrategy | null {
  for (const strategy of ACQUIRE_STRATEGY_CHAIN) {
    if (failedStrategies.includes(strategy.name)) continue;
    if (!strategy.enabled()) continue;
    if (!strategy.answers.includes(failureClass)) continue;
    return strategy;
  }
  return null;
}
