import { CHANGELOG_URL } from './analytics/constants';

export interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  changes: string[];
  summary?: string;
  added?: string[];
  changed?: string[];
  fixed?: string[];
  markdown?: string;
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

export interface ChangelogMeta {
  liveUpdatedAt?: number;
  applyMode?: string;
  lastAutoSyncAt?: number | null;
  lastAutoSyncStatus?: string;
}

export interface ChangelogData {
  entries: ChangelogEntry[];
  config: ChangelogConfig;
  meta?: ChangelogMeta;
  revisionToken: string;
  lastFetched: number;
}

const STORAGE_KEY = 'cqd_changelog_v1';
const CACHE_duration_MS = 0; // Always fetch on reload
const SEEN_KEY = 'cqd_changelog_seen_v1';
const FORCE_REFRESH_QUERY_KEY = '_';

function normalizeStringList(value: unknown, maxItems = 24): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function toLegacyChanges(entry: {
  summary?: string;
  added?: string[];
  changed?: string[];
  fixed?: string[];
  changes?: unknown;
}): string[] {
  const fallback = normalizeStringList(entry.changes, 40);
  if (fallback.length > 0) return fallback;
  const out: string[] = [];
  const summary = (entry.summary || '').trim();
  if (summary) out.push(`Summary: ${summary}`);
  for (const row of normalizeStringList(entry.added, 20)) out.push(`Added: ${row}`);
  for (const row of normalizeStringList(entry.changed, 20)) out.push(`Changed: ${row}`);
  for (const row of normalizeStringList(entry.fixed, 20)) out.push(`Fixed: ${row}`);
  return out;
}

function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, '');
}

function toFiniteInt(value: unknown): number | undefined {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.floor(num);
}

function hashText(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
}

function normalizeRulePriority(value: unknown): NotificationRule['priority'] {
  return value === 'minor' || value === 'major' ? value : 'normal';
}

function normalizeRuleEffect(value: unknown): NotificationRule['effect'] {
  return value === 'glow' || value === 'pulse' ? value : 'none';
}

function normalizeRuleTarget(value: unknown): string {
  if (typeof value !== 'string') return 'all';
  const trimmed = value.trim();
  if (!trimmed) return 'all';
  if (trimmed.toLowerCase() === 'all') return 'all';
  return normalizeVersion(trimmed);
}

function sanitizeRules(value: unknown): NotificationRule[] {
  if (!Array.isArray(value)) return [];
  const out: NotificationRule[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const row = value[i] as Record<string, unknown> | null | undefined;
    const idRaw = typeof row?.id === 'string' && row.id.trim()
      ? row.id.trim()
      : `rule-${i + 1}`;
    out.push({
      id: idRaw,
      target: normalizeRuleTarget(row?.target),
      priority: normalizeRulePriority(row?.priority),
      effect: normalizeRuleEffect(row?.effect),
    });
  }
  return out;
}

function sanitizeMeta(value: unknown): ChangelogMeta | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const liveUpdatedAt = toFiniteInt(row.liveUpdatedAt);
  const lastAutoSyncAtRaw = row.lastAutoSyncAt;
  const lastAutoSyncAt = lastAutoSyncAtRaw == null ? null : toFiniteInt(lastAutoSyncAtRaw) ?? null;
  const applyMode = typeof row.applyMode === 'string' ? row.applyMode : undefined;
  const lastAutoSyncStatus = typeof row.lastAutoSyncStatus === 'string' ? row.lastAutoSyncStatus : undefined;
  if (
    liveUpdatedAt === undefined &&
    applyMode === undefined &&
    lastAutoSyncStatus === undefined &&
    lastAutoSyncAt === null
  ) {
    return undefined;
  }
  return {
    liveUpdatedAt,
    applyMode,
    lastAutoSyncAt,
    lastAutoSyncStatus,
  };
}

function computeRevisionToken(entries: ChangelogEntry[], config: ChangelogConfig, meta?: ChangelogMeta): string {
  const basis = {
    configLastUpdated: toFiniteInt(config.lastUpdated) ?? null,
    liveUpdatedAt: toFiniteInt(meta?.liveUpdatedAt) ?? null,
    rules: config.rules.map((rule) => ({
      target: normalizeRuleTarget(rule.target),
      priority: normalizeRulePriority(rule.priority),
      effect: normalizeRuleEffect(rule.effect),
    })),
    entries: entries.map((entry) => ({
      id: entry.id,
      version: normalizeVersion(entry.version),
      date: entry.date,
      summary: entry.summary || '',
      changes: entry.changes,
      added: entry.added || [],
      changed: entry.changed || [],
      fixed: entry.fixed || [],
      markdown: entry.markdown || '',
      isImportant: entry.isImportant === true,
    })),
  };
  return `rev-${hashText(JSON.stringify(basis))}`;
}

function sanitizeCachedData(value: unknown): ChangelogData | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const entriesRaw = Array.isArray(row.entries) ? row.entries : [];
  const entries: ChangelogEntry[] = entriesRaw
    .map((entryRaw, index): ChangelogEntry | null => {
      const entry = entryRaw as Record<string, unknown> | null | undefined;
      const versionRaw = typeof entry?.version === 'string' ? entry.version.trim() : '';
      if (!versionRaw) return null;
      const version = normalizeVersion(versionRaw);
      const date = typeof entry?.date === 'string' ? entry.date : new Date().toISOString();
      const id = typeof entry?.id === 'string' && entry.id.trim()
        ? entry.id.trim()
        : `cl-${version}-${Date.parse(date) || 0}-${index}`;
      const added = normalizeStringList(entry?.added, 20);
      const changed = normalizeStringList(entry?.changed, 20);
      const fixed = normalizeStringList(entry?.fixed, 20);
      const summary = typeof entry?.summary === 'string' ? entry.summary.trim() : '';
      const markdown = typeof entry?.markdown === 'string' ? entry.markdown : '';
      const parsedEntry: ChangelogEntry = {
        id,
        version,
        date,
        changes: toLegacyChanges({
          summary,
          added,
          changed,
          fixed,
          changes: entry?.changes,
        }),
        added,
        changed,
        fixed,
        isImportant: entry?.isImportant === true,
      };
      if (summary) parsedEntry.summary = summary;
      if (markdown) parsedEntry.markdown = markdown;
      return parsedEntry;
    })
    .filter((entry): entry is ChangelogEntry => entry !== null);
  const configRaw = (row.config && typeof row.config === 'object') ? (row.config as Record<string, unknown>) : {};
  const config: ChangelogConfig = {
    rules: sanitizeRules(configRaw.rules),
    lastUpdated: toFiniteInt(configRaw.lastUpdated),
  };
  const meta = sanitizeMeta(row.meta);
  const lastFetched = toFiniteInt(row.lastFetched) ?? Date.now();
  const revisionToken = typeof row.revisionToken === 'string' && row.revisionToken.trim()
    ? row.revisionToken.trim()
    : computeRevisionToken(entries, config, meta);
  return {
    entries,
    config,
    meta,
    revisionToken,
    lastFetched,
  };
}

/**
 * Fetch changelog from storage or network.
 * Returns null if network fails and no cache.
 */
export async function fetchChangelog(force = false): Promise<ChangelogData | null> {
  // 1. Check cache
  const cached = await chrome.storage.local.get(STORAGE_KEY);
  const data = sanitizeCachedData(cached[STORAGE_KEY]);

  if (!force && data && (Date.now() - data.lastFetched < CACHE_duration_MS)) {
    return data;
  }

  // 2. Fetch network
  if (!CHANGELOG_URL) return data || null;

  try {
    const requestUrl = force
      ? `${CHANGELOG_URL}${CHANGELOG_URL.includes('?') ? '&' : '?'}${FORCE_REFRESH_QUERY_KEY}=${Date.now()}`
      : CHANGELOG_URL;
    const res = await fetch(requestUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    
    const json = await res.json();
    if (!json.ok) throw new Error('API error');

    const rawEntries = Array.isArray(json.entries) ? json.entries : [];
    const parsedEntries: ChangelogEntry[] = rawEntries
      .map((entry: any, index: number) => {
        const versionRaw = typeof entry?.version === 'string' ? entry.version.trim() : '';
        const version = normalizeVersion(versionRaw);
        const date = typeof entry?.date === 'string' ? entry.date : new Date().toISOString();
        if (!version) return null;
        const id = typeof entry?.id === 'string' && entry.id.trim()
          ? entry.id.trim()
          : `cl-${version}-${Date.parse(date) || 0}-${index}`;
        const added = normalizeStringList(entry?.added, 20);
        const changed = normalizeStringList(entry?.changed, 20);
        const fixed = normalizeStringList(entry?.fixed, 20);
        const summary = typeof entry?.summary === 'string' ? entry.summary.trim() : '';
        const markdown = typeof entry?.markdown === 'string' ? entry.markdown : '';
        const changes = toLegacyChanges({
          summary,
          added,
          changed,
          fixed,
          changes: entry?.changes
        });
        return {
          id,
          version,
          date,
          changes,
          summary: summary || undefined,
          added,
          changed,
          fixed,
          markdown: markdown || undefined,
          isImportant: entry?.isImportant === true
        };
      })
      .filter((entry: ChangelogEntry | null): entry is ChangelogEntry => entry !== null);

    const configRaw = (json.config && typeof json.config === 'object') ? json.config : {};
    const config: ChangelogConfig = {
      rules: sanitizeRules(configRaw.rules),
      lastUpdated: toFiniteInt(configRaw.lastUpdated),
    };
    const meta = sanitizeMeta(json.meta);
    const newData: ChangelogData = {
      entries: parsedEntries,
      config,
      meta,
      revisionToken: computeRevisionToken(parsedEntries, config, meta),
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

type SeenState = Record<string, string>;

function getSeenToken(version: string, data?: ChangelogData | null): string {
  const normalizedVersion = normalizeVersion(version);
  if (!normalizedVersion) return 'legacy';
  if (!data) return 'legacy';
  return `${normalizedVersion}::${data.revisionToken}`;
}

function migrateSeenState(raw: unknown): SeenState {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const state: SeenState = {};
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const version = normalizeVersion(item);
      if (!version) continue;
      state[version] = 'legacy';
    }
    return state;
  }
  if (typeof raw !== 'object') return {};
  const row = raw as Record<string, unknown>;
  const state: SeenState = {};
  for (const [key, value] of Object.entries(row)) {
    const version = normalizeVersion(key);
    if (!version) continue;
    if (typeof value !== 'string') continue;
    state[version] = value.trim() || 'legacy';
  }
  return state;
}

/**
 * Mark the current version as seen.
 */
/**
 * Mark a version as seen.
 */
export async function markAsSeen(version: string, data?: ChangelogData | null): Promise<void> {
  const normalizedVersion = normalizeVersion(version);
  if (!normalizedVersion) return;
  const storage = await chrome.storage.local.get(SEEN_KEY);
  const seen = migrateSeenState(storage[SEEN_KEY]);
  seen[normalizedVersion] = getSeenToken(normalizedVersion, data);
  await chrome.storage.local.set({ [SEEN_KEY]: seen });
}

/**
 * Check if a version has been seen.
 */
export async function isVersionSeen(version: string, data?: ChangelogData | null): Promise<boolean> {
  const normalizedVersion = normalizeVersion(version);
  if (!normalizedVersion) return false;
  const storage = await chrome.storage.local.get(SEEN_KEY);
  const seen = migrateSeenState(storage[SEEN_KEY]);
  if (!seen[normalizedVersion]) return false;
  return seen[normalizedVersion] === getSeenToken(normalizedVersion, data);
}

/**
 * Get the matching rule for a given version.
 * Priority: Exact Match > "all" > null
 */
export function getMatchingRule(config: ChangelogConfig | undefined, currentVersion: string): NotificationRule | null {
  if (!config || !config.rules || !config.rules.length) return null;
  const version = normalizeVersion(currentVersion);
  if (!version) return null;

  // 1. Exact Match
  const exact = config.rules.find(r => normalizeRuleTarget(r.target) === version);
  if (exact) return exact;

  // 2. Wildcard "all"
  const all = config.rules.find(r => normalizeRuleTarget(r.target) === 'all');
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