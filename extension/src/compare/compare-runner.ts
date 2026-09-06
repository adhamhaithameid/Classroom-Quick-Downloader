// filepath: extension/src/compare/compare-runner.ts
/**
 * ============================================================================
 * COMPARE RUNNER — the one entry point orchestration calls
 * ============================================================================
 *
 * Runs both detectors over a post, compares them, records the result, logs a
 * line, and renders the structural badge over the keyword one.
 *
 * Kept as a single function so the engine gains exactly one guarded call
 * rather than a block of compare logic. Everything here is compare-build only;
 * `runComparison` is a no-op unless IS_COMPARE_BUILD is true, and the whole
 * module is unreachable from production entrypoints.
 */
import { keywordDetector } from '../detect/keyword/keyword-detector';
import { structuralDetector } from '../detect/structural/structural-detector';
import { decideFlags } from '../decide/decide-flags';
import type { DetectContext } from '../contracts/detection';

import { IS_COMPARE_BUILD } from './compare-mode';
import { compareObservations } from './compare-observations';
import { compareCollector, logComparison, printReport } from './compare-instrumentation';
import { renderStructuralBadge, markCompareRoot } from './compare-render';

/**
 * Observe a post with both engines, record the comparison, render the
 * structural badge. No-op outside a compare build.
 */
export function runComparison(post: HTMLElement, ctx: DetectContext): void {
  if (!IS_COMPARE_BUILD) return;

  const keyword = keywordDetector.observe(post, ctx);
  const structural = structuralDetector.observe(post, ctx);

  const record = compareObservations(keyword, structural);
  compareCollector.add(record);
  logComparison(record);

  markCompareRoot(post);
  renderStructuralBadge(decideFlags(structural), post);
}

/**
 * Expose `window.__cqd.report()` for on-demand summaries.
 *
 * Called once at engine init. No-op outside a compare build, so the global
 * does not exist in a store build at all.
 */
export function installCompareGlobals(): void {
  if (!IS_COMPARE_BUILD) return;
  if (typeof window === 'undefined') return;

  const target = window as unknown as Record<string, unknown>;
  target['__cqd'] = {
    report: () => printReport(),
    records: () => compareCollector.all(),
    reset: () => compareCollector.reset(),
  };

  console.info('[CQD-COMPARE] compare build active — run window.__cqd.report() for a summary');
}
