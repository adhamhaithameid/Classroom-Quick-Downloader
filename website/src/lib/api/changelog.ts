import { WORKER_BASE_URL } from '$lib/config';
import type { ChangelogResponse, ChangelogConfig, ChangelogMeta, ChangelogNotificationRule } from '$lib/types/public';

const REQUEST_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function sanitizeNotificationRules(input: unknown): ChangelogNotificationRule[] {
  if (!Array.isArray(input)) return [];
  const VALID_PRIORITIES = new Set(['normal', 'minor', 'major']);
  const VALID_EFFECTS = new Set(['none', 'glow', 'pulse']);
  const seen = new Map<string, ChangelogNotificationRule>();
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const targetRaw = typeof raw.target === 'string' ? raw.target.trim().replace(/^v/i, '') : '';
    const target = targetRaw.toLowerCase() === 'all' ? 'all' : targetRaw;
    if (!target) continue;
    const priority = typeof raw.priority === 'string' && VALID_PRIORITIES.has(raw.priority)
      ? (raw.priority as ChangelogNotificationRule['priority'])
      : 'normal';
    const effect = typeof raw.effect === 'string' && VALID_EFFECTS.has(raw.effect)
      ? (raw.effect as ChangelogNotificationRule['effect'])
      : 'none';
    seen.set(target, { id: id || `rule-${target}`, target, priority, effect });
  }
  return Array.from(seen.values());
}

function sanitizeChangelogConfig(input: unknown): ChangelogConfig | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const rules = sanitizeNotificationRules(raw.rules);
  const lastUpdated = typeof raw.lastUpdated === 'number' && Number.isFinite(raw.lastUpdated)
    ? Math.floor(raw.lastUpdated)
    : undefined;
  return { rules, lastUpdated };
}

function sanitizeChangelogMeta(input: unknown): ChangelogMeta | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  return {
    liveUpdatedAt: typeof raw.liveUpdatedAt === 'number' && Number.isFinite(raw.liveUpdatedAt)
      ? Math.floor(raw.liveUpdatedAt)
      : undefined,
    applyMode: typeof raw.applyMode === 'string' ? raw.applyMode : undefined,
    lastAutoSyncAt: typeof raw.lastAutoSyncAt === 'number' && Number.isFinite(raw.lastAutoSyncAt)
      ? Math.floor(raw.lastAutoSyncAt)
      : null,
    lastAutoSyncStatus: typeof raw.lastAutoSyncStatus === 'string' ? raw.lastAutoSyncStatus : undefined,
  };
}

function coerceChangelogPayload(input: unknown): ChangelogResponse {
  const source = input as Partial<ChangelogResponse>;
  const normalizeList = (value: unknown, maxItems = 24): string[] =>
    Array.isArray(value)
      ? value
          .filter((line): line is string => typeof line === 'string' && line.trim().length > 0)
          .map((line) => line.trim())
          .slice(0, maxItems)
      : [];

  const buildLegacyChanges = (entry: {
    summary?: string;
    added?: string[];
    changed?: string[];
    fixed?: string[];
    changes?: string[];
  }): string[] => {
    const direct = normalizeList(entry.changes, 40);
    if (direct.length > 0) return direct;
    const out: string[] = [];
    if (entry.summary && entry.summary.trim().length > 0) out.push(`Summary: ${entry.summary.trim()}`);
    for (const value of normalizeList(entry.added, 20)) out.push(`Added: ${value}`);
    for (const value of normalizeList(entry.changed, 20)) out.push(`Changed: ${value}`);
    for (const value of normalizeList(entry.fixed, 20)) out.push(`Fixed: ${value}`);
    return out;
  };

  const entries = Array.isArray(source?.entries)
    ? source.entries
        .map((entry) => {
          const raw = entry as ChangelogResponse['entries'][number];
          const id = typeof raw?.id === 'string' ? raw.id : '';
          const version = typeof raw?.version === 'string' ? raw.version : '';
          const date = typeof raw?.date === 'string' ? raw.date : '';
          const summary = typeof raw?.summary === 'string' ? raw.summary.trim() : '';
          const added = normalizeList(raw?.added, 20);
          const changed = normalizeList(raw?.changed, 20);
          const fixed = normalizeList(raw?.fixed, 20);
          const markdown = typeof raw?.markdown === 'string' ? raw.markdown : '';
          const changes = buildLegacyChanges({
            summary,
            added,
            changed,
            fixed,
            changes: raw?.changes
          });
          if (!id || !version || !date) return null;
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
            isImportant: raw.isImportant === true
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : [];

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return {
    ok: source?.ok === true,
    entries
  };
}

export async function fetchChangelog(): Promise<ChangelogResponse> {
  const response = await withTimeout(fetch(`${WORKER_BASE_URL}/changelog`), REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Changelog request failed (${response.status})`);
  }
  const payload = await response.json();
  return coerceChangelogPayload(payload);
}
