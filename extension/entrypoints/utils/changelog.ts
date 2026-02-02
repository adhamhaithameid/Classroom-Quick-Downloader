import { CHANGELOG_URL } from './analytics/constants';
import { getExtensionVersion } from './analytics/detection';

export interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  changes: string[];
  isImportant?: boolean;
}

export interface NotificationRule {
  id: string;
  target: string;
  glow: boolean;
  showDot: boolean;
}

export interface ChangelogConfig {
  rules: NotificationRule[];
  lastUpdated?: number;
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
 * Get the matching rule for a given version.
 * Priority: Exact Match > "all" > null
 */
export function getMatchingRule(config: ChangelogConfig | undefined, currentVersion: string): NotificationRule | null {
  if (!config || !config.rules || !config.rules.length) return null;

  // 1. Exact Match
  const exact = config.rules.find(r => r.target === currentVersion);
  if (exact) return exact;

  // 2. Wildcard "all"
  const all = config.rules.find(r => r.target === 'all');
  if (all) return all;

  return null;
}

/**
 * Check if we should show a notification dot based on ACTIVE RULE.
 * (This is slightly different from before - now the rule fully controls the UI)
 */
export function shouldShowDot(rule: NotificationRule | null): boolean {
  return rule ? rule.showDot : false;
}

/**
 * Helper: Get pill CSS classes based on rule
 */
export function getRuleClasses(rule: NotificationRule | null): string {
  if (!rule) return '';
  const classes = [];
  if (rule.glow) classes.push('cqd-version-glow');
  return classes.join(' ');
}