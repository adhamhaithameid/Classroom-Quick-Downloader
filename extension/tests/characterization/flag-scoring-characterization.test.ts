// filepath: extension/tests/characterization/flag-scoring-characterization.test.ts
/**
 * Characterization lock for the V2 flag scoring path.
 *
 * This test does not assert that the behaviour is CORRECT. It asserts that it
 * is UNCHANGED. The baseline was captured before the Detect/Decide seam was
 * extracted; any diff here means the refactor altered detection.
 *
 * To regenerate deliberately (only when a behaviour change is intended and
 * reviewed): UPDATE_CHARACTERIZATION=1 pnpm -C extension test characterization
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { queryPostCards } from '../../entrypoints/content/post-card-utils';
import { scoreFlagsForPost } from '../../src/v2/decision/flag-scoring';
import { clearKeywordCache } from '../../src/v2/decision/keyword-loader';
import { ViewKind } from '../../src/engines/types';

const FIXTURES_DIR = resolve(process.cwd(), 'tests/fixtures/classroom');
const BASELINE_PATH = resolve(
  process.cwd(),
  'tests/characterization/flag-scoring-baseline.json',
);

/** Fixture filename -> the ViewKind that page would be classified as. */
const VIEW_KIND_BY_FIXTURE: Record<string, ViewKind> = {
  'announcement-detail-en.html': ViewKind.ANNOUNCEMENT_DETAIL,
  'assignment-details-en.html': ViewKind.ASSIGNMENT_DETAILS,
  'classwork-material-post-en.html': ViewKind.CLASSWORK_LIST,
  'material-details-en.html': ViewKind.MATERIAL_DETAILS,
  'mixed-links-post-en.html': ViewKind.STREAM,
  'rtl-flagged-post-ar.html': ViewKind.STREAM,
  'stream-flagged-post-en.html': ViewKind.STREAM,
  'student-submissions-en.html': ViewKind.STUDENT_SUBMISSIONS,
  'student-work-teacher-en.html': ViewKind.STUDENT_WORK_TEACHER,
};

/**
 * Fixtures that legitimately contain zero post cards.
 *
 * These three are attachment/button regression fixtures, not post-card
 * fixtures — their own header comments say so ("loose assignment instructions
 * and CTA controls do not become random download buttons", "admin action
 * buttons on the submissions dashboard do not get treated as attachments").
 * Detail and teacher-submission routes have no `data-stream-item-id` cards.
 *
 * Verified 2026-08-18: `queryPostCards()` and `DOMScanner.fullScan()` agree on
 * the post count for all 9 fixtures, so this is a property of the fixtures and
 * not of the enumerator chosen here.
 *
 * They are asserted to yield EXACTLY zero rather than skipped. That catches a
 * regression in both directions: a post-bearing fixture dropping to zero, and
 * a post-less fixture starting to produce posts — which would mean the post
 * selector got too loose, the precise failure these fixtures exist to guard.
 */
const POSTLESS_FIXTURES = new Set([
  'assignment-details-en.html',
  'material-details-en.html',
  'student-work-teacher-en.html',
]);

/** Page language to score each fixture with, derived from its filename. */
function langFor(fixture: string): string {
  return fixture.endsWith('-ar.html') ? 'ar' : 'en';
}

/**
 * Strip everything non-deterministic. `timestamp` is Date.now() and
 * `duration_ms` is a performance measurement — both change every run.
 */
type NormalizedDecision = {
  commentScore: number;
  editedScore: number;
  commentCount: number | null;
  editedDiff: string | null;
  finalVerdict: string;
  confidence: string;
  exclusionPenalties: Array<{ ruleId: string; penalty: number }>;
  layers: Array<{
    layerName: string;
    layerIndex: number;
    score: number;
    matched: boolean;
    matchedText: string | null;
    details: string;
  }>;
  exclusionRuleIds: string[];
  finalScore: number;
};

function normalize(decision: ReturnType<typeof scoreFlagsForPost>): NormalizedDecision {
  return {
    commentScore: decision.commentScore,
    editedScore: decision.editedScore,
    commentCount: decision.commentCount,
    editedDiff: decision.editedDiff,
    finalVerdict: decision.finalVerdict,
    confidence: decision.confidence,
    exclusionPenalties: decision.exclusionPenalties,
    layers: decision.trace.layers.map((l) => ({
      layerName: l.layerName,
      layerIndex: l.layerIndex,
      score: l.score,
      matched: l.matched,
      matchedText: l.matchedText,
      details: l.details,
    })),
    exclusionRuleIds: decision.trace.exclusions.map((e) => e.ruleId),
    finalScore: decision.trace.finalScore,
  };
}

function captureAll(): Record<string, NormalizedDecision[]> {
  const fixtures = readdirSync(FIXTURES_DIR)
    .filter((n) => n.endsWith('.html'))
    .sort((a, b) => a.localeCompare(b));

  const captured: Record<string, NormalizedDecision[]> = {};

  for (const fixture of fixtures) {
    document.body.innerHTML = readFileSync(resolve(FIXTURES_DIR, fixture), 'utf8');
    const viewKind = VIEW_KIND_BY_FIXTURE[fixture] ?? ViewKind.UNKNOWN;
    const lang = langFor(fixture);

    captured[fixture] = queryPostCards().map((post, index) =>
      normalize(scoreFlagsForPost(post, `${fixture}#${index}`, viewKind, lang)),
    );
  }

  return captured;
}

describe('flag scoring characterization', () => {
  beforeEach(() => {
    clearKeywordCache();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('every fixture is covered by the ViewKind map', () => {
    const fixtures = readdirSync(FIXTURES_DIR).filter((n) => n.endsWith('.html'));
    for (const fixture of fixtures) {
      expect(VIEW_KIND_BY_FIXTURE[fixture], `missing ViewKind for ${fixture}`).toBeDefined();
    }
  });

  it('produces output identical to the committed baseline', () => {
    const captured = captureAll();

    if (process.env.UPDATE_CHARACTERIZATION === '1') {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(captured, null, 2)}\n`, 'utf8');
    }

    expect(existsSync(BASELINE_PATH), 'baseline not captured yet').toBe(true);
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    expect(captured).toEqual(baseline);
  });

  it('finds posts in every post-bearing fixture and none in the rest', () => {
    const captured = captureAll();

    for (const [fixture, decisions] of Object.entries(captured)) {
      if (POSTLESS_FIXTURES.has(fixture)) {
        expect(
          decisions.length,
          `${fixture} is an attachment fixture and must yield no post cards`,
        ).toBe(0);
      } else {
        expect(decisions.length, `${fixture} yielded no post cards`).toBeGreaterThan(0);
      }
    }
  });

  it('covers every fixture on disk, in one bucket or the other', () => {
    const fixtures = readdirSync(FIXTURES_DIR).filter((n) => n.endsWith('.html'));
    const captured = captureAll();

    expect(Object.keys(captured).sort()).toEqual(fixtures.sort());
    for (const fixture of POSTLESS_FIXTURES) {
      expect(fixtures, `${fixture} is listed as post-less but not on disk`).toContain(fixture);
    }
  });
});
