// filepath: extension/src/contracts/topics.ts
/**
 * ============================================================================
 * TOPIC CONTRACTS — the vocabulary of the two buses
 * ============================================================================
 *
 * Spec: extension/docs/ENGINE_V4_SYSTEM_DESIGN.md §4.1.
 *
 * A topic map is the only thing two roles may share. Each payload is plain
 * data: the page bus carries DOM-coupled types because it never leaves the
 * page; anything that crosses the BridgePort (worker topics) must be
 * structured-cloneable, so it references `FileRef`, never `FileNode`.
 *
 * Topics marked "+" in the design doc (download/acquire/name) are additions
 * over PRD_ENGINE_REFACTOR.md §4.2; the rest is that PRD's page surface.
 */
import type {
  ViewKind,
  PostNode,
  FlagDecision,
  PlacementDecision,
} from '../engines/types';

// ============================================================================
// SHARED PLAIN-DATA TYPES (safe over the bridge)
// ============================================================================

/** Correlation id for one download/acquisition. Owned by BridgePort. */
export type RequestId = string;

/** Where a filename candidate came from (design §8, RawNameSources). */
export type NameSource =
  | 'aria'
  | 'tooltip'
  | 'title'
  | 'text-line'
  | 'url-path'
  | 'mime-hint'
  | 'drive-meta';

/** A downloadable file as plain data — the bridge-safe projection of FileNode. */
export interface FileRef {
  /** Canonical file id: data-drive-id → Drive URL id → data-id pair → hash. */
  fileId: string;
  /** The URL to acquire. */
  url: string;
  /** Known extension, if the scanner found one. */
  ext?: string;
  /** Best display name seen so far, if any. */
  name?: string;
}

/** Everything the name pipeline needs to derive a filename for a FileRef. */
export interface NameHint {
  preferredStem: string;
  ext: string;
  source: NameSource;
}

// ============================================================================
// ACQUISITION TYPES (design §7)
// ============================================================================

/** The strategies the AcquireEngine may drive, in fallback order. `api` is
 *  the reserved third tier (Drive files.get via OAuth) — flag-gated off until
 *  the #398 consent model ships; see docs/API_DOWNLOAD_TIER.md. */
export type AcquireStrategyName = 'direct' | 'drive-auth' | 'bypass-tab' | 'api';

/** Which acquisition state a download is in when progress is reported. */
export type AcquirePhase =
  | 'requested'
  | 'planned'
  | 'direct'
  | 'drive-auth'
  | 'bypass-tab'
  | 'settled';

/**
 * Every acquisition ends in exactly one outcome — there is no path that ends
 * in silence (design goal G6). `timeout` is forced by the ClockPort deadline;
 * `cancelled` is the user's own cancellation.
 */
export type AcquireOutcomeStatus =
  | 'saved'
  | 'blocked'
  | 'auth-exhausted'
  | 'browser-fail'
  | 'timeout'
  | 'cancelled'
  | 'failed';

export interface AcquireOutcome {
  status: AcquireOutcomeStatus;
  /** Human-readable detail for status surfaces and traces. */
  detail?: string;
  /** Browser download id, once the browser assigned one. */
  downloadId?: number;
}

// ============================================================================
// PAGE TOPICS
// ============================================================================

/** Throttle levels, mirroring v2/telemetry/budget-controller.ts. */
export type ThrottleLevel = 'normal' | 'elevated' | 'high' | 'critical';

/** A repair request published by Harden. Contract-local shape; the v2
 *  correction queue maps its richer items into this. */
export interface CorrectionItem {
  id: string;
  postId: string;
  reason: string;
}

export interface PageTopicMap {
  'route:changed': { view: ViewKind; url: string };
  'post:scanned': { posts: PostNode[] };
  'file:discovered': { postId: string; files: FileRef[] };
  'decision:flags': { decisions: FlagDecision[] };
  'decision:placement': { decisions: PlacementDecision[] };
  'render:applied': { postId: string; kind: 'button' | 'flag' | 'all' };
  'correction:needed': { item: CorrectionItem };
  'budget:throttle': { level: ThrottleLevel };
  'download:requested': { requestId: RequestId; file: FileRef; nameHint: NameHint };
  'download:progress': { requestId: RequestId; phase: AcquirePhase };
  'download:settled': { requestId: RequestId; outcome: AcquireOutcome };
}

// ============================================================================
// WORKER TOPICS
// ============================================================================

export interface WorkerTopicMap {
  'acquire:requested': { requestId: RequestId; file: FileRef; nameHint: NameHint };
  'acquire:attempt': {
    requestId: RequestId;
    strategy: AcquireStrategyName;
    authUser?: number;
  };
  'acquire:settled': { requestId: RequestId; outcome: AcquireOutcome };
  'name:resolved': { requestId: RequestId; filename: string; source: NameSource };
}
