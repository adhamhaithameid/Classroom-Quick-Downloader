// cloudflare-worker/src/dashboard.ts

export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>CQD Analytics – Downloads Stats</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark light;
        --bg: #020617;
        --bg-elevated: #020617;
        --border-subtle: #1e293b;
        --border-strong: #38bdf8;
        --accent: #38bdf8;
        --accent-soft: rgba(56, 189, 248, 0.12);
        --text-main: #e5e7eb;
        --text-muted: #9ca3af;
        --danger: #f97373;
        --success: #4ade80;
        --warning: #facc15;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
          "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #0f172a 0, #020617 60%);
        color: var(--text-main);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .shell {
        width: 100%;
        max-width: 1100px;
        background: radial-gradient(circle at top left, #0f172a 0, #020617 60%);
        border-radius: 24px;
        border: 1px solid var(--border-subtle);
        padding: 24px 26px 26px;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.9);
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 22px;
      }

      h1 {
        font-size: 22px;
        margin: 0 0 4px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .badge-primary {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--accent-soft);
        border: 1px solid rgba(56, 189, 248, 0.6);
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .subtitle {
        margin: 0;
        font-size: 13px;
        color: var(--text-muted);
      }

      .meta {
        text-align: right;
        font-size: 12px;
        color: var(--text-muted);
      }

      .meta b {
        color: var(--text-main);
      }

      .grid {
        display: grid;
        gap: 12px;
      }

      .grid-cols-4 {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .grid-cols-3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .grid-cols-2 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      @media (max-width: 900px) {
        .grid-cols-4 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .grid-cols-3 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 640px) {
        body {
          padding: 12px;
        }
        .shell {
          border-radius: 18px;
          padding: 18px;
        }
        header {
          flex-direction: column;
          align-items: flex-start;
        }
        .grid-cols-4,
        .grid-cols-3,
        .grid-cols-2 {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      .card {
        background: linear-gradient(145deg, #020617 0, #020617 70%);
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        padding: 10px 11px;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }

      .card-title {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
      }

      .card-chip {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        color: var(--text-muted);
      }

      .card-value {
        font-size: 20px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .card-value.success {
        color: var(--success);
      }

      .card-value.danger {
        color: var(--danger);
      }

      .card-sub {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 2px;
      }

      .section-title {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin: 16px 0 8px;
      }

      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .pill {
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.45);
        font-size: 11px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-variant-numeric: tabular-nums;
      }

      .pill .key {
        color: var(--text-muted);
      }

      .pill .value {
        color: var(--text-main);
      }

      .pill.soft {
        border-style: dashed;
        opacity: 0.9;
      }

      .muted {
        color: var(--text-muted);
      }

      .badge-soft {
        font-size: 11px;
        padding: 2px 7px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(148, 163, 184, 0.4);
      }

      .dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 999px;
        margin-right: 6px;
      }

      .dot.green {
        background: var(--success);
      }

      .dot.red {
        background: var(--danger);
      }

      .dot.yellow {
        background: var(--warning);
      }

      .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 14px;
        font-size: 11px;
        color: var(--text-muted);
      }

      .footer a {
        color: var(--accent);
        text-decoration: none;
      }

      .footer a:hover {
        text-decoration: underline;
      }

      .endpoint-list {
        font-size: 11px;
        line-height: 1.5;
      }

      .endpoint-list code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
        background: rgba(15, 23, 42, 0.9);
        padding: 2px 4px;
        border-radius: 6px;
        border: 1px solid rgba(148, 163, 184, 0.35);
      }

      .btn-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }

      button {
        cursor: pointer;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.5);
        background: rgba(15, 23, 42, 0.9);
        color: var(--text-main);
        padding: 5px 10px;
        font-size: 11px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      button.primary {
        border-color: rgba(56, 189, 248, 0.8);
        background: linear-gradient(
          135deg,
          rgba(56, 189, 248, 0.15),
          rgba(56, 189, 248, 0.05)
        );
      }

      button:hover {
        border-color: var(--accent);
      }

      button:disabled {
        opacity: 0.6;
        cursor: default;
      }

      .btn-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--accent);
      }

      .debug-status {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
      }

      .debug-status strong {
        color: var(--text-main);
      }

      pre {
        margin: 0;
        max-height: 220px;
        overflow: auto;
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          "Liberation Mono", "Courier New", monospace;
        background: rgba(15, 23, 42, 0.9);
        border-radius: 12px;
        padding: 8px 10px;
        border: 1px solid rgba(148, 163, 184, 0.3);
      }

      .json-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        font-size: 11px;
        color: var(--text-muted);
      }

      .json-header span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .pill.warning {
        border-color: rgba(250, 204, 21, 0.8);
        color: var(--warning);
      }

      .pill.warning .key {
        color: var(--warning);
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div>
          <h1>
            CQD Analytics
            <span class="badge-primary">Durable Object</span>
          </h1>
          <p class="subtitle">
            Live Worker + Durable Object stats for the Classroom Quick Downloader
            extension. Auto refresh every <b>5s</b>.
          </p>
        </div>
        <div class="meta" id="meta">
          Worker: <b>cqd-analytics</b><br />
          Durable Object: <b>DownloadsDurable</b><br />
          Last refresh: <span id="lastRefresh">never</span>
        </div>
      </header>

      <!-- Top summary -->
      <div class="grid grid-cols-4">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Total Downloads</div>
          </div>
          <div class="card-value" id="totalDownloads">–</div>
          <div class="card-sub">
            Successful completed downloads (status = <code>success</code>)
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Total Success</div>
          </div>
          <div class="card-value success" id="totalSuccess">–</div>
          <div class="card-sub">
            All events with status <code>success</code>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Total Fail</div>
          </div>
          <div class="card-value danger" id="totalFail">–</div>
          <div class="card-sub">
            Events with status <code>fail</code> (downloads that errored)
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Total Events</div>
          </div>
          <div class="card-value" id="totalEvents">–</div>
          <div class="card-sub">
            All events received by the Durable Object (success + fail)
          </div>
        </div>
      </div>

      <!-- Buffer / timing / env -->
      <div class="grid grid-cols-3" style="margin-top: 12px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Buffer</div>
          </div>
          <div class="card-sub" id="bufferInfo">
            Pending in DO buffer: –<br />
            Buffer age: –<br />
            Next flush condition: –
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Timeline</div>
          </div>
          <div class="card-sub" id="timeInfo">
            Last event at: –<br />
            Age since last event: –<br />
            Last flush to Oracle: –<br />
            Age since last flush: –
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Environment</div>
          </div>
          <div class="pill-row" id="envInfo">
            <span class="muted">Loading…</span>
          </div>
        </div>
      </div>

      <!-- Breakdowns -->
      <div class="section-title">Breakdown by dimensions</div>
      <div class="grid grid-cols-3">
        <div class="card">
          <div class="card-header">
            <div class="card-title">By Type</div>
          </div>
          <div class="pill-row" id="byType"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">By Status</div>
          </div>
          <div class="pill-row" id="byStatus"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">By Browser</div>
          </div>
          <div class="pill-row" id="byBrowser"></div>
        </div>
      </div>

      <div class="grid grid-cols-3" style="margin-top: 12px;">
        <div class="card">
          <div class="card-header">
            <div class="card-title">By OS</div>
          </div>
          <div class="pill-row" id="byOs"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">By Extension Version</div>
          </div>
          <div class="pill-row" id="byExtVersion"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">By Language</div>
          </div>
          <div class="pill-row" id="byLanguage"></div>
        </div>
      </div>

      <!-- Debug + endpoints -->
      <div class="section-title">Debug & endpoints</div>
      <div class="grid grid-cols-2">
        <div class="card">
          <div class="card-header">
            <div class="card-title">Endpoints</div>
          </div>
          <div class="endpoint-list" id="endpointList">
            <span class="muted">Loading…</span>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Actions</div>
            <span class="card-chip">Safe to use in dev</span>
          </div>
          <div class="btn-row">
            <button id="btnRefresh">
              <span class="btn-dot"></span>
              Refresh stats now
            </button>
            <button id="btnFlush" class="primary">
              <span class="btn-dot"></span>
              POST /debug/flush
            </button>
            <button id="btnOpenStats">
              <span class="btn-dot"></span>
              Open /stats JSON
            </button>
            <button id="btnOpenHealth">
              <span class="btn-dot"></span>
              Open /health
            </button>
          </div>
          <div class="debug-status" id="debugStatus">
            Ready.
          </div>
        </div>
      </div>

      <!-- Raw JSON -->
      <div class="section-title">Raw /stats payload</div>
      <div class="card">
        <div class="json-header">
          <span>
            <span class="dot yellow"></span>
            Direct JSON returned by <code>/stats</code>
          </span>
          <span id="jsonMeta">size: –</span>
        </div>
        <pre id="rawJson">{}</pre>
      </div>

      <div class="footer">
        <div>
          <span class="badge-soft">
            <span class="dot green"></span> Global stats for all extension users
            (Durable Object)
          </span>
        </div>
        <div>
          <span class="muted">Tip:</span>
          values auto-update every 5 seconds – keep this tab open while testing.
        </div>
      </div>
    </div>

    <script>
      function fmtNumber(n) {
        if (n == null || Number.isNaN(n)) return "0";
        try {
          return Number(n).toLocaleString("en-US");
        } catch {
          return String(n);
        }
      }

      function fmtDate(ts) {
        if (!ts) return "–";
        const n = Number(ts);
        if (!n || Number.isNaN(n)) return String(ts);
        try {
          return new Date(n).toLocaleString();
        } catch {
          return String(ts);
        }
      }

      function fmtAge(ts) {
        if (!ts) return "–";
        const n = Number(ts);
        if (!n || Number.isNaN(n)) return "–";
        const diff = Date.now() - n;
        if (diff < 0) return "0s";
        const sec = Math.floor(diff / 1000);
        if (sec < 60) return sec + "s";
        const min = Math.floor(sec / 60);
        if (min < 60) return min + "m";
        const hours = Math.floor(min / 60);
        if (hours < 24) return hours + "h";
        const days = Math.floor(hours / 24);
        return days + "d";
      }

      function renderPillsFromMap(containerId, obj) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = "";
        if (!obj || typeof obj !== "object") {
          el.textContent = "–";
          return;
        }
        const entries = Object.entries(obj);
        if (!entries.length) {
          el.textContent = "–";
          return;
        }
        for (const [key, value] of entries) {
          const pill = document.createElement("div");
          pill.className = "pill";
          const k = document.createElement("span");
          k.className = "key";
          k.textContent = key;
          const v = document.createElement("span");
          v.className = "value";
          v.textContent = fmtNumber(value);
          pill.appendChild(k);
          pill.appendChild(v);
          el.appendChild(pill);
        }
      }

      function buildEndpoints() {
        const base = window.location.origin;
        const endpoints = {
          "Worker base": base + "/",
          "Track endpoint": base + "/track",
          "Stats (JSON)": base + "/stats",
          "Health": base + "/health",
          "Debug flush (POST)": base + "/debug/flush",
        };
        const el = document.getElementById("endpointList");
        el.innerHTML = "";
        Object.entries(endpoints).forEach(([label, url]) => {
          const line = document.createElement("div");
          line.innerHTML =
            "<span class=\\"muted\\">" +
            label +
            ":</span> <code>" +
            url +
            "</code>";
          el.appendChild(line);
        });
      }

      function populateEnv(stats) {
        const envInfo = document.getElementById("envInfo");
        envInfo.innerHTML = "";

        function pill(label, value) {
          const p = document.createElement("div");
          p.className = "pill soft";
          const k = document.createElement("span");
          k.className = "key";
          k.textContent = label;
          const v = document.createElement("span");
          v.className = "value";
          v.textContent = value;
          p.appendChild(k);
          p.appendChild(v);
          envInfo.appendChild(p);
        }

        const maxBatch =
          stats.maxBatchEvents != null ? String(stats.maxBatchEvents) : "n/a";
        pill("MAX_BATCH_EVENTS", maxBatch);

        const oracleFlag =
          stats.oracleConfigured === true
            ? "configured"
            : stats.oracleConfigured === false
            ? "not set"
            : "unknown";
        pill("ORACLE_ENDPOINT", oracleFlag);

        if (stats.pendingEvents != null) {
          pill("pendingEvents", fmtNumber(stats.pendingEvents));
        }

        if (stats.retryState) {
          pill("retry.count", stats.retryState.count ?? "?");
          if (stats.retryState.nextRetryAt) {
            pill(
              "retry.nextRetryAt",
              fmtDate(stats.retryState.nextRetryAt) +
                " (" +
                fmtAge(stats.retryState.nextRetryAt) +
                " ago)"
            );
          }
        }
      }

      function updateSummary(stats) {
        const counters = stats.counters || {};
        const byStatus = counters.byStatus || {};
        const totalSuccess =
          stats.totalSuccess != null
            ? stats.totalSuccess
            : byStatus.success || 0;
        const totalFail =
          stats.totalFail != null ? stats.totalFail : byStatus.fail || 0;
        const totalDownloads =
          stats.totalDownloads != null ? stats.totalDownloads : totalSuccess;

        document.getElementById("totalDownloads").textContent =
          fmtNumber(totalDownloads);
        document.getElementById("totalSuccess").textContent =
          fmtNumber(totalSuccess);
        document.getElementById("totalFail").textContent = fmtNumber(totalFail);
        document.getElementById("totalEvents").textContent = fmtNumber(
          stats.totalEvents ?? totalSuccess + totalFail
        );
      }

      function updateBufferAndTime(stats) {
        const buf = document.getElementById("bufferInfo");
        const pending = fmtNumber(stats.pendingEvents ?? 0);
        const maxBatch =
          stats.maxBatchEvents != null ? stats.maxBatchEvents : "unknown";

        buf.innerHTML =
          "Pending in DO buffer: <b>" +
          pending +
          "</b><br />" +
          "Buffer age (since last event): <b>" +
          fmtAge(stats.lastEventAt) +
          "</b><br />" +
          "Next auto flush: when buffer ≥ " +
          maxBatch +
          " events";

        const t = document.getElementById("timeInfo");
        t.innerHTML =
          "Last event at: <b>" +
          fmtDate(stats.lastEventAt) +
          "</b><br />" +
          "Age since last event: " +
          fmtAge(stats.lastEventAt) +
          "<br />" +
          "Last flush to Oracle: <b>" +
          fmtDate(stats.lastFlushAt) +
          "</b><br />" +
          "Age since last flush: " +
          fmtAge(stats.lastFlushAt);
      }

      function updateBreakdowns(stats) {
        const counters = stats.counters || {};
        renderPillsFromMap("byType", counters.byType || {});
        renderPillsFromMap("byStatus", counters.byStatus || {});
        renderPillsFromMap("byBrowser", counters.byBrowser || {});
        renderPillsFromMap("byOs", counters.byOs || {});
        renderPillsFromMap("byExtVersion", counters.byExtVersion || {});
        renderPillsFromMap("byLanguage", counters.byLanguage || {});
      }

      function updateRawJson(stats) {
        const rawEl = document.getElementById("rawJson");
        try {
          rawEl.textContent = JSON.stringify(stats, null, 2);
        } catch {
          rawEl.textContent = String(stats);
        }
        const size = new Blob([rawEl.textContent]).size;
        document.getElementById("jsonMeta").textContent =
          "size: " + fmtNumber(size) + " bytes";
      }

      async function refreshStats() {
        try {
          const res = await fetch("/stats");
          if (!res.ok) throw new Error("HTTP " + res.status);
          const stats = await res.json();

          updateSummary(stats);
          updateBufferAndTime(stats);
          updateBreakdowns(stats);
          populateEnv(stats);
          updateRawJson(stats);

          const now = new Date();
          document.getElementById("lastRefresh").textContent =
            now.toLocaleTimeString();
          document.getElementById("debugStatus").textContent =
            "Last refresh OK (HTTP " + res.status + ").";
        } catch (e) {
          console.error("Failed to refresh stats", e);
          document.getElementById("debugStatus").textContent =
            "Refresh failed: " + e;
        }
      }

      async function doDebugFlush() {
        const btn = document.getElementById("btnFlush");
        const status = document.getElementById("debugStatus");
        try {
          btn.disabled = true;
          status.textContent = "Sending POST /debug/flush…";
          const res = await fetch("/debug/flush", { method: "POST" });
          let bodyText = "";
          try {
            const j = await res.json();
            bodyText = JSON.stringify(j);
          } catch {
            bodyText = await res.text();
          }
          status.textContent =
            "Flush response: HTTP " + res.status + " – " + bodyText;
          await refreshStats();
        } catch (e) {
          console.error("flush error", e);
          status.textContent = "Flush failed: " + e;
        } finally {
          btn.disabled = false;
        }
      }

      document.getElementById("btnRefresh").addEventListener("click", () => {
        refreshStats();
      });

      document.getElementById("btnFlush").addEventListener("click", () => {
        doDebugFlush();
      });

      document
        .getElementById("btnOpenStats")
        .addEventListener("click", () => window.open("/stats", "_blank"));

      document
        .getElementById("btnOpenHealth")
        .addEventListener("click", () => window.open("/health", "_blank"));

      buildEndpoints();
      refreshStats();
      setInterval(refreshStats, 5000);
    </script>
  </body>
</html>`;