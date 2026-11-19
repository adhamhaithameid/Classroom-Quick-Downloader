// filepath: extension/src/engines/v3/file-reconciler.ts
/**
 * ============================================================================
 * FILE RECONCILER — v3-base API-truth file union (2026-11-18 design)
 * ============================================================================
 *
 * Pure merge half of the v3-base design (docs/audit/2026-11-18-v3-base-design.md,
 * "Target design" §1): turn a ClassroomApiSnapshot's mapped submission
 * attachments into synthetic FileNodes the V2 engine can merge into a tracked
 * post. NO DOM writes, NO engine coupling — the engine wiring lives in
 * engine-v3.ts (applyApiFileReconciliation → v2.applyExternalFiles).
 *
 * Ruled decision (design doc): UNION, not replace. The API can ADD files to
 * a post's list; it never removes DOM files — a false-empty or mapping miss
 * cannot hide a downloadable file. Concretely:
 *
 *   - snapshot null            → [] (401/403/offline/quota leave the engine's
 *                                latestApiSnapshot null — the refresh catch in
 *                                engine-v3.ts), so every matrix failure row
 *                                degrades to "DOM verbatim".
 *   - stale snapshot           → [] — the SAME 120s bound the ApiDetector
 *                                applies (api-detector.ts MAX_SNAPSHOT_AGE_MS).
 *   - studentSubmissionId null → [] — list views have no post-to-student
 *                                mapping yet (mapping rule; phase 2).
 *   - mapped submission absent → [] — an id that answers nothing reconciles
 *                                nothing.
 *   - 'link'/'form' rows       → skipped — they are not Drive downloads; the
 *                                post's download-all flow is Drive-only.
 *   - id already tracked       → skipped — idempotent union; the API adds,
 *                                never removes. The key is the DRIVE FILE ID:
 *                                a DOM-discovered Drive anchor canonicalizes
 *                                as `drive-<id>` (engine-v2 extractFileNode),
 *                                so both the raw id and its `drive-<id>`
 *                                canonical form count as "already appears in
 *                                post.files".
 *
 * Staleness gates only NEW adds. Retention of files already merged is the
 * engine's job (engine-v2 ingestPost carries 'api-snapshot' files across a
 * re-scan), so a snapshot aging out never makes merged files vanish.
 *
 * Synthetic FileNodes carry idSource 'api-snapshot' and the POST's element as
 * their anchor: they have no DOM of their own. The engine filters them out of
 * the placement pass (no floating single-file button); they join post.files,
 * so the download-all count includes them.
 */

import type { ClassroomApiSnapshot } from './api/types';
import type { FileNode, PostNode } from '../types';
import { driveFileKeys, toCanonicalDriveId } from '../canonical-id';
import { sanitizeFileName } from '../../core/name/sanitize';
import { toDownloadUrlFrom } from '../../core/acquire/download-url';
import { validateDownloadUrl } from '../../v2/decision/download-validator';

/** A snapshot older than this is stale — mirrors api-detector.ts:93. */
export const MAX_RECONCILE_SNAPSHOT_AGE_MS = 120_000;

export { toCanonicalDriveId };

/** Lowercase extension from a Drive title or URL ('' when none) —
 *  same shape as engine-v2's ext scan (name-anchored, query-tolerant). */
function extensionFromTitle(title: string): string {
  const match = /\.([a-zA-Z0-9]{1,10})(?:\?|$)/.exec(title);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Reconcile the snapshot's mapped submission attachments against a post's
 * tracked files.
 *
 * @param snapshot The latest discovery snapshot, or null when the API had
 *   nothing usable (denied token, rejected fetch, quota, offline).
 * @param post The tracked post the snapshot's single submission maps to.
 * @param now Current time (ms) — injected so the staleness math stays pure.
 * @returns ONLY the new synthetic FileNodes, possibly [] — the caller merges;
 *   this function never mutates the post.
 */
export function reconcileApiFiles(
  snapshot: ClassroomApiSnapshot | null,
  post: PostNode,
  now: number,
): FileNode[] {
  if (!snapshot) return [];
  if (now - snapshot.fetchedAt > MAX_RECONCILE_SNAPSHOT_AGE_MS) return [];
  // List view: no post-to-student mapping yet — DOM stays the source (phase 2).
  if (snapshot.context.studentSubmissionId === null) return [];

  const submission = snapshot.submissions.find(
    (candidate) => candidate.id === snapshot.context.studentSubmissionId,
  );
  if (!submission) return [];

  // Keys include the Drive id named by each file's download URL, so a DOM
  // file canonicalized as url-…/dataid- still matches the same Drive file.
  const tracked = new Set(post.files.flatMap((file) => driveFileKeys(file)));
  // Multi-account index: passed through like the DOM path (getPageAuthUser →
  // resolveDownloadUrl), so a URL-safe non-numeric value (an account email)
  // keeps its account. A malformed one (trips the validator's '..'/'%25' rule)
  // is retried below without authuser instead of dropping the file.
  const authUser = snapshot.context.authUser;
  const fresh: FileNode[] = [];

  for (const attachment of submission.attachments) {
    // Scope: only driveFile rows reconcile — 'link'/'form' attachments are
    // not Drive downloads, so they cannot ride the download-all flow.
    if (attachment.source !== 'driveFile') continue;
    // Security gate: the API URL reaches download:requested like a DOM URL,
    // so it must pass the same validator (https + Google hosts); drop failures.
    if (!validateDownloadUrl(attachment.downloadUrl).valid) continue;
    // Idempotent union: compare on the canonical form (drive-<id>) only. The
    // API side ALWAYS prefixes (an API id that already starts with 'drive-'
    // is a different file than the DOM's drive-<id>); only the DOM-side ids
    // above go through the idempotent toCanonicalDriveId.
    const canonicalId = `drive-${attachment.id}`;
    if (tracked.has(canonicalId)) continue;
    // Same conversion the DOM path applies (engine-v2 extractFileNode →
    // resolveDownloadUrl), so native Docs/Sheets/Slides ids take the same
    // byte-serving endpoint as their DOM anchors. The API gives no mimeType.
    let downloadUrl = toDownloadUrlFrom(attachment.downloadUrl, authUser);
    if (!validateDownloadUrl(downloadUrl).valid && authUser) {
      downloadUrl = toDownloadUrlFrom(attachment.downloadUrl, null);
    }
    if (!validateDownloadUrl(downloadUrl).valid) continue;
    tracked.add(canonicalId);

    fresh.push({
      canonicalId,
      // '...' or '/' sanitize to '' — fall back to Untitled. (The DOM path
      // yields '' there; aligning it would change flag-OFF output, and the
      // Untitled fallback is pinned by union-3 #1.)
      name: sanitizeFileName(attachment.title) || 'Untitled',
      // DOM scan reads the name, or the href when the name is empty.
      ext: extensionFromTitle(attachment.title || attachment.downloadUrl),
      downloadUrl,
      element: post.element,
      idSource: 'api-snapshot',
    });
  }

  return fresh;
}
