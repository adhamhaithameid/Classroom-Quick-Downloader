import { FAVICON_PNG_DATA_URI } from "../assets";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderWebsiteConsole(scriptNonce?: string): string {
  const scriptAttr = scriptNonce ? ` nonce="${escapeHtml(scriptNonce)}"` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CQD Dashboard • Website Data Console</title>
  <link rel="icon" href="${FAVICON_PNG_DATA_URI}">
  <style>
    :root {
      color-scheme: dark;
      --bg-0: #0b1220;
      --bg-1: #111827;
      --bg-2: #1f2937;
      --bg-3: #374151;
      --text-0: #f9fafb;
      --text-1: #d1d5db;
      --text-2: #94a3b8;
      --accent: #22d3ee;
      --success: #22c55e;
      --warn: #f59e0b;
      --danger: #ef4444;
      --border: rgba(148, 163, 184, 0.28);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
      background:
        radial-gradient(1100px 450px at 10% -10%, rgba(34, 211, 238, 0.12), transparent 55%),
        radial-gradient(900px 450px at 100% -15%, rgba(139, 92, 246, 0.12), transparent 58%),
        var(--bg-0);
      color: var(--text-0);
    }

    .wrap {
      width: min(1280px, 96vw);
      margin: 24px auto 32px;
      display: grid;
      gap: 16px;
    }

    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(17, 24, 39, 0.92);
      backdrop-filter: blur(6px);
    }

    .title {
      display: grid;
      gap: 4px;
    }

    .title h1 {
      margin: 0;
      font-size: clamp(1.05rem, 2.8vw, 1.4rem);
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    .title p {
      margin: 0;
      color: var(--text-2);
      font-size: 0.86rem;
    }

    .top-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .btn {
      appearance: none;
      border: 1px solid var(--border);
      background: var(--bg-2);
      color: var(--text-0);
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.86rem;
      line-height: 1;
      padding: 10px 13px;
      text-decoration: none;
      cursor: pointer;
      transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
    }

    .btn:hover {
      transform: translateY(-1px);
      border-color: rgba(34, 211, 238, 0.45);
    }

    .btn.primary {
      background: linear-gradient(135deg, rgba(8, 145, 178, 0.78), rgba(30, 64, 175, 0.75));
      border-color: rgba(125, 211, 252, 0.45);
    }

    .btn.warn {
      background: linear-gradient(135deg, rgba(180, 83, 9, 0.72), rgba(146, 64, 14, 0.82));
      border-color: rgba(251, 191, 36, 0.44);
    }

    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .card {
      border: 1px solid var(--border);
      background: rgba(17, 24, 39, 0.93);
      border-radius: 14px;
      padding: 14px;
    }

    .card h2 {
      margin: 0 0 8px;
      font-size: 0.93rem;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-2);
    }

    .metric {
      font-size: clamp(1.2rem, 3vw, 1.8rem);
      font-weight: 700;
    }

    .metric-sub {
      color: var(--text-2);
      font-size: 0.82rem;
      margin-top: 3px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      border: 1px solid var(--border);
      padding: 4px 10px;
      font-size: 0.75rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-1);
      background: rgba(15, 23, 42, 0.7);
    }

    .pill.ok { border-color: rgba(34, 197, 94, 0.45); color: #86efac; }
    .pill.warn { border-color: rgba(245, 158, 11, 0.45); color: #fcd34d; }
    .pill.danger { border-color: rgba(239, 68, 68, 0.45); color: #fca5a5; }

    .section-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .section-title h3 {
      margin: 0;
      font-size: 0.96rem;
    }

    .json {
      margin: 0;
      background: rgba(2, 6, 23, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 10px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      max-height: 360px;
      overflow: auto;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .split {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }

    label {
      display: block;
      color: var(--text-2);
      font-size: 0.8rem;
      margin-bottom: 6px;
    }

    textarea, input, select {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: rgba(2, 6, 23, 0.86);
      color: var(--text-0);
      padding: 10px;
      font-size: 0.84rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      color: var(--text-2);
      font-size: 0.78rem;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .status-line {
      color: var(--text-2);
      font-size: 0.8rem;
      margin-top: 6px;
      min-height: 18px;
    }

    @media (max-width: 720px) {
      .top { align-items: flex-start; flex-direction: column; }
      .top-actions { width: 100%; justify-content: flex-start; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <div class="title">
        <h1>Website Data Console</h1>
        <p>Cloudflare runtime visibility for website telemetry, cache state, and Oracle sync.</p>
      </div>
      <div class="top-actions">
        <a class="btn" href="/dashboard">Back To Main Dashboard</a>
        <button class="btn warn" id="unlock-raw" type="button">Unlock Raw Access</button>
        <button class="btn primary" id="refresh-all" type="button">Refresh</button>
      </div>
    </header>

    <section class="grid">
      <article class="card">
        <h2>Cloudflare Runtime</h2>
        <div class="metric" id="runtime-health">—</div>
        <div class="metric-sub" id="runtime-desc">Loading runtime state…</div>
      </article>
      <article class="card">
        <h2>Website Snapshot</h2>
        <div class="metric" id="snapshot-downloads">—</div>
        <div class="metric-sub" id="snapshot-meta">downloads in latest snapshot</div>
      </article>
      <article class="card">
        <h2>Telemetry Queue</h2>
        <div class="metric" id="telemetry-pending">—</div>
        <div class="metric-sub" id="telemetry-meta">pending batches</div>
      </article>
      <article class="card">
        <h2>Last Correlation</h2>
        <div class="metric" id="telemetry-correlation" style="font-size:1rem;">—</div>
        <div class="metric-sub" id="telemetry-ack">last ack</div>
      </article>
    </section>

    <section class="split">
      <article class="card">
        <div class="section-title">
          <h3>Console Summary</h3>
          <span class="pill" id="summary-pill">loading</span>
        </div>
        <pre class="json" id="summary-json">Loading…</pre>
      </article>
      <article class="card">
        <div class="section-title">
          <h3>Telemetry</h3>
          <span class="pill" id="telemetry-pill">loading</span>
        </div>
        <pre class="json" id="telemetry-json">Loading…</pre>
      </article>
    </section>

    <section class="split">
      <article class="card">
        <div class="section-title">
          <h3>KV Inspector (Raw)</h3>
          <span class="pill" id="kv-pill">locked</span>
        </div>
        <label for="kv-key">KV Key</label>
        <input id="kv-key" value="site:v1:snapshot" />
        <div class="status-line" id="kv-status"></div>
        <pre class="json" id="kv-json">Unlock and load to inspect KV payloads.</pre>
      </article>

      <article class="card">
        <div class="section-title">
          <h3>D1 Inspector (Raw)</h3>
          <span class="pill" id="d1-pill">locked</span>
        </div>
        <label for="d1-tables">Known Tables</label>
        <select id="d1-tables">
          <option value="">Loading…</option>
        </select>
        <label for="d1-query" style="margin-top:10px;">Read-only SQL</label>
        <textarea id="d1-query" rows="6" placeholder="SELECT table_name, snapshot_id, generated_at_utc FROM site_snapshot_cache ORDER BY generated_at_utc DESC LIMIT 50"></textarea>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="btn" id="d1-run" type="button">Run Query</button>
        </div>
        <div class="status-line" id="d1-status"></div>
        <pre class="json" id="d1-json">Unlock and run a read-only query.</pre>
      </article>
    </section>

    <section class="card">
      <div class="section-title">
        <h3>Snapshot Raw Payload (Step-Up)</h3>
        <span class="pill" id="snapshot-pill">locked</span>
      </div>
      <pre class="json" id="snapshot-json">Unlock to inspect raw snapshot payload.</pre>
    </section>

    <footer class="footer">
      <span>Raw data tabs require danger step-up and are read-only guarded.</span>
      <span id="updated-at">Updated: never</span>
    </footer>
  </div>

  <script${scriptAttr}>
    (function () {
      var rawUnlocked = false;

      function setText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
      }

      function setJson(id, value) {
        var el = document.getElementById(id);
        if (!el) return;
        try {
          el.textContent = JSON.stringify(value, null, 2);
        } catch (_) {
          el.textContent = String(value);
        }
      }

      function setPill(id, status) {
        var el = document.getElementById(id);
        if (!el) return;
        el.className = "pill " + (status === "ok" ? "ok" : status === "warn" ? "warn" : status === "danger" ? "danger" : "");
        el.textContent = status;
      }

      async function api(path, init) {
        var options = init || {};
        var headers = new Headers(options.headers || {});
        if (options.method && options.method !== "GET") {
          headers.set("X-Requested-With", "XMLHttpRequest");
        }
        options.headers = headers;
        options.credentials = "same-origin";
        var res = await fetch(path, options);
        var text = await res.text();
        var data = null;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (_) {
          data = { ok: false, code: "invalid_json", message: text };
        }
        if (!res.ok) {
          var error = new Error((data && data.message) || (data && data.error) || ("HTTP " + res.status));
          error.payload = data;
          throw error;
        }
        return data;
      }

      function formatTs(ts) {
        if (!ts || !Number.isFinite(ts)) return "—";
        try {
          return new Date(ts).toISOString();
        } catch (_) {
          return "—";
        }
      }

      function formatRuntime(summary) {
        if (!summary || !summary.runtime) return { pill: "warn", label: "unknown", desc: "Runtime status unavailable" };
        if (summary.runtime.oracleReachable === false) {
          return { pill: "danger", label: "Degraded", desc: "Oracle/DO sync path currently degraded" };
        }
        return { pill: "ok", label: "Healthy", desc: "Worker, KV, and D1 checks passed" };
      }

      async function loadSummary() {
        try {
          var data = await api("/admin/website/console/summary");
          setJson("summary-json", data);
          var health = formatRuntime(data);
          setPill("summary-pill", health.pill);
          setText("runtime-health", health.label);
          setText("runtime-desc", health.desc);

          var totals = (((data || {}).snapshot || {}).totals) || {};
          setText("snapshot-downloads", String(totals.downloads || 0));
          setText("snapshot-meta", "countries: " + String(totals.countries || 0));

          var q = (((data || {}).telemetry || {}).pendingBatches) || 0;
          setText("telemetry-pending", String(q));
          setText("telemetry-meta", "dead-letter: " + String((((data || {}).telemetry || {}).deadLetterBatches) || 0));

          setText("telemetry-correlation", String((((data || {}).telemetry || {}).lastCorrelationId) || "—"));
          setText("telemetry-ack", "last ack: " + formatTs((((data || {}).telemetry || {}).lastBatchAckAtUtc) || null));
          return data;
        } catch (err) {
          setPill("summary-pill", "danger");
          setText("runtime-health", "Error");
          setText("runtime-desc", err && err.message ? err.message : "Failed to load summary");
          setJson("summary-json", { ok: false, error: err && err.message ? err.message : String(err) });
          return null;
        }
      }

      async function loadTelemetry() {
        try {
          var data = await api("/admin/website/console/telemetry");
          setPill("telemetry-pill", "ok");
          setJson("telemetry-json", data);
        } catch (err) {
          setPill("telemetry-pill", "danger");
          setJson("telemetry-json", { ok: false, error: err && err.message ? err.message : String(err) });
        }
      }

      async function unlockRaw() {
        var password = window.prompt("Enter admin danger password to unlock raw tabs:", "");
        if (!password) return false;
        try {
          await api("/auth/verify-danger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: password }),
          });
          rawUnlocked = true;
          setPill("kv-pill", "ok");
          setPill("d1-pill", "ok");
          setPill("snapshot-pill", "ok");
          setText("kv-status", "Raw access unlocked.");
          setText("d1-status", "Raw access unlocked.");
          return true;
        } catch (err) {
          rawUnlocked = false;
          setPill("kv-pill", "danger");
          setPill("d1-pill", "danger");
          setPill("snapshot-pill", "danger");
          setText("kv-status", err && err.message ? err.message : "Unlock failed");
          setText("d1-status", err && err.message ? err.message : "Unlock failed");
          return false;
        }
      }

      async function loadRawPanels() {
        if (!rawUnlocked) {
          setText("kv-status", "Locked: unlock raw access first.");
          setText("d1-status", "Locked: unlock raw access first.");
          return;
        }

        var keyInput = document.getElementById("kv-key");
        var key = keyInput ? String(keyInput.value || "site:v1:snapshot") : "site:v1:snapshot";

        try {
          var kv = await api("/admin/website/console/kv?key=" + encodeURIComponent(key));
          setJson("kv-json", kv);
          setText("kv-status", "Loaded key: " + key);
        } catch (err) {
          setJson("kv-json", { ok: false, error: err && err.message ? err.message : String(err) });
          setText("kv-status", "KV load failed");
        }

        try {
          var tables = await api("/admin/website/console/d1/tables");
          setJson("d1-json", tables);
          var select = document.getElementById("d1-tables");
          if (select && tables && Array.isArray(tables.tables)) {
            select.innerHTML = "";
            tables.tables.forEach(function (name) {
              var opt = document.createElement("option");
              opt.value = name;
              opt.textContent = name;
              select.appendChild(opt);
            });
            if (tables.tables.length) {
              var first = String(tables.tables[0]);
              var queryEl = document.getElementById("d1-query");
              if (queryEl && !queryEl.value.trim()) {
                queryEl.value = "SELECT * FROM " + first + " LIMIT 50";
              }
            }
          }
          setText("d1-status", "Loaded table metadata.");
        } catch (err) {
          setText("d1-status", "Failed to load D1 tables.");
          setJson("d1-json", { ok: false, error: err && err.message ? err.message : String(err) });
        }

        try {
          var snap = await api("/admin/website/console/snapshot/raw");
          setJson("snapshot-json", snap);
        } catch (err) {
          setJson("snapshot-json", { ok: false, error: err && err.message ? err.message : String(err) });
        }
      }

      async function runQuery() {
        if (!rawUnlocked) {
          setText("d1-status", "Raw access is locked.");
          return;
        }
        var input = document.getElementById("d1-query");
        var query = input ? String(input.value || "") : "";
        if (!query.trim()) {
          setText("d1-status", "Query is required.");
          return;
        }

        try {
          var data = await api("/admin/website/console/d1/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, maxRows: 200 }),
          });
          setJson("d1-json", data);
          setText("d1-status", "Query succeeded.");
        } catch (err) {
          setJson("d1-json", { ok: false, error: err && err.message ? err.message : String(err) });
          setText("d1-status", "Query rejected.");
        }
      }

      async function refreshAll() {
        await Promise.all([loadSummary(), loadTelemetry()]);
        if (rawUnlocked) {
          await loadRawPanels();
        }
        setText("updated-at", "Updated: " + new Date().toISOString());
      }

      var refreshBtn = document.getElementById("refresh-all");
      if (refreshBtn) {
        refreshBtn.addEventListener("click", function () {
          refreshAll().catch(function () { /* no-op */ });
        });
      }

      var unlockBtn = document.getElementById("unlock-raw");
      if (unlockBtn) {
        unlockBtn.addEventListener("click", async function () {
          var ok = await unlockRaw();
          if (ok) await loadRawPanels();
        });
      }

      var runBtn = document.getElementById("d1-run");
      if (runBtn) {
        runBtn.addEventListener("click", function () {
          runQuery().catch(function () { /* no-op */ });
        });
      }

      refreshAll().catch(function () {
        setJson("summary-json", { ok: false, error: "Failed to initialize console" });
      });
    })();
  </script>
</body>
</html>`;
}

export const WEBSITE_CONSOLE_TITLE = escapeHtml("Website Data Console");
