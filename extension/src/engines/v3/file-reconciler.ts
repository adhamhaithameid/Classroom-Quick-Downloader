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
 * Synthetic FileNodes carry idSource 'api-snapshot' and the POST's element as
 * their anchor: they have no DOM of their own. The engine filters them out of
 * the placement pass (no floating single-file button); they join post.files,
 * so the download-all count includes them.
 */

import type { ClassroomApiSnapshot } from './api/types';
import type { FileNode, PostNode } from '../types';

/** A snapshot older than this is stale — mirrors api-detector.ts:93. */
export const MAX_RECONCILE_SNAPSHOT_AGE_MS = 120_000;

/** Lowercase extension from a Drive title ('' when the title has none) —
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

  const tracked = new Set(post.files.map((file) => file.canonicalId));
  const fresh: FileNode[] = [];

  for (const attachment of submission.attachments) {
    // Scope: only driveFile rows reconcile — 'link'/'form' attachments are
    // not Drive downloads, so they cannot ride the download-all flow.
    if (attachment.source !== 'driveFile') continue;
    // Idempotent union: skip anything already tracked, under either the raw
    // Drive id or the DOM canonical form (drive-<id>).
    if (tracked.has(attachment.id) || tracked.has(`drive-${attachment.id}`)) continue;
    tracked.add(attachment.id);

    fresh.push({
      canonicalId: attachment.id,
      name: attachment.title,
      ext: extensionFromTitle(attachment.title),
      downloadUrl: attachment.downloadUrl,
      element: post.element,
      idSource: 'api-snapshot',
    });
  }

  return fresh;
}
