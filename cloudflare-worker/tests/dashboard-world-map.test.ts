// filepath: tests/dashboard-world-map.test.ts
// Slice 2 commit 6: server-side country capture and the worldwide map card.
// Contract: /track count reports capture the request's country server-side
// (worker copies request.cf.country into CF-IPCountry; clients cannot choose),
// the DO aggregates per-country totals into a bounded top-100 + ZZ rest map
// that survives junk codes, and the dashboard card renders an honest zero
// state plus a populated inline-SVG choropleth keyed only on valid ISO codes.
import { describe, it, expect } from "vitest";
import { DownloadsDurable, MAX_DOWNLOAD_COUNT_COUNTRIES } from "../src/downloads_do";
import { renderDashboard } from "../src/dashboard/main";
import { WORLD_MAP_COUNTRIES } from "../src/dashboard/world-map-svg";
import type { Env } from "../src/types";
import type { DurableObjectState } from "@cloudflare/workers-types";
import type { StatsResponse } from "../src/types";

const STORAGE_KEY = "analytics_state";

class MockStorage {
  private map = new Map<string, unknown>();

  seed(key: string, value: unknown): void {
    this.map.set(key, value);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async getAlarm(): Promise<number | null> {
    return null;
  }

  async setAlarm(_ts: number): Promise<void> {}

  async deleteAlarm(): Promise<void> {}
}

class MockState {
  storage = new MockStorage();
  pending: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>) {
    this.pending.push(promise.catch(() => {}));
  }

  async drain(): Promise<void> {
    await Promise.all(this.pending);
    this.pending = [];
  }
}

function makeDO(seed?: Record<string, unknown>) {
  const state = new MockState();
  if (seed) state.storage.seed(STORAGE_KEY, seed);
  const env: Env = {
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
  } as Env;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

async function postReport(
  obj: DownloadsDurable,
  body: Record<string, unknown>,
  country?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "CF-Connecting-IP": `203.0.113.${Math.floor(Math.random() * 250) + 1}`,
  };
  if (country !== undefined) headers["CF-IPCountry"] = country;
  const res = await obj.fetch(
    new Request("http://do/track", { method: "POST", headers, body: JSON.stringify(body) }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function getStats(obj: DownloadsDurable): Promise<Record<string, unknown>> {
  const res = await obj.fetch(new Request("http://do/stats", { method: "GET" }));
  return (await res.json()) as Record<string, unknown>;
}

function aggregatesOf(stats: Record<string, unknown>): Record<string, unknown> {
  return stats.downloadCountAggregates as Record<string, unknown>;
}

function countReport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    installId: "install-1",
    lifetimeCount: 1000,
    browser: "chrome",
    clientBatchId: `dlc-${Math.random()}`,
    ...overrides,
  };
}

function makeStats(overrides: Partial<StatsResponse> = {}): StatsResponse {
  return {
    ok: true,
    totalEvents: 0,
    totalDownloads: 0,
    totalSuccess: 0,
    totalFail: 0,
    totalCancelled: 0,
    pendingEvents: 0,
    lastEventAt: null,
    lastFlushAt: null,
    counters: {
      byStatus: {},
      byType: {},
      byBrowser: {},
      byOs: {},
      byExtVersion: {},
      byLanguage: {},
      byCountry: {},
      byErrorType: {},
    },
    retryState: null,
    quota: {
      requestsToday: 0,
      quotaLevel: "BELOW_LIMITS",
      modeLabel: "chill",
      remoteEnabled: true,
      batchSizeSuggestion: 50,
    },
    envSnapshot: { maxBatchEvents: "10000", oracleEndpoint: "" },
    requestsToday: 0,
    requestDate: "2026-10-09",
    uniqueRequestsToday: 0,
    uniqueIpsToday: 0,
    isApproximated: false,
    remoteConfig: {
      batchSize: 50,
      maxDailyRequests: 50,
      maxRetry: 20,
      maxEventsPerRequest: 5000,
      maxBufferSize: 50000,
      flushMode: "weekly",
      timeFlushMinutes: { low: 1440, mid: 1440, high: 1440 },
      dailyFlushWindowStartUtc: 0,
      dailyFlushWindowMinutes: 120,
      configVersion: 2,
      cancelHoldDelayMs: 1000,
      allowLegacyEvents: true,
      remoteEnabledReason: "ok",
      hardRemoteOff: false,
    },
    bufferStatus: { currentSize: 0, maxSize: 50000, utilizationPercent: "0.00" },
    nextAlarmAt: null,
    changelog: [],
    changelogConfig: { rules: [] },
    ...overrides,
  };
}

describe("server-side country capture (commit 6)", () => {
  it("captures the CF-IPCountry header on accepted count reports", async () => {
    const { obj } = makeDO();
    const { status } = await postReport(obj, countReport(), "DE");
    expect(status).toBe(200);
    const byCountry = aggregatesOf(await getStats(obj)).byCountry as Record<string, number>;
    expect(byCountry.DE).toBe(1000);
  });

  it("normalizes case and folds unknown/junk codes into the ZZ rest bucket", async () => {
    const { obj } = makeDO();
    await postReport(obj, countReport({ installId: "a", lifetimeCount: 10 }), "de");
    await postReport(obj, countReport({ installId: "b", lifetimeCount: 20 }), "XX");
    await postReport(obj, countReport({ installId: "c", lifetimeCount: 30 }), "BRA");
    await postReport(obj, countReport({ installId: "d", lifetimeCount: 40 }), "12");
    await postReport(obj, countReport({ installId: "e", lifetimeCount: 50 }), "");
    const byCountry = aggregatesOf(await getStats(obj)).byCountry as Record<string, number>;
    expect(byCountry.DE).toBe(10);
    expect(byCountry.ZZ).toBe(140); // XX + BRA + 12 + "" all fold into the rest bucket
    expect(Object.keys(byCountry).every((cc) => /^[A-Z]{2}$/.test(cc))).toBe(true);
  });

  it("does not double-count countries on replayed clientBatchIds", async () => {
    const { obj } = makeDO();
    const report = countReport({ clientBatchId: "dlc-fixed" });
    await postReport(obj, report, "US");
    await postReport(obj, report, "US");
    const byCountry = aggregatesOf(await getStats(obj)).byCountry as Record<string, number>;
    expect(byCountry.US).toBe(1000);
  });

  it("drops countries from cap-refused reports (only accepted reports count)", async () => {
    const { obj } = makeDO();
    // Refused shape: negative count is rejected before any state change.
    const { status } = await postReport(
      obj,
      countReport({ lifetimeCount: -5 }),
      "FR",
    );
    expect(status).toBe(400);
    const byCountry = aggregatesOf(await getStats(obj)).byCountry as Record<string, number>;
    expect(byCountry.FR).toBeUndefined();
  });
});

describe("per-country aggregation bounds (commit 6)", () => {
  it("keeps at most the top 100 named countries plus the ZZ rest bucket", async () => {
    const { obj } = makeDO();
    const codes: string[] = [];
    // 120 distinct valid-looking codes (real range + user-assigned range).
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; codes.length < 120; i++) {
      const cc = `${letters[i % 26]}${letters[Math.floor(i / 26) % 26]}`;
      codes.push(cc);
    }
    for (let i = 0; i < codes.length; i++) {
      const { status } = await postReport(
        obj,
        countReport({ installId: `i-${i}`, lifetimeCount: codes.length - i }),
        codes[i],
      );
      expect(status).toBe(200);
    }
    const byCountry = aggregatesOf(await getStats(obj)).byCountry as Record<string, number>;
    expect(Object.keys(byCountry).length).toBeLessThanOrEqual(MAX_DOWNLOAD_COUNT_COUNTRIES + 1);
    // Every surviving key is a valid ISO-shaped code, ZZ carries the overflow.
    for (const cc of Object.keys(byCountry)) {
      expect(cc).toMatch(/^[A-Z]{2}$/);
    }
    expect(byCountry.ZZ).toBeGreaterThan(0);
    // Highest-count country survives the collapse intact.
    expect(byCountry[codes[0]]).toBe(codes.length);
  });

  it("coerces stored per-country state and drops junk rows on load", async () => {
    const { obj } = makeDO({
      downloadCountsByCountry: { DE: 7, us: 9, BRA: 5, XX: 3, bad: 1 },
    });
    const byCountry = aggregatesOf(await getStats(obj)).byCountry as Record<string, number>;
    // "us" normalizes to US; 3-letter, XX, and non-code keys are dropped.
    expect(byCountry).toEqual({ DE: 7, US: 9 });
  });
});

describe("worldwide map card render (commit 6)", () => {
  it("renders an honest zero state with no colored buckets", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('data-zero-state="world-map"');
    expect(html).toContain("No reports yet — reporting is disabled.");
    expect(html).toContain('id="worldwide-map-svg"');
    // Every path sits at the base fill; the list stays hidden.
    expect(html).not.toContain('fill="#1e3a68"');
    expect(/id="worldwide-map-list"[^>]*hidden/.test(html)).toBe(true);
  });

  it("renders the populated choropleth and top-countries list", () => {
    const html = renderDashboard(
      makeStats({
        downloadCountAggregates: {
          total: 9410,
          installs: 2,
          byBrowser: { chrome: 9000, firefox: 410 },
          reportsProcessed: 3,
          byCountry: { US: 9000, DE: 400, ZZ: 10 },
        },
      }),
    );
    // Max-count country gets the brightest bucket; mid-count gets the darkest.
    expect(html).toContain('fill="#8fb6f9" data-cc="US"');
    expect(html).toContain('fill="#1e3a68" data-cc="DE"');
    // Top list: names come from Intl (fallback to the raw code), ZZ = Other.
    expect(html).toContain("Other");
    expect(/United States|<span class="wmap-name">US<\/span>/.test(html)).toBe(true);
    // The server-side zero-state div is gone (the client JS selector remains).
    expect(html).not.toContain(
      '<div class="metric-sub" data-zero-state="world-map">',
    );
  });

  it("keys SVG paths on valid ISO 3166-1 alpha-2 codes only", () => {
    const html = renderDashboard(
      makeStats({
        downloadCountAggregates: {
          total: 5,
          installs: 1,
          byBrowser: { chrome: 5 },
          reportsProcessed: 1,
          byCountry: { US: 5 },
        },
      }),
    );
    // Path-level data-cc only (the top list uses the same attribute).
    const ccs = [...html.matchAll(/<path d="[^"]*" fill="[^"]*" data-cc="([^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(ccs.length).toBe(Object.keys(WORLD_MAP_COUNTRIES).length);
    for (const cc of ccs) {
      expect(cc).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("updates the map from live pushes via DOM nodes, not dynamic innerHTML", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain("function updateWorldwideMap(rawByCountry)");
    expect(html).toContain("normalizeWorldMapDataJS(rawByCountry)");
    // The list rebuild path uses createElement/textContent; no innerHTML there.
    expect(html).not.toContain("list.innerHTML");
    // Same fill buckets server and client.
    expect(html).toContain('"#1e3a68", "#27509c", "#3366cc", "#5c8ef2", "#8fb6f9"');
  });
});
