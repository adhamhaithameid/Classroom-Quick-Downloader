import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  fetchStoreReviews,
  isDeveloperAuthored,
  mergeStoreReviews,
  parseAbsoluteDateUtc,
  parseChromeReviewsPage,
  parseFirefoxReviewsPage,
  parseRelativeDateUtc,
  sanitizeReviewText,
  type StoreReview,
} from "../src/store-reviews";

const FIXTURES = join(__dirname, "fixtures/store-reviews");
const chromeHtml = readFileSync(join(FIXTURES, "cws-reviews.html"), "utf8");
const firefoxHtml = readFileSync(join(FIXTURES, "amo-reviews.html"), "utf8");
const NOW = Date.UTC(2026, 8, 20); // 2026-09-20

describe("sanitize guards", () => {
  it("strips markup, decodes entities, and clamps length", () => {
    expect(sanitizeReviewText("<b>thanks</b> broo.")).toBe("thanks broo.");
    expect(sanitizeReviewText("a &amp; b &lt;script&gt;")).toBe("a & b <script>");
    const long = sanitizeReviewText("x".repeat(900));
    expect(long.length).toBeLessThanOrEqual(600);
    expect(long.endsWith("…")).toBe(true);
  });

  it("flags the developer identity but keeps same-first-name reviewers", () => {
    expect(isDeveloperAuthored("Adham Haitham Eid")).toBe(true);
    expect(isDeveloperAuthored("adham haitham")).toBe(true);
    expect(isDeveloperAuthored("Adham Ahmed")).toBe(false);
    expect(isDeveloperAuthored("Adham 320230021")).toBe(false);
  });

  it("parses absolute and relative store dates", () => {
    expect(parseAbsoluteDateUtc("Sep 7, 2026")).toBe(Date.UTC(2026, 8, 7));
    expect(parseAbsoluteDateUtc("nope")).toBeNull();
    expect(parseRelativeDateUtc("2 months ago", NOW)).toBe(NOW - 60 * 86_400_000);
    expect(parseRelativeDateUtc("just now", NOW)).toBeNull();
  });

  it("decodes numeric and named entities without executing markup", () => {
    expect(decodeEntities("&#39;&amp;&#x27;")).toBe("'&'");
  });
});

describe("chrome reviews page parser", () => {
  const reviews = parseChromeReviewsPage(chromeHtml, NOW);

  it("extracts the newest server-rendered reviews with ratings", () => {
    expect(reviews.length).toBeGreaterThan(3);
    for (const review of reviews) {
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
      expect(review.store).toBe("chrome");
      expect(review.reviewer.length).toBeGreaterThan(0);
      expect(review.reviewUrl).toContain("chromewebstore.google.com");
    }
  });

  it("captures a known reviewer with avatar and absolute date", () => {
    const ashraful = reviews.find((r) => r.reviewer === "Ashraful Islam");
    expect(ashraful).toBeDefined();
    expect(ashraful?.rating).toBe(5);
    expect(ashraful?.text).toContain("thanks broo");
    expect(ashraful?.dateUtc).toBe(Date.UTC(2026, 8, 7));
    expect(ashraful?.avatarUrl ?? null).toMatch(/lh3\.googleusercontent\.com/);
  });

  it("never includes developer-authored entries", () => {
    for (const review of reviews) {
      expect(isDeveloperAuthored(review.reviewer)).toBe(false);
    }
  });

  it("returns empty for empty or review-less HTML", () => {
    expect(parseChromeReviewsPage("", NOW)).toEqual([]);
    expect(parseChromeReviewsPage("<html><body>nothing</body></html>", NOW)).toEqual([]);
  });
});

describe("firefox reviews page parser", () => {
  const reviews = parseFirefoxReviewsPage(firefoxHtml, NOW);

  it("extracts server-rendered reviews with permalinks and ratings", () => {
    expect(reviews.length).toBeGreaterThan(2);
    for (const review of reviews) {
      expect(review.reviewUrl).toMatch(/addons\.mozilla\.org\/.*\/reviews\/\d+\//);
      expect(review.rating).toBeGreaterThanOrEqual(1);
    }
  });

  it("captures a known reviewer with text and estimated date", () => {
    const rouby = reviews.find((r) => r.reviewer === "rouby");
    expect(rouby).toBeDefined();
    expect(rouby?.rating).toBe(5);
    expect(rouby?.dateUtc).not.toBeNull();
  });
});

describe("merge guard rails", () => {
  const base: StoreReview = {
    id: "chrome:abc", store: "chrome", reviewer: "A", rating: 5, text: "t",
    reviewUrl: "https://x", avatarUrl: null, dateText: "", dateUtc: 1,
    helpful: null, fetchedAtUtc: 1,
  };

  it("adds new, updates known, and never drops previous entries", () => {
    const prev = [base, { ...base, id: "chrome:old", reviewer: "Old", dateUtc: 5 }];
    const fresh = [{ ...base, id: "chrome:abc", text: "updated", fetchedAtUtc: 9 }, { ...base, id: "chrome:new", reviewer: "New", dateUtc: 7 }];
    const merged = mergeStoreReviews(prev, fresh);
    expect(merged.map((r) => r.id).sort()).toEqual(["chrome:abc", "chrome:new", "chrome:old"]);
    expect(merged.find((r) => r.id === "chrome:abc")?.text).toBe("updated");
  });

  it("sorts newest first and caps the payload", () => {
    const many: StoreReview[] = Array.from({ length: 30 }, (_, i) => ({ ...base, id: `c:${i}`, dateUtc: i }));
    const merged = mergeStoreReviews([], many, 10);
    expect(merged.length).toBe(10);
    expect(merged[0].id).toBe("c:29");
  });

  it("keeps everything when fresh is empty (failed scrape)", () => {
    const prev = [base];
    expect(mergeStoreReviews(prev, [])).toEqual(prev);
  });
});

describe("fetchStoreReviews", () => {
  it("aggregates per-store parses and fails soft when both sources die", async () => {
    const okResponse = (body: string) => new Response(body, { status: 200 });
    const snapshot = await fetchStoreReviews(async (url) => {
      if (String(url).includes("chromewebstore")) return okResponse(chromeHtml);
      if (String(url).includes("addons.mozilla")) return okResponse(firefoxHtml);
      return new Response("nope", { status: 500 });
    });
    expect(snapshot!.reviews.length).toBeGreaterThan(3);

    const dead = await fetchStoreReviews(async () => {
      throw new Error("down");
    });
    expect(dead).toBeNull();
  });
});
