import { resolveMetricsSource } from '$lib/api/metrics-source';
import { ORACLE_API_BASE_URL, STORE_LINKS, WORKER_BASE_URL } from '$lib/config';
import type {
  InstallBrowser,
  MapResponse,
  OverviewResponse,
  UserChangelogResponse,
  UserPrivacyResponse,
  UninstallFeedbackRequest,
  UninstallFeedbackResponse,
  UninstallStatsResponse,
  WorkerHealth,
  WorkerSiteMetricsResponse
} from '$lib/types/public';

const REQUEST_TIMEOUT_MS = 8000;

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
  const response = await withTimeout(fetch(`${normalizedBase}${pathname}`), REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`${sourceLabel} request failed (${response.status})`);
  }
  return response.json();
}

async function fetchOracleJSON(pathname: string): Promise<unknown> {
  return fetchJSONFromBase(ORACLE_API_BASE_URL, pathname, 'Oracle public API');
}

async function fetchWorkerJSON(pathname: string): Promise<unknown> {
  return fetchJSONFromBase(WORKER_BASE_URL, pathname, 'Cloudflare Worker public API');
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

function asNumberArray(value: unknown, maxItems = 24): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item)) continue;
    const hour = Math.trunc(item);
    if (hour < 0 || hour > 23) continue;
    out.push(hour);
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
  return {
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    granularity: 'country',
    countries: Array.isArray(source?.countries)
      ? source.countries
          .map((item) => ({
            countryCode: asString(item?.countryCode).toUpperCase(),
            count: asNumber(item?.count)
          }))
          .filter((item) => item.countryCode.length === 2 && item.count > 0)
      : [],
    totals: {
      countries: asNumber(source?.totals?.countries),
      downloads: asNumber(source?.totals?.downloads)
    },
    privacyNote: asString(source?.privacyNote)
  };
}

function coerceWorkerSiteMetricsPayload(input: unknown): WorkerSiteMetricsResponse {
  const source = input as Partial<WorkerSiteMetricsResponse>;
  const countries = Array.isArray(source?.countries)
    ? source.countries
        .map((item) => ({
          countryCode: asString(item?.countryCode).toUpperCase(),
          count: asNumber(item?.count)
        }))
        .filter((item) => item.countryCode.length === 2 && item.count > 0)
    : [];

  countries.sort((a, b) => {
    if (a.count === b.count) return a.countryCode.localeCompare(b.countryCode);
    return b.count - a.count;
  });

  return {
    ok: source?.ok === true,
    source: 'cloudflare-worker',
    generatedAt: asNumber(source?.generatedAt),
    snapshotAtUtc: asNumber(source?.snapshotAtUtc),
    totals: {
      downloads: asNumber(source?.totals?.downloads),
      countries: asNumber(source?.totals?.countries)
    },
    countries,
    schedule: {
      refreshHoursUtc: asNumberArray(source?.schedule?.refreshHoursUtc),
      activeHourUtc: asNumber(source?.schedule?.activeHourUtc),
      isRefreshWindow: source?.schedule?.isRefreshWindow === true,
      lastRefreshAtUtc: asNumber(source?.schedule?.lastRefreshAtUtc),
      nextRefreshAtUtc: asNumber(source?.schedule?.nextRefreshAtUtc)
    }
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

function coerceUserPrivacyPayload(input: unknown): UserPrivacyResponse {
  const source = input as Partial<UserPrivacyResponse>;
  const sections = Array.isArray(source?.sections)
    ? source.sections
        .map((section) => ({
          id: asString(section?.id),
          title: asString(section?.title),
          summary: asString(section?.summary),
          bullets: asStringArray(section?.bullets, 7),
          priority: asNumber(section?.priority)
        }))
        .filter((section) => section.id.length > 0 && section.title.length > 0 && section.summary.length > 0)
    : [];

  sections.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

  return {
    ok: source?.ok === true,
    generatedAt: asNumber(source?.generatedAt),
    headline: asString(source?.headline),
    description: asString(source?.description),
    sections,
    fullPrivacyUrl: asString(source?.fullPrivacyUrl),
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

async function fetchWorkerSiteMetrics(): Promise<WorkerSiteMetricsResponse> {
  const payload = await fetchWorkerJSON('/public/site-metrics');
  return coerceWorkerSiteMetricsPayload(payload);
}

function mergeOverviewWithWorkerMetrics(base: OverviewResponse, worker: WorkerSiteMetricsResponse): OverviewResponse {
  return {
    ...base,
    ok: base.ok || worker.ok,
    generatedAt: worker.generatedAt || base.generatedAt,
    totals: {
      ...base.totals,
      downloads: worker.totals.downloads
    },
    status: {
      ...base.status,
      systemLive: worker.totals.downloads > 0,
      liveSinceUtc: worker.snapshotAtUtc || base.status.liveSinceUtc,
      workerHealth: 'up'
    }
  };
}

function mapFromWorkerMetrics(worker: WorkerSiteMetricsResponse): MapResponse {
  const privacyNote =
    'Country-level usage is aggregated without storing raw IP addresses. VPN/proxy users may appear at exit-node locations.';

  return {
    ok: worker.ok,
    generatedAt: worker.generatedAt,
    granularity: 'country',
    countries: worker.countries,
    totals: {
      countries: worker.totals.countries || worker.countries.length,
      downloads: worker.totals.downloads
    },
    privacyNote
  };
}

export async function fetchOverview(): Promise<OverviewResponse> {
  const source = resolveMetricsSource();
  if (source === 'oracle') {
    return fetchOracleOverview();
  }

  const [workerResult, oracleResult] = await Promise.allSettled([fetchWorkerSiteMetrics(), fetchOracleOverview()]);

  if (workerResult.status === 'fulfilled') {
    const oracleOverview =
      oracleResult.status === 'fulfilled' ? oracleResult.value : coerceOverviewPayload({ links: STORE_LINKS });
    return mergeOverviewWithWorkerMetrics(oracleOverview, workerResult.value);
  }

  if (oracleResult.status === 'fulfilled') {
    return oracleResult.value;
  }

  throw workerResult.reason instanceof Error ? workerResult.reason : new Error('Failed to load overview data.');
}

export async function fetchMapData(): Promise<MapResponse> {
  const source = resolveMetricsSource();
  if (source === 'oracle') {
    return fetchOracleMap();
  }

  try {
    const workerMetrics = await fetchWorkerSiteMetrics();
    return mapFromWorkerMetrics(workerMetrics);
  } catch {
    return fetchOracleMap();
  }
}

export async function fetchUserChangelog(): Promise<UserChangelogResponse> {
  const payload = await fetchOracleJSON('/api/public/website/changelog');
  return coerceUserChangelogPayload(payload);
}

export async function fetchUserPrivacy(): Promise<UserPrivacyResponse> {
  const payload = await fetchOracleJSON('/api/public/website/privacy');
  return coerceUserPrivacyPayload(payload);
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
