/**
 * Live store-review scraping: pulls user reviews for the extension from the
 * Chrome Web Store and Firefox Add-ons so the website's testimonials section
 * picks up new submissions without a redeploy. Edge Add-ons has no
 * server-rendered review source, so it is intentionally absent here; the
 * website keeps its curated baseline for Edge.
 *
 * Guard rails (mirroring store-stats.ts conventions):
 * - Every fetch is time-boxed and independent; one store failing degrades only
 *   that store and never throws.
 * - Every field is validated and clamped; review text is tag-stripped and
 *   length-capped so store markup can never inject into the website.
 * - Reviews authored by the developer identity are dropped.
 * - Callers merge with the previous KV snapshot (union by id) so a partial or
 *   failed scrape can only ever add or update, never delete.
 */

export type StoreReviewStore = "chrome" | "firefox" | "edge";

export type StoreReview = {
  /** Stable id: `<store>:<per-store natural key>`. */
  id: string;
  store: StoreReviewStore;
  reviewer: string;
  rating: number;
  text: string;
  reviewUrl: string;
  avatarUrl: string | null;
  /** Store-provided display string ("Sep 7, 2026" / "2 months ago"). */
  dateText: string;
  /** Best-effort absolute time; approximate for relative store dates. */
  dateUtc: number | null;
  helpful: string | null;
  fetchedAtUtc: number;
};

export type StoreReviewsSnapshot = {
  fetchedAtUtc: number;
  reviews: StoreReview[];
};

const REVIEWS_FETCH_TIMEOUT_MS = 8_000;
const MAX_REVIEWS_PER_STORE = 60;
const MAX_TEXT_CHARS = 600;
const MAX_NAME_CHARS = 80;

const CHROME_REVIEWS_PAGE_URL =
  "https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid/reviews?hl=en";
const FIREFOX_REVIEWS_PAGE_URL =
  "https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/reviews/";
const CHROME_REVIEWS_PAGE_URL_BASE =
  "https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid/reviews";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Matches the developer identity (full name). Bare first names are kept. */
const DEVELOPER_NAME_PATTERN = /adham\s+haitham/i;

export function isDeveloperAuthored(reviewer: string): boolean {
  return DEVELOPER_NAME_PATTERN.test(reviewer);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ", hellip: "…",
  mdash: "-", ndash: "-", rsquo: "\u2019", lsquo: "\u2018", ldquo: "\u201C", rdquo: "\u201D",
};

/** Decode the handful of entities stores emit, without any HTML execution. */
export function decodeEntities(raw: string): string {
  return raw.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    const named = NAMED_ENTITIES[code.toLowerCase()];
    if (named !== undefined) return named;
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const value = parseInt(code.slice(2), 16);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    if (code.startsWith("#")) {
      const value = parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return match;
  });
}

/** Strip markup, decode entities, collapse whitespace, clamp length. */
export function sanitizeReviewText(raw: string, maxChars = MAX_TEXT_CHARS): string {
  const stripped = decodeEntities(String(raw ?? "").replace(/<[^>]*>/g, " "));
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  return collapsed.length > maxChars ? collapsed.slice(0, maxChars - 1).trimEnd() + "…" : collapsed;
}

function clampName(raw: string): string {
  return sanitizeReviewText(raw, MAX_NAME_CHARS);
}

/** Parse absolute "Sep 7, 2026" dates; null when absent or malformed. */
export function parseAbsoluteDateUtc(raw: string): number | null {
  const match = raw.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})/);
  if (!match) return null;
  const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  const utc = Date.UTC(year, month, day);
  return Number.isFinite(utc) ? utc : null;
}

/** Parse relative "2 months ago" dates as best-effort absolute estimates. */
export function parseRelativeDateUtc(raw: string, nowUtc: number): number | null {
  const match = raw.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const unitMs: Record<string, number> = {
    second: 1_000, minute: 60_000, hour: 3_600_000, day: 86_400_000,
    week: 7 * 86_400_000, month: 30 * 86_400_000, year: 365 * 86_400_000,
  };
  return nowUtc - amount * unitMs[match[2].toLowerCase()];
}

function stableId(store: StoreReviewStore, key: string): string {
  // FNV-1a keeps ids short and stable without crypto dependency.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${store}:${(hash >>> 0).toString(36)}`;
}

type WindowParse = {
  rating: number | null;
  dateText: string;
  body: string;
  avatarUrl: string | null;
};

function parseChromeWindow(window: string): WindowParse {
  const ratingMatch = window.match(/aria-label="([1-5]) out of 5 stars"/);
  const dateMatch = window.match(
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/,
  );
  // Review body: first paragraph after the heading window.
  const bodyMatch = window.match(/<p[^>]*>([\s\S]{0,900}?)<\/p>/);
  return {
    rating: ratingMatch ? Number(ratingMatch[1]) : null,
    dateText: dateMatch ? dateMatch[1] : "",
    body: bodyMatch ? bodyMatch[1] : "",
    avatarUrl: null,
  };
}

/**
 * Parse the Chrome Web Store reviews page. The page is server-rendered with
 * the most recent reviews in the initial HTML; each review anchors on a
 * `<span class="LfYwpe">Name</span>` heading followed by its rating, date,
 * and body within the same block window.
 */
export function parseChromeReviewsPage(
  html: string,
  nowUtc: number,
  reviewUrl: string = CHROME_REVIEWS_PAGE_URL_BASE,
): StoreReview[] {
  if (!html) return [];
  const namePattern = /<span class="LfYwpe">([^<]{1,120})<\/span>/g;
  const anchors: { name: string; index: number }[] = [];
  for (const match of html.matchAll(namePattern)) {
    anchors.push({ name: match[1], index: match.index ?? 0 });
  }

  const out: StoreReview[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const windowEnd = i + 1 < anchors.length ? anchors[i + 1].index : Math.min(html.length, anchor.index + 6_000);
    const window = html.slice(anchor.index, windowEnd);
    const parsed = parseChromeWindow(window);
    if (parsed.rating === null) continue;

    const reviewer = clampName(anchor.name);
    if (!reviewer || isDeveloperAuthored(reviewer)) continue;

    // Avatar (if any) precedes the name inside the same review block; take
    // the closest googleusercontent image from the pre-window.
    const preStart = i > 0 ? anchors[i - 1].index : Math.max(0, anchor.index - 3_000);
    const avatarMatch = html.slice(preStart, anchor.index).match(
      /<img[^>]+src="(https:\/\/lh3\.googleusercontent\.com\/[^"]+)"/,
    );
    const avatarUrl = avatarMatch ? avatarMatch[1] : null;

    out.push({
      id: stableId("chrome", `${reviewer}|${parsed.dateText}`),
      store: "chrome",
      reviewer,
      rating: parsed.rating,
      text: sanitizeReviewText(parsed.body),
      reviewUrl,
      avatarUrl,
      dateText: parsed.dateText,
      dateUtc: parseAbsoluteDateUtc(parsed.dateText),
      helpful: null,
      fetchedAtUtc: nowUtc,
    });
    if (out.length >= MAX_REVIEWS_PER_STORE) break;
  }
  return out;
}

/**
 * Parse the Firefox Add-ons reviews page. Server-rendered: each review block
 * anchors on a review permalink, with the star rating, reviewer profile link,
 * relative date, and body inside the same block.
 */
export function parseFirefoxReviewsPage(
  html: string,
  nowUtc: number,
  baseUrl: string = "https://addons.mozilla.org",
): StoreReview[] {
  if (!html) return [];
  const linkPattern = /href="(\/en-US\/firefox\/addon\/classroom-quick-downloader\/reviews\/(\d+)\/)"/g;
  const anchors: { href: string; id: string; index: number }[] = [];
  for (const match of html.matchAll(linkPattern)) {
    anchors.push({ href: match[1], id: match[2], index: match.index ?? 0 });
  }

  const out: StoreReview[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const windowEnd =
      i + 1 < anchors.length ? anchors[i + 1].index : Math.min(html.length, anchor.index + 6_000);
    const window = html.slice(anchor.index, windowEnd);

    const ratingMatch = window.match(/Rated\s+([1-5])\s+out of 5/);
    if (!ratingMatch) continue;
    const userMatch = window.match(/href="\/en-US\/firefox\/user\/\d+\/"[^>]*>([^<]{1,120})<\/a>/);
    const reviewer = userMatch ? clampName(userMatch[1]) : "";
    if (!reviewer || isDeveloperAuthored(reviewer)) continue;

    // Body: first non-empty text run after the permalink that is not UI chrome.
    const afterLink = window.slice(window.indexOf(anchor.href) + anchor.href.length);
    const bodyMatch = afterLink.match(/<\/a>\s*([^<]{2,700})/);
    const text = bodyMatch ? sanitizeReviewText(bodyMatch[1]) : "";

    const dateMatch = window.match(/>(\d+[^<]*?\s+ago)</);
    const dateText = dateMatch ? dateMatch[1] : "";

    out.push({
      id: `firefox:${anchor.id}`,
      store: "firefox",
      reviewer,
      rating: Number(ratingMatch[1]),
      text,
      reviewUrl: `${baseUrl}${anchor.href}`,
      avatarUrl: null,
      dateText,
      dateUtc: parseRelativeDateUtc(dateText, nowUtc),
      helpful: null,
      fetchedAtUtc: nowUtc,
    });
    if (out.length >= MAX_REVIEWS_PER_STORE) break;
  }
  return out;
}

/**
 * Union by id: fresh entries add or update, known entries are never dropped,
 * sorted newest-first and capped so the payload stays bounded.
 */
export function mergeStoreReviews(
  prev: StoreReview[],
  fresh: StoreReview[],
  cap = 100,
): StoreReview[] {
  const byId = new Map<string, StoreReview>();
  for (const review of prev) byId.set(review.id, review);
  for (const review of fresh) byId.set(review.id, review);
  const merged = [...byId.values()].sort((a, b) => {
    const aTime = a.dateUtc ?? a.fetchedAtUtc;
    const bTime = b.dateUtc ?? b.fetchedAtUtc;
    return bTime - aTime;
  });
  return merged.length > cap ? merged.slice(0, cap) : merged;
}

async function fetchTextWithTimeout(
  url: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("store_reviews_timeout"), REVIEWS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { "user-agent": BROWSER_UA, accept: "text/html", "accept-language": "en" },
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

/**
 * Fetch both server-rendered review sources in parallel. Individual failures
 * yield empty lists for that store; the result is null only when both failed,
 * so callers can keep serving the previous KV-cached reviews.
 */
export async function fetchStoreReviews(
  fetchImpl: typeof fetch = fetch,
): Promise<StoreReviewsSnapshot | null> {
  const nowUtc = Date.now();
  const [chromeHtml, firefoxHtml] = await Promise.all([
    fetchTextWithTimeout(CHROME_REVIEWS_PAGE_URL, fetchImpl),
    fetchTextWithTimeout(FIREFOX_REVIEWS_PAGE_URL, fetchImpl),
  ]);

  const chromeReviews = chromeHtml ? parseChromeReviewsPage(chromeHtml, nowUtc) : [];
  const firefoxReviews = firefoxHtml ? parseFirefoxReviewsPage(firefoxHtml, nowUtc) : [];

  if (chromeReviews.length === 0 && firefoxReviews.length === 0) return null;
  return {
    fetchedAtUtc: nowUtc,
    reviews: mergeStoreReviews([], [...chromeReviews, ...firefoxReviews], MAX_REVIEWS_PER_STORE * 2),
  };
}
