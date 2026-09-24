/**
 * Live extension-store stats: users, ratings, and versions scraped from the
 * Chrome Web Store, Firefox Add-ons (AMO), and Edge Add-ons, plus the latest
 * GitHub release tag. This replaces the Oracle backend as the source for
 * install/user metrics on the public website snapshot.
 *
 * Every fetch is independent and time-boxed: one store failing degrades only
 * that store's numbers instead of failing the whole snapshot.
 */

export type StoreBrowserKey = "chrome" | "firefox" | "edge";

export type StoreBrowserStats = {
  key: StoreBrowserKey;
  name: string;
  usersCount: number;
  version: string;
  rating: string;
  ratingCount: number;
};

export type StoreStatsSnapshot = {
  fetchedAtUtc: number;
  browsers: StoreBrowserStats[];
  versions: {
    chrome: string | null;
    firefox: string | null;
    edge: string | null;
    github: string | null;
  };
};

const STORE_FETCH_TIMEOUT_MS = 5_000;

const CHROME_STORE_PAGE_URL =
  "https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid?hl=en";
const FIREFOX_AMO_API_URL =
  "https://addons.mozilla.org/api/v5/addons/addon/classroom-quick-downloader/?lang=en-US";
const EDGE_DETAILS_API_URL =
  "https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/ecojbijjkcjdolpeoiemnccgmaeomcmn?hl=en-US&gl=US";
const GITHUB_LATEST_RELEASE_URL =
  "https://api.github.com/repos/adhamhaithameid/Classroom-Quick-Downloader/releases/latest";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function parseCountToken(raw: string): number {
  const normalized = raw.replace(/[,\s+]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function normalizeVersion(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  return /^\d+(?:\.\d+){0,3}$/.test(value) ? value : "";
}

function normalizeRating(raw: unknown): string {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 5) return "";
  return value.toFixed(1);
}

export type ChromeStoreStats = {
  usersCount: number;
  rating: string;
  ratingCount: number;
  version: string;
};

/**
 * Parse the Chrome Web Store detail page. The page is a server-rendered shell
 * around a JS app, but the headline numbers appear as plain text:
 * "1,000 users", "4.8 out of 5", "25 ratings", and the version row
 * "Version</div><div ...>1.5.5</div>".
 */
export function parseChromeStoreStats(html: string): ChromeStoreStats | null {
  if (!html) return null;

  const usersMatch = html.match(/([\d,]+)\+?\s*users/);
  const ratingMatch = html.match(/([\d.]+)\s*out of 5/);
  const ratingCountMatch = html.match(/([\d,]+)\s*ratings?/);
  const versionMatch =
    html.match(/Version<\/div><div[^>]*>([\d.]+)</) ||
    html.match(/\\"version\\":\\"([\d.]+)\\"/) ||
    html.match(/(\d+\.\d+\.\d+)/);

  const usersCount = usersMatch ? parseCountToken(usersMatch[1]) : 0;
  const ratingCount = ratingCountMatch ? parseCountToken(ratingCountMatch[1]) : 0;
  if (usersCount <= 0 && ratingCount <= 0) return null;

  return {
    usersCount,
    rating: ratingMatch ? normalizeRating(ratingMatch[1]) : "",
    ratingCount,
    version: versionMatch ? normalizeVersion(versionMatch[1]) : "",
  };
}

export type FirefoxAddonStats = {
  usersCount: number;
  rating: string;
  ratingCount: number;
  version: string;
};

export function parseFirefoxAddonStats(payload: unknown): FirefoxAddonStats | null {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as {
    average_daily_users?: unknown;
    ratings?: { average?: unknown; count?: unknown };
    current_version?: { version?: unknown };
  };

  const usersCount = typeof source.average_daily_users === "number" && Number.isFinite(source.average_daily_users)
    ? Math.max(0, Math.floor(source.average_daily_users))
    : 0;
  const ratingCount =
    typeof source.ratings?.count === "number" && Number.isFinite(source.ratings.count)
      ? Math.max(0, Math.floor(source.ratings.count))
      : 0;
  if (usersCount <= 0 && ratingCount <= 0) return null;

  return {
    usersCount,
    rating: normalizeRating(source.ratings?.average),
    ratingCount,
    version: normalizeVersion(source.current_version?.version),
  };
}

export type EdgeDetailsStats = {
  usersCount: number;
  rating: string;
  ratingCount: number;
  version: string;
};

export function parseEdgeDetailsStats(payload: unknown): EdgeDetailsStats | null {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as {
    activeInstallCount?: unknown;
    averageRating?: unknown;
    ratingCount?: unknown;
    version?: unknown;
  };

  const usersCount =
    typeof source.activeInstallCount === "number" && Number.isFinite(source.activeInstallCount)
      ? Math.max(0, Math.floor(source.activeInstallCount))
      : 0;
  const ratingCount =
    typeof source.ratingCount === "number" && Number.isFinite(source.ratingCount)
      ? Math.max(0, Math.floor(source.ratingCount))
      : 0;
  if (usersCount <= 0 && ratingCount <= 0) return null;

  return {
    usersCount,
    rating: normalizeRating(source.averageRating),
    ratingCount,
    version: normalizeVersion(source.version),
  };
}

async function fetchTextWithTimeout(
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("store_stats_timeout"), STORE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout(
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const text = await fetchTextWithTimeout(url, headers, fetchImpl);
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export type StoreScrapeOutcome = "ok" | "fail";
export type StoreScrapeOutcomes = Record<string, StoreScrapeOutcome>;

export type StoreStatsResult = {
  snapshot: StoreStatsSnapshot | null;
  outcomes: StoreScrapeOutcomes;
};

/**
 * Fetch all stores in parallel. Individual failures yield null entries; the
 * snapshot is null only when every store failed, so callers can keep serving
 * the previous KV-cached numbers. `outcomes` records per-source success for
 * scrape-health tracking (chrome/firefox/edge/github).
 */
export async function fetchStoreStats(fetchImpl: typeof fetch = fetch): Promise<StoreStatsResult> {
  const [chromeHtml, firefoxPayload, edgePayload, githubPayload] = await Promise.all([
    fetchTextWithTimeout(
      CHROME_STORE_PAGE_URL,
      { "user-agent": BROWSER_UA, accept: "text/html", "accept-language": "en" },
      fetchImpl,
    ),
    fetchJsonWithTimeout(
      FIREFOX_AMO_API_URL,
      { "user-agent": BROWSER_UA, accept: "application/json" },
      fetchImpl,
    ),
    fetchJsonWithTimeout(
      EDGE_DETAILS_API_URL,
      { "user-agent": BROWSER_UA, accept: "application/json" },
      fetchImpl,
    ),
    fetchJsonWithTimeout(
      GITHUB_LATEST_RELEASE_URL,
      { "user-agent": BROWSER_UA, accept: "application/vnd.github+json" },
      fetchImpl,
    ),
  ]);

  const chromeStats = chromeHtml ? parseChromeStoreStats(chromeHtml) : null;
  const firefoxStats = parseFirefoxAddonStats(firefoxPayload);
  const edgeStats = parseEdgeDetailsStats(edgePayload);

  const outcomes: StoreScrapeOutcomes = {
    chrome: chromeStats ? "ok" : "fail",
    firefox: firefoxStats ? "ok" : "fail",
    edge: edgeStats ? "ok" : "fail",
    github: githubPayload && typeof githubPayload === "object" && !Array.isArray(githubPayload) && "tag_name" in (githubPayload as object) ? "ok" : "fail",
  };

  const browsers: StoreBrowserStats[] = [];
  if (chromeStats) {
    browsers.push({
      key: "chrome",
      name: "Chrome",
      usersCount: chromeStats.usersCount,
      version: chromeStats.version,
      rating: chromeStats.rating,
      ratingCount: chromeStats.ratingCount,
    });
  }
  if (firefoxStats) {
    browsers.push({
      key: "firefox",
      name: "Firefox",
      usersCount: firefoxStats.usersCount,
      version: firefoxStats.version,
      rating: firefoxStats.rating,
      ratingCount: firefoxStats.ratingCount,
    });
  }
  if (edgeStats) {
    browsers.push({
      key: "edge",
      name: "Edge",
      usersCount: edgeStats.usersCount,
      version: edgeStats.version,
      rating: edgeStats.rating,
      ratingCount: edgeStats.ratingCount,
    });
  }

  const githubTag =
    githubPayload && typeof githubPayload === "object"
      ? (githubPayload as { tag_name?: unknown }).tag_name
      : null;
  const githubVersionRaw = typeof githubTag === "string" ? githubTag.trim().replace(/^v/i, "") : "";
  const githubVersion = /^\d+(?:\.\d+){0,3}$/.test(githubVersionRaw) ? githubVersionRaw : null;

  if (browsers.length === 0) {
    return { snapshot: null, outcomes };
  }

  return {
    snapshot: {
      fetchedAtUtc: Date.now(),
      browsers,
      versions: {
        chrome: chromeStats?.version || null,
        firefox: firefoxStats?.version || null,
        edge: edgeStats?.version || null,
        github: githubVersion,
      },
    },
    outcomes,
  };
}

// --- Scrape health ------------------------------------------------------------

export type StoreHealthEntry = {
  lastOkAtUtc: number | null;
  lastFailAtUtc: number | null;
  consecutiveFailures: number;
};

export type StoreHealthDoc = {
  stores: Record<string, StoreHealthEntry>;
  updatedAtUtc: number;
  lastAlertStatus: string | null;
  lastAlertAtUtc: number | null;
};

export function createEmptyStoreHealthDoc(): StoreHealthDoc {
  return { stores: {}, updatedAtUtc: 0, lastAlertStatus: null, lastAlertAtUtc: null };
}

export function mergeScrapeOutcomes(
  prev: StoreHealthDoc | null,
  outcomes: StoreScrapeOutcomes,
  now: number,
): StoreHealthDoc {
  const doc: StoreHealthDoc = prev
    ? { ...prev, stores: { ...prev.stores }, updatedAtUtc: now }
    : { ...createEmptyStoreHealthDoc(), updatedAtUtc: now };
  for (const [source, outcome] of Object.entries(outcomes)) {
    const entry: StoreHealthEntry = doc.stores[source] ?? {
      lastOkAtUtc: null,
      lastFailAtUtc: null,
      consecutiveFailures: 0,
    };
    if (outcome === "ok") {
      entry.lastOkAtUtc = now;
      entry.consecutiveFailures = 0;
    } else {
      entry.lastFailAtUtc = now;
      entry.consecutiveFailures += 1;
    }
    doc.stores[source] = entry;
  }
  return doc;
}

export type ScrapeAlert = { store: string; reason: string };

/**
 * Decide which stores need attention. A store alerts when it failed the last
 * N consecutive attempts, or when its last successful scrape is older than
 * `staleOkMs` (the "frozen numbers" case).
 */
export function evaluateScrapeHealth(
  doc: StoreHealthDoc,
  opts: { now: number; failThreshold: number; staleOkMs: number },
): ScrapeAlert[] {
  const alerts: ScrapeAlert[] = [];
  for (const [store, entry] of Object.entries(doc.stores)) {
    if (entry.consecutiveFailures >= opts.failThreshold) {
      alerts.push({ store, reason: `consecutive_failures_${entry.consecutiveFailures}` });
      continue;
    }
    if (
      entry.lastOkAtUtc !== null &&
      opts.now - entry.lastOkAtUtc > opts.staleOkMs
    ) {
      alerts.push({ store, reason: `last_ok_stale_${Math.floor((opts.now - entry.lastOkAtUtc) / 3_600_000)}h` });
    }
  }
  return alerts;
}
