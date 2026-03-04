import { EXTENSION_MANUAL_CHANGELOG } from './manual-changelog.generated';

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
  contentChecksum?: string;
}

export interface ChangelogData {
  entries: ChangelogEntry[];
  config: ChangelogConfig;
  meta?: ChangelogMeta;
  revisionToken: string;
  lastFetched: number;
}

export type ChangelogFetchStatus = 'fresh' | 'not-modified' | 'cache-fallback' | 'empty' | 'error';

export interface ChangelogFetchResult {
  data: ChangelogData | null;
  status: ChangelogFetchStatus;
  error?: string;
}

const STORAGE_KEY = 'cqd_changelog_v1';
const SEEN_KEY = 'cqd_changelog_seen_v1';

function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, '');
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
  if (!trimmed || trimmed.toLowerCase() === 'all') return 'all';
  return normalizeVersion(trimmed);
}

function hashText(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
}

function normalizeManualData(): ChangelogData {
  const now = Date.now();
  const rawEntries = Array.isArray(EXTENSION_MANUAL_CHANGELOG.entries)
    ? EXTENSION_MANUAL_CHANGELOG.entries
    : [];

  const entries: ChangelogEntry[] = [];
  for (let index = 0; index < rawEntries.length; index += 1) {
    const entry = rawEntries[index];
    const version = normalizeVersion(String(entry?.version || ''));
    if (!version) continue;
    const date = typeof entry?.date === 'string' && entry.date.trim()
      ? entry.date
      : new Date(now - index * 86_400_000).toISOString();
    const id = typeof entry?.id === 'string' && entry.id.trim()
      ? entry.id.trim()
      : `manual-${version}-${index + 1}`;
    const changes = Array.isArray(entry?.changes)
      ? entry.changes.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    entries.push({
      id,
      version,
      date,
      changes,
      summary: typeof entry?.summary === 'string' ? entry.summary.trim() : undefined,
      added: Array.isArray(entry?.added) ? entry.added.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0) : [],
      changed: Array.isArray(entry?.changed) ? entry.changed.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0) : [],
      fixed: Array.isArray(entry?.fixed) ? entry.fixed.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0) : [],
      isImportant: entry?.isImportant === true,
    });
  }
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const rawRules = Array.isArray(EXTENSION_MANUAL_CHANGELOG?.config?.rules)
    ? EXTENSION_MANUAL_CHANGELOG.config.rules
    : [];

  const rules: NotificationRule[] = rawRules.map((rule, index) => ({
    id: typeof rule?.id === 'string' && rule.id.trim() ? rule.id.trim() : `manual-rule-${index + 1}`,
    target: normalizeRuleTarget(rule?.target),
    priority: normalizeRulePriority(rule?.priority),
    effect: normalizeRuleEffect(rule?.effect),
  }));

  const meta: ChangelogMeta = {
    applyMode: 'manual',
    liveUpdatedAt: Number(EXTENSION_MANUAL_CHANGELOG?.meta?.liveUpdatedAt) || now,
    contentChecksum: typeof EXTENSION_MANUAL_CHANGELOG?.meta?.contentChecksum === 'string'
      ? EXTENSION_MANUAL_CHANGELOG.meta.contentChecksum
      : `manual-${now}`,
  };

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
 * Parse a raw API JSON response into ChangelogData.
 * Shared between Oracle and Worker responses (same format).
 */
function parseApiResponse(json: any): ChangelogData | null {
  if (!json || !json.ok) return null;
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
  return {
    entries: parsedEntries,
    config,
    meta,
    revisionToken: computeRevisionToken(parsedEntries, config, meta),
    lastFetched: Date.now(),
  };
}

/**
 * Try fetching from a URL. Returns [ChangelogData | null, newEtag | null].
 * Returns [null, storedEtag] on 304 Not Modified.
 */
async function tryFetchEndpoint(
  url: string,
  force: boolean,
  storedEtag?: string
): Promise<[ChangelogData | null, string | null]> {
  const requestUrl = force
    ? `${url}${url.includes('?') ? '&' : '?'}${FORCE_REFRESH_QUERY_KEY}=${Date.now()}`
    : url;

  const headers: Record<string, string> = {};
  if (storedEtag && !force) {
    headers['If-None-Match'] = storedEtag;
  }

  const res = await fetch(requestUrl, { cache: 'no-store', headers });

  // 304 Not Modified — data hasn't changed
  if (res.status === 304) {
    return [null, storedEtag || null];
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const parsed = parseApiResponse(json);
  const newEtag = res.headers.get('ETag') || null;
  return [parsed, newEtag];
}

/**
 * Fetch changelog from Oracle (primary) or Worker (fallback).
 * Returns cached data if both fail; null if no cache exists.
 */
export async function fetchChangelog(force = false): Promise<ChangelogData | null> {
  // 1. Check cache
  const cached = await chrome.storage.local.get([STORAGE_KEY, ETAG_KEY]);
  const data = sanitizeCachedData(cached[STORAGE_KEY]);
  const storedEtag = typeof cached[ETAG_KEY] === 'string' ? cached[ETAG_KEY] : undefined;

  if (!force && data && (Date.now() - data.lastFetched < CACHE_duration_MS)) {
    return data;
  }

  // 2. Try Oracle (primary)
  try {
    if (ORACLE_CHANGELOG_URL) {
      const [oracleData, newEtag] = await tryFetchEndpoint(ORACLE_CHANGELOG_URL, force, storedEtag);
      if (oracleData) {
        // Fresh data from Oracle
        await chrome.storage.local.set({
          [STORAGE_KEY]: oracleData,
          [ETAG_KEY]: newEtag || '',
        });
        return oracleData;
      }
      // 304 response — data unchanged, update lastFetched
      if (data) {
        const refreshed = { ...data, lastFetched: Date.now() };
        await chrome.storage.local.set({ [STORAGE_KEY]: refreshed });
        return refreshed;
      }
    }
  } catch (oracleErr) {
    console.warn('[CQD Changelog] Oracle fetch failed, trying Worker fallback:', oracleErr);
  }

  // 3. Try Worker (fallback)
  try {
    if (CHANGELOG_URL) {
      const [workerData] = await tryFetchEndpoint(CHANGELOG_URL, force);
      if (workerData) {
        await chrome.storage.local.set({ [STORAGE_KEY]: workerData });
        return workerData;
      }
    }
  } catch (workerErr) {
    console.warn('[CQD Changelog] Worker fallback also failed:', workerErr);
  }

  // 4. Return cached data (offline fallback)
  return data || null;
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
