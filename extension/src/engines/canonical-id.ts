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
