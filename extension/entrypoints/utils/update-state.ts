/**
 * Shared update-state contract (bead 08fg.3). The background owns the live
 * /changelog check and persists its result here; the popup mirrors the key
 * for the pill pulse. Keep this module free of chrome.* imports so both
 * entrypoints and tests can use it.
 */

export const UPDATE_STATE_KEY = 'cqd_update_state_v1';

/**
 * Changelog seen map (changelog.ts owns the shape: version → token). Lives
 * here so the background can watch dismissals without importing the
 * 56KB bundled changelog module.
 */
export const CHANGELOG_SEEN_KEY = 'cqd_changelog_seen_v1';

export interface UpdateState {
  /** Newest live changelog version, or null when the worker has none. */
  latestVersion: string | null;
  /** Epoch ms of the last successful check (staleness gate). */
  checkedAt: number;
}
