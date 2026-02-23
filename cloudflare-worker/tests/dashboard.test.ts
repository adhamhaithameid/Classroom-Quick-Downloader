import { describe, it, expect } from "vitest";
import { renderDashboard, renderLoginPage as renderMainLoginPage } from "../src/dashboard/main";
import { renderLoginPage as renderSimpleLoginPage } from "../src/dashboard/login";
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
      oracleEndpoint: "https://example.com",
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
    expect(html).toContain('id="cfg-health-notify-warn"');
    expect(html).toContain('id="cfg-health-notify-critical"');
  });

  it("uses minute-based conversions for health notify intervals", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain("function msToMinutes");
    expect(html).toContain("readMinutesMs(\"cfg-health-notify-warn\"");
    expect(html).toContain("msToMinutes(merged.healthNotifyIntervalsMs.warn");
  });
});

describe("Dashboard website sync UI", () => {
  it("renders website sync controls in the data hub", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="btn-website-status-refresh"');
    expect(html).toContain('id="btn-website-flush-now"');
    expect(html).toContain('id="btn-website-refresh-toggle"');
    expect(html).toContain('id="btn-website-override-save"');
    expect(html).toContain('id="website-admin-output"');
  });
});

describe("Dashboard login rendering", () => {
  it("escapes injected login error content in the full dashboard template", () => {
    const html = renderMainLoginPage(`<img src=x onerror=alert("xss")>`);
    expect(html).toContain("&lt;img src=x onerror=alert(&quot;xss&quot;)&gt;");
    expect(html).not.toContain(`<img src=x onerror=alert("xss")>`);
    expect(html).toContain("</form>");
  });

  it("escapes injected login error content in the lightweight login template", () => {
    const html = renderSimpleLoginPage(`<img src=x onerror=alert("xss")>`);
    expect(html).toContain("&lt;img src=x onerror=alert(&quot;xss&quot;)&gt;");
    expect(html).not.toContain(`<img src=x onerror=alert("xss")>`);
    expect(html).toContain("</form>");
  });
});

describe("Dashboard security rendering", () => {
  it("escapes changelog fields and script-embedded config JSON", () => {
    const stats = makeStats({
      changelog: [
        {
          id: `rel-1"><img src=x onerror=alert(1)>`,
          version: `1.0.0"><script>alert("v")</script>`,
          date: "2026-02-11",
          changes: [`<script>alert('xss')</script>`],
        },
      ],
      changelogConfig: {
        rules: [
          {
            id: "rule-1",
            target: "</script><script>alert(1)</script>",
            priority: "normal",
            effect: "none",
          },
        ],
      },
    });

    const html = renderDashboard(stats);

    expect(html).not.toContain(`<script>alert('xss')</script>`);
    expect(html).not.toContain(`</script><script>alert(1)</script>`);
    expect(html).not.toContain(`data-release-id="rel-1"><img src=x onerror=alert(1)>"`);

    expect(html).toContain("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    expect(html).toContain("\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e");
    expect(html).toContain("data-release-id=\"rel-1&quot;&gt;&lt;img src=x onerror=alert(1)&gt;\"");
  });
});
