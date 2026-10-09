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

  it("does not render weekly or monthly events rows in quota usage", () => {
    const html = renderDashboard(makeStats());
    expect(html).not.toContain("Weekly Events");
    expect(html).not.toContain("Monthly Events");
    expect(html).not.toContain('data-bind="weeklyEvents"');
    expect(html).not.toContain('data-bind="monthlyEvents"');
  });
});

describe("Dashboard website console CTA", () => {
  it("renders giant link to the dedicated website data console", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain("Open Website Data Console");
    expect(html).toContain('href="/dashboard/website"');
  });

  it("removes legacy release and notification nav entries", () => {
    const html = renderDashboard(makeStats());
    expect(html).not.toContain('href="#config"');
    expect(html).not.toContain('href="#release"');
    expect(html).not.toContain("Notifications");
    expect(html).not.toContain("Releases");
  });

  it("renders canonical external links in the dashboard shell", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('href="https://classroom-quick-downloader.adhamhaithameid.is-a.dev/"');
    expect(html).toContain('href="https://github.com/adhamhaithameid/Classroom-Quick-Downloader"');
    expect(html).toContain(
      'href="https://github.com/adhamhaithameid/Classroom-Quick-Downloader/tree/main/backups/latest"',
    );
  });
});

describe("Dashboard country label tooltips", () => {
  it("adds human-readable country names for ISO-2 country codes on hover", () => {
    const html = renderDashboard(
      makeStats({
        counters: {
          byStatus: {},
          byType: {},
          byBrowser: {},
          byOs: {},
          byExtVersion: {},
          byLanguage: {},
          byCountry: { EG: 12 },
          byErrorType: {},
        },
      })
    );
    expect(html).toContain('data-tooltip="Egypt"');
    expect(html).toContain(">EG<");
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

  it("renders key login page elements properly", () => {
    const html = renderSimpleLoginPage();
    expect(html).toContain('class="login-card"');
    expect(html).toContain('id="password-input"');
    expect(html).toContain('type="password"');
    expect(html).toContain("CQD Analytics Admin");
    expect(html).not.toContain('class="login-error"');
  });

  it("conditionally renders the error block if errorMessage is provided", () => {
    const html = renderSimpleLoginPage("Invalid password");
    expect(html).toContain('class="login-error"');
    expect(html).toContain("Invalid password");
  });
});

describe("Dashboard security rendering", () => {
  it("escapes changelog fields inside embedded raw stats JSON", () => {
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
    expect(html).not.toContain(`<img src=x onerror=alert(1)>`);

    expect(html).toContain("&lt;script&gt;alert('xss')&lt;/script&gt;");
    expect(html).toContain("&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("Dashboard tabbed navigation", () => {
  it("renders an accessible tablist with a tab and panel per section", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Dashboard sections"');

    const tabIds = [
      "overview",
      "breakdown",
      "system",
      "quota",
      "remote-config",
      "debug",
      "raw",
      "security",
      "datahub",
      "danger",
    ];
    for (const id of tabIds) {
      expect(html).toContain(`id="tab-${id}"`);
      expect(html).toContain(`id="panel-${id}"`);
      expect(html).toContain(`aria-controls="panel-${id}"`);
      expect(html).toContain(`aria-labelledby="tab-${id}"`);
    }
    expect((html.match(/role="tab"/g) || []).length).toBe(tabIds.length);
    expect((html.match(/role="tabpanel"/g) || []).length).toBe(tabIds.length);
    // Roving tabindex: exactly one focusable tab at render time.
    expect((html.match(/tabindex="0"/g) || []).length).toBe(1);
  });

  it("keeps overview as the default active tab and marks the rest hidden", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="tab-overview"');
    expect(/id="tab-overview"[^>]*aria-selected="true"/.test(html)).toBe(true);
    expect(/id="panel-overview"[^>]*(\s|)hidden/.test(html)).toBe(false);
    expect(/id="panel-danger"[^>]*hidden/.test(html)).toBe(true);
  });

  it("keeps existing section anchors inside their panels for deep links", () => {
    const html = renderDashboard(makeStats());
    // pipeline-health lives inside the overview panel; raw-pipeline-health in raw.
    const overviewPanel = html.slice(
      html.indexOf('id="panel-overview"'),
      html.indexOf('id="panel-breakdown"'),
    );
    expect(overviewPanel).toContain('id="pipeline-health"');
    const rawPanel = html.slice(
      html.indexOf('id="panel-raw"'),
      html.indexOf('id="panel-security"'),
    );
    expect(rawPanel).toContain('id="raw-pipeline-health"');
  });

  it("drops the old sidebar and hamburger markup", () => {
    const html = renderDashboard(makeStats());
    expect(html).not.toContain("sidebar-nav");
    expect(html).not.toContain("hamburger-btn");
    expect(html).not.toContain("sidebar-overlay");
    expect(html).not.toContain("nav-item");
  });

  it("wires keyboard operability and hash persistence in the client script", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain("hashchange");
    expect(html).toContain("history.replaceState");
    expect(html).toContain("'ArrowRight'");
    expect(html).toContain("'ArrowLeft'");
    expect(html).toContain("'Home'");
    expect(html).toContain("'End'");
    expect(html).toContain("focus-visible");
  });
});

describe("Dashboard card search", () => {
  it("renders the search box with data-* filter hooks and the empty state", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="card-search"');
    expect(html).toContain("data-card-search");
    expect(html).toContain('data-search-empty');
    expect(html).toContain('id="search-empty"');
    expect(html).toContain("No cards match your search");
  });

  it("marks every filterable card with data-card", () => {
    const html = renderDashboard(makeStats());
    const count = (html.match(/data-card>/g) || []).length;
    expect(count).toBe(13);
    for (const id of ["overview", "pipeline-health", "breakdown", "raw-pipeline-health", "danger"]) {
      expect(html).toContain(`id="${id}" data-card>`);
    }
  });

  it("debounces search input at ~150ms and searches card text client-side", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain("setTimeout(applyCardSearch, 150)");
    expect(html).toContain("main section[data-card]");
    expect(html).toContain("body.classList.toggle('searching'");
  });
});
