// filepath: extension/src/engines/canonical-id.ts

/**
 * Canonical Drive file id — the form engine-v2's extractFileNode gives a DOM
 * Drive anchor (`drive-<id>`). Idempotent: an id already in that form is
 * returned unchanged. Shared by the v2 engine (dedupe compares) and the v3
 * file reconciler; lives here so v2 never imports from v3.
 */
export function toCanonicalDriveId(id: string): string {
  return id.startsWith('drive-') ? id : `drive-${id}`;
}

/**
 * Every Drive-id key a file answers to: its canonical id (normalized) plus,
 * when its download URL has a shape toDownloadUrlFrom trusts as a Drive file
 * (see googleDriveIdFromUrl), `drive-<id>`. A generic `?id=` on another Google
 * page (sites, forms, search) is NOT a Drive id and yields no key.
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

/** Docs viewer path (document|presentation|drawings|spreadsheets)/d/<id>. */
const DOCS_ID_RE = /^\/(?:document|presentation|drawings|spreadsheets)\/d\/([^/]+)/;
const FILE_ID_RE = /^\/file\/d\/([^/]+)/;

/**
 * The Drive id of a URL, only for the shapes core/acquire/download-url.ts
 * (toDownloadUrlFrom) converts as Drive files:
 *   drive.google.com            /file/d/<id>, /open?id=, /uc?id=
 *   drive.usercontent.google.com /download?id=   (its own output endpoint)
 *   docs.google.com             /<kind>/d/<id>
 *   classroom.google.com        /drive?id|resourceId|fileId=
 * Any other URL (even on google.com) returns null.
 */
function googleDriveIdFromUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const path = parsed.pathname.replace(/^\/u\/\d+(?=\/)/, '');
  const query = (key: string): string | null => parsed.searchParams.get(key) || null;
  switch (parsed.hostname) {
    case 'drive.google.com':
      return FILE_ID_RE.exec(path)?.[1] ?? (path === '/open' || path === '/uc' ? query('id') : null);
    case 'drive.usercontent.google.com':
      return path === '/download' ? query('id') : null;
    case 'docs.google.com':
      return DOCS_ID_RE.exec(path)?.[1] ?? null;
    case 'classroom.google.com':
      return path.startsWith('/drive') ? query('id') ?? query('resourceId') ?? query('fileId') : null;
    default:
      return null;
  }
}
