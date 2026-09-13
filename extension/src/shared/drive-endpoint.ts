// filepath: extension/src/shared/drive-endpoint.ts
/**
 * The single source of the Drive byte-serving download URL.
 *
 * drive.usercontent.google.com/download?...&confirm=t is the destination
 * Drive's own interstitial "Download anyway" link points at — fetching it
 * directly serves the file bytes with the ambient session: no interstitial
 * hop, no error-page hop, no bypass tab (the visible "403 Access Forbidden"
 * window regression). Both the content-script URL layer and the background
 * normalizer must emit exactly this shape; they import this module so the
 * two can never drift.
 */

export const DRIVE_DOWNLOAD_ENDPOINT = 'https://drive.usercontent.google.com/download';

export function buildDriveDownloadUrl(id: string): string {
  return `${DRIVE_DOWNLOAD_ENDPOINT}?id=${encodeURIComponent(id)}&export=download&confirm=t`;
}
