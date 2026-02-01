import { CHANGELOG_URL } from './analytics/constants';
import { getExtensionVersion } from './analytics/detection';

export interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  changes: string[];
  isImportant?: boolean;
}

export interface ChangelogConfig {
  customPill: boolean;
  pillColor?: string;
  showNotification: boolean;
  lastUpdated?: number;
  latestVersion?: string;
}

export interface ChangelogData {
  entries: ChangelogEntry[];
  config: ChangelogConfig;
  lastFetched: number;
}

const STORAGE_KEY = 'cqd_changelog_v1';
const CACHE_duration_MS = 0; // Always fetch on reload

/**
 * Fetch changelog from storage or network.
 * Returns null if network fails and no cache.
 */
export async function fetchChangelog(force = false): Promise<ChangelogData | null> {
  // 1. Check cache
  const cached = await chrome.storage.local.get(STORAGE_KEY);
  const data = cached[STORAGE_KEY] as ChangelogData | undefined;

  if (!force && data && (Date.now() - data.lastFetched < CACHE_duration_MS)) {
    return data;
  }

  // 2. Fetch network
  if (!CHANGELOG_URL) return data || null;

  try {
    const res = await fetch(CHANGELOG_URL);
    if (!res.ok) throw new Error('Network error');
    
    const json = await res.json();
    if (!json.ok) throw new Error('API error');

    const newData: ChangelogData = {
      entries: json.entries || [],
      config: json.config || { customPill: false, showNotification: false },
      lastFetched: Date.now(),
    };

    // 3. Update cache
    await chrome.storage.local.set({ [STORAGE_KEY]: newData });
    return newData;
  } catch (e) {
    console.warn('[CQD Changelog] Fetch failed:', e);
    return data || null;
  }
}

/**
 * Get the latest change description from the most recent entry.
 */
export function getLatestChange(data: ChangelogData | null): string | null {
  if (!data || !data.entries.length) return null;
  const latest = data.entries[0];
  if (latest && latest.changes.length) {
    return latest.changes[0];
  }
  return null;
}


const SEEN_KEY = 'cqd_changelog_seen_v1';

/**
 * Mark the current version as seen.
 */
export async function markAsSeen(version: string): Promise<void> {
  if (!version) return;
  await chrome.storage.local.set({ [SEEN_KEY]: version });
}

/**
 * Check if we should show a notification (e.g. unread update).
 * Logic: 
 * 1. Global config.showNotification must be true.
 * 2. AND current extension version must NOT match the last "seen" version.
 * 3. AND we must have fetched data.
 */
export async function shouldShowNotification(data: ChangelogData | null): Promise<boolean> {
  if (!data || !data.config || !data.config.showNotification) return false;
  
  const currentVer = getExtensionVersion();
  // If we have no data, or extension version is unknown, don't show
  if (!currentVer) return false;

  // Check what user has seen
  const stored = await chrome.storage.local.get(SEEN_KEY);
  const seenVer = stored[SEEN_KEY];

  // If user hasn't seen this version yet, show notification
  return seenVer !== currentVer;
}