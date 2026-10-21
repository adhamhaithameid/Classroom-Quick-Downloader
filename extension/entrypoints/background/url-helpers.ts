// filepath: extension/entrypoints/background/url-helpers.ts
/**
 * URL manipulation utilities for download handling.
 */

import { buildDriveDownloadUrl } from '../../src/shared/drive-endpoint';

/**
 * Normalize a download URL and detect if it's a Drive URL.
 *
 * Every Drive URL resolves to the byte-serving endpoint
 * drive.usercontent.google.com/download?...&confirm=t — the destination
 * Drive's own interstitial "Download anyway" link points at. Downloading it
 * directly serves the file bytes with the ambient session: no interstitial
 * hop, no error-page hop, and therefore no reason for a bypass tab (the
 * visible "403 Access Forbidden" window regression).
 */
export function normalizeUrl(rawUrl: string): { baseUrl: string; isDrive: boolean } {
  try {
    const url = new URL(rawUrl);
    const isDrive = url.hostname.includes('drive');
    if (!isDrive) return { baseUrl: rawUrl, isDrive: false };

    if (url.hostname === 'drive.usercontent.google.com') {
      url.searchParams.set('export', 'download');
      url.searchParams.set('confirm', 't');
      return { baseUrl: url.toString(), isDrive: true };
    }

    const id =
      url.searchParams.get('id') ??
      url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ??
      url.pathname.match(/\/d\/([^/]+)/)?.[1];
    if (id) {
      return { baseUrl: buildDriveDownloadUrl(id), isDrive: true };
    }
    return { baseUrl: rawUrl, isDrive: true };
  } catch {
    return { baseUrl: rawUrl, isDrive: false };
  }
}

/**
 * Build URL with specific authuser parameter.
 */
export function buildUrlWithAuthUser(baseUrl: string, authuser: number): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('authuser', String(authuser));
    return url.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Extract file extension from filename.
 */
export function getFilenameExt(filename?: string): string | undefined {
  if (!filename) return undefined;
  const m = filename.match(/\.([a-zA-Z0-9]{1,10})$/);
  return m ? m[1].toLowerCase() : undefined;
}

/**
 * Wire MIME type → file extension for the attachment types Classroom
 * actually serves. The suggested filename must never leave an
 * extension-less title on disk (survey #821): when the Classroom title
 * carries no extension, the download's own MIME names the type.
 */
const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/rtf': 'rtf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

export function extForMime(mime?: string): string | undefined {
  if (!mime) return undefined;
  return MIME_EXT[mime.trim().toLowerCase()];
}

/**
 * Compose the filename the download pipeline suggests. Order of trust for
 * the extension: an extension present in the name itself, then the
 * wire-known extension, then the response MIME type. The name keeps the
 * Classroom title when one exists and falls back to a fixed base.
 */
export function composeSuggestedFilename(opts: {
  name?: string;
  knownExt?: string;
  mime?: string;
}): string {
  const base = opts.name?.trim() ? opts.name.trim() : 'classroom_download';
  if (getFilenameExt(base)) return base;
  const ext = opts.knownExt?.toLowerCase() || extForMime(opts.mime);
  return ext ? `${base}.${ext}` : base;
}
