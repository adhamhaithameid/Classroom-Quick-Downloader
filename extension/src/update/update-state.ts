/**
 * Update-available state (bead 08fg.3). Pure version arithmetic for the
 * toolbar dot and the popup pill. The live latest version comes from the
 * worker's GET /changelog (entries sorted newest first); the bundled
 * changelog ships WITH the release, so it can never contain a newer
 * version and is not a usable source here.
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

export interface DotInput {
  latestVersion: string | null;
  installedVersion: string;
  seenVersions: SeenVersions;
}

export function shouldShowDot({ latestVersion, installedVersion, seenVersions }: DotInput): boolean {
  if (!latestVersion) return false;
  if (!isNewerVersion(latestVersion, installedVersion)) return false;
  return !seenVersions[latestVersion];
}
