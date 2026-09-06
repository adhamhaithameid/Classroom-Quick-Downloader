/**
 * THE GATE. See docs/adr/0008-accuracy-definition-and-gates.md.
 *
 * C1 — every corpus case must match its labels exactly, except cases listed in
 *      knownFailures. A knownFailure that starts passing FAILS the test, which
 *      is how the list ratchets down instead of rotting.
 * C2 — statistical floors, which may only move up.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCorpus } from './corpus';
import { observeHtml } from './tier-b';
import { decideObservations } from './tier-a';
import {
  emptyReport,
  scoreCase,
  precision,
  recall,
  coverage,
  countExactRate,
} from './metrics';
import type { AccuracyReport } from './types';

const BUDGET_PATH = resolve(process.cwd(), 'tests/accuracy/accuracy-budget.json');
const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf8')) as {
  floors: Record<string, number>;
  knownFailures: string[];
};

function runCorpus(): AccuracyReport {
  const report = emptyReport();
  for (const item of loadCorpus()) {
    const observations = observeHtml(item.html, item.expected.viewKind, item.expected.lang);
    scoreCase(report, item.expected, decideObservations(observations));
  }
  return report;
}

describe('accuracy gate', () => {
  const report = runCorpus();

  it('C1: every case outside knownFailures matches its labels exactly', () => {
    const unexpected = report.failedCases.filter((id) => !budget.knownFailures.includes(id));
    expect(unexpected).toEqual([]);
  });

  it('C1: no knownFailure is silently passing', () => {
    const fixed = budget.knownFailures.filter((id) => report.exactCases.includes(id));
    expect(
      fixed,
      `These cases now pass. Remove them from knownFailures in ${BUDGET_PATH}.`,
    ).toEqual([]);
  });

  it('C2: comment precision meets its floor', () => {
    expect(precision(report.comment)).toBeGreaterThanOrEqual(budget.floors.commentPrecision!);
  });

  it('C2: comment recall meets its floor', () => {
    expect(recall(report.comment)).toBeGreaterThanOrEqual(budget.floors.commentRecall!);
  });

  it('C2: edited precision meets its floor', () => {
    expect(precision(report.edited)).toBeGreaterThanOrEqual(budget.floors.editedPrecision!);
  });

  it('C2: edited recall meets its floor', () => {
    expect(recall(report.edited)).toBeGreaterThanOrEqual(budget.floors.editedRecall!);
  });

  it('C2: comment count exact-match rate meets its floor', () => {
    expect(countExactRate(report)).toBeGreaterThanOrEqual(budget.floors.countExactRate!);
  });

  it('C2: post coverage meets its floor', () => {
    expect(coverage(report)).toBeGreaterThanOrEqual(budget.floors.coverage!);
  });
});
