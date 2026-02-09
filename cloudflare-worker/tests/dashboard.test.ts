import { describe, it, expect } from "vitest";
import { renderDashboard } from "../src/dashboard/main";
import type { StatsResponse } from "../src/types";

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
    envSnapshot: {
      maxBatchEvents: "10000",
      oracleEndpoint: "http://example.com",
    },
    requestsToday: 0,
    requestDate: "2026-02-09",
    uniqueRequestsToday: 0,
    uniqueIpsToday: 0,
    isApproximated: false,
    remoteConfig: {
      batchSize: 50,
      maxDailyRequests: 50,
      maxRetry: 5,
      maxEventsPerRequest: 5000,
      maxBufferSize: 50000,
      flushMode: "next_day",
      timeFlushMinutes: { low: 1440, mid: 1440, high: 1440 },
      dailyFlushWindowStartUtc: 1,
      dailyFlushWindowMinutes: 120,
      configVersion: 2,
      cancelHoldDelayMs: 1000,
      allowLegacyEvents: true,
      remoteEnabledReason: "ok",
      hardRemoteOff: false,
    },
    bufferStatus: {
      currentSize: 0,
      maxSize: 50000,
      utilizationPercent: "0.00",
    },
    nextAlarmAt: null,
    changelog: [],
    changelogConfig: { rules: [] },
    ...overrides,
  };
}

describe("Dashboard legacy toggle UI", () => {
  it("renders the legacy toggle as enabled when allowLegacyEvents is true", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="cfg-allow-legacy"');
    expect(/id="cfg-allow-legacy"[^>]*checked/.test(html)).toBe(true);
    expect(html).toContain("Enabled — missing event IDs will be auto-assigned.");
  });

  it("renders the legacy toggle as disabled when allowLegacyEvents is false", () => {
    const html = renderDashboard(makeStats({
      remoteConfig: {
        batchSize: 50,
        maxDailyRequests: 50,
        maxRetry: 5,
        maxEventsPerRequest: 5000,
        maxBufferSize: 50000,
        flushMode: "next_day",
        timeFlushMinutes: { low: 1440, mid: 1440, high: 1440 },
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        configVersion: 2,
        cancelHoldDelayMs: 1000,
        allowLegacyEvents: false,
        remoteEnabledReason: "ok",
        hardRemoteOff: false,
      },
    }));
    expect(/id="cfg-allow-legacy"[^>]*checked/.test(html)).toBe(false);
    expect(html).toContain("Disabled — events without IDs will be rejected.");
  });
});

describe("Dashboard pipeline health UI", () => {
  it("renders the pipeline health card and raw payload block", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="pipeline-health"');
    expect(html).toContain('id="pipeline-health-chip"');
    expect(html).toContain('id="raw-health-json"');
    expect(html).toContain('id="pipeline-health-last-alert"');
  });
});
