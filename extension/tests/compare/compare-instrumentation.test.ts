// filepath: extension/tests/compare/compare-instrumentation.test.ts
/**
 * The collector that turns per-post comparisons into the summary the
 * promotion decision is made from.
 *
 * Statistics here must be honest about the unavailable bucket: agreement rate
 * is computed over signals both engines could actually evaluate, and the
 * unavailable count is reported separately and prominently.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CompareCollector } from '../../src/compare/compare-instrumentation';
import { ViewKind } from '../../src/engines/types';
import type { ComparisonRecord } from '../../src/compare/compare-observations';

function record(overrides: Partial<ComparisonRecord> = {}): ComparisonRecord {
  return {
    postId: 'p1',
    viewKind: ViewKind.STREAM,
    comment: {
      outcome: 'agree',
      keyword: { present: true, count: 3 },
      structural: { present: true, count: 3 },
    },
    edited: {
      outcome: 'unavailable',
      keyword: { present: false, count: null },
      structural: { present: false, count: null },
    },
    keywordMs: 4,
    structuralMs: 1,
    ...overrides,
  };
}

describe('CompareCollector', () => {
  let collector: CompareCollector;

  beforeEach(() => {
    collector = new CompareCollector();
  });

  it('starts empty', () => {
    const report = collector.summarize();
    expect(report.postsScanned).toBe(0);
    expect(report.comment.agreementRate).toBeNull();
  });

  it('counts posts scanned', () => {
    collector.add(record({ postId: 'a' }));
    collector.add(record({ postId: 'b' }));
    expect(collector.summarize().postsScanned).toBe(2);
  });

  it('computes an agreement rate over evaluable signals only', () => {
    collector.add(record({ comment: { outcome: 'agree', keyword: { present: true, count: 1 }, structural: { present: true, count: 1 } } }));
    collector.add(record({ comment: { outcome: 'agree', keyword: { present: true, count: 1 }, structural: { present: true, count: 1 } } }));
    collector.add(record({ comment: { outcome: 'disagree', keyword: { present: true, count: 1 }, structural: { present: false, count: null } } }));

    const report = collector.summarize();
    expect(report.comment.agree).toBe(2);
    expect(report.comment.disagree).toBe(1);
    expect(report.comment.agreementRate).toBeCloseTo(2 / 3);
  });

  it('excludes unavailable signals from the agreement rate entirely', () => {
    collector.add(record());
    collector.add(record());

    const report = collector.summarize();
    // Every edited signal was unavailable, so there is no rate to report.
    expect(report.edited.unavailable).toBe(2);
    expect(report.edited.agreementRate).toBeNull();
  });

  it('never lets unavailable inflate the agreement rate', () => {
    collector.add(record({ edited: { outcome: 'unavailable', keyword: { present: true, count: null }, structural: { present: false, count: null } } }));
    collector.add(record({ edited: { outcome: 'disagree', keyword: { present: true, count: null }, structural: { present: false, count: null } } }));

    const report = collector.summarize();
    expect(report.edited.agree).toBe(0);
    expect(report.edited.agreementRate).toBe(0);
  });

  it('reports mean and median latency per engine', () => {
    collector.add(record({ keywordMs: 2, structuralMs: 1 }));
    collector.add(record({ keywordMs: 4, structuralMs: 3 }));
    collector.add(record({ keywordMs: 9, structuralMs: 5 }));

    const report = collector.summarize();
    expect(report.keyword.meanMs).toBeCloseTo(5);
    expect(report.keyword.medianMs).toBe(4);
    expect(report.structural.meanMs).toBeCloseTo(3);
    expect(report.structural.medianMs).toBe(3);
  });

  it('takes the mean of the two middle values for an even sample', () => {
    collector.add(record({ keywordMs: 1, structuralMs: 1 }));
    collector.add(record({ keywordMs: 3, structuralMs: 1 }));

    expect(collector.summarize().keyword.medianMs).toBe(2);
  });

  it('lists disagreements with their post ids', () => {
    collector.add(record({ postId: 'good' }));
    collector.add(record({
      postId: 'bad',
      comment: { outcome: 'disagree', keyword: { present: true, count: 5 }, structural: { present: false, count: null } },
    }));

    const report = collector.summarize();
    expect(report.disagreements).toHaveLength(1);
    expect(report.disagreements[0]!.postId).toBe('bad');
    expect(report.disagreements[0]!.signal).toBe('comment');
  });

  it('carries the main-thread contention caveat in the report', () => {
    collector.add(record());
    expect(collector.summarize().caveat).toMatch(/contend|relative/i);
  });

  it('can be reset', () => {
    collector.add(record());
    collector.reset();
    expect(collector.summarize().postsScanned).toBe(0);
  });

  it('produces a report that survives JSON round-tripping', () => {
    collector.add(record());
    const report = collector.summarize();
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});
