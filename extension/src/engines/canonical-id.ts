// filepath: extension/src/engines/canonical-id.ts
import { extractDriveFileId } from '../core/acquire/download-url';

/**
 * Canonical Drive file id — the form engine-v2's extractFileNode gives a DOM
 * Drive anchor (`drive-<id>`). Idempotent: an id already in that form is
 * returned unchanged. Shared by the v2 engine (dedupe compares) and the v3
 * file reconciler; lives here so v2 never imports from v3.
 */
export function toCanonicalDriveId(id: string): string {
  return id.startsWith('drive-') ? id : `drive-${id}`;
}

/** Hosts whose `id=` / path Drive id is trustworthy for cross-path dedupe. */
const DRIVE_ID_HOST_RE = /(^|\.)google\.com$/;

/**
 * Every Drive-id key a file answers to: its canonical id (normalized) plus,
 * when its download URL is a Google URL carrying a Drive id, `drive-<id>`.
 * A DOM anchor without /d/<id> or data-drive-id (e.g. `open?id=` links)
 * canonicalizes as `url-…`/`dataid-…`, yet its resolved download URL still
 * names the Drive file — this lets the API union recognize it as the same
 * file. Read-only: never changes a file's canonicalId (flag-OFF output).
 */
export function driveFileKeys(file: { canonicalId: string; downloadUrl: string }): string[] {
  const keys = [toCanonicalDriveId(file.canonicalId)];
  const id = googleDriveIdFromUrl(file.downloadUrl);
  if (id) keys.push(`drive-${id}`);
  return keys;
}

function googleDriveIdFromUrl(rawUrl: string): string | null {
  try {
    if (!DRIVE_ID_HOST_RE.test(new URL(rawUrl).hostname)) return null;
  } catch {
    return null;
  }
  return extractDriveFileId(rawUrl);
}
