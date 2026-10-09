/**
 * Fixture state — builders for the data the simulated chrome serves to the
 * real popup.
 *
 * Every value mirrors what the extension background would put in
 * chrome.storage.local or answer over runtime.sendMessage. The popup reads
 * REAL storage shapes (checksummed stats record, flat settings keys), so
 * fixtures stay byte-compatible with production records.
 */

import { computeChecksum } from '../../../extension/src/history/history-store';
import {
  DOWNLOAD_STATS_INTEGRITY_KEY,
  DOWNLOAD_STATS_KEY,
  createEmptyStats,
  type DownloadStats,
} from '../../../extension/src/history/download-stats';
import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_KEY,
  SETTINGS_SCHEMA_VERSION,
  type Settings,
} from '../../../extension/src/ui/settings/store';

export interface QueueRow {
  requestId: string;
  queued: boolean;
  filename: string;
  ext?: string;
}

export interface HistoryRow {
  id: string;
  ts: number;
  filename: string;
  ext?: string;
  bytes?: number;
  status: string;
  errorCode?: string;
  host: string;
  url: string;
}

/**
 * How the changelog module answers fetches ('real' = production behavior;
 * 'fail' and 'offline' ride the vite.config override seam).
 */
export type ChangelogMode = 'real' | 'fail' | 'offline';

export interface FixtureState {
  /** chrome.storage.local contents. */
  storage: Record<string, unknown>;
  queueRows: QueueRow[];
  queuePaused: boolean;
  historyRows: HistoryRow[];
  /** true → CQD_HISTORY_GET answers ok:false (the history read fails). */
  historyFails: boolean;
  /** URL the simulated active tab reports. */
  tabUrl: string;
  /** Manifest version reported by the simulated chrome. */
  version: string;
  /** Whether identity + oauth2 client_id exist (gates the API engine). */
  apiConfigured: boolean;
  changelog: ChangelogMode;
}

/** Build a checksummed cqd_download_stats_v1 record the way production writes it. */
export function statsStorage(
  lifetimeCount: number,
  opts: { pending?: number | null; last?: number | null } = {},
): Record<string, unknown> {
  const stats: DownloadStats = {
    ...createEmptyStats(),
    lifetimeCount,
    milestonePending: opts.pending ?? null,
    lastMilestoneReached: opts.last ?? null,
    countedDownloadIds: Array.from(
      { length: Math.min(lifetimeCount, 5) },
      (_, i) => `sim-dl-${i + 1}`,
    ),
  };
  return {
    [DOWNLOAD_STATS_KEY]: stats,
    [DOWNLOAD_STATS_INTEGRITY_KEY]: computeChecksum(JSON.stringify(stats)),
  };
}

/**
 * Build a cqd_download_stats_v1 record whose integrity checksum does not
 * match its content (bit rot / tampering): loadDownloadStats fails the
 * checksum comparison and resets to an honest empty record.
 */
export function corruptStatsStorage(): Record<string, unknown> {
  const stats: DownloadStats = {
    ...createEmptyStats(),
    lifetimeCount: 137,
    lastMilestoneReached: 100,
  };
  return {
    [DOWNLOAD_STATS_KEY]: stats,
    [DOWNLOAD_STATS_INTEGRITY_KEY]: computeChecksum('{"corrupted":true}'),
  };
}

/** Build the popup's donut-chart record (local_stats). */
export function localStatsStorage(byType: Record<string, number>): Record<string, unknown> {
  const total = Object.values(byType).reduce((sum, n) => sum + n, 0);
  return { local_stats: { total, byType } };
}

/** Build the flat settings keys + schema stamp (production migration shape). */
export function settingsStorage(patch: Partial<Settings> = {}): Record<string, unknown> {
  return {
    ...DEFAULT_SETTINGS,
    ...patch,
    [SETTINGS_SCHEMA_KEY]: SETTINGS_SCHEMA_VERSION,
  };
}

/**
 * Build a pre-schema settings payload — an install upgraded from a version
 * before the schema stamp existed: the original flat keys survive (Edited
 * off proves stored values migrate), the later keys and the
 * cqdSettingsSchemaVersion marker do not exist. loadSettings back-fills the
 * missing keys from defaults and stamps v2 on first load.
 */
export function preSchemaSettingsStorage(): Record<string, unknown> {
  return {
    extensionEnabled: true,
    downloadAllEnabled: true,
    commentsFlagEnabled: true,
    editedFlagEnabled: false,
  };
}

export const CLASSROOM_TAB_URL = 'https://classroom.google.com/u/0/c/MjY4NzA@example';
export const OTHER_TAB_URL = 'https://github.com/adhamhaithameid';

/** Shared row factories for queue and history fixtures. */
export const queueRowsFixtureHelpers = {
  running(): QueueRow[] {
    return [
      { requestId: 'sim-q-1', queued: false, filename: 'week-4-lecture.pdf', ext: 'pdf' },
      { requestId: 'sim-q-2', queued: false, filename: 'lab-manual.pdf', ext: 'pdf' },
      { requestId: 'sim-q-3', queued: true, filename: 'grade-sheet.xlsx', ext: 'xlsx' },
      { requestId: 'sim-q-4', queued: true, filename: 'reading-list.docx', ext: 'docx' },
    ];
  },
};

const DAY_MS = 86_400_000;

export const historyRowsFixtureHelpers = {
  firstSuccess(): HistoryRow[] {
    return [
      {
        id: 'sim-h-1',
        ts: Date.now() - DAY_MS,
        filename: 'syllabus.pdf',
        ext: 'pdf',
        bytes: 482_133,
        status: 'success',
        host: 'drive.google.com',
        url: 'https://drive.google.com/uc?id=sim-syllabus',
      },
    ];
  },
  mixed(): HistoryRow[] {
    return [
      {
        id: 'sim-h-1',
        ts: Date.now() - DAY_MS,
        filename: 'syllabus.pdf',
        ext: 'pdf',
        bytes: 482_133,
        status: 'success',
        host: 'drive.google.com',
        url: 'https://drive.google.com/uc?id=sim-syllabus',
      },
      {
        id: 'sim-h-2',
        ts: Date.now() - 2 * DAY_MS,
        filename: 'week-4-slides.pptx',
        ext: 'pptx',
        bytes: 1_882_901,
        status: 'success',
        host: 'drive.google.com',
        url: 'https://drive.google.com/uc?id=sim-slides',
      },
      {
        id: 'sim-h-3',
        ts: Date.now() - 3 * DAY_MS,
        filename: 'grade-sheet.xlsx',
        ext: 'xlsx',
        status: 'failed',
        errorCode: 'SERVER_FORBIDDEN',
        host: 'drive.google.com',
        url: 'https://drive.google.com/uc?id=sim-sheet',
      },
    ];
  },
  failed(): HistoryRow[] {
    return [
      {
        id: 'sim-h-f1',
        ts: Date.now() - 3_600_000,
        filename: 'grade-sheet.xlsx',
        ext: 'xlsx',
        status: 'failed',
        errorCode: 'SERVER_FORBIDDEN',
        host: 'drive.google.com',
        url: 'https://drive.google.com/uc?id=sim-sheet',
      },
      {
        id: 'sim-h-f2',
        ts: Date.now() - 7_200_000,
        filename: 'recording.mp4',
        ext: 'mp4',
        status: 'failed',
        errorCode: 'NETWORK_TIMEOUT',
        host: 'drive.google.com',
        url: 'https://drive.google.com/uc?id=sim-video',
      },
    ];
  },
  corrupt(): HistoryRow {
    return {
      id: 'sim-h-corrupt',
      ts: Number.NaN,
      filename: '',
      status: '',
      host: '',
      url: '',
    };
  },
};

/** The fresh-install fixture: level 0, empty history, zero stats, no consent. */
export function firstRunFixture(): FixtureState {
  return {
    storage: {
      ...settingsStorage(),
      ...statsStorage(0),
      ...localStatsStorage({}),
      cqdSettingsCollapsed: true,
    },
    queueRows: [],
    queuePaused: false,
    historyRows: [],
    historyFails: false,
    tabUrl: CLASSROOM_TAB_URL,
    version: '1.9.1',
    apiConfigured: false,
    changelog: 'real',
  };
}
