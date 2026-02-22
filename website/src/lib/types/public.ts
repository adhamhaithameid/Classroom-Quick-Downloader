export type WorkerHealth = 'up' | 'degraded' | 'down';
export type PublicMetricsSource = 'oracle' | 'worker';

export type InstallBrowser = {
  key: 'chrome' | 'firefox' | 'edge' | string;
  name: string;
  usersCount: number;
  version: string;
  rating: string;
  ratingCount: number;
};

export type OverviewResponse = {
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
  ok: boolean;
  generatedAt: number;
  granularity: 'country';
  countries: Array<{ countryCode: string; count: number }>;
  totals: { countries: number; downloads: number };
  privacyNote: string;
};

export type WorkerSiteMetricsResponse = {
  ok: boolean;
  source: 'cloudflare-worker';
  generatedAt: number;
  snapshotAtUtc: number;
  totals: {
    downloads: number;
    countries: number;
  };
  countries: Array<{ countryCode: string; count: number }>;
  schedule: {
    refreshHoursUtc: number[];
    activeHourUtc: number;
    isRefreshWindow: boolean;
    lastRefreshAtUtc: number;
    nextRefreshAtUtc: number;
  };
};

export type ChangelogResponse = {
  ok: boolean;
  entries: Array<{
    id: string;
    version: string;
    date: string;
    changes: string[];
    isImportant?: boolean;
  }>;
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
  ok: boolean;
  generatedAt: number;
  headline: string;
  description: string;
  entries: UserChangelogEntry[];
  fullChangelogUrl: string;
  lastUpdatedAtUtc: number | null;
};

export type UserPrivacySection = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  priority: number;
};

export type UserPrivacyResponse = {
  ok: boolean;
  generatedAt: number;
  headline: string;
  description: string;
  sections: UserPrivacySection[];
  fullPrivacyUrl: string;
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
