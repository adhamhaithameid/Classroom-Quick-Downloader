// filepath: extension/src/v2/model/dom-scanner.ts
/**
 * ============================================================================
 * DOM SCANNER — The Eyes of V2
 * ============================================================================
 *
 * The DOM scanner is responsible for finding everything on the page.
 * It uses the SelectorScorer (from selector-scorer.ts) to find elements
 * with the 5-level priority chain, then wraps them into our model
 * (PostModel, FileModel from entities.ts).
 *
 * This is a PURE SCANNER — it only reads the DOM, never writes to it.
 * No buttons injected, no badges created, no attributes set. Just
 * discovery and modeling. The separation is important because:
 *
 * 1. Scanners can run in shadow mode without side effects
 * 2. Scanning and rendering can be tested independently
 * 3. The reconciler can diff scan results against the model
 *
 * The scan pipeline:
 *   1. findPosts(scope) → HTMLElement[]     (find all post containers)
 *   2. extractFiles(post) → FileModel[]      (find files within each post)
 *   3. detectAccordion(post) → boolean        (is the post expanded?)
 *   4. Return: full scan result with metadata
 *
 * Each step uses a specific SelectorScorer instance loaded with
 * the right candidates (from selector-registry.ts). The scorer
 * handles all the priority logic, so the scanner just asks
 * "find me posts" and gets the best available result.
 *
 * @author Adham — keeping reads and writes separate was the hardest discipline
 * @since v4.0.0
 */

import type { ViewKind } from '../../engines/types';
import {
  createPostScorer,
  createFileAnchorScorer,
  createAccordionScorer,
} from '../selectors/selector-registry';
import type { SelectorScorer, ScorerResult } from '../selectors/selector-scorer';
import {
  type PostModel,
  type FileModel,
  type CourseContext,
  createPostModel,
  createFileModel,
  getCanonicalFileId,
  computeFingerprint,
} from './entities';

// ============================================================================
// SCAN RESULT — What a scan produces
// ============================================================================

/**
 * The output of a single full scan.
 *
 * Contains everything the reconciler needs to diff against the
 * current model and produce DOM operations.
 */
export interface ScanResult {
  /** When the scan was performed */
  timestamp: number;

  /** How long the scan took in ms */
  duration_ms: number;

  /** What view kind was active */
  viewKind: ViewKind;

  /** All discovered posts */
  posts: Map<string, ScannedPost>;

  /** Total files discovered */
  totalFiles: number;

  /** Scorer traces for debugging (one per scorer used) */
  scorerTraces: Map<string, ScorerResult>;
}

/**
 * A single post as discovered by the scanner.
 *
 * This is the "raw" scan output — it hasn't been diffed against
 * the model yet. The reconciler compares these with the existing
 * PostModels to determine what changed.
 */
export interface ScannedPost {
  /** Post ID from the DOM */
  id: string;

  /** The DOM element */
  element: HTMLElement;

  /** Structural fingerprint for change detection */
  fingerprint: string;

  /** Files found within this post */
  files: ScannedFile[];

  /** Whether the post is expanded (classwork accordion) */
  isExpanded: boolean;

  /** Whether the element is still in the DOM */
  isConnected: boolean;
}

export interface ScannedFile {
  /** Canonical file ID */
  canonicalId: string;

  /** The DOM element */
  element: HTMLElement;

  /** How the ID was derived */
  idSource: FileModel['idSource'];

  /** File name */
  name: string;

  /** File extension */
  ext: string;

  /** URL for downloading */
  downloadUrl: string;
}

// ============================================================================
// DOM SCANNER CLASS
// ============================================================================

/**
 * DOMScanner — discovers posts and files on the current page.
 *
 * Usage:
 *   const scanner = new DOMScanner();
 *   const result = scanner.fullScan(ViewKind.STREAM, document.body);
 *   console.log(`Found ${result.posts.size} posts, ${result.totalFiles} files`);
 *
 * The scanner creates fresh scorer instances on each scan so that
 * failure counts from previous scans don't affect the current one.
 * In practice, scorers are lightweight objects — creating them is cheap.
 */
export class DOMScanner {
  private postScorer: SelectorScorer;
  private fileScorer: SelectorScorer;
  private accordionScorer: SelectorScorer;

  constructor() {
    this.postScorer = createPostScorer();
    this.fileScorer = createFileAnchorScorer();
    this.accordionScorer = createAccordionScorer();
  }

  /**
   * Run a full page scan.
   *
   * Finds all posts, extracts their files, checks accordion state,
   * and returns the results with timing and debugging info.
   *
   * @param viewKind - Current page type (affects which selectors are used)
   * @param scope - DOM scope to scan (usually document.body)
   * @returns ScanResult with all discovered posts and files
   */
  fullScan(viewKind: ViewKind, scope: HTMLElement | Document = document): ScanResult {
    const startTime = performance.now();
    const scorerTraces = new Map<string, ScorerResult>();

    // 1. Find all post elements
    const postResult = this.postScorer.queryAll(scope);
    scorerTraces.set('posts', postResult);

    const posts = new Map<string, ScannedPost>();
    let totalFiles = 0;

    // 2. Process each post
    for (const postEl of postResult.allElements) {
      // Skip nested posts (a post inside another post)
      // This happens in topic view where material cards can be nested
      // inside assignment cards. We only want the top-level post.
      if (postEl.parentElement?.closest('[data-stream-item-id]')) {
        continue;
      }

      // Get the post ID
      const postId =
        postEl.getAttribute('data-stream-item-id') ||
        `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Skip duplicates (in case multiple selectors match the same element)
      if (posts.has(postId)) continue;

      // 2a. Extract files from this post
      const files = this.extractFiles(postEl);
      totalFiles += files.length;

      // 2b. Check accordion state (only relevant for classwork views)
      const isExpanded = this.checkAccordionState(postEl, viewKind);

      // 2c. Build the scanned post
      const scannedPost: ScannedPost = {
        id: postId,
        element: postEl,
        fingerprint: computeFingerprint(postEl),
        files,
        isExpanded,
        isConnected: postEl.isConnected,
      };

      posts.set(postId, scannedPost);
    }

    const duration_ms = performance.now() - startTime;

    return {
      timestamp: Date.now(),
      duration_ms,
      viewKind,
      posts,
      totalFiles,
      scorerTraces,
    };
  }

  /**
   * Scan a single post (for incremental updates after mutations).
   *
   * Instead of re-scanning the entire page, this scans just one post
   * when we know that specific post changed (from MutationObserver).
   *
   * @param postEl - The post element to scan
   * @param viewKind - Current page type
   * @returns ScannedPost or null if the element is invalid
   */
  scanSinglePost(postEl: HTMLElement, viewKind: ViewKind): ScannedPost | null {
    if (!postEl.isConnected) return null;

    const postId = postEl.getAttribute('data-stream-item-id');
    if (!postId) return null;

    const files = this.extractFiles(postEl);
    const isExpanded = this.checkAccordionState(postEl, viewKind);

    return {
      id: postId,
      element: postEl,
      fingerprint: computeFingerprint(postEl),
      files,
      isExpanded,
      isConnected: true,
    };
  }

  // ========================================================================
  // FILE EXTRACTION
  // ========================================================================

  /**
   * Find all downloadable files within a post element.
   *
   * Uses the file anchor scorer to find elements, then extracts
   * canonical IDs using getCanonicalFileId. Files with duplicate
   * canonical IDs are deduplicated — only the first one is kept.
   *
   * The deduplication is important because the same file can have
   * multiple DOM representations:
   * - An anchor tag to the file
   * - A data-drive-id container element
   * - A thumbnail/preview element
   *
   * All of these should produce ONE FileNode, not three.
   */
  private extractFiles(postEl: HTMLElement): ScannedFile[] {
    const fileResult = this.fileScorer.queryAll(postEl);
    const files: ScannedFile[] = [];
    const seenIds = new Set<string>();

    for (const el of fileResult.allElements) {
      // Skip CQD's own injected elements
      if (el.hasAttribute('data-cqd-injected')) continue;
      if (el.closest('[data-cqd-injected]')) continue;

      const canonicalId = getCanonicalFileId(el);
      if (!canonicalId) continue;

      // Dedup
      if (seenIds.has(canonicalId)) continue;
      seenIds.add(canonicalId);

      // Determine ID source
      let idSource: ScannedFile['idSource'] = 'url-hash';
      if (canonicalId.startsWith('drive:') && el.getAttribute('data-drive-id')) {
        idSource = 'data-drive-id';
      } else if (canonicalId.startsWith('drive:')) {
        idSource = 'url-parse';
      } else if (canonicalId.startsWith('meta:')) {
        idSource = 'data-id-combo';
      }

      // Extract name and extension
      const href = this.getHref(el) || '';
      const name =
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.querySelector('[aria-label]')?.getAttribute('aria-label') ||
        el.textContent?.trim()?.slice(0, 100) ||
        'Untitled';

      const extMatch = (name || href).match(/\.([a-zA-Z0-9]{1,10})(?:\?|$)/);
      const ext = extMatch ? extMatch[1].toLowerCase() : '';

      files.push({
        canonicalId,
        element: el,
        idSource,
        name,
        ext,
        downloadUrl: href,
      });
    }

    return files;
  }

  // ========================================================================
  // ACCORDION STATE
  // ========================================================================

  /**
   * Check if a post is expanded or collapsed (classwork accordion).
   *
   * In Stream and Topic views, posts are always expanded.
   * In Classwork List view, posts can be collapsed.
   *
   * We check:
   * 1. aria-expanded attribute (most reliable)
   * 2. Expanded/collapsed class names (L4 fallback)
   * 3. Default to expanded if we can't tell
   *
   * Why does this matter? Because in collapsed state, we should NOT
   * show download buttons or badges — they'd be invisible anyway
   * and would waste memory.
   */
  private checkAccordionState(postEl: HTMLElement, viewKind: ViewKind): boolean {
    // Stream and topic views are always expanded
    if (viewKind === 'stream' || viewKind === 'classwork_topic') {
      return true;
    }

    // Check aria-expanded
    const expandToggle = postEl.querySelector('[aria-expanded]');
    if (expandToggle) {
      return expandToggle.getAttribute('aria-expanded') === 'true';
    }

    // Check class names (L4 golden — may break)
    if (postEl.matches('.lXuxY, li.lXuxY')) return true;
    if (postEl.matches('.AZd1I, li.AZd1I')) return false;

    // Default: assume expanded
    return true;
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  /**
   * Get href from an element (anchor, container, or child of anchor).
   */
  private getHref(el: HTMLElement): string | null {
    if (el.tagName === 'A') return (el as HTMLAnchorElement).href || null;

    const anchor = el.querySelector<HTMLAnchorElement>('a[href]');
    if (anchor?.href) return anchor.href;

    const parentAnchor = el.closest<HTMLAnchorElement>('a[href]');
    return parentAnchor?.href || null;
  }

  /**
   * Get the scorer instances (for debugging/testing).
   */
  getScorers() {
    return {
      post: this.postScorer,
      file: this.fileScorer,
      accordion: this.accordionScorer,
    };
  }
}
