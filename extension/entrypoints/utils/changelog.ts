import { CHANGELOG_URL } from './analytics/constants';

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
  priority: 'normal' | 'minor' | 'major';
  effect: 'none' | 'glow' | 'pulse';
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
/**
 * Mark a version as seen.
 */
export async function markAsSeen(version: string): Promise<void> {
  if (!version) return;
  const data = await chrome.storage.local.get(SEEN_KEY);
  const seen = (data[SEEN_KEY] as string[]) || [];
  if (!seen.includes(version)) {
    const newSeen = [...seen, version];
    await chrome.storage.local.set({ [SEEN_KEY]: newSeen });
  }
}

/**
 * Check if a version has been seen.
 */
export async function isVersionSeen(version: string): Promise<boolean> {
  if (!version) return false;
  const data = await chrome.storage.local.get(SEEN_KEY);
  const seen = (data[SEEN_KEY] as string[]) || [];
  return seen.includes(version);
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
 * Helper: Get pill CSS classes based on rule & seen state
 */
export function getRuleClasses(rule: NotificationRule | null, isSeen: boolean): string {
  if (!rule) return '';
  if (isSeen) return ''; // Default / Normal style if seen

  const classes = [];
  
  // Priority (Color)
  if (rule.priority === 'minor') classes.push('cqd-pill-minor');
  if (rule.priority === 'major') classes.push('cqd-pill-major');
  
  // Effect
  // Glow: Minor=Blue, Major=Red
  if (rule.effect === 'glow') {
    classes.push(rule.priority === 'major' ? 'cqd-effect-glow-red' : 'cqd-effect-glow-blue');
  }
  // Pulse: Minor=Blue, Major=Red
  if (rule.effect === 'pulse') {
    classes.push(rule.priority === 'major' ? 'cqd-effect-pulse-red' : 'cqd-effect-pulse-blue');
  }

  return classes.join(' ');
}