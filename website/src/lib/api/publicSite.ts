import { ORACLE_API_BASE_URL, STORE_LINKS, WORKER_BASE_URL } from '$lib/config';
import type {
  InstallBrowser,
  MapResponse,
  OverviewResponse,
  PublicSchemaVersion,
  SnapshotResponse,
  UserChangelogResponse,
  UninstallFeedbackRequest,
  UninstallFeedbackResponse,
  UninstallStatsResponse,
  WebsiteSnapshot,
  WorkerHealth
} from '$lib/types/public';

const REQUEST_TIMEOUT_MS = 8000;
export const ORACLE_SNAPSHOT_REFRESH_MS = 3 * 60 * 60 * 1000;
const SNAPSHOT_STORAGE_KEY = 'cqd.website.snapshot.v1';

let cachedSnapshot: WebsiteSnapshot | null = null;
let snapshotInFlight: Promise<WebsiteSnapshot> | null = null;
let snapshotStorageHydrated = false;

function isSnapshotFresh(snapshot: WebsiteSnapshot): boolean {
  return Date.now() < snapshot.nextRefreshAtUtc;
}

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readSnapshotFromStorage(): WebsiteSnapshot | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WebsiteSnapshot> & { overview?: unknown; map?: unknown };
    const fetchedAtUtc = asNumber(parsed.fetchedAtUtc);
    const nextRefreshAtUtc = asNumber(parsed.nextRefreshAtUtc);
    if (fetchedAtUtc <= 0 || nextRefreshAtUtc <= 0) return null;

    return {
      source: 'oracle',
      fetchedAtUtc,
      nextRefreshAtUtc,
      overview: coerceOverviewPayload(parsed.overview),
      map: coerceMapPayload(parsed.map)
    };
  } catch {
    return null;
  }
}

function writeSnapshotToStorage(snapshot: WebsiteSnapshot): void {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore quota/privacy mode failures.
  }
}

function hydrateSnapshotCacheFromStorage(): void {
  if (snapshotStorageHydrated) return;
  snapshotStorageHydrated = true;
  const persisted = readSnapshotFromStorage();
  if (persisted) cachedSnapshot = persisted;
}

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

async function fetchJSONFromBase(baseUrl: string, pathname: string, sourceLabel: string): Promise<unknown> {
  const normalizedBase = baseUrl.trim();
  if (!normalizedBase) {
    throw new Error(`Missing ${sourceLabel} base URL`);
  }
  const response = await withTimeout(
    fetch(`${normalizedBase}${pathname}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    }),
    REQUEST_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(`${sourceLabel} request failed (${response.status})`);
  }
  return response.json();
}

async function fetchOracleJSON(pathname: string): Promise<unknown> {
  return fetchJSONFromBase(ORACLE_API_BASE_URL, pathname, 'Oracle public API');
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
}

function asNullableString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  return null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function asWorkerHealth(value: unknown): WorkerHealth {
  if (value === 'up' || value === 'degraded' || value === 'down') {
    return value;
  }
  return 'down';
}

function asStringArray(value: unknown, maxItems = 8): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized) continue;
    out.push(normalized);
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeBrowser(input: unknown): InstallBrowser {
  const candidate = input as Partial<InstallBrowser>;
  return {
    key: asString(candidate?.key),
    name: asString(candidate?.name),
    usersCount: asNumber(candidate?.usersCount),
    version: asString(candidate?.version),
    rating: asString(candidate?.rating),
    ratingCount: asNumber(candidate?.ratingCount)
  };
}

export function coerceOverviewPayload(input: unknown): OverviewResponse {
  const source = input as Partial<OverviewResponse>;
  return {
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    totals: {
      downloads: asNumber(source?.totals?.downloads),
      success: asNumber(source?.totals?.success),
      fail: asNumber(source?.totals?.fail)
    },
    installs: {
      usersTotal: asNumber(source?.installs?.usersTotal),
      lastSyncedAtUtc: asNumber(source?.installs?.lastSyncedAtUtc),
      browsers: Array.isArray(source?.installs?.browsers)
        ? source.installs.browsers.map(normalizeBrowser)
        : []
    },
    versions: {
      github: asNullableString(source?.versions?.github),
      chrome: asNullableString(source?.versions?.chrome),
      firefox: asNullableString(source?.versions?.firefox),
      edge: asNullableString(source?.versions?.edge)
    },
    status: {
      systemLive: source?.status?.systemLive === true,
      liveSinceUtc: asNullableNumber(source?.status?.liveSinceUtc),
      workerHealth: asWorkerHealth(source?.status?.workerHealth)
    },
    links: {
      chrome: asString(source?.links?.chrome) || STORE_LINKS.chrome,
      firefox: asString(source?.links?.firefox) || STORE_LINKS.firefox,
      edge: asString(source?.links?.edge) || STORE_LINKS.edge,
      github: asString(source?.links?.github) || STORE_LINKS.github
    }
  };
}

export function coerceMapPayload(input: unknown): MapResponse {
  const source = input as Partial<MapResponse>;
  const bucket = new Map<string, number>();

  if (Array.isArray(source?.countries)) {
    for (const item of source.countries) {
      const code = asString(item?.countryCode).toUpperCase();
      const count = asNumber(item?.count);
      if (code.length !== 2 || count <= 0) continue;
      bucket.set(code, (bucket.get(code) ?? 0) + count);
    }
  }

  const countries = Array.from(bucket.entries())
    .map(([countryCode, count]) => ({ countryCode, count }))
    .sort((a, b) => b.count - a.count || a.countryCode.localeCompare(b.countryCode));
  const totalDownloads = countries.reduce((sum, item) => sum + item.count, 0);

  return {
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    granularity: 'country',
    countries,
    totals: {
      countries: countries.length,
      downloads: totalDownloads
    },
    privacyNote: asString(source?.privacyNote)
  };
}

function coerceUninstallStatsPayload(input: unknown): UninstallStatsResponse {
  const source = input as Partial<UninstallStatsResponse>;
  return {
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    stats: {
      totalSubmissions: asNumber(source?.stats?.totalSubmissions),
      lastSubmittedAtUtc: asNullableNumber(source?.stats?.lastSubmittedAtUtc),
      topReasons: Array.isArray(source?.stats?.topReasons)
        ? source.stats.topReasons
            .map((item) => ({
              reason: asString(item?.reason),
              count: asNumber(item?.count)
            }))
            .filter((item) => item.reason.length > 0 && item.count > 0)
        : []
    }
  };
}

function coerceUninstallSubmitPayload(input: unknown): UninstallFeedbackResponse {
  const source = input as Partial<UninstallFeedbackResponse>;
  return {
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    submissionId: asNumber(source?.submissionId),
    message: asString(source?.message)
  };
}

function coerceUserChangelogPayload(input: unknown): UserChangelogResponse {
  const source = input as Partial<UserChangelogResponse>;
  const entries = Array.isArray(source?.entries)
    ? source.entries
        .map((entry) => ({
          id: asString(entry?.id),
          version: asString(entry?.version),
          title: asString(entry?.title),
          summary: asString(entry?.summary),
          highlights: asStringArray(entry?.highlights, 6),
          releasedAtUtc: asNullableNumber(entry?.releasedAtUtc)
        }))
        .filter((entry) => entry.id.length > 0 && entry.version.length > 0 && entry.summary.length > 0)
    : [];

  entries.sort((a, b) => (b.releasedAtUtc ?? 0) - (a.releasedAtUtc ?? 0));

  return {
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    headline: asString(source?.headline),
    description: asString(source?.description),
    entries,
    fullChangelogUrl: asString(source?.fullChangelogUrl),
    lastUpdatedAtUtc: asNullableNumber(source?.lastUpdatedAtUtc)
  };
}

async function fetchOracleOverview(): Promise<OverviewResponse> {
  const payload = await fetchOracleJSON('/api/public/website/overview');
  return coerceOverviewPayload(payload);
}

async function fetchOracleMap(): Promise<MapResponse> {
  const payload = await fetchOracleJSON('/api/public/website/map');
  return coerceMapPayload(payload);
}

function buildSnapshot(overview: OverviewResponse, map: MapResponse): WebsiteSnapshot {
  const browsersTotal = overview.installs.browsers.reduce((sum, item) => sum + (item.usersCount || 0), 0);
  const normalizedUsersTotal = Math.max(overview.installs.usersTotal, browsersTotal);
  const normalizedOverview: OverviewResponse = {
    ...overview,
    installs: {
      ...overview.installs,
      usersTotal: normalizedUsersTotal
    }
  };

  const now = Date.now();
  return {
    source: 'oracle',
    fetchedAtUtc: now,
    nextRefreshAtUtc: now + ORACLE_SNAPSHOT_REFRESH_MS,
    overview: normalizedOverview,
    map
  };
}

export async function fetchWebsiteSnapshot(options: { force?: boolean } = {}): Promise<WebsiteSnapshot> {
  hydrateSnapshotCacheFromStorage();

  if (!options.force && cachedSnapshot && isSnapshotFresh(cachedSnapshot)) {
    return cachedSnapshot;
  }
  if (!options.force && snapshotInFlight) {
    return snapshotInFlight;
  }

  const runner = (async () => {
    const [overview, map] = await Promise.all([fetchOracleOverview(), fetchOracleMap()]);
    const snapshot = buildSnapshot(overview, map);
    cachedSnapshot = snapshot;
    writeSnapshotToStorage(snapshot);
    return snapshot;
  })()
    .catch((error) => {
      if (cachedSnapshot) return cachedSnapshot;
      throw error;
    })
    .finally(() => {
      snapshotInFlight = null;
    });

  snapshotInFlight = runner;
  return runner;
}

export async function fetchOverview(): Promise<OverviewResponse> {
  return fetchOracleOverview();
}

export async function fetchMapData(): Promise<MapResponse> {
  return fetchOracleMap();
}

export function resetWebsiteSnapshotCacheForTests(): void {
  cachedSnapshot = null;
  snapshotInFlight = null;
  snapshotStorageHydrated = false;
  if (canUseBrowserStorage()) {
    try {
      window.localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
    } catch {
      // Ignore.
    }
  }
}

export async function fetchUserChangelog(): Promise<UserChangelogResponse> {
  const payload = await fetchOracleJSON('/api/public/website/changelog');
  return coerceUserChangelogPayload(payload);
}

export async function fetchUninstallStats(): Promise<UninstallStatsResponse> {
  const payload = await fetchOracleJSON('/api/public/website/uninstall');
  return coerceUninstallStatsPayload(payload);
}

export async function submitUninstallFeedback(body: UninstallFeedbackRequest): Promise<UninstallFeedbackResponse> {
  const response = await withTimeout(
    fetch(`${ORACLE_API_BASE_URL}/api/public/website/uninstall`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(body)
    }),
    REQUEST_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(`Uninstall feedback request failed (${response.status})`);
  }
  const payload = await response.json();
  return coerceUninstallSubmitPayload(payload);
}
