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
    expect(html).not.toContain("Releases");
    // The legacy sidebar had Release Publishing / Notification Styling
    // entries; they must not come back as nav targets. The new
    // Notifications tab is a different, intentional feature.
    expect(html).not.toContain('data-section="release"');
    expect(html).not.toContain('data-section="config"');
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
      "notifications",
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
    // 14 base cards + uptime + worldwide-activity + downloads-by-browser
    // + notifications + live-updates + worldwide-map + recent-errors (1ef6).
    expect(count).toBe(20);
    for (const id of [
      "overview",
      "error-rollup",
      "pipeline-health",
      "uptime",
      "worldwide-activity",
      "live-updates",
      "worldwide-map",
      "breakdown",
      "downloads-by-browser",
      "raw-pipeline-health",
      "danger",
    ]) {
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

describe("Dashboard uptime card", () => {
  it("renders an honest zero state before the first check", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="uptime"');
    expect(html).toContain("First check pending");
    expect(html).toContain("No checks recorded");
    expect(html).toContain("/uptime-ping");
  });

  it("renders 24h and 7d uptime plus last check when populated", () => {
    const html = renderDashboard(makeStats(), undefined, {
      uptime: {
        lastCheck: { timestamp: 1770000000000, ok: false, latencyMs: 812 },
        uptime24h: 99.3,
        uptime7d: 98.7,
        checks24h: 288,
        checks7d: 1679,
        consecutiveFailures: 2,
      },
    });
    expect(html).toContain("99.3%");
    expect(html).toContain("98.7%");
    expect(html).toContain("288 checks");
    expect(html).toContain("1679 checks");
    expect(html).toContain("consecutive failures: 2");
    expect(html).toContain("fail");
  });

  it("embeds the shared admin JSON island with the uptime bundle", () => {
    const html = renderDashboard(makeStats(), "nonce123", {
      uptime: { uptime24h: 100, uptime7d: null, checks24h: 1, checks7d: 0, consecutiveFailures: 0, lastCheck: null },
      generatedAt: 1770000000000,
    });
    expect(html).toContain('window.ADMIN_DATA = {"uptime":{"uptime24h":100,"uptime7d":null,"checks24h":1,"checks7d":0,"consecutiveFailures":0,"lastCheck":null},"generatedAt":1770000000000};');
  });

  it("escapes script-breaking characters in the admin JSON island", () => {
    const html = renderDashboard(makeStats(), "nonce123<script>", { generatedAt: 1 });
    expect(html).toContain("window.ADMIN_DATA");
    expect(html).not.toContain("nonce123<script>");
  });
});

describe("Dashboard downloads-by-browser card", () => {
  it("renders an honest zero state while reporting is disabled", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="downloads-by-browser"');
    expect(html).toContain("No reports yet — reporting is disabled");
    expect(html).toContain("Manual check");
    expect(html).toContain("chromewebstore.google.com");
    expect(html).toContain("microsoftedge.microsoft.com");
    expect(html).toContain("via Mozilla API");
  });

  it("renders per-browser counts plus Firefox users from the AMO cache", () => {
    const html = renderDashboard(
      makeStats({
        downloadCountAggregates: {
          total: 1500,
          installs: 2,
          byBrowser: { chrome: 900, firefox: 600 },
          reportsProcessed: 2,
          recentReports: [],
        },
      }),
      undefined,
      { amoUsers: { firefoxUsers: 1234, fetchedAtUtc: 1770000000000 } },
    );
    expect(html).toContain("900");
    expect(html).toContain("600");
    expect(html).toContain("1,500 reported downloads from 2 installs");
    expect(html).toContain("1,234 users (Mozilla API)");
  });

  it("renders Firefox users as n/a when the AMO cache is empty", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain("n/a (Mozilla API)");
  });
});

describe("Dashboard worldwide activity card", () => {
  it("renders an honest zero state before any report arrives", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="worldwide-activity"');
    expect(html).toContain("No reports yet — reporting is disabled");
  });

  it("lists recent count reports newest first with escaped browser names", () => {
    const html = renderDashboard(
      makeStats({
        downloadCountAggregates: {
          total: 200,
          installs: 2,
          byBrowser: { firefox: 200 },
          reportsProcessed: 2,
          recentReports: [
            { ts: 1770000000000, count: 150, browser: "firefox" },
            { ts: 1770000060000, count: 50 },
          ],
        },
      }),
    );
    expect(html).toContain('id="worldwide-activity"');
    expect(html).toContain("<td>150</td>");
    expect(html).toContain("<td>50</td>");
    expect(html).toContain("firefox");
    // Newest first: the newer 50-count report lists above the 150 one.
    const firefoxIdx = html.indexOf("<td>150</td>");
    const fiftyIdx = html.indexOf("<td>50</td>");
    expect(fiftyIdx).toBeGreaterThan(0);
    expect(firefoxIdx).toBeGreaterThan(fiftyIdx);
  });

  it("escapes hostile browser strings in report rows", () => {
    const html = renderDashboard(
      makeStats({
        downloadCountAggregates: {
          total: 5,
          installs: 1,
          byBrowser: {},
          reportsProcessed: 1,
          recentReports: [{ ts: 1770000000000, count: 5, browser: 'chrome"><script>alert(1)</script>' }],
        },
      }),
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain("chrome&quot;&gt;&lt;script&gt;");
  });
});

describe("Dashboard notifications tab", () => {
  it("renders the notifications tab, panel, and all-clear state by default", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain('id="tab-notifications"');
    expect(html).toContain('id="panel-notifications"');
    expect(html).toContain("All clear — no active notifications");
    expect(html).not.toContain("data-notification-count");
  });

  it("renders notification items with severity chips and dismiss buttons", () => {
    const html = renderDashboard(makeStats(), undefined, {
      notifications: {
        visible: [
          { id: "scrape:chrome", severity: "warn", title: "Store scrape failing: chrome", detail: "consecutive_failures_3" },
          { id: "quota:requests-95", severity: "critical", title: "Request quota nearly exhausted", detail: "96,000 of 100,000 daily requests used (>= 95%)." },
        ],
        dismissedIds: ["uptime:last-check"],
      },
    });
    expect(html).toContain('data-notification-count>2</span>');
    expect(html).toContain('data-notification-id="scrape:chrome"');
    expect(html).toContain('data-notification-id="quota:requests-95"');
    expect(html).toContain('data-dismiss-notification="scrape:chrome"');
    expect(html).toContain("critical");
    expect(html).toContain("1 dismissed");
    expect(html).toContain('id="notif-reset"');
    // The dismissed id is not rendered as a visible item.
    expect(html).not.toContain('data-notification-id="uptime:last-check"');
  });

  it("escapes hostile notification fields", () => {
    const html = renderDashboard(makeStats(), undefined, {
      notifications: {
        visible: [
          { id: "scrape:x", severity: "warn", title: '"><script>alert(1)</script>', detail: "<img src=x onerror=alert(2)>" },
        ],
        dismissedIds: [],
      },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(2)>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("wires dismiss + reset client handlers", () => {
    const html = renderDashboard(makeStats());
    expect(html).toContain("'/admin/notifications/dismiss'");
    expect(html).toContain("'/admin/notifications/reset'");
  });
});

describe("Dashboard uptime card colors", () => {
  function cardSlice(html: string, id: string): string {
    const start = html.indexOf(`id="${id}"`);
    return html.slice(start, start + 400);
  }

  it("colors 24h/7d green at 99% or above", () => {
    const html = renderDashboard(makeStats(), undefined, {
      uptime: { lastCheck: { timestamp: 1, ok: true, latencyMs: 10 }, uptime24h: 99.5, uptime7d: 99.9, checks24h: 288, checks7d: 100, consecutiveFailures: 0 },
    });
    expect(cardSlice(html, "uptime-24h")).toContain("var(--success)");
    expect(cardSlice(html, "uptime-7d")).toContain("var(--success)");
  });

  it("colors uptime amber between 90% and 99%", () => {
    const html = renderDashboard(makeStats(), undefined, {
      uptime: { lastCheck: { timestamp: 1, ok: true, latencyMs: 10 }, uptime24h: 95, uptime7d: 90, checks24h: 200, checks7d: 100, consecutiveFailures: 0 },
    });
    expect(cardSlice(html, "uptime-24h")).toContain("var(--warning)");
    expect(cardSlice(html, "uptime-7d")).toContain("var(--warning)");
  });

  it("colors uptime red below 90% and neutral without data", () => {
    const html = renderDashboard(makeStats(), undefined, {
      uptime: { lastCheck: { timestamp: 1, ok: false, latencyMs: 10 }, uptime24h: 50, uptime7d: 30, checks24h: 200, checks7d: 100, consecutiveFailures: 3 },
    });
    expect(cardSlice(html, "uptime-24h")).toContain("var(--danger)");
    expect(cardSlice(html, "uptime-7d")).toContain("var(--danger)");

    const zeroState = renderDashboard(makeStats());
    expect(cardSlice(zeroState, "uptime-24h")).not.toContain("var(--success)");
    expect(cardSlice(zeroState, "uptime-7d")).not.toContain("var(--success)");
  });
});
