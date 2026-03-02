export type WorkerHealth = 'up' | 'degraded' | 'down';
export type PublicSchemaVersion = '1';

export type InstallBrowser = {
  key: 'chrome' | 'firefox' | 'edge' | string;
  name: string;
  usersCount: number;
  version: string;
  rating: string;
  ratingCount: number;
};

export type OverviewResponse = {
  schemaVersion: PublicSchemaVersion;
  ok: boolean;
  generatedAt: number;
  totals: {
    downloads: number;
    success: number;
    fail: number;
  };
  installs: {
    usersTotal: number;
    lastSyncedAtUtc: number;
    browsers: InstallBrowser[];
  };
  versions: {
    github: string | null;
    chrome: string | null;
    firefox: string | null;
    edge: string | null;
  };
  status: {
    systemLive: boolean;
    liveSinceUtc: number | null;
    workerHealth: WorkerHealth;
  };
  links: {
    chrome: string;
    firefox: string;
    edge: string;
    github: string;
  };
};

export type MapResponse = {
  schemaVersion: PublicSchemaVersion;
  ok: boolean;
  generatedAt: number;
  granularity: 'country';
  countries: Array<{ countryCode: string; count: number }>;
  totals: { countries: number; downloads: number };
  privacyNote: string;
};

export type SnapshotResponse = {
  schemaVersion: PublicSchemaVersion;
  ok: boolean;
  generatedAt: number;
  snapshotId: string;
  overview: OverviewResponse;
  map: MapResponse;
  changelog: UserChangelogResponse;
  userChangelogSummary: {
    headline: string;
    description: string;
    entriesCount: number;
    lastUpdatedAtUtc: number | null;
    fullChangelogUrl: string;
  };
  privacy: {
    headline: string;
    description: string;
    userPrivacyUrl: string;
    fullPrivacyUrl: string;
  };
};

export type WebsiteSnapshot = {
  source: 'oracle';
  snapshotId: string;
  generatedAt: number;
  fetchedAtUtc: number;
  nextRefreshAtUtc: number;
  overview: OverviewResponse;
  map: MapResponse;
  changelog: UserChangelogResponse;
  userChangelogSummary: SnapshotResponse['userChangelogSummary'];
  privacy: SnapshotResponse['privacy'];
};

export type WebsiteSnapshotFetchSource = 'oracle' | 'memory-cache' | 'storage-cache';

export type WebsiteSnapshotFetchResult = {
  snapshot: WebsiteSnapshot;
  source: WebsiteSnapshotFetchSource;
  degraded: boolean;
  stale: boolean;
  errorMessage: string | null;
};

export type WebsiteSnapshotStoreStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'refreshing'
  | 'degraded'
  | 'error';

export type WebsiteSnapshotStoreState = {
  status: WebsiteSnapshotStoreStatus;
  snapshot: WebsiteSnapshot | null;
  source: WebsiteSnapshotFetchSource | null;
  degraded: boolean;
  stale: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  lastUpdatedAtUtc: number | null;
  lastFailureAtUtc: number | null;
  lastUserRefreshAtUtc: number | null;
};

export type ChangelogNotificationRule = {
  id: string;
  target: string;
  priority: 'normal' | 'minor' | 'major';
  effect: 'none' | 'glow' | 'pulse';
};

export type ChangelogConfig = {
  rules: ChangelogNotificationRule[];
  lastUpdated?: number;
};

export type ChangelogMeta = {
  liveUpdatedAt?: number;
  applyMode?: string;
  lastAutoSyncAt?: number | null;
  lastAutoSyncStatus?: string;
};

export type ChangelogResponse = {
  schemaVersion: PublicSchemaVersion;
  ok: boolean;
  entries: Array<{
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
  }>;
  config?: ChangelogConfig;
  meta?: ChangelogMeta;
};

export type UserChangelogEntry = {
  id: string;
  version: string;
  title: string;
  summary: string;
  highlights: string[];
  releasedAtUtc: number | null;
};

export type UserChangelogResponse = {
  schemaVersion: PublicSchemaVersion;
  ok: boolean;
  generatedAt: number;
  headline: string;
  description: string;
  entries: UserChangelogEntry[];
  fullChangelogUrl: string;
  lastUpdatedAtUtc: number | null;
};

export type UninstallFeedbackRequest = {
  reason: string;
  browser: string;
  version: string;
  source: string;
  notes?: string;
};

export type UninstallFeedbackResponse = {
  schemaVersion: PublicSchemaVersion;
  ok: boolean;
  generatedAt: number;
  submissionId: number;
  message: string;
};

export type UninstallStatsResponse = {
  ok: boolean;
  generatedAt: number;
  stats: {
    totalSubmissions: number;
    lastSubmittedAtUtc: number | null;
    topReasons: Array<{
      reason: string;
      count: number;
    }>;
  };
};
