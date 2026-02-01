// filepath: extension/entrypoints/background/auth-utils.ts
/**
 * Authentication utilities for Google Drive URL handling.
 * Handles authuser extraction and URL manipulation for multi-account support.
 */

import { AUTHUSER_CANDIDATES } from './state';

/**
 * Extract authuser parameter from a Google URL.
 * Checks query params and path patterns.
 */
export function extractAuthUserFromUrl(rawUrl: string): number | undefined {
  try {
    const url = new URL(rawUrl);
    const qp = url.searchParams.get('authuser') ?? url.searchParams.get('u');
    const pathMatch = url.pathname.match(/\/u\/(\d+)\//);
    const raw = qp ?? (pathMatch ? pathMatch[1] : undefined);
    if (raw == null) return undefined;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed) || !AUTHUSER_CANDIDATES.includes(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Extract Google Drive file ID from various URL formats.
 */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const idParam = parsed.searchParams.get('id');
    if (idParam) return idParam;
    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) return fileMatch[1];
    const dMatch = parsed.pathname.match(/\/d\/([^/]+)/);
    if (dMatch) return dMatch[1];
    return null;
  } catch {
    return null;
  }
}
