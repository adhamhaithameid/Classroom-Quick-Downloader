// filepath: extension/src/compare/compare-instrumentation.ts
/**
 * ============================================================================
 * COMPARE INSTRUMENTATION — the evidence the promotion decision needs
 * ============================================================================
 *
 * Collects one ComparisonRecord per post per scan and summarizes them on
 * demand via `window.__cqd.report()`.
 *
 * STATISTICAL HONESTY
 * Agreement rate is computed over signals BOTH engines could evaluate. A
 * signal one engine cannot evaluate is counted in its own `unavailable`
 * bucket and excluded from the denominator. If every sample of a signal is
 * unavailable, the rate is `null` — not 100%, not 0%. Reporting "100%
 * agreement on edited" when the structural engine is simply blind to edited
 * would be the single easiest way to talk ourselves into a bad promotion.
 *
 * TIMING CAVEAT
 * In compare mode both engines contend for the same main thread, so absolute
 * timings are inflated. Relative comparison between the two is meaningful;
 * the absolute numbers are not. The caveat ships inside the report so it
 * cannot be read without it.
 */
import type { ComparisonRecord, ComparisonOutcome } from './compare-observations';

const TIMING_CAVEAT =
  'Both engines contend for the same main thread in compare mode, so absolute ' +
  'timings are inflated. Relative comparison is meaningful; absolute numbers are not.';

/** Per-signal tallies. */
export interface SignalStats {
  agree: number;
  disagree: number;
  unavailable: number;
  /** agree / (agree + disagree). Null when nothing was evaluable. */
  agreementRate: number | null;
}

/** Per-engine latency stats. */
export interface EngineStats {
  meanMs: number;
  medianMs: number;
}

/** One row of the disagreement list. */
export interface DisagreementRow {
  postId: string;
  signal: 'comment' | 'edited';
  keyword: { present: boolean; count: number | null };
  structural: { present: boolean; count: number | null };
}

/** What `window.__cqd.report()` returns and prints. */
export interface CompareReport {
  postsScanned: number;
  comment: SignalStats;
  edited: SignalStats;
  keyword: EngineStats;
  structural: EngineStats;
  disagreements: DisagreementRow[];
  caveat: string;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function tally(outcomes: ComparisonOutcome[]): SignalStats {
  const agree = outcomes.filter((o) => o === 'agree').length;
  const disagree = outcomes.filter((o) => o === 'disagree').length;
  const unavailable = outcomes.filter((o) => o === 'unavailable').length;
  const evaluable = agree + disagree;

  return {
    agree,
    disagree,
    unavailable,
    agreementRate: evaluable === 0 ? null : agree / evaluable,
  };
}

export class CompareCollector {
  private records: ComparisonRecord[] = [];

  add(record: ComparisonRecord): void {
    this.records.push(record);
  }

  reset(): void {
    this.records = [];
  }

  all(): readonly ComparisonRecord[] {
    return this.records;
  }

  summarize(): CompareReport {
    const disagreements: DisagreementRow[] = [];

    for (const r of this.records) {
      if (r.comment.outcome === 'disagree') {
        disagreements.push({
          postId: r.postId,
          signal: 'comment',
          keyword: r.comment.keyword,
          structural: r.comment.structural,
        });
      }
      if (r.edited.outcome === 'disagree') {
        disagreements.push({
          postId: r.postId,
          signal: 'edited',
          keyword: r.edited.keyword,
          structural: r.edited.structural,
        });
      }
    }

    return {
      postsScanned: this.records.length,
      comment: tally(this.records.map((r) => r.comment.outcome)),
      edited: tally(this.records.map((r) => r.edited.outcome)),
      keyword: {
        meanMs: mean(this.records.map((r) => r.keywordMs)),
        medianMs: median(this.records.map((r) => r.keywordMs)),
      },
      structural: {
        meanMs: mean(this.records.map((r) => r.structuralMs)),
        medianMs: median(this.records.map((r) => r.structuralMs)),
      },
      disagreements,
      caveat: TIMING_CAVEAT,
    };
  }
}

/** The one collector a compare build uses. */
export const compareCollector = new CompareCollector();

function formatRate(rate: number | null): string {
  return rate === null ? 'n/a (nothing evaluable)' : `${(rate * 100).toFixed(1)}%`;
}

/** One grouped line per post, as it is scanned. */
export function logComparison(record: ComparisonRecord): void {
  const flag = (o: ComparisonOutcome) => (o === 'agree' ? '=' : o === 'disagree' ? '!' : '?');

  console.groupCollapsed(
    `[CQD-COMPARE] ${record.postId} comment:${flag(record.comment.outcome)} ` +
      `edited:${flag(record.edited.outcome)} kw:${record.keywordMs.toFixed(2)}ms ` +
      `st:${record.structuralMs.toFixed(2)}ms`,
  );
  console.log('comment', record.comment);
  console.log('edited', record.edited);
  console.groupEnd();
}

/** Print the summary. Called by `window.__cqd.report()`. */
export function printReport(collector: CompareCollector = compareCollector): CompareReport {
  const report = collector.summarize();

  console.group('[CQD-COMPARE] summary');
  console.log(`posts scanned: ${report.postsScanned}`);
  console.table({
    comment: {
      agree: report.comment.agree,
      disagree: report.comment.disagree,
      unavailable: report.comment.unavailable,
      agreement: formatRate(report.comment.agreementRate),
    },
    edited: {
      agree: report.edited.agree,
      disagree: report.edited.disagree,
      unavailable: report.edited.unavailable,
      agreement: formatRate(report.edited.agreementRate),
    },
  });
  console.table({
    keyword: { mean_ms: report.keyword.meanMs.toFixed(2), median_ms: report.keyword.medianMs.toFixed(2) },
    structural: { mean_ms: report.structural.meanMs.toFixed(2), median_ms: report.structural.medianMs.toFixed(2) },
  });

  if (report.disagreements.length > 0) {
    console.log('disagreements:');
    console.table(report.disagreements);
  } else {
    console.log('no disagreements');
  }

  console.warn(report.caveat);
  console.groupEnd();

  return report;
}
