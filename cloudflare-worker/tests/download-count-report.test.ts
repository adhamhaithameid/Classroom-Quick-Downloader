// filepath: tests/download-count-report.test.ts
/**
 * 1.9.0: DORMANT per-install download-count reports (riding /track's
 * count-report shape). Contract: idempotent per clientBatchId (same id twice
 * = one change), monotonic max guard (replays/downgrades never lower a
 * count), aggregate totals + per-browser split on /stats, and the dashboard
 * card renders both zero and populated states.
 */
import { describe, it, expect } from "vitest";
import { DownloadsDurable, MAX_DOWNLOAD_COUNT_INSTALLS } from "../src/downloads_do";
import { renderDashboard } from "../src/dashboard/main";
import type { Env } from "../src/types";
import type { DurableObjectState } from "@cloudflare/workers-types";
import type { StatsResponse } from "../src/types";

const STORAGE_KEY = "analytics_state";

// MockStorage/MockState copied from tests/quota-guard.test.ts.
class MockStorage {
  private map = new Map<string, unknown>();
  private alarm: number | null = null;

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
    return this.alarm;
  }

  async setAlarm(ts: number): Promise<void> {
    this.alarm = ts;
  }

  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
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

function makeDO() {
  const state = new MockState();
  const env: Env = {
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
  } as Env;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

function countReport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    installId: "install-1",
    lifetimeCount: 1000,
    browser: "chrome",
    clientBatchId: "dlc-install-1-1000",
    ...overrides,
  });
}

async function postReport(
  obj: DownloadsDurable,
  body: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await obj.fetch(new Request("http://do/track", { method: "POST", body }));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function getStats(obj: DownloadsDurable): Promise<Record<string, unknown>> {
  const res = await obj.fetch(new Request("http://do/stats", { method: "GET" }));
  return (await res.json()) as Record<string, unknown>;
}

describe("download-count reports (1.9.0, dormant)", () => {
  it("accepts a count report and exposes the aggregate on /stats", async () => {
    const { obj } = makeDO();
    const { status, body } = await postReport(obj, countReport());
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.count).toBe(1000);

    const stats = await getStats(obj);
    const agg = stats.downloadCountAggregates as Record<string, unknown>;
    expect(agg.total).toBe(1000);
    expect(agg.installs).toBe(1);
    expect(agg.byBrowser).toEqual({ chrome: 1000 });
    expect(agg.reportsProcessed).toBe(1);
  });

  it("is idempotent: the same clientBatchId twice = one change", async () => {
    const { obj } = makeDO();
    await postReport(obj, countReport());
    const second = await postReport(obj, countReport());
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    const stats = await getStats(obj);
    const agg = stats.downloadCountAggregates as Record<string, unknown>;
    expect(agg.total).toBe(1000);
    expect(agg.reportsProcessed).toBe(1);
  });

  it("applies the monotonic max guard: downgrades never lower a count", async () => {
    const { obj } = makeDO();
    await postReport(obj, countReport({ lifetimeCount: 5000, clientBatchId: "dlc-a-5000" }));
    const downgrade = await postReport(
      obj,
      countReport({ lifetimeCount: 300, clientBatchId: "dlc-b-300" }),
    );
    expect(downgrade.body.count).toBe(5000);
    expect(downgrade.body.monotonicGuard).toBe(true);

    const stats = await getStats(obj);
    const agg = stats.downloadCountAggregates as Record<string, unknown>;
    expect(agg.total).toBe(5000);
  });

  it("raises a count when a newer report is higher", async () => {
    const { obj } = makeDO();
    await postReport(obj, countReport({ lifetimeCount: 100, clientBatchId: "dlc-a-100" }));
    const raised = await postReport(
      obj,
      countReport({ lifetimeCount: 150, clientBatchId: "dlc-a-150" }),
    );
    expect(raised.body.count).toBe(150);
    expect(raised.body.monotonicGuard).toBe(false);
  });

  it("sums across installs and splits by browser", async () => {
    const { obj } = makeDO();
    await postReport(obj, countReport());
    await postReport(
      obj,
      countReport({ installId: "install-2", lifetimeCount: 250, browser: "firefox", clientBatchId: "dlc-install-2-250" }),
    );
    await postReport(
      obj,
      countReport({ installId: "install-3", lifetimeCount: 50, browser: "Chrome", clientBatchId: "dlc-install-3-50" }),
    );
    const stats = await getStats(obj);
    const agg = stats.downloadCountAggregates as Record<string, unknown>;
    expect(agg.total).toBe(1300);
    expect(agg.installs).toBe(3);
    expect(agg.byBrowser).toEqual({ chrome: 1050, firefox: 250 });
  });

  it("rejects malformed reports without poisoning the counters", async () => {
    const { obj } = makeDO();
    const bad = await postReport(
      obj,
      JSON.stringify({ installId: "", lifetimeCount: -5, clientBatchId: "x" }),
    );
    expect(bad.status).toBe(400);
    const stats = await getStats(obj);
    const agg = stats.downloadCountAggregates as Record<string, unknown>;
    expect(agg.total).toBe(0);
  });

  it("leaves the classic /track event pipeline untouched", async () => {
    const { obj } = makeDO();
    const ev = {
      status: "success",
      file_type: "pdf",
      browser: "chrome",
      os: "mac",
      ext_version: "1.9.0",
      duration_ms: 10,
      bypass_used: false,
      language: "en",
      timestamp: Date.now(),
      id: "ev-1",
    };
    const res = await obj.fetch(
      new Request("http://do/track", {
        method: "POST",
        body: JSON.stringify({ events: [ev], clientBatchId: "batch-1" }),
      }),
    );
    // 202 Accepted is the event pipeline's normal success status.
    expect(res.status).toBe(202);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });
});

describe("download-count map cap (1.9.0, fix round 1)", () => {
  function makeSeededDO(downloadCounts: Record<string, Record<string, unknown>>) {
    const state = new MockState();
    state.storage.seed(STORAGE_KEY, { downloadCounts });
    const env: Env = {
      DO_SHARED_SECRET: "secret",
      MAX_BATCH_EVENTS: "10000",
    } as Env;
    const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
    return { obj };
  }

  it("caps unknown installs; known installs still update at the cap", async () => {
    // Prefill the map to the cap: 50k installs x 10 downloads each.
    const downloadCounts: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < MAX_DOWNLOAD_COUNT_INSTALLS; i++) {
      downloadCounts[`inst-${i}`] = { count: 10, browser: "chrome", updatedAt: 0 };
    }
    const { obj } = makeSeededDO(downloadCounts);

    // Unknown install at cap: dropped, counter incremented, totals unchanged.
    const dropped = await postReport(
      obj,
      countReport({ installId: "brand-new", lifetimeCount: 999, clientBatchId: "dlc-brand-new-999" }),
    );
    expect(dropped.status).toBe(200);
    expect(dropped.body.ok).toBe(true);
    expect(dropped.body.dropped).toBe(true);

    let stats = await getStats(obj);
    let agg = stats.downloadCountAggregates as Record<string, unknown>;
    expect(agg.total).toBe(MAX_DOWNLOAD_COUNT_INSTALLS * 10);
    expect(agg.installs).toBe(MAX_DOWNLOAD_COUNT_INSTALLS);
    expect(agg.dropped).toBe(1);

    // Known install at cap: the update is still accepted (monotonic max).
    const known = await postReport(
      obj,
      countReport({ installId: "inst-0", lifetimeCount: 99, clientBatchId: "dlc-inst-0-99" }),
    );
    expect(known.status).toBe(200);
    expect(known.body.dropped).toBeUndefined();
    expect(known.body.count).toBe(99);

    stats = await getStats(obj);
    agg = stats.downloadCountAggregates as Record<string, unknown>;
    expect(agg.total).toBe(MAX_DOWNLOAD_COUNT_INSTALLS * 10 - 10 + 99);
    expect(agg.dropped).toBe(1);
  });

  it("a replayed dropped report is idempotent and does not double-count drops", async () => {
    const downloadCounts: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < MAX_DOWNLOAD_COUNT_INSTALLS; i++) {
      downloadCounts[`inst-${i}`] = { count: 10, browser: "chrome", updatedAt: 0 };
    }
    const { obj } = makeSeededDO(downloadCounts);

    await postReport(
      obj,
      countReport({ installId: "brand-new", lifetimeCount: 999, clientBatchId: "dlc-brand-new-999" }),
    );
    const replay = await postReport(
      obj,
      countReport({ installId: "brand-new", lifetimeCount: 999, clientBatchId: "dlc-brand-new-999" }),
    );
    expect(replay.body.duplicate).toBe(true);

    const stats = await getStats(obj);
    const agg = stats.downloadCountAggregates as Record<string, unknown>;
    expect(agg.dropped).toBe(1);
  });
});

describe("dashboard lifetime-downloads card (1.9.0)", () => {
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
      envSnapshot: { maxBatchEvents: "10000" },
      requestsToday: 0,
      requestDate: "2026-10-09",
      uniqueRequestsToday: 0,
      uniqueIpsToday: 0,
      isApproximated: false,
      remoteConfig: { hardRemoteOff: false },
      bufferStatus: { currentSize: 0, maxSize: 50000, utilizationPercent: "0.00" },
      nextAlarmAt: null,
      changelog: [],
      changelogConfig: {
        applyMode: "manual",
        autoSyncEnabled: false,
        autoSyncIntervalMinutes: 60,
        lastAutoSyncStatus: "idle",
      },
      ...overrides,
    } as StatsResponse;
  }

  it("renders the zero state when no aggregate exists", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="card-lifetime-downloads"');
    expect(html).toContain("No count reports yet");
  });

  it("renders the total, install count, and per-browser split", () => {
    const html = renderDashboard(
      makeStats({
        downloadCountAggregates: {
          total: 1300,
          installs: 3,
          byBrowser: { chrome: 1050, firefox: 250 },
          reportsProcessed: 3,
        },
      }),
    );
    expect(html).toContain('id="card-lifetime-downloads"');
    expect(html).toContain("1,300");
    expect(html).toContain("across 3 installs");
    expect(html).toContain("chrome: 1,050");
    expect(html).toContain("firefox: 250");
  });
});
