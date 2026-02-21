export type WorkerHealth = 'up' | 'degraded' | 'down';

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
