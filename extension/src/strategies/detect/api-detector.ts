// filepath: extension/src/strategies/detect/api-detector.ts
/**
 * ============================================================================
 * API DETECTOR — the S13 Classroom-API assist, as a Detector decorator
 * ============================================================================
 *
 * R7 (master plan): this is ASSIST, never a replacement. ApiDetector WRAPS a
 * base DOM detector and returns that detector's observation — enriched only
 * when the API genuinely has something to say, and verbatim otherwise. A
 * denied token, a missing snapshot, a stale snapshot, or a route mismatch all
 * degrade to the exact base observation (same object), which is what "silent
 * DOM fallback" means here: the API layer can never make detection WORSE.
 *
 * ---------------------------------------------------------------------------
 * THE REFRESH CONTRACT (why refresh() exists)
 * ---------------------------------------------------------------------------
 * Detector.observe is SYNCHRONOUS by contract (contracts/detection.ts), but
 * token + snapshot acquisition is async. So the strategy pre-resolves BOTH
 * before any observe() call: the ORCHESTRATOR calls `await refresh()` on view
 * change (the same lifecycle points where it already calls reset()); observe()
 * then reads only the internal cache and falls back whenever the cache is
 * empty or stale. observe() never awaits, never fetches, never acquires a
 * token — consent and fetch cadence are entirely the orchestrator's business.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE API CAN HONESTLY CORROBORATE
 * ---------------------------------------------------------------------------
 * The snapshot is the studentSubmissions data for the current courseWork
 * route. It carries NO comment facts and NO edited facts, so this detector
 * NEVER writes comment.present/count or any edited field from API data.
 *
 * The one enrichment the PostObservation type honestly allows is the D12
 * corroboration floor (keyword-detector.ts): when the DOM channel already
 * found a REAL comment numeral (present, count > 0) but its score died below
 * the decide threshold (strength > 0, sub-threshold), the API's independent
 * proof that this exact courseWork is live and reachable — submissions came
 * back for this courseWorkId — floors the strength at comment_show. Additive
 * only: strength 0 (excluded or no finding) never gets floored; higher
 * strengths never get lowered; counts never change.
 *
 * Every firing is traced: a final 'api-corroboration' LayerTrace lands in
 * observation.debug with the API source note, so DevTools rebuilds can show
 * exactly what the API added. The observation keeps the BASE detector's name
 * — the finding remains the DOM's; the API only corroborated it.
 *
 * ---------------------------------------------------------------------------
 * FITNESS (tests/architecture/engine-layers.test.ts)
 * ---------------------------------------------------------------------------
 * strategies/** may not import the v3 stack, so the snapshot shape is defined
 * here structurally — it mirrors engines/v3/api/types.ts's ClassroomApiSnapshot
 * (same field names), making that type directly assignable at the composition
 * root: the v3 engine or bootstrap (OUTSIDE the new layers) constructs this
 * detector, wiring its discovery service and the BrowserPort identity token
 * seam into `deps`. This module imports only contracts, engines/types and
 * decide/thresholds.
 */
import type { ViewKind } from '../../engines/types';
import type { Detector, DetectorName, DetectContext, PostObservation } from '../../contracts/detection';
import type { LayerTrace } from '../../engines/types';
import { THRESHOLDS } from '../../decide/thresholds';

/** Route identity of a snapshot — structurally the v3 ClassroomApiRouteContext. */
export interface ApiSnapshotRoute {
  viewKind: ViewKind;
  courseId: string;
  courseWorkId: string;
  studentSubmissionId: string | null;
}

/** One student submission — structurally a subset of the v3 shape. */
export interface ApiSnapshotSubmission {
  id: string;
  userId?: string;
  state?: string;
  attachments: Array<{ id: string; title: string; downloadUrl: string }>;
}

/** What getSnapshot() hands over. engines/v3/api ClassroomApiSnapshot satisfies this as-is. */
export interface ApiSnapshot {
  fetchedAt: number;
  context: ApiSnapshotRoute;
  submissions: ApiSnapshotSubmission[];
}

export interface ApiDetectorDeps {
  /** Resolves the OAuth token, or null when denied/unavailable. Never rejects. */
  getToken: () => Promise<string | null>;
  /** Resolves the API snapshot for the CURRENT route, or null when none. Never rejects. */
  getSnapshot: () => Promise<ApiSnapshot | null>;
}

/** A snapshot older than this is stale — mirrors the runtime bridge's own bound. */
const MAX_SNAPSHOT_AGE_MS = 120_000;

export class ApiDetector implements Detector {
  readonly name: DetectorName = 'api';

  private cachedToken: string | null = null;
  private cachedSnapshot: ApiSnapshot | null = null;

  constructor(
    private readonly base: Detector,
    private readonly deps: ApiDetectorDeps,
  ) {}

  /**
   * Pre-resolve token + snapshot into the internal cache.
   *
   * Orchestrator contract: call on every view change BEFORE observes begin.
   * Idempotent per call (one deps round-trip each). Never rejects — a throwing
   * dep is indistinguishable from a denial, which is exactly the fallback the
   * next observe() will take.
   */
  async refresh(): Promise<void> {
    let token: string | null = null;
    let snapshot: ApiSnapshot | null = null;
    try {
      token = await this.deps.getToken();
    } catch {
      token = null;
    }
    try {
      snapshot = await this.deps.getSnapshot();
    } catch {
      snapshot = null;
    }
    this.cachedToken = token;
    this.cachedSnapshot = snapshot;
  }

  /**
   * Drop the cached token + snapshot (navigation teardown). Does not forward
   * to the base detector — orchestration calls the base's own reset()
   * directly if it has one; this method only owns what this class caches.
   */
  reset(): void {
    this.cachedToken = null;
    this.cachedSnapshot = null;
  }

  observe(post: HTMLElement, ctx: DetectContext): PostObservation {
    const base = this.base.observe(post, ctx);
    const snapshot = this.usableSnapshotFor(ctx);
    if (!snapshot) return base;

    // Additive-only corroboration floor (D12 shape): a real DOM numeral whose
    // score died sub-threshold gets floored at comment_show — nothing else on
    // comment/edited is ever written from API data.
    let floored = false;
    const comment = { ...base.comment };
    if (
      comment.present &&
      comment.count !== null &&
      comment.count > 0 &&
      comment.strength > 0 &&
      comment.strength < THRESHOLDS.comment_show
    ) {
      comment.strength = THRESHOLDS.comment_show;
      floored = true;
    }

    const debug: LayerTrace[] = [...(base.debug ?? [])];
    debug.push(this.corroborationTrace(snapshot, debug.length, floored));

    return { ...base, comment, debug };
  }

  /** The cached snapshot, but ONLY when token + freshness + route all hold. */
  private usableSnapshotFor(ctx: DetectContext): ApiSnapshot | null {
    if (!this.cachedToken) return null;
    const snapshot = this.cachedSnapshot;
    if (!snapshot) return null;
    // Route-changed guard: the orchestrator refreshes on view change, but
    // between refreshes a mismatch means the cache is for the OLD route.
    if (snapshot.context.viewKind !== ctx.viewKind) return null;
    // Time-stale guard, independent of orchestrator discipline.
    if (Date.now() - snapshot.fetchedAt > MAX_SNAPSHOT_AGE_MS) return null;
    return snapshot;
  }

  private corroborationTrace(
    snapshot: ApiSnapshot,
    layerIndex: number,
    floored: boolean,
  ): LayerTrace {
    const { courseId, courseWorkId, studentSubmissionId } = snapshot.context;
    const total = snapshot.submissions.length;
    const turnedIn = snapshot.submissions.filter((s) => s.state === 'TURNED_IN').length;

    return {
      layerName: 'api-corroboration',
      layerIndex,
      score: floored ? THRESHOLDS.comment_show : 0,
      matched: true,
      // API data is not page text; the debug rule stands either way.
      matchedText: null,
      selectorUsed: 'classroom.googleapis.com/v1/studentSubmissions',
      details:
        `api-corroboration: courseWork ${courseId}/${courseWorkId}` +
        `${studentSubmissionId ? `/${studentSubmissionId}` : ''} — ` +
        `${total} submission(s), ${turnedIn} turned in; ` +
        (floored
          ? `DOM comment finding corroborated, strength floored to ${THRESHOLDS.comment_show}`
          : 'no DOM comment finding to corroborate') +
        ` (fetchedAt ${snapshot.fetchedAt})`,
    };
  }
}
