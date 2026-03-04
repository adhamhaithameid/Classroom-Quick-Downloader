import type { ChangelogResponse } from '$lib/types/public';
import { WEBSITE_MANUAL_CHANGELOG } from '$lib/content/changelog.manual.generated';

function toIsoFromReleasedAt(value: unknown): string {
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) {
    return new Date(num).toISOString();
  }
  return new Date().toISOString();
}

/**
 * LEGACY_CHANGELOG_DISABLED_START
 * Remote changelog fetch (Oracle/Worker) is intentionally disabled.
 * Changelog is now fully manual and source-controlled.
 * LEGACY_CHANGELOG_DISABLED_END
 */
export async function fetchChangelog(): Promise<ChangelogResponse> {
  const entries = (WEBSITE_MANUAL_CHANGELOG.entries || []).map((entry, index) => {
    const version = String(entry.version || '').replace(/^v/i, '').trim();
    const date = toIsoFromReleasedAt(entry.releasedAtUtc);
    const summary = String(entry.summary || '').trim();
    const highlights = Array.isArray(entry.highlights)
      ? entry.highlights.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const added = Array.isArray(entry.added)
      ? entry.added.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const changed = Array.isArray(entry.changed)
      ? entry.changed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const fixed = Array.isArray(entry.fixed)
      ? entry.fixed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    return {
      id: String(entry.id || `manual-${version || index + 1}`),
      version,
      date,
      changes: [
        ...(summary ? [`Summary: ${summary}`] : []),
        ...added.map((item) => `Added: ${item}`),
        ...changed.map((item) => `Changed: ${item}`),
        ...fixed.map((item) => `Fixed: ${item}`),
        ...highlights,
      ],
      summary,
      added,
      changed,
      fixed,
      markdown: undefined,
      isImportant: index === 0,
    };
  }).filter((entry) => entry.version.length > 0);

  return {
    schemaVersion: '1',
    ok: true,
    entries,
    config: {
      rules: [],
      lastUpdated: Number(WEBSITE_MANUAL_CHANGELOG.generatedAt) || Date.now(),
    },
    meta: {
      applyMode: 'manual',
      liveUpdatedAt: Number(WEBSITE_MANUAL_CHANGELOG.generatedAt) || Date.now(),
      lastAutoSyncAt: null,
      lastAutoSyncStatus: 'manual',
    },
  };
}
