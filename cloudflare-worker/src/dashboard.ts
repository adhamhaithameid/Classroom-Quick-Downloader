// filepath: cloudflare-worker/src/dashboard.ts

import type { StatsResponse, QuotaDescriptor } from "./types";

function formatTs(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function quotaToStateTag(quota?: QuotaDescriptor) {
  if (!quota) {
    return {
      label: "unknown",
      className: "state-unknown",
      description: "No quota information available.",
    };
  }

  const n = quota.requestsToday;

  if (n <= 1_000) {
    return {
      label: "sleeping",
      className: "state-sleeping",
      description: "Very low traffic today.",
    };
  }
  if (n <= 5_000) {
    return {
      label: "super chill",
      className: "state-super-chill",
      description: "Extension is barely touching the Worker.",
    };
  }
  if (n <= 10_000) {
    return {
      label: "chill",
      className: "state-chill",
      description: "Plenty of headroom.",
    };
  }
  if (n <= 20_000) {
    return {
      label: "easy",
      className: "state-easy",
      description: "Still well below limits.",
    };
  }
  if (n <= 30_000) {
    return {
      label: "kinda easy",
      className: "state-kinda-easy",
      description: "Load is fine. Batch size may start increasing soon.",
    };
  }
  if (n <= 40_000) {
    return {
      label: "normal",
      className: "state-normal",
      description: "Normal daily traffic.",
    };
  }
  if (n <= 50_000) {
    return {
      label: "slightly busy",
      className: "state-slightly-busy",
      description: "Worker is warming up.",
    };
  }
  if (n <= 60_000) {
    return {
      label: "kinda busy",
      className: "state-kinda-busy",
      description: "Closer to quota, batching should be stronger.",
    };
  }
  if (n <= 70_000) {
    return {
      label: "busy",
      className: "state-busy",
      description: "We are in the hard-normal zone.",
    };
  }
  if (n <= 80_000) {
    return {
      label: "very busy",
      className: "state-very-busy",
      description: "High traffic. Worker is protecting quota.",
    };
  }
  if (n <= 90_000) {
    return {
      label: "super busy",
      className: "state-super-busy",
      description: "Approaching Cloudflare free tier limits.",
    };
  }
  if (n <= 95_000) {
    return {
      label: "emergency",
      className: "state-emergency",
      description: "Emergency mode. Batch sizes should be huge.",
    };
  }
  if (n <= 99_000) {
    return {
      label: "critical",
      className: "state-critical",
      description: "We are basically at the limit. Prepare cut power.",
    };
  }
  return {
    label: "cut the power rn",
    className: "state-cut-power",
    description: "Remote analytics should be OFF; everything local.",
  };
}

export function renderDashboard(stats: StatsResponse): string {
  const quota = stats.quota;
  const stateTag = quotaToStateTag(quota);

  const requestsToday = quota?.requestsToday ?? 0;
  const remoteEnabled = quota?.remoteEnabled ?? true;
  const quotaLevel = quota?.quotaLevel ?? "UNKNOWN";
  const modeLabel = quota?.modeLabel ?? "unknown";
  const batchSize = quota?.batchSizeSuggestion ?? 50;

  const lastEventAt = formatTs(stats.lastEventAt);
  const lastFlushAt = formatTs(stats.lastFlushAt);

  const byTypeRows = Object.entries(stats.counters.byType || {})
    .map(([type, count]) => `<tr><td>${type}</td><td>${count}</td></tr>`)
    .join("");

  const byStatusRows = Object.entries(stats.counters.byStatus || {})
    .map(([status, count]) => `<tr><td>${status}</td><td>${count}</td></tr>`)
    .join("");

  const byBrowserRows = Object.entries(stats.counters.byBrowser || {})
    .map(([br, count]) => `<tr><td>${br}</td><td>${count}</td></tr>`)
    .join("");

  const byOsRows = Object.entries(stats.counters.byOs || {})
    .map(([os, count]) => `<tr><td>${os}</td><td>${count}</td></tr>`)
    .join("");

  const byLangRows = Object.entries(stats.counters.byLanguage || {})
    .map(([lang, count]) => `<tr><td>${lang}</td><td>${count}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CQD Analytics – Worker & DO Dashboard</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #050816;
      --bg-elevated: #111827;
      --border-subtle: #1f2937;
      --accent: #3b82f6;
      --accent-soft: rgba(59,130,246,0.15);
      --danger: #ef4444;
      --danger-soft: rgba(239,68,68,0.12);
      --text-main: #e5e7eb;
      --text-muted: #9ca3af;
      --text-soft: #6b7280;
      --success: #22c55e;
      --warning: #f97316;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
      background: radial-gradient(circle at top, #111827 0, #020617 60%, #020617 100%);
      color: var(--text-main);
    }

    .page {
      max-width: 1040px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .title-block h1 {
      margin: 0;
      font-size: 1.6rem;
      letter-spacing: 0.02em;
    }
    .title-block p {
      margin: 4px 0 0;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .badge-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      border: 1px solid var(--border-subtle);
      background: rgba(15,23,42,0.8);
    }

    .pill-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--accent);
    }

    .pill-label {
      text-transform: uppercase;
      letter-spacing: 0.09em;
      font-weight: 600;
      color: var(--text-muted);
    }

    button.refresh-btn {
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid var(--border-subtle);
      background: rgba(15,23,42,0.9);
      color: var(--text-main);
      font-size: 0.8rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    button.refresh-btn:hover {
      border-color: var(--accent);
      background: rgba(15,23,42,1);
    }

    main {
      display: grid;
      grid-template-columns: minmax(0, 1.8fr) minmax(0, 1.2fr);
      gap: 16px;
      align-items: flex-start;
    }

    .card {
      background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(8,16,32,0.98));
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,0.18);
      padding: 16px 18px;
      box-shadow: 0 18px 40px rgba(0,0,0,0.55);
    }
    .card h2 {
      margin: 0 0 8px;
      font-size: 1rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .card-subtitle {
      margin: 0 0 12px;
      font-size: 0.8rem;
      color: var(--text-soft);
    }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .metric {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .metric-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-soft);
    }
    .metric-value {
      font-size: 1.1rem;
      font-weight: 600;
    }
    .metric-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
    }
    th, td {
      padding: 4px 0;
      text-align: left;
    }
    th {
      font-weight: 600;
      color: var(--text-soft);
    }
    td {
      color: var(--text-main);
    }
    tr + tr td {
      border-top: 1px dashed rgba(148,163,184,0.18);
    }

    .quota-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
    }
    .quota-tag span {
      white-space: nowrap;
    }

    .state-sleeping      { background: rgba(148,163,184,0.10); color: #d1d5db; border: 1px solid rgba(148,163,184,0.5); }
    .state-super-chill   { background: rgba(34,197,94,0.12);  color: #bbf7d0; border: 1px solid rgba(34,197,94,0.7); }
    .state-chill         { background: rgba(52,211,153,0.16); color: #a7f3d0; border: 1px solid rgba(52,211,153,0.7); }
    .state-easy          { background: rgba(59,130,246,0.15); color: #bfdbfe; border: 1px solid rgba(59,130,246,0.7); }
    .state-kinda-easy    { background: rgba(59,130,246,0.18); color: #bfdbfe; border: 1px solid rgba(59,130,246,0.8); }
    .state-normal        { background: rgba(96,165,250,0.18); color: #dbeafe; border: 1px solid rgba(59,130,246,0.9); }
    .state-slightly-busy { background: rgba(234,179,8,0.16);  color: #fef9c3; border: 1px solid rgba(234,179,8,0.9); }
    .state-kinda-busy    { background: rgba(245,158,11,0.16); color: #ffedd5; border: 1px solid rgba(245,158,11,0.9); }
    .state-busy          { background: rgba(249,115,22,0.18); color: #fed7aa; border: 1px solid rgba(249,115,22,0.9); }
    .state-very-busy     { background: rgba(239,68,68,0.18);  color: #fee2e2; border: 1px solid rgba(239,68,68,0.9); }
    .state-super-busy    { background: rgba(185,28,28,0.22);  color: #fee2e2; border: 1px solid rgba(239,68,68,1); }
    .state-emergency     { background: rgba(185,28,28,0.35);  color: #fecaca; border: 1px solid #ef4444; }
    .state-critical      { background: rgba(127,29,29,0.5);   color: #fecaca; border: 1px solid #f97316; }
    .state-cut-power     { background: rgba(15,23,42,0.8);    color: #fca5a5; border: 1px solid #ef4444; box-shadow: 0 0 0 1px rgba(239,68,68,0.7); }
    .state-unknown       { background: rgba(31,41,55,0.8);    color: #e5e7eb; border: 1px dashed rgba(148,163,184,0.6); }

    .remote-flag {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .remote-flag span {
      font-weight: 600;
    }
    .remote-on {
      color: var(--success);
    }
    .remote-off {
      color: var(--danger);
    }

    .last-refreshed {
      font-size: 0.75rem;
      color: var(--text-soft);
    }
    .last-refreshed.updated {
      animation: pulse 0.8s ease-out;
    }

    @keyframes pulse {
      0% { color: #22c55e; }
      100% { color: var(--text-soft); }
    }

    @media (max-width: 900px) {
      main {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div class="title-block">
        <h1>CQD Analytics – Worker + DO</h1>
        <p>Live view of Durable Object counters and Cloudflare quota state.</p>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div class="badge-row">
          <div class="pill">
            <span class="pill-dot"></span>
            <span class="pill-label">WORKER</span>
            <span>cqd-analytics</span>
          </div>
          <div class="pill">
            <span class="pill-label">DO</span>
            <span>DownloadsDurable</span>
          </div>
        </div>
        <button class="refresh-btn" id="refresh-btn">
          <span>↻</span><span>Refresh</span>
        </button>
      </div>
    </header>

    <main>
      <section class="card">
        <h2>Global Counters</h2>
        <p class="card-subtitle">Durable Object stats from /stats</p>
        <div class="grid-2">
          <div class="metric">
            <div class="metric-label">Total Downloads</div>
            <div class="metric-value">${stats.totalDownloads}</div>
            <div class="metric-sub">successful downloads recorded</div>
          </div>
          <div class="metric">
            <div class="metric-label">Total Events</div>
            <div class="metric-value">${stats.totalEvents}</div>
            <div class="metric-sub">success + fail events</div>
          </div>
          <div class="metric">
            <div class="metric-label">Pending in DO buffer</div>
            <div class="metric-value">${stats.pendingEvents}</div>
            <div class="metric-sub">waiting to flush to Oracle</div>
          </div>
          <div class="metric">
            <div class="metric-label">Last Event</div>
            <div class="metric-value" style="font-size:0.85rem;">${lastEventAt}</div>
            <div class="metric-sub">lastFlush: ${lastFlushAt}</div>
          </div>
        </div>

        <hr style="margin:16px 0;border:none;border-top:1px dashed var(--border-subtle);" />

        <div class="grid-2">
          <div>
            <h3 style="margin:0 0 6px;font-size:0.82rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.08em;">By Type</h3>
            <table>
              <thead>
                <tr><th>Type</th><th>Count</th></tr>
              </thead>
              <tbody>${byTypeRows || "<tr><td colspan='2'>—</td></tr>"}</tbody>
            </table>
          </div>
          <div>
            <h3 style="margin:0 0 6px;font-size:0.82rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.08em;">By Status</h3>
            <table>
              <thead>
                <tr><th>Status</th><th>Count</th></tr>
              </thead>
              <tbody>${byStatusRows || "<tr><td colspan='2'>—</td></tr>"}</tbody>
            </table>
          </div>
        </div>

        <hr style="margin:16px 0;border:none;border-top:1px dashed var(--border-subtle);" />

        <div class="grid-2">
          <div>
            <h3 style="margin:0 0 6px;font-size:0.82rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.08em;">By Browser</h3>
            <table>
              <thead>
                <tr><th>Browser</th><th>Count</th></tr>
              </thead>
              <tbody>${byBrowserRows || "<tr><td colspan='2'>—</td></tr>"}</tbody>
            </table>
          </div>
          <div>
            <h3 style="margin:0 0 6px;font-size:0.82rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.08em;">By OS / Language</h3>
            <table>
              <thead>
                <tr><th>OS</th><th>Count</th></tr>
              </thead>
              <tbody>${byOsRows || "<tr><td colspan='2'>—</td></tr>"}</tbody>
            </table>
            <table style="margin-top:6px;">
              <thead>
                <tr><th>Lang</th><th>Count</th></tr>
              </thead>
              <tbody>${byLangRows || "<tr><td colspan='2'>—</td></tr>"}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Worker Quota & Mode</h2>
        <p class="card-subtitle">Daily request usage and suggested extension behaviour.</p>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div>
              <div class="metric-label">Requests Today (approx)</div>
              <div class="metric-value">${requestsToday}</div>
              <div class="metric-sub">Cloudflare Worker requests (analytics related)</div>
            </div>
            <div>
              <div class="quota-tag ${stateTag.className}">
                <span>${stateTag.label}</span>
              </div>
              <div class="remote-flag">
                Analytics:
                <span class="${remoteEnabled ? "remote-on" : "remote-off"}">
                  ${remoteEnabled ? "ON (extensions may send)" : "OFF (store local only)"}
                </span>
              </div>
            </div>
          </div>

          <div style="font-size:0.78rem;color:var(--text-muted);">
            <div>Quota level: <code>${quotaLevel}</code></div>
            <div>Worker mode: <strong>${modeLabel}</strong></div>
            <div>Suggested batch size for extensions: <strong>${batchSize}</strong> events / POST</div>
            <div style="margin-top:4px;color:var(--text-soft);">${stateTag.description}</div>
          </div>

          <div class="last-refreshed" id="last-refreshed">
            Last refreshed: <span id="last-refreshed-ts">${new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </section>
    </main>
  </div>

  <script>
    (function () {
      const refreshBtn = document.getElementById("refresh-btn");
      const lastRef = document.getElementById("last-refreshed");
      const lastRefTs = document.getElementById("last-refreshed-ts");

      async function refresh() {
        try {
          const res = await fetch("/stats", { cache: "no-store" });
          if (!res.ok) return;
          const data = await res.json();

          // naive reload: for now just reload the page with new HTML
          // (keeps implementation simple)
          window.location.reload();
        } catch (e) {
          console.error("Failed to refresh stats", e);
        }
      }

      if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
          refresh();
        });
      }

      // Visual feedback that this render is "fresh"
      if (lastRef && lastRefTs) {
        lastRef.classList.add("updated");
        lastRefTs.textContent = new Date().toLocaleTimeString();
        setTimeout(() => lastRef.classList.remove("updated"), 900);
      }
    })();
  </script>
</body>
</html>`;
}