// filepath: extension/src/engines/types.ts
/**
 * ============================================================================
 * ENGINE TYPES — The Foundation of the Multi-Engine Architecture
 * ============================================================================
 *
 * This is probably the file I'm most proud of in this whole project.
 *
 * After 5 months of building CQD, I realized the biggest problem wasn't
 * the detection itself — it was that everything was tangled together like
 * a plate of spaghetti. The comment detector, edited detector, download
 * buttons, and Download All were all independent scripts with their own
 * MutationObservers, their own lifecycle, their own everything.
 *
 * So I designed this engine interface. The idea is simple:
 * - Engine V1 = the current legacy code (wrapped as-is, no changes)
 * - Engine V2 = the new unified DOM-only engine
 * - Engine V3 = V2 + Google Classroom API integration
 *
 * Each engine implements the same interface, so the orchestrator can
 * swap between them with a single flag flip. This is what makes the
 * shadow mode possible — V2 runs alongside V1, they both produce
 * decisions, and we compare them to make sure V2 doesn't regress.
 *
 * I spent weeks thinking about this interface. Every method has a reason:
 * - init() / destroy() — clean lifecycle, no zombie observers
 * - handleMutations() — single observer feeds all engines
 * - getDecisionTrace() — debugging! When something goes wrong, we can
 *   see exactly WHY the engine made each decision
 *
 * The ViewKind enum is crucial too. Google Classroom has 8 different page
 * types, and each one has a different DOM structure. The old code just
 * used regex patterns and hoped for the best. Now we have a proper
 * classification system.
 *
 * @author Adham — built with love over 5 months of late nights
 * @since v4.0.0
 */

// ============================================================================
// VIEW CLASSIFICATION
// ============================================================================

/**
 * Every page in Google Classroom falls into one of these categories.
 *
 * Each ViewKind has different DOM structure, different selectors that work,
 * and different features that apply. For example:
 * - STREAM has announcements with comments
 * - CLASSWORK_LIST has collapsible items with Download All
 * - STUDENT_SUBMISSIONS is a page we've NEVER supported before (V2 will fix that!)
 *
 * I mapped every single URL pattern in tab-detector.ts to these ViewKinds.
 * See: route-classifier.ts for the mapping logic.
 */
export enum ViewKind {
  /** /c/{classId} — The main stream with announcements and posts */
  STREAM = 'stream',

  /** /w/{classId}/t/all — All assignments and materials in a list */
  CLASSWORK_LIST = 'classwork_list',

  /** /w/{classId}/tc/{topicId} — Assignments filtered by topic (always expanded!) */
  CLASSWORK_TOPIC = 'classwork_topic',

  /** /c/{classId}/a/{itemId}/details — Single assignment detail page */
  ASSIGNMENT_DETAILS = 'assignment_details',

  /** /c/{classId}/m/{itemId}/details — Single material detail page */
  MATERIAL_DETAILS = 'material_details',

  /** /c/{classId}/a/{itemId}/submissions/{studentId} — Individual student's work */
  STUDENT_SUBMISSIONS = 'student_submissions',

  /** /c/{classId}/a/{itemId}/submissions — Teacher view of ALL student work */
  STUDENT_WORK_TEACHER = 'student_work_teacher',

  /** /c/{classId}/p/{postId} — Single announcement/post detail */
  ANNOUNCEMENT_DETAIL = 'announcement_detail',

  /** Anything that doesn't match — People tab, Grades, settings, etc. */
  UNKNOWN = 'unknown',
}

// ============================================================================
// ENGINE MODES — How the engines coexist
// ============================================================================

/**
 * The mode system is our safety net during the migration.
 *
 * Here's the progression I planned:
 * 1. LEGACY — Ships first. Nothing changes for users.
 * 2. SHADOW — V2 runs silently alongside V1, logs its decisions, never renders
 *    anything. We compare V1 vs V2 decisions to find bugs.
 * 3. V2 — V2 takes over rendering. V1 is disabled but code stays for rollback.
 * 4. V3 — V2 + API integration. Only difference is API-based discovery.
 *
 * The beautiful thing is: rolling back is just one flag flip.
 * `cqdV2.mode = 'legacy'` and we're back to the old system instantly.
 */
export type EngineMode = 'legacy' | 'shadow' | 'v2' | 'v3';

// ============================================================================
// CORE DATA MODELS
// ============================================================================

/**
 * A post in Google Classroom — announcements, assignments, materials.
 *
 * This is the canonical representation of a post. The old code had no
 * concept of "a post" as an entity — it just scanned the DOM for anchors
 * and injected buttons wherever it found them. That's why we got duplicates
 * and missed files.
 *
 * Now every post gets a PostNode with a unique ID, and every file within
 * it gets a FileNode. Deduplication becomes trivial: same fileId = same file.
 */
export interface PostNode {
  /** Unique identifier — usually from data-stream-item-id */
  id: string;
  /** The actual DOM element this post corresponds to */
  element: HTMLElement;
  /** What page type this post is on */
  viewKind: ViewKind;
  /** All files discovered within this post */
  files: FileNode[];
  /** Flag detection results */
  flags: FlagDecision | null;
  /** When this post was last scanned */
  lastScannedAt: number;
}

/**
 * A downloadable file attachment within a post.
 *
 * The canonical file ID is the key to deduplication. I spent 3 days
 * debugging duplicate download buttons before realizing that the same
 * file can appear with different URLs depending on the authuser param.
 * The canonical ID strips all that away — it's just the Drive file ID.
 *
 * Priority for deriving the ID (from selector-catalog.md):
 * 1. data-drive-id attribute (most reliable)
 * 2. Drive file ID from URL (/file/d/{id}/)
 * 3. data-id + data-item-id combination
 * 4. URL hash (fallback for non-Drive files)
 */
export interface FileNode {
  /** Canonical file ID — used for deduplication */
  canonicalId: string;
  /** Display name of the file */
  name: string;
  /** File extension */
  ext: string;
  /** Direct download URL */
  downloadUrl: string;
  /** The DOM element containing this file */
  element: HTMLElement;
  /** How the file ID was derived */
  idSource: 'data-drive-id' | 'url-parse' | 'data-id-combo' | 'url-hash';
}

// ============================================================================
// FLAG DECISIONS
// ============================================================================

/**
 * The result of flag detection for a post.
 *
 * This replaces the scattered CommentDetectionResult + EditedDetectionResult
 * from the old system. Instead of two separate systems running independently
 * and sometimes racing each other, we now have ONE unified decision.
 *
 * The confidence scores are 0-100. The thresholds are:
 * - 40+ to show a comment badge
 * - 35+ to show an edited badge
 * - 30+ each to show a "both" badge
 *
 * These thresholds are in rule-registry.ts and can be tuned without
 * changing any detection logic. That was a hard lesson — the old system
 * had magic numbers sprinkled everywhere.
 */
export interface FlagDecision {
  postId: string;
  commentScore: number;
  editedScore: number;
  commentCount: number | null;
  editedDiff: string | null;
  exclusionPenalties: Array<{ ruleId: string; penalty: number }>;
  finalVerdict: 'comment' | 'edited' | 'both' | 'none';
  confidence: 'high' | 'medium' | 'low';
  trace: DecisionTrace;
}

/**
 * Full audit trail for a single flag decision.
 *
 * THIS is what I wished I had when debugging false positives at 2am.
 * Every layer records what it found, what it excluded, and why.
 * When a user reports "the comment badge is wrong on this post,"
 * I can just look at the trace and see exactly what happened.
 */
export interface DecisionTrace {
  postId: string;
  timestamp: number;
  viewKind: ViewKind;
  layers: LayerTrace[];
  exclusions: ExclusionTrace[];
  finalScore: number;
  duration_ms: number;
}

export interface LayerTrace {
  layerName: string;
  layerIndex: number;
  score: number;
  matched: boolean;
  matchedText: string | null;
  selectorUsed: string | null;
  details: string;
}

export interface ExclusionTrace {
  ruleId: string;
  penalty: number;
  reason: string;
  matchedText: string;
}

// ============================================================================
// PLACEMENT DECISIONS
// ============================================================================

/**
 * Where to put a download button for a specific file.
 *
 * The old system just found the closest parent element and appendChild'd
 * the button. That's why buttons sometimes appeared in weird places or
 * overlapped with Google's own UI elements.
 *
 * The new system produces a _decision_ first, then renders it. This
 * separation means we can:
 * 1. Log the decision for debugging
 * 2. Compare V1 vs V2 placement decisions in shadow mode
 * 3. Validate that the decision still makes sense before rendering
 */
export interface PlacementDecision {
  fileId: string;
  targetElement: HTMLElement;
  insertionPoint: 'append' | 'prepend' | 'before' | 'after';
  anchorSelector: string;
  confidence: number;
  reasonCodes: string[];
  fallbackUsed: boolean;
}

// ============================================================================
// ENGINE INTERFACE
// ============================================================================

/**
 * The contract that every engine version must implement.
 *
 * This is the most important interface in the entire codebase.
 * It's what makes the shadow mode, rollback, and progressive migration
 * possible. Each engine is a black box — give it mutations, get back
 * decisions. The orchestrator doesn't care HOW it works internally.
 *
 * V1 wraps the legacy code. V2 is the new DOM-only engine. V3 adds API.
 * But they all look the same to the orchestrator.
 */
export interface CQDEngine {
  /** Human-readable name for logging */
  readonly name: string;

  /** Semantic version of this engine */
  readonly version: string;

  /**
   * Initialize the engine for a specific view.
   * Called once when the page loads or when navigating to a new page.
   * The AbortSignal is used to cancel any pending work on navigation.
   */
  init(viewKind: ViewKind, signal: AbortSignal): Promise<void>;

  /**
   * Clean up everything — observers, intervals, cached state.
   * Must be safe to call multiple times.
   */
  destroy(): void;

  /**
   * Process a batch of DOM mutations.
   * Called by the orchestrator's single shared MutationObserver.
   * Must be fast — target is <6ms p95.
   */
  handleMutations(mutations: MutationRecord[]): void;

  /**
   * Run a full scan of the current page.
   * Used for initial page load and after navigation.
   * Can be slower than handleMutations since it runs once.
   */
  fullScan(): void;

  /**
   * Get all posts currently tracked by this engine.
   */
  getTrackedPosts(): PostNode[];

  /**
   * Get the placement decisions for all tracked files.
   */
  getPlacementDecisions(): PlacementDecision[];

  /**
   * Get the flag decisions for all tracked posts.
   */
  getFlagDecisions(): FlagDecision[];

  /**
   * Get the decision trace for a specific post (for debugging).
   */
  getDecisionTrace(postId: string): DecisionTrace | null;
}

// ============================================================================
// ENGINE EVENTS
// ============================================================================

/**
 * Events emitted by an engine so the orchestrator can react.
 *
 * These replace the mess of chrome.runtime.sendMessage calls in the old
 * system. Each event has a clear type and payload, making it easy to
 * handle in the orchestrator.
 */
export type EngineEvent =
  | { type: 'posts-discovered'; posts: PostNode[] }
  | { type: 'files-discovered'; files: FileNode[] }
  | { type: 'placement-ready'; decisions: PlacementDecision[] }
  | { type: 'flags-resolved'; decisions: FlagDecision[] }
  | { type: 'repair-needed'; postId: string; reason: string }
  | { type: 'error'; message: string; context: string };

export type EngineEventHandler = (event: EngineEvent) => void;
