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
  WebsiteEventIngestResponse,
  WebsiteEventRequest,
  WebsiteSnapshotFetchResult,
  WebsiteSnapshotFetchSource,
  WebsiteSnapshot,
  WorkerHealth
} from '$lib/types/public';

const REQUEST_TIMEOUT_MS = 8000;
export const ORACLE_SNAPSHOT_REFRESH_MS = 3 * 60 * 60 * 1000;
const SNAPSHOT_STORAGE_KEY = 'cqd.website.snapshot.v1';
const PUBLIC_SCHEMA_VERSION: PublicSchemaVersion = '1';

let cachedSnapshot: WebsiteSnapshot | null = null;
let cachedSnapshotSource: WebsiteSnapshotFetchSource = 'memory-cache';
let snapshotInFlight: Promise<WebsiteSnapshot> | null = null;
let snapshotResultInFlight: Promise<WebsiteSnapshotFetchResult> | null = null;
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
      snapshotId: asString(parsed.snapshotId),
      generatedAt: asNumber(parsed.generatedAt),
      fetchedAtUtc,
      nextRefreshAtUtc,
      overview: coerceOverviewPayload(parsed.overview),
      map: coerceMapPayload(parsed.map),
      changelog: coerceUserChangelogPayload(parsed.changelog),
      userChangelogSummary: normalizeUserChangelogSummary((parsed as Partial<SnapshotResponse>)?.userChangelogSummary),
      privacy: normalizePrivacyPointers((parsed as Partial<SnapshotResponse>)?.privacy)
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
  if (persisted) {
    cachedSnapshot = persisted;
    cachedSnapshotSource = 'storage-cache';
  }
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

function buildRequestErrorMessage(status: number, requestLabel: string): string {
  if (status === 401 || status === 403) {
    return `Access denied (${status}).`;
  }
  if (status === 404) {
    return `Requested content was not found (${status}).`;
  }
  if (status === 429) {
    return `Too many requests (${status}). Please try again soon.`;
  }
  if (status >= 500) {
    return `Service temporarily unavailable (${status}). Please try again.`;
  }
  return `${requestLabel} request failed (${status}).`;
}

async function extractResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    const message =
      (typeof payload?.error?.message === 'string' && payload.error.message) ||
      (typeof payload?.message === 'string' && payload.message) ||
      '';
    return message.trim() || fallback;
  } catch {
    return fallback;
  }
}

async function fetchJSONFromBase(baseUrl: string, pathname: string, requestLabel: string): Promise<unknown> {
  const normalizedBase = baseUrl.trim();
  if (!normalizedBase) {
    throw new Error('Public API is not configured.');
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
    throw new Error(buildRequestErrorMessage(response.status, requestLabel));
  }
  return response.json();
}

async function fetchOracleJSON(pathname: string): Promise<unknown> {
  return fetchJSONFromBase(ORACLE_API_BASE_URL, pathname, 'Public data');
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

function asSchemaVersion(value: unknown): PublicSchemaVersion {
  return value === '1' ? '1' : PUBLIC_SCHEMA_VERSION;
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
    schemaVersion: asSchemaVersion(source?.schemaVersion),
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
    schemaVersion: asSchemaVersion(source?.schemaVersion),
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
    schemaVersion: asSchemaVersion(source?.schemaVersion),
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
    schemaVersion: asSchemaVersion(source?.schemaVersion),
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    submissionId: asNumber(source?.submissionId),
    message: asString(source?.message)
  };
}

function coerceWebsiteEventIngestPayload(input: unknown): WebsiteEventIngestResponse {
  const source = input as Partial<WebsiteEventIngestResponse>;
  return {
    schemaVersion: asSchemaVersion(source?.schemaVersion),
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    acceptedCount: asNumber(source?.acceptedCount),
    rejectedCount: asNumber(source?.rejectedCount)
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
    schemaVersion: asSchemaVersion(source?.schemaVersion),
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    headline: asString(source?.headline),
    description: asString(source?.description),
    entries,
    fullChangelogUrl: asString(source?.fullChangelogUrl),
    lastUpdatedAtUtc: asNullableNumber(source?.lastUpdatedAtUtc)
  };
}

function normalizeUserChangelogSummary(input: unknown): SnapshotResponse['userChangelogSummary'] {
  const source = input as Partial<SnapshotResponse['userChangelogSummary']> | undefined;
  return {
    headline: asString(source?.headline),
    description: asString(source?.description),
    entriesCount: asNumber(source?.entriesCount),
    lastUpdatedAtUtc: asNullableNumber(source?.lastUpdatedAtUtc),
    fullChangelogUrl: asString(source?.fullChangelogUrl)
  };
}

function normalizePrivacyPointers(input: unknown): SnapshotResponse['privacy'] {
  const source = input as Partial<SnapshotResponse['privacy']> | undefined;
  return {
    headline: asString(source?.headline),
    description: asString(source?.description),
    userPrivacyUrl: asString(source?.userPrivacyUrl),
    fullPrivacyUrl: asString(source?.fullPrivacyUrl)
  };
}

function coerceSnapshotPayload(input: unknown): SnapshotResponse {
  const source = input as Partial<SnapshotResponse>;
  const overview = coerceOverviewPayload(source?.overview);
  const map = coerceMapPayload(source?.map);
  const changelog = coerceUserChangelogPayload(source?.changelog);

  return {
    schemaVersion: asSchemaVersion(source?.schemaVersion),
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    snapshotId: asString(source?.snapshotId),
    overview,
    map,
    changelog,
    userChangelogSummary: normalizeUserChangelogSummary(source?.userChangelogSummary),
    privacy: normalizePrivacyPointers(source?.privacy)
  };
}

async function fetchOracleSnapshot(): Promise<SnapshotResponse> {
  const payload = await fetchOracleJSON('/api/public/website/snapshot');
  return coerceSnapshotPayload(payload);
}

function buildSnapshot(snapshotPayload: SnapshotResponse): WebsiteSnapshot {
  const overview = snapshotPayload.overview;
  const map = snapshotPayload.map;
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
    snapshotId: snapshotPayload.snapshotId || `snapshot-${snapshotPayload.generatedAt || now}`,
    generatedAt: snapshotPayload.generatedAt || now,
    fetchedAtUtc: now,
    nextRefreshAtUtc: now + ORACLE_SNAPSHOT_REFRESH_MS,
    overview: normalizedOverview,
    map,
    changelog: snapshotPayload.changelog,
    userChangelogSummary: snapshotPayload.userChangelogSummary,
    privacy: snapshotPayload.privacy
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'Failed to fetch live Oracle snapshot.';
}

function buildSnapshotFetchResult(
  snapshot: WebsiteSnapshot,
  source: WebsiteSnapshotFetchSource,
  degraded: boolean,
  errorMessage: string | null
): WebsiteSnapshotFetchResult {
  return {
    snapshot,
    source,
    degraded,
    stale: degraded || Date.now() >= snapshot.nextRefreshAtUtc,
    errorMessage
  };
}

export async function fetchWebsiteSnapshotResult(options: { force?: boolean } = {}): Promise<WebsiteSnapshotFetchResult> {
  hydrateSnapshotCacheFromStorage();

  if (!options.force && cachedSnapshot && isSnapshotFresh(cachedSnapshot)) {
    return buildSnapshotFetchResult(cachedSnapshot, cachedSnapshotSource, false, null);
  }
  if (!options.force && snapshotResultInFlight) {
    return snapshotResultInFlight;
  }

  const runner = (async () => {
    const canonicalPayload = await fetchOracleSnapshot();
    const snapshot = buildSnapshot(canonicalPayload);
    cachedSnapshot = snapshot;
    cachedSnapshotSource = 'memory-cache';
    writeSnapshotToStorage(snapshot);
    return buildSnapshotFetchResult(snapshot, 'oracle', false, null);
  })()
    .catch((error) => {
      if (cachedSnapshot) {
        return buildSnapshotFetchResult(
          cachedSnapshot,
          cachedSnapshotSource,
          true,
          toErrorMessage(error)
        );
      }
      throw error;
    })
    .finally(() => {
      snapshotInFlight = null;
      snapshotResultInFlight = null;
    });

  snapshotResultInFlight = runner;
  snapshotInFlight = runner.then((result) => result.snapshot);
  return runner;
}

export async function fetchWebsiteSnapshot(options: { force?: boolean } = {}): Promise<WebsiteSnapshot> {
  const result = await fetchWebsiteSnapshotResult(options);
  return result.snapshot;
}

export async function fetchOverview(): Promise<OverviewResponse> {
  const snapshot = await fetchWebsiteSnapshot();
  return snapshot.overview;
}

export async function fetchMapData(): Promise<MapResponse> {
  const snapshot = await fetchWebsiteSnapshot();
  return snapshot.map;
}

export function resetWebsiteSnapshotCacheForTests(): void {
  cachedSnapshot = null;
  cachedSnapshotSource = 'memory-cache';
  snapshotInFlight = null;
  snapshotResultInFlight = null;
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
  const snapshot = await fetchWebsiteSnapshot();
  if (snapshot.changelog.entries.length > 0 || snapshot.changelog.headline || snapshot.changelog.description) {
    return snapshot.changelog;
  }
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
