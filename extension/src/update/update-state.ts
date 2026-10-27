/**
 * Update-available state (bead 08fg.3). Pure version arithmetic for the
 * toolbar dot and the popup pill. The live latest version comes from the
 * worker's GET /changelog; a pending version is set by the browser events
 * (onInstalled reason "update" = just updated, onUpdateAvailable = update
 * scheduled). The bundled changelog ships WITH the release, so it can
 * never contain a newer version and is not a usable live source.
 */

export interface VersionedEntry {
  version?: string;
}

export type SeenVersions = Record<string, string | undefined>;

export function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, '');
}

export function isNewerVersion(candidate: string, installed: string): boolean {
  const a = normalizeVersion(candidate);
  const b = normalizeVersion(installed);
  if (!a || !b) return false;
  return a.localeCompare(b, undefined, { numeric: true }) > 0;
}

export function latestVersionFrom(entries: VersionedEntry[]): string | null {
  let best: string | null = null;
  for (const entry of entries) {
    const version = typeof entry?.version === 'string' ? normalizeVersion(entry.version) : '';
    if (!version) continue;
    if (best === null || isNewerVersion(version, best)) best = version;
  }
  return best;
}

export type UpdateReason = 'updated' | 'scheduled' | 'available';

export interface UpdateTargetInput {
  /** Version from onInstalled (just updated) or onUpdateAvailable (scheduled). */
  pendingVersion: string | null;
  /** Newest live changelog version from the worker. */
  latestVersion: string | null;
  installedVersion: string;
  seenVersions: SeenVersions;
}

export interface UpdateTarget {
  /** Version the dot and pill point at, or null for no signal. */
  version: string | null;
  reason: UpdateReason | null;
}

/**
 * Decides what the dot points at, in priority order: a pending browser
 * update event first, then a newer unseen live release. Seen versions
 * drop out of each branch, so a seen pending version still lets a newer
 * live release show.
 */
export function updateTarget(input: UpdateTargetInput): UpdateTarget {
  if (input.pendingVersion && !input.seenVersions[input.pendingVersion]) {
    const reason: UpdateReason =
      input.pendingVersion === normalizeVersion(input.installedVersion)
        ? 'updated'
        : 'scheduled';
    return { version: input.pendingVersion, reason };
  }
  if (
    input.latestVersion &&
    isNewerVersion(input.latestVersion, input.installedVersion) &&
    !input.seenVersions[input.latestVersion]
  ) {
    return { version: input.latestVersion, reason: 'available' };
  }
  return { version: null, reason: null };
}
