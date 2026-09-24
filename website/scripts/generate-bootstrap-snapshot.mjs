// Regenerates website/static/data/bootstrap-snapshot.json from live sources:
// the Cloudflare Worker's DO-backed site metrics plus store stats scraped from
// Chrome Web Store, Firefox Add-ons (AMO), Edge Add-ons, and GitHub Releases.
//
// Usage: node website/scripts/generate-bootstrap-snapshot.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WORKER_BASE =
  process.env.PUBLIC_WORKER_BASE_URL || 'https://cqd-analytics.adhamhaithameid.workers.dev';
const OUT_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'data', 'bootstrap-snapshot.json');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchText(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, ...headers }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const parseCount = (raw) => {
  const value = Number(String(raw).replace(/[,\s+]/g, ''));
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
};
const normalizeVersion = (raw) => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return /^\d+(?:\.\d+){0,3}$/.test(value) ? value : '';
};
const normalizeRating = (raw) => {
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) && value > 0 && value <= 5 ? value.toFixed(1) : '';
};

async function fetchChrome() {
  const html = await fetchText(
    'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid?hl=en',
    { accept: 'text/html', 'accept-language': 'en' }
  );
  if (!html) return null;
  const users = html.match(/([\d,]+)\+?\s*users/);
  const rating = html.match(/([\d.]+)\s*out of 5/);
  const ratingCount = html.match(/([\d,]+)\s*ratings?/);
  const version =
    html.match(/Version<\/div><div[^>]*>([\d.]+)</) || html.match(/\\"version\\":\\"([\d.]+)\\"/);
  const usersCount = users ? parseCount(users[1]) : 0;
  const count = ratingCount ? parseCount(ratingCount[1]) : 0;
  if (usersCount <= 0 && count <= 0) return null;
  return {
    usersCount,
    rating: rating ? normalizeRating(rating[1]) : '',
    ratingCount: count,
    version: version ? normalizeVersion(version[1]) : '',
  };
}

async function fetchFirefox() {
  const text = await fetchText(
    'https://addons.mozilla.org/api/v5/addons/addon/classroom-quick-downloader/?lang=en-US',
    { accept: 'application/json' }
  );
  if (!text) return null;
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }
  const usersCount = Number.isFinite(payload?.average_daily_users) ? Math.floor(payload.average_daily_users) : 0;
  const ratingCount = Number.isFinite(payload?.ratings?.count) ? Math.floor(payload.ratings.count) : 0;
  if (usersCount <= 0 && ratingCount <= 0) return null;
  return {
    usersCount,
    rating: normalizeRating(payload?.ratings?.average),
    ratingCount,
    version: normalizeVersion(payload?.current_version?.version),
  };
}

async function fetchEdge() {
  const text = await fetchText(
    'https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/ecojbijjkcjdolpeoiemnccgmaeomcmn?hl=en-US&gl=US',
    { accept: 'application/json' }
  );
  if (!text) return null;
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }
  const usersCount = Number.isFinite(payload?.activeInstallCount) ? Math.floor(payload.activeInstallCount) : 0;
  const ratingCount = Number.isFinite(payload?.ratingCount) ? Math.floor(payload.ratingCount) : 0;
  if (usersCount <= 0 && ratingCount <= 0) return null;
  return {
    usersCount,
    rating: normalizeRating(payload?.averageRating),
    ratingCount,
    version: normalizeVersion(payload?.version),
  };
}

async function fetchGithubVersion() {
  const text = await fetchText(
    'https://api.github.com/repos/adhamhaithameid/Classroom-Quick-Downloader/releases/latest',
    { accept: 'application/vnd.github+json' }
  );
  if (!text) return null;
  try {
    const payload = JSON.parse(text);
    return normalizeVersion(String(payload?.tag_name ?? '').replace(/^v/i, '')) || null;
  } catch {
    return null;
  }
}

async function fetchSiteMetrics() {
  const text = await fetchText(`${WORKER_BASE}/public/site-metrics`, { accept: 'application/json' });
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const [chrome, firefox, edge, githubVersion, metrics] = await Promise.all([
  fetchChrome(),
  fetchFirefox(),
  fetchEdge(),
  fetchGithubVersion(),
  fetchSiteMetrics(),
]);

if (!metrics || !(metrics?.totals?.downloads > 0)) {
  console.error('FATAL: live site metrics unavailable; refusing to write a placeholder snapshot.');
  process.exit(1);
}

const browsers = [];
if (chrome) browsers.push({ key: 'chrome', name: 'Chrome', ...chrome });
if (firefox) browsers.push({ key: 'firefox', name: 'Firefox', ...firefox });
if (edge) browsers.push({ key: 'edge', name: 'Edge', ...edge });

const countries = Array.isArray(metrics.countries)
  ? metrics.countries
      .map((row) => ({
        countryCode: String(row.countryCode ?? '').trim().toUpperCase(),
        count: Number.isFinite(row.count) && row.count > 0 ? Math.floor(row.count) : 0,
      }))
      .filter((row) => /^[A-Z]{2}$/.test(row.countryCode) && row.count > 0)
  : [];

const now = Date.now();
const usersTotal = browsers.reduce((sum, browser) => sum + browser.usersCount, 0);
const githubRepo = 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader';
const siteUrl = 'https://classroom-quick-downloader.adhamhaithameid.is-a.dev';

const snapshot = {
  schemaVersion: '1',
  ok: true,
  generatedAt: now,
  snapshotId: `ws-public-website-snapshot-${now}-${Math.floor(Math.random() * 1_000_000)}`,
  overview: {
    schemaVersion: '1',
    ok: true,
    generatedAt: now,
    totals: {
      downloads: metrics.totals.downloads,
      success: Number.isFinite(metrics.totals.success) ? metrics.totals.success : 0,
      fail: Number.isFinite(metrics.totals.fail) ? metrics.totals.fail : 0,
    },
    installs: {
      usersTotal,
      lastSyncedAtUtc: now,
      browsers,
    },
    versions: {
      github: githubVersion,
      chrome: chrome?.version || null,
      firefox: firefox?.version || null,
      edge: edge?.version || null,
    },
    status: {
      systemLive: true,
      liveSinceUtc: 1765865693687,
      workerHealth: 'up',
    },
    links: {
      chrome: 'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid',
      firefox: 'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/',
      edge: 'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn',
      github: githubRepo,
    },
  },
  map: {
    schemaVersion: '1',
    ok: true,
    generatedAt: now,
    granularity: 'country',
    countries,
    totals: {
      countries: countries.length,
      downloads: countries.reduce((sum, row) => sum + row.count, 0),
    },
    privacyNote:
      'Country-level usage is aggregated without storing raw IP addresses.',
  },
  // Entries intentionally empty: the website merges its source-controlled
  // manual changelog at render time.
  changelog: {
    schemaVersion: '1',
    ok: true,
    generatedAt: now,
    headline: 'Release notes',
    description: 'Release highlights are maintained in source control.',
    entries: [],
    fullChangelogUrl: `${githubRepo}/blob/main/user-friendly-changelog.md`,
    lastUpdatedAtUtc: null,
  },
  userChangelogSummary: {
    headline: 'Release notes',
    description: 'Release highlights are maintained in source control.',
    entriesCount: 0,
    lastUpdatedAtUtc: null,
    fullChangelogUrl: `${githubRepo}/blob/main/user-friendly-changelog.md`,
  },
  privacy: {
    headline: 'Privacy-first',
    description: 'Telemetry is minimized and public metrics are aggregated only.',
    userPrivacyUrl: `${siteUrl}/privacy`,
    fullPrivacyUrl: `${githubRepo}/blob/main/PRIVACY.md`,
  },
  generatedAtUtc: now,
  cacheWrittenAtUtc: now,
  sessionPinned: true,
};

// Sanity check against the previously committed file: never let a bad run
// silently shrink the headline numbers.
try {
  const previous = JSON.parse(readFileSync(OUT_FILE, 'utf8'));
  const prevDownloads = previous?.overview?.totals?.downloads ?? 0;
  const nextDownloads = snapshot.overview.totals.downloads;
  if (nextDownloads < prevDownloads * 0.9) {
    console.error(
      `FATAL: new downloads total (${nextDownloads}) is >10% below the committed one (${prevDownloads}). Refusing to write.`
    );
    process.exit(1);
  }
} catch {
  // No previous file or unreadable — proceed.
}

writeFileSync(OUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${OUT_FILE}: downloads=${snapshot.overview.totals.downloads}, countries=${countries.length}, usersTotal=${usersTotal}`
);
console.log(
  `browsers: ${browsers.map((b) => `${b.key}=${b.usersCount}u v${b.version} ${b.rating}(${b.ratingCount})`).join(', ')}`
);
