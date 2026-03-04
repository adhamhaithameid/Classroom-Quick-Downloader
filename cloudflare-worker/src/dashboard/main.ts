// filepath: cloudflare-worker/src/dashboard/main.ts
import type { StatsResponse, QuotaDescriptor, ChangelogEntry, ChangelogConfig } from "../types";
import { FAVICON_PNG_DATA_URI } from "../assets";
import { resolveOracleEndpoint } from "../oracle-endpoint";

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function formatTs(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAge(ts: number | null): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff <= 0) return "just now";

  const sec = Math.floor(diff / 1_000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day > 0) return `${day}d`;
  if (hr > 0) return `${hr}h`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  UK: "United Kingdom",
  EL: "Greece",
};
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const countryDisplayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function countryNameFromCode(code: string): string {
  const normalized = String(code || "").trim().toUpperCase();
  if (!COUNTRY_CODE_PATTERN.test(normalized)) return "";
  if (normalized === "XX" || normalized === "ZZ" || normalized === "UN" || normalized === "EU") return "";
  if (COUNTRY_NAME_ALIASES[normalized]) return COUNTRY_NAME_ALIASES[normalized];
  if (!countryDisplayNames) return "";
  try {
    return countryDisplayNames.of(normalized) || "";
  } catch {
    return "";
  }
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

  if (n <= 1_000)
    return {
      label: "sleeping",
      className: "state-sleeping",
      description: "Very low traffic today.",
    };
  if (n <= 5_000)
    return {
      label: "super chill",
      className: "state-super-chill",
      description: "Extension is barely touching the Worker.",
    };
  if (n <= 10_000)
    return {
      label: "chill",
      className: "state-chill",
      description: "Plenty of headroom.",
    };
  if (n <= 20_000)
    return {
      label: "easy",
      className: "state-easy",
      description: "Still well below limits.",
    };
  if (n <= 30_000)
    return {
      label: "kinda easy",
      className: "state-kinda-easy",
      description: "Load is fine. Batch size may start increasing soon.",
    };
  if (n <= 40_000)
    return {
      label: "normal",
      className: "state-normal",
      description: "Normal daily traffic.",
    };
  if (n <= 50_000)
    return {
      label: "slightly busy",
      className: "state-slightly-busy",
      description: "Worker is warming up.",
    };
  if (n <= 60_000)
    return {
      label: "kinda busy",
      className: "state-kinda-busy",
      description: "Closer to quota, batching should be stronger.",
    };
  if (n <= 70_000)
    return {
      label: "busy",
      className: "state-busy",
      description: "We are in the hard-normal zone.",
    };
  if (n <= 80_000)
    return {
      label: "very busy",
      className: "state-very-busy",
      description: "High traffic. Worker is protecting quota.",
    };
  if (n <= 90_000)
    return {
      label: "super busy",
      className: "state-super-busy",
      description: "Approaching Cloudflare free tier limits.",
    };
  if (n <= 95_000)
    return {
      label: "emergency",
      className: "state-emergency",
      description: "Emergency mode. Batch sizes should be huge.",
    };
  if (n <= 99_000)
    return {
      label: "critical",
      className: "state-critical",
      description: "We are basically at the limit. Prepare cut power.",
    };
  return {
    label: "cut the power rn",
    className: "state-cut-power",
    description: "Remote analytics should be OFF; everything local.",
  };
}

function quotaToFlag(quota?: QuotaDescriptor) {
  if (!quota) {
    return {
      label: "unknown",
      className: "flag-unknown",
      description: "No info.",
    };
  }
  const n = quota.requestsToday;
  if (n <= 20_000)
    return {
      label: "easy",
      className: "flag-easy",
      description: "Way below limits (<20k).",
    };
  if (n <= 50_000)
    return {
      label: "normal",
      className: "flag-normal",
      description: "Comfortable usage (<50k).",
    };
  if (n <= 80_000)
    return {
      label: "hard",
      className: "flag-hard",
      description: "High traffic (<80k).",
    };
  return {
    label: "critical",
    className: "flag-critical",
    description: "Basically at limits (>80k).",
  };
}

function classifySuccessRate(success: number, fail: number) {
  const total = success + fail;
  if (!total) {
    return {
      text: "—",
      badge: "No data",
      className: "",
    };
  }
  const rate = (success / total) * 100;
  if (rate >= 98) {
    return {
      text: `${rate.toFixed(1)}%`,
      badge: "Excellent",
      className: "metric-good",
    };
  }
  if (rate >= 95) {
    return {
      text: `${rate.toFixed(1)}%`,
      badge: "Healthy",
      className: "metric-warn",
    };
  }
  return {
    text: `${rate.toFixed(1)}%`,
    badge: "Unstable",
    className: "metric-bad",
  };
}

function topKey(data?: Record<string, number>): string {
  if (!data) return "—";
  const entries = Object.entries(data);
  if (!entries.length) return "—";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function renderLoginPage(errorMessage?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CQD Analytics – Admin Login</title>
  <link rel="icon" href="${FAVICON_PNG_DATA_URI}">
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root { color-scheme: dark; --bg: #0a0f1a; --accent: #3b82f6; --text-main: #f1f5f9; --text-soft: #64748b; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { min-height: 100vh; font-family: system-ui, sans-serif; background: var(--bg); color: var(--text-main); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .login-card { width: 100%; max-width: 380px; border-radius: 12px; padding: 24px 22px 20px; background: #1a2332; border: 1px solid #2d3a4d; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    .login-title { font-size: 1.35rem; font-weight: 600; margin-bottom: 4px; }
    .login-subtitle { font-size: 0.85rem; color: var(--text-soft); margin-bottom: 16px; }
    .login-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; border: 1px solid #2d3a4d; background: rgba(59,130,246,0.1); font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px; }
    .login-badge-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--accent); }
    .login-row { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
    .field { display: flex; flex-direction: column; gap: 4px; flex: 1; margin: 0; }
    .field input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #2d3a4d; background: #141c2b; color: #f9fafb; outline: none; transition: all 0.2s; }
    .field input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(59,130,246,0.25); }
    .login-error { margin-top: 12px; padding: 6px 8px; border-radius: 8px; font-size: 0.78rem; color: #fecaca; background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.6); }
    .login-button { padding: 10px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; background: var(--accent); color: #f9fafb; display: inline-flex; align-items: center; transition: all 0.2s; white-space: nowrap; height: 100%; }
    .login-button:hover { background: #2563eb; }
    .login-button:active { background: #1d4ed8; }
  </style>
</head>
<body>
  <form class="login-card" method="POST" action="/">
    <div class="login-badge"><span class="login-badge-dot"></span><span>CQD Analytics Admin</span></div>
    <h1 class="login-title">Enter admin password</h1>
    <p class="login-subtitle">Allowlisted IPs use the normal password. If blocked-IP step-up is enabled, blocked IPs can use the admin danger password in the same field.</p>
    
    <div class="login-row">
      <div class="field">
        <input id="password-input" name="password" type="password" placeholder="Password..." autofocus required />
      </div>
      <button class="login-button" type="submit">Unlock →</button>
    </div>
    ${errorMessage ? `<div class="login-error">${escapeHtml(errorMessage)}</div>` : ""}
  </form>
  <script>document.getElementById("password-input")?.focus();</script>
</body>
</html>`;
}

// LEGACY_CHANGELOG_DISABLED_START
// Notification Rules Engine UI is retained for rollback only and intentionally not rendered.
function renderNotificationSection(entries: ChangelogEntry[], config: ChangelogConfig): string {
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const knownVersions = Array.from(new Set(sorted.map(e => e.version)));
  const dataListOptions = [
    '<option value="all">Global (All Versions)</option>',
    ...knownVersions.map(v => `<option value="${escapeHtml(v)}">v${escapeHtml(v)}</option>`)
  ].join('');

  const rulesJson = safeJson(config.rules || []);

  return `
    <section class="card config-card" id="config">
      <h2>
        <span>🔔</span> Notification Styling
        <span class="release-count-badge" id="notification-counter">${(config.rules || []).length}</span>
        <span class="unsaved-dot" id="unsaved-indicator" title="Unsaved changes"></span>
      </h2>
      
      <script>window.CURRENT_RULES = ${rulesJson};</script>
      
      <div class="split-section" style="gap: 24px;">
        <!-- Left: Actions / Form -->
        <div style="flex: 1;">
          <div class="section-header" style="margin-bottom: 12px;">Create New Rule</div>
          <div style="font-size: 0.85em; color: var(--text-soft); margin-bottom: 16px;">
            Define how the extension badge looks for specific versions.
          </div>
          
          <div style="padding: 20px; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid var(--border-subtle);">
            <!-- Target Selection -->
            <div style="margin-bottom: 16px;">
               <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 6px;">Target Version</label>
               <input list="known-versions" id="rule-target" placeholder="e.g. 1.2.3 or 'all'" class="input-field" style="width: 100%; padding: 10px 12px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: white; border-radius: 8px; font-size: 0.95em;" oninput="window.updatePreview && window.updatePreview()">
               <datalist id="known-versions">
                 ${dataListOptions}
               </datalist>
               <div style="font-size: 0.7em; color: var(--text-muted); margin-top: 6px;">Select from history or type new version.</div>
            </div>
            
            <div style="border-top: 1px dashed var(--border-subtle); margin: 16px 0; padding-top: 16px;">
               <!-- Priority -->
               <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 10px;">Priority (Color Scheme)</label>
               <div style="display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap;">
                 <label class="priority-option" style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid transparent; transition: all 0.15s;">
                   <input type="radio" name="rule-priority" value="normal" checked style="accent-color: #6b7280;">
                   <span style="font-size: 0.9em;">Normal</span>
                 </label>
                 <label class="priority-option" style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(59,130,246,0.1); border-radius: 8px; border: 1px solid rgba(59,130,246,0.3); transition: all 0.15s;">
                   <input type="radio" name="rule-priority" value="minor" style="accent-color: #3b82f6;">
                   <span style="font-size: 0.9em; color: #60a5fa;">Minor (Blue)</span>
                 </label>
                 <label class="priority-option" style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(239,68,68,0.1); border-radius: 8px; border: 1px solid rgba(239,68,68,0.3); transition: all 0.15s;">
                   <input type="radio" name="rule-priority" value="major" style="accent-color: #ef4444;">
                   <span style="font-size: 0.9em; color: #f87171; font-weight: 600;">Major (Red)</span>
                 </label>
               </div>

               <!-- Effect -->
               <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 10px;">Animation Effect</label>
               <div style="display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap;">
                 <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; transition: background 0.15s;">
                   <input type="radio" name="rule-effect" value="none" checked>
                   <span style="font-size: 0.9em;">None</span>
                 </label>
                 <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; transition: background 0.15s;">
                   <input type="radio" name="rule-effect" value="glow">
                   <span style="font-size: 0.9em;">✨ Glow</span>
                 </label>
                 <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; transition: background 0.15s;">
                   <input type="radio" name="rule-effect" value="pulse">
                   <span style="font-size: 0.9em;">📡 Pulse</span>
                 </label>
               </div>
            </div>
            
            <div style="background: #0f1419; padding: 20px; border-radius: 10px; text-align: center; border: 1px solid #2d3a4d; margin-bottom: 18px;">
               <div style="font-size: 0.7em; color: #555; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1.5px;">Live Extension Preview</div>
               <span id="rule-preview-pill" class="cqd-brand-version">v1.2.3</span>
            </div>
            
            <script>
              (function() {
                var pill = document.getElementById('rule-preview-pill');
                function updatePreview() {
                  if (!pill) return;
                  var priorityInputs = document.getElementsByName('rule-priority');
                  var effectInputs = document.getElementsByName('rule-effect');
                  var priority = 'normal';
                  var effect = 'none';
                  for (var i = 0; i < priorityInputs.length; i++) {
                    if (priorityInputs[i].checked) { priority = priorityInputs[i].value; break; }
                  }
                  for (var i = 0; i < effectInputs.length; i++) {
                    if (effectInputs[i].checked) { effect = effectInputs[i].value; break; }
                  }
                  var cls = 'cqd-brand-version';
                  if (priority === 'minor') cls += ' cqd-pill-minor';
                  if (priority === 'major') cls += ' cqd-pill-major';
                  if (effect === 'glow') cls += (priority === 'major') ? ' cqd-effect-glow-red' : ' cqd-effect-glow-blue';
                  if (effect === 'pulse') cls += (priority === 'major') ? ' cqd-effect-pulse-red' : ' cqd-effect-pulse-blue';
                  pill.className = cls;
                }
                var allRadios = document.querySelectorAll('input[name="rule-priority"], input[name="rule-effect"]');
                for (var i = 0; i < allRadios.length; i++) {
                  allRadios[i].onchange = updatePreview;
                }
                window.updatePreview = updatePreview;
                updatePreview();
              })();
            </script>
            
            <button id="btn-add-rule" class="btn" style="width: 100%; justify-content: center; background: var(--accent); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.95em; transition: all 0.2s;">
               + Add Rule
            </button>
          </div>
        </div>
        
        <!-- Right: History / Rules List -->
        <div style="flex: 1;">
          <div class="section-header" style="margin-bottom: 12px;">Active Rules</div>
          <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
             <span style="font-size: 0.8em; color: var(--text-muted);">Specific versions override 'all' rules</span>
             <span id="rules-count" style="font-size: 0.8em; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">0 rules</span>
          </div>
          <div id="rules-list-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; padding-right: 4px;">
             <!-- Renders via JS -->
          </div>
          <div style="display:flex; align-items:center; gap:10px; margin-top:12px;">
            <button id="btn-save-rules" class="btn btn-primary" style="padding:8px 12px;">Save Notification Rules</button>
            <span id="rules-save-status" style="font-size:0.75em; color: var(--text-soft);">Idle</span>
          </div>
        </div>
      </div>
    </section>
  `;
}

// Marked for rollback only while hidden from render tree.
void renderNotificationSection;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Legacy Cloudflare changelog UI kept for rollback.
function renderReleaseManagementSection(entries: ChangelogEntry[], config: ChangelogConfig): string {
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const applyMode = config.applyMode === "auto_github" ? "auto_github" : "manual";
  const autoSyncEnabled = config.autoSyncEnabled === true;
  const autoSyncIntervalMinutes = Number.isFinite(Number(config.autoSyncIntervalMinutes))
    ? Math.max(5, Math.min(1440, Number(config.autoSyncIntervalMinutes)))
    : 60;
  const syncStatus = config.lastAutoSyncStatus || "idle";
  const syncStatusText =
    syncStatus === "ok" ? "Auto sync healthy" : syncStatus === "error" ? "Auto sync error" : "Auto sync idle";
  const syncStatusColor =
    syncStatus === "ok" ? "#86efac" : syncStatus === "error" ? "#fca5a5" : "var(--text-soft)";
  
  // Versions for DataList
  const knownVersions = Array.from(new Set(sorted.map(e => e.version)));
  const dataListOptions = [
    '<option value="all">Global (All Versions)</option>',
    ...knownVersions.map(v => `<option value="${escapeHtml(v)}">v${escapeHtml(v)}</option>`)
  ].join('');

  const releaseCount = sorted.length;
  const historyHtml = sorted.map(e => `
    <div class="cl-history-item" data-release-id="${escapeHtml(e.id)}">
      <div class="cl-history-header">
        <div class="cl-history-meta">
          <span class="cl-version-badge">v${escapeHtml(e.version)}</span>
          <span class="cl-date">${new Date(e.date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div class="cl-actions">
           <button class="cl-action-btn edit-cl-btn" data-id="${escapeHtml(e.id)}" title="Edit release">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
           </button>
           <button class="cl-action-btn delete-cl-btn" data-id="${escapeHtml(e.id)}" title="Delete release">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
           </button>
        </div>
      </div>
      <ul class="cl-changes-list">
        ${
          (e.summary || (Array.isArray(e.added) && e.added.length) || (Array.isArray(e.changed) && e.changed.length) || (Array.isArray(e.fixed) && e.fixed.length))
            ? `
              ${e.summary ? `<li><strong>Summary:</strong> ${escapeHtml(e.summary)}</li>` : ""}
              ${Array.isArray(e.added) ? e.added.map((c) => `<li><strong>Added:</strong> ${escapeHtml(c)}</li>`).join("") : ""}
              ${Array.isArray(e.changed) ? e.changed.map((c) => `<li><strong>Changed:</strong> ${escapeHtml(c)}</li>`).join("") : ""}
              ${Array.isArray(e.fixed) ? e.fixed.map((c) => `<li><strong>Fixed:</strong> ${escapeHtml(c)}</li>`).join("") : ""}
            `
            : e.changes.map(c => `<li>${escapeHtml(c)}</li>`).join('')
        }
      </ul>
    </div>
  `).join('') || `
    <div class="cl-empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <p>No releases published yet</p>
      <span>Create your first release using the form above</span>
    </div>
  `;

  return `
    <section class="card config-card" id="release">
       <h2>
         <span>📢</span> Release Publishing
         <span class="release-count-badge">${releaseCount}</span>
       </h2>
       <div class="section-subtitle">
         Publish a new changelog entry. This text appears when users click the version pill.
       </div>
       <div style="display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap:10px; margin: 10px 0 16px;">
         <label style="display:flex; flex-direction:column; gap:6px; font-size:0.78em; color: var(--text-soft);">
           Apply Mode
           <select id="cl-apply-mode" class="input-field" style="padding:8px 10px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: white; border-radius: 8px;">
             <option value="manual" ${applyMode === "manual" ? "selected" : ""}>Manual</option>
             <option value="auto_github" ${applyMode === "auto_github" ? "selected" : ""}>Auto GitHub</option>
           </select>
         </label>
         <label style="display:flex; flex-direction:column; gap:6px; font-size:0.78em; color: var(--text-soft);">
           Auto Sync Interval (minutes)
           <input id="cl-auto-sync-interval" type="number" min="5" max="1440" value="${autoSyncIntervalMinutes}" class="input-field" style="padding:8px 10px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: white; border-radius: 8px;" />
         </label>
         <label style="display:flex; align-items:center; gap:8px; font-size:0.78em; color: var(--text-soft); margin-top: 20px;">
           <input id="cl-auto-sync-enabled" type="checkbox" ${autoSyncEnabled ? "checked" : ""} />
           Auto Sync Enabled
         </label>
         <div style="display:flex; flex-direction:column; justify-content:center; gap:4px; font-size:0.78em;">
           <span id="cl-sync-status" style="color:${syncStatusColor}; font-weight:600;">${syncStatusText}</span>
           <span id="cl-sync-error" style="color:#fca5a5;">${escapeHtml(config.lastAutoSyncError || "")}</span>
         </div>
       </div>

       <!-- Edit Mode Banner -->
       <div id="edit-mode-banner" class="edit-mode-banner">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
         <span class="edit-mode-text">Editing <strong id="edit-mode-version">v1.0.0</strong></span>
         <button id="btn-cancel-edit" class="btn-cancel-edit">Cancel</button>
       </div>

       <div class="split-section" style="gap: 24px;">
         <!-- Left: Create/Edit Form -->
         <div style="flex: 1;">
           <div class="section-header" style="margin-bottom: 12px;">Create New Release</div>
           <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border: 1px solid var(--border-subtle);">
              <input type="hidden" id="edit-cl-id" value="">
              
              <div style="margin-bottom: 14px;">
                 <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 6px;">Version</label>
                 <input list="known-versions-release" id="new-cl-version" placeholder="e.g. 1.2.4" class="input-field" style="width: 100%; padding: 10px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: white; border-radius: 8px; font-size: 0.95em;">
                 <datalist id="known-versions-release">
                   ${dataListOptions}
                 </datalist>
              </div>

              <div style="margin-bottom: 16px;">
                 <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 6px;">Changes (one per line)</label>
                 <div class="textarea-wrapper">
                   <textarea id="new-cl-changes" rows="5" class="input-field" placeholder="- Added new feature X&#10;- Fixed bug with Y&#10;- Improved performance" style="width: 100%; padding: 10px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color: white; border-radius: 8px; font-size: 0.9em; line-height: 1.5; resize: vertical;"></textarea>
                   <span id="char-counter" class="char-counter">0 / 500</span>
                 </div>
              </div>

              <div style="margin-bottom: 14px;">
                 <label style="font-size: 0.75em; color: var(--text-soft); display: flex; align-items:center; gap:8px; margin-bottom: 6px;">
                   User-Friendly Markdown
                   <button type="button" id="cl-format-help" class="cl-help-btn" title="Show markdown format help">i</button>
                 </label>
                 <input id="new-cl-markdown-url" class="input-field" placeholder="GitHub raw URL (optional)" style="width:100%; padding:10px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color:white; border-radius:8px; font-size:0.88em; margin-bottom:8px;">
                 <textarea id="new-cl-markdown" rows="10" class="input-field" placeholder="## v1.3.8&#10;### Summary&#10;Improved changelog reliability and release delivery for normal users.&#10;### Added&#10;- ...&#10;### Changed&#10;- ...&#10;### Fixed&#10;- ..." style="width:100%; padding:10px 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); color:white; border-radius:8px; font-size:0.88em; line-height:1.5; resize:vertical;"></textarea>
                 <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                   <button type="button" id="btn-preview-markdown" class="btn btn-secondary" style="padding:8px 12px;">Preview Draft</button>
                   <button type="button" id="btn-import-markdown-url" class="btn btn-secondary" style="padding:8px 12px;">Import From URL</button>
                   <a href="https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/user-friendly-changelog.md" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="padding:8px 12px; text-decoration:none;">Open GitHub Source</a>
                 </div>
              </div>
              
              <button id="btn-save-all" class="btn btn-primary" style="width: 100%; padding: 14px 24px; background: var(--success); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span id="btn-save-text">Save Draft</span>
              </button>
              <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
                <button id="btn-publish-draft" class="btn btn-secondary" style="padding:8px 12px;">Publish Draft</button>
                <button id="btn-sync-now" class="btn btn-secondary" style="padding:8px 12px;">Sync Now (Auto)</button>
                <button id="btn-save-mode" class="btn btn-secondary" style="padding:8px 12px;">Save Mode</button>
              </div>
              <div id="cl-action-status" style="margin-top:8px; font-size:0.75em; color: var(--text-soft);">Idle</div>
              
           <div style="margin-top: 10px; font-size: 0.75em; color: var(--text-soft); text-align: center;">
                 💡 Tip: Press <kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace;">Ctrl+Enter</kbd> to save quickly
              </div>
           </div>
         </div>
         
         <!-- Right: History -->
         <div style="flex: 1;">
           <div class="section-header" style="margin-bottom: 12px;">Historical Releases</div>
           <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
             <span style="font-size: 0.8em; color: var(--text-muted);">Click a release to edit it</span>
             <span style="font-size: 0.75em; color: var(--text-muted);">${releaseCount} releases</span>
           </div>
           <div class="cl-history-list" style="overflow-y: auto; max-height: 400px; padding-right: 8px;">
             ${historyHtml}
           </div>
           <div style="margin-top:14px; padding:12px; border:1px solid var(--border-subtle); border-radius:10px; background:rgba(255,255,255,0.03);">
             <div class="section-header" style="margin-bottom:8px;">Live Preview (Users See This)</div>
             <div id="cl-current-preview" class="cl-render-preview" style="max-height:180px; overflow:auto;"></div>
           </div>
           <div style="margin-top:10px; padding:12px; border:1px solid var(--border-subtle); border-radius:10px; background:rgba(255,255,255,0.03);">
             <div class="section-header" style="margin-bottom:8px;">Draft Preview (Unpublished)</div>
             <div id="cl-draft-preview" class="cl-render-preview" style="max-height:220px; overflow:auto;"></div>
           </div>
           <div style="margin-top:10px; padding:12px; border:1px solid var(--border-subtle); border-radius:10px; background:rgba(255,255,255,0.03);">
             <div class="section-header" style="margin-bottom:8px;">Revision History</div>
             <div id="cl-revision-history" style="max-height:180px; overflow:auto; display:flex; flex-direction:column; gap:8px;"></div>
           </div>
         </div>
       </div>
    </section>
  `;
}
// LEGACY_CHANGELOG_DISABLED_END

export function renderDashboard(stats: StatsResponse): string {
  const quota = stats.quota;
  const stateTag = quotaToStateTag(quota);
  const flag = quotaToFlag(quota);

  const requestsToday = quota?.requestsToday ?? 0;
  const remoteEnabled = quota?.remoteEnabled ?? true;
  const quotaLevel = quota?.quotaLevel ?? "UNKNOWN";
  const batchSize = quota?.batchSizeSuggestion ?? 50;

  const lastEventAt = formatTs(stats.lastEventAt);
  const lastFlushAt = formatTs(stats.lastFlushAt);
  const ageLastEvent = formatAge(stats.lastEventAt);
  const ageLastFlush = formatAge(stats.lastFlushAt);

  const maxBatchEvents = stats.envSnapshot?.maxBatchEvents || "n/a";
  const oracleEndpoint = stats.envSnapshot?.oracleEndpoint || "unknown";
  const nextAutoFlush =
    maxBatchEvents !== "n/a"
      ? `when buffer ≥ ${maxBatchEvents} events`
      : "unknown";

  const workerUrl = "https://cqd-analytics.adhamhaithameid.workers.dev";
  
  const isApproximated = stats.isApproximated ?? false;
  const uniqueCountriesAllTime =
    stats.uniqueCountriesAllTime ??
    Object.keys(stats.counters?.byCountry || {}).filter((country) => {
      const normalized = String(country || "").trim().toLowerCase();
      return normalized !== "" && normalized !== "xx" && normalized !== "unknown";
    }).length;
  const uniqueIpsDisplay = uniqueCountriesAllTime.toLocaleString();

  const remoteConfig = stats.remoteConfig || {};
  const cfgVersion = remoteConfig.configVersion ?? 1;
  const cfgBatchSize = remoteConfig.batchSize ?? 50;
  const cfgMaxDaily = remoteConfig.maxDailyRequests ?? 50;
  const cfgMaxRetry = remoteConfig.maxRetry ?? 5;
  const cfgMaxEvents = remoteConfig.maxEventsPerRequest ?? 5000;
  const cfgMaxBuffer = remoteConfig.maxBufferSize ?? 50000;
  const cfgFlushMode = remoteConfig.flushMode ?? "next_day";
  const cfgTimeLow = remoteConfig.timeFlushMinutes?.low ?? 1440;
  const cfgTimeMid = remoteConfig.timeFlushMinutes?.mid ?? 1440;
  const cfgTimeHigh = remoteConfig.timeFlushMinutes?.high ?? 1440;
  const cfgDailyStart = remoteConfig.dailyFlushWindowStartUtc ?? 1;
  const cfgDailyMinutes = remoteConfig.dailyFlushWindowMinutes ?? 120;
  const cfgCancelHold = remoteConfig.cancelHoldDelayMs ?? 1000;
  const cfgAllowLegacy = remoteConfig.allowLegacyEvents ?? true;
  const cfgRemoteReason = remoteConfig.remoteEnabledReason ?? "ok";
  const pipelineHealthUrl = `${workerUrl}/pipeline-health`;
  const oracleDashboardUrl = (() => {
    const resolved = resolveOracleEndpoint(oracleEndpoint);
    if (resolved.ok && resolved.protocol === "https:") {
      return `${resolved.baseUrl}/`;
    }
    return `${workerUrl}/api/public/website/overview`;
  })();
  const uptimeStatusUrl = pipelineHealthUrl;
  const cfgHealth = remoteConfig.healthThresholds || {
    warnPendingBatches: 10,
    criticalPendingBatches: 25,
    warnFailures: 3,
    criticalFailures: 5,
    warnStaleMs: 6 * 60 * 60 * 1000,
    criticalStaleMs: 24 * 60 * 60 * 1000,
    warnBufferUtil: 0.8,
    criticalBufferUtil: 0.95,
  };
  const cfgHealthWarnPending = cfgHealth.warnPendingBatches ?? 10;
  const cfgHealthCritPending = cfgHealth.criticalPendingBatches ?? 25;
  const cfgHealthWarnFailures = cfgHealth.warnFailures ?? 3;
  const cfgHealthCritFailures = cfgHealth.criticalFailures ?? 5;
  const cfgHealthWarnStaleHours = Math.round((cfgHealth.warnStaleMs ?? 21600000) / 3600000);
  const cfgHealthCritStaleHours = Math.round((cfgHealth.criticalStaleMs ?? 86400000) / 3600000);
  const cfgHealthWarnBufferPct = Math.round((cfgHealth.warnBufferUtil ?? 0.8) * 100);
  const cfgHealthCritBufferPct = Math.round((cfgHealth.criticalBufferUtil ?? 0.95) * 100);
  const cfgHealthNotify = remoteConfig.healthNotifyIntervalsMs || {
    warn: 30 * 60 * 1000,
    critical: 10 * 60 * 1000,
  };
  const cfgHealthNotifyWarnMin = Math.round((cfgHealthNotify.warn ?? 1800000) / 60000);
  const cfgHealthNotifyCritMin = Math.round((cfgHealthNotify.critical ?? 600000) / 60000);

  const renderTableRows = (data: Record<string, number>, dimension?: string) => {
    const keys = Object.keys(data).sort((a, b) => data[b] - data[a]);
    if (keys.length === 0) return "<tr><td colspan='2'>—</td></tr>";
    return keys
      .map((k) => {
        const countryName = dimension === "country" ? countryNameFromCode(k) : "";
        const tooltipAttr = countryName ? ` data-tooltip="${escapeHtml(countryName)}"` : "";
        return `<tr><td${tooltipAttr}>${escapeHtml(k)}</td><td>${data[k]}</td></tr>`;
      })
      .join("");
  };

  const byTypeRows = renderTableRows(stats.counters.byType || {});
  const byStatusRows = renderTableRows(stats.counters.byStatus || {});
  const byBrowserRows = renderTableRows(stats.counters.byBrowser || {});
  const byOsRows = renderTableRows(stats.counters.byOs || {});
  const byExtVersionRows = renderTableRows(stats.counters.byExtVersion || {});
  const byLangRows = renderTableRows(stats.counters.byLanguage || {});
  const byCountryRows = renderTableRows(stats.counters.byCountry || {}, "country");
  const byErrorRows = renderTableRows(stats.counters.byErrorType || {});

  const totalSuccess = stats.totalSuccess || 0;
  const totalFail = stats.totalFail || 0;
  const srMeta = classifySuccessRate(totalSuccess, totalFail);
  const totalAttempts = totalSuccess + totalFail;
  const failRate =
    totalAttempts > 0 ? (totalFail / totalAttempts) * 100 : null;
  const failRateText = failRate !== null ? `${failRate.toFixed(1)}%` : "—";
  
  // Success percentage for donut chart
  const successPercent = totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 0;
  const successPercentText = successPercent > 0 ? `${successPercent.toFixed(0)}%` : "—";
  // Donut chart gradient (green = success, red = fail)
  const donutGradient = `conic-gradient(var(--success) 0% ${successPercent}%, var(--danger) ${successPercent}% 100%)`;

  // Unique counts for breakdown tables
  const uniqueType = Object.keys(stats.counters.byType || {}).length;
  const uniqueStatus = Object.keys(stats.counters.byStatus || {}).length;
  const uniqueBrowser = Object.keys(stats.counters.byBrowser || {}).length;
  const uniqueOs = Object.keys(stats.counters.byOs || {}).length;
  const uniqueExtVersion = Object.keys(stats.counters.byExtVersion || {}).length;
  const uniqueLang = Object.keys(stats.counters.byLanguage || {}).length;
  const uniqueCountry = Object.keys(stats.counters.byCountry || {}).length;
  const uniqueError = Object.keys(stats.counters.byErrorType || {}).length;

  const hotType = topKey(stats.counters.byType);
  const hotBrowser = topKey(stats.counters.byBrowser);
  const hotOs = topKey(stats.counters.byOs);
  const hotCountry = topKey(stats.counters.byCountry);
  const hotCountryTooltipAttr = (() => {
    const countryName = countryNameFromCode(hotCountry);
    return countryName ? ` data-tooltip="${escapeHtml(countryName)}"` : "";
  })();

  const rawStatsJson = JSON.stringify(stats, null, 2)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const rawHealthJson = JSON.stringify({ ok: true, status: "loading" }, null, 2)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CQD Analytics – Worker & DO Dashboard</title>
  <link rel="icon" href="${FAVICON_PNG_DATA_URI}">
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    /* ===== COMPREHENSIVE DESIGN SYSTEM ===== */
    :root {
      color-scheme: dark;
      
      /* ===== PROFESSIONAL DARK THEME ===== */
      
      /* Background Hierarchy - Enhanced Contrast */
      --bg-base: #0a0b0f;
      --bg-card: #161820;
      --bg-elevated: #1e2029;
      --bg-surface: #141519;
      --bg-input: #0e0f14;
      --bg-hover: #282a36;
      --bg-active: #323444;
      
      /* Borders - Enhanced Contrast */
      --border: #363848;
      --border-muted: #2a2d3a;
      --border-hover: #525670;
      --border-focus: #4d8cf7;
      --border-subtle: rgba(255, 255, 255, 0.12);
      
      /* Primary Accent - Blue */
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
      --accent-muted: rgba(59, 130, 246, 0.15);
      --accent-strong: rgba(59, 130, 246, 0.25);
      --accent-light: #93c5fd;
      
      /* Status Colors */
      --success: #22c55e;
      --success-muted: rgba(34, 197, 94, 0.15);
      --success-bg: rgba(34, 197, 94, 0.10);
      --success-border: rgba(34, 197, 94, 0.35);
      --warning: #eab308;
      --warning-muted: rgba(234, 179, 8, 0.15);
      --warning-bg: rgba(234, 179, 8, 0.10);
      --warning-soft: rgba(234, 179, 8, 0.18);
      --danger: #ef4444;
      --danger-muted: rgba(239, 68, 68, 0.12);
      --danger-bg: rgba(239, 68, 68, 0.08);
      --danger-soft: rgba(127, 29, 29, 0.30);
      --danger-hover: #dc2626;
      
      /* Typography */
      --text-primary: #ffffff;
      --text-secondary: #b4b4bc;
      --text-muted: #8a8a94;
      --text-disabled: #5c5c66;
      --text-soft: #a8a8b4;
      --text-main: #ebebef;
      
      /* Spacing System */
      --space-0: 2px;
      --space-1: 4px;
      --space-2: 8px;
      --space-3: 12px;
      --space-4: 16px;
      --space-5: 20px;
      --space-6: 24px;
      --space-7: 28px;
      --space-8: 32px;
      --space-10: 40px;
      --space-12: 48px;
      --section-gap: 24px;
      
      /* Border Radius */
      --radius-xs: 4px;
      --radius-sm: 6px;
      --radius: 10px;
      --radius-lg: 14px;
      --radius-xl: 18px;
      --radius-full: 9999px;
      
      /* Shadows */
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
      --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
      --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);
      
      /* Layout */
      --sidebar-width: 220px;
      --content-max-width: 1200px;
      --header-height: 64px;
    }
    
    /* ===== TOGGLE SWITCH ===== */
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 26px;
      flex-shrink: 0;
    }
    
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      transition: all 0.3s ease;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
    }
    
    .toggle-slider::before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: var(--text-muted);
      border-radius: var(--radius-full);
      transition: all 0.3s ease;
      box-shadow: 0 6px 12px rgba(0,0,0,0.4);
    }
    
    .toggle-switch input:checked + .toggle-slider {
      background-color: var(--accent);
      border-color: var(--accent);
    }
    
    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(24px);
      background-color: white;
    }
    
    .toggle-switch input:focus + .toggle-slider {
      box-shadow: 0 0 0 2px var(--accent-muted);
    }
    
    /* ===== ANIMATIONS ===== */
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-100%); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    
    /* ===== BASE STYLES ===== */
    * { 
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    html { 
      scroll-behavior: smooth;
      overflow-x: hidden;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-base);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    
    /* ===== GLOBAL CURSOR STYLES ===== */
    a, button, .btn, .nav-item, .clickable, .toggle-switch, [role="button"] {
      cursor: pointer;
    }
    
    .info-card, [data-tooltip], .stat-card:not(:hover), .metric-label {
      cursor: help;
    }
    
    /* ===== LAYOUT WRAPPER ===== */
    .dashboard-layout {
      display: flex;
      min-height: 100vh;
    }
    
    /* ===== SIDEBAR NAVIGATION ===== */
    .sidebar-nav {
      position: fixed;
      left: 0;
      top: 0;
      width: var(--sidebar-width);
      height: 100vh;
      background: var(--bg-card);
      border-right: 1px solid var(--border);
      padding: 0;
      display: flex;
      flex-direction: column;
      z-index: 1000;
      overflow-y: auto;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: var(--shadow-lg);
    }
    
    .nav-header {
      padding: var(--space-2) var(--space-2);
      margin-bottom: var(--space-4);
      border-bottom: 1px solid var(--border);
    }

    @keyframes pulse-accent {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }
    
    .nav-brand {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }

    .nav-utc {
      display: flex;
      flex-direction: row;
      gap: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-variant-numeric: tabular-nums;
      font-size: 0.95rem;
      color: var(--text-primary);
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border-subtle);
      background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
      cursor: pointer;
      user-select: none;
    }

    .nav-utc-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .nav-utc-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 10px rgba(59,130,246,0.8);
      animation: pulse-accent 2s infinite;
    }

    .nav-utc small {
      font-size: 0.65rem;
      color: var(--text-muted);
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .nav-utc-time {
      font-size: 1.5rem;
      color: var(--text-primary);
      letter-spacing: 0.06em;
      white-space: nowrap;
      transition: font-size 0.2s ease;
    }

    .nav-utc-time.is-12h {
      font-size: 1.1rem;
    }
    
    .nav-subtitle {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-top: 2px;
    }
    
    .nav-section {
      padding: var(--space-3) var(--space-4);
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-disabled);
    }
    
    .nav-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      margin: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    
    .nav-item:hover {
      color: var(--text-secondary);
      background: var(--bg-hover);
    }
    
    .nav-item.active {
      color: var(--accent-hover);
      background: rgba(59, 130, 246, 0.3);
      border-left: 2px solid var(--accent);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      margin-left: 0;
      padding-left: calc(var(--space-5) - 2px);
    }
    
    .nav-item.active .nav-icon {
      color: var(--accent);
    }
    
    /* Scroll offset for section anchors */
    section[id] {
      scroll-margin-top: 24px;
    }
    
    .nav-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }
    
    .nav-item.danger-nav {
      color: var(--danger);
    }
    
    .nav-item.danger-nav:hover {
      background: var(--danger-bg);
    }
    
    /* Hamburger Menu */
    .hamburger-btn {
      display: none;
      position: fixed;
      top: var(--space-4);
      left: var(--space-4);
      z-index: 1100;
      width: 44px;
      height: 44px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      align-items: center;
      justify-content: center;
      color: var(--text-primary);
    }
    
    .hamburger-btn svg {
      width: 22px;
      height: 22px;
    }
    
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 999;
      backdrop-filter: blur(4px);
    }
    
    /* ===== MAIN CONTENT ===== */
    .main-content {
      flex: 1;
      margin-left: var(--sidebar-width);
      padding: var(--space-6);
      max-width: 100%;
      overflow-x: hidden;
    }
    
    .page {
      max-width: var(--content-max-width);
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }
    
    .hidden { display: none !important; }
    
    /* ===== HEADER ===== */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-4);
      padding-bottom: var(--space-5);
      border-bottom: 1px solid var(--border);
      animation: fadeSlideUp 0.4s ease-out;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }
    
    .header-logo {
      width: 44px;
      height: 44px;
      border-radius: var(--radius);
    }
    
    .title-block h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--text-primary);
    }
    
    .title-block p {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 2px;
    }
    
    /* ===== MAIN LAYOUT ===== */
    .page {
      max-width: 1000px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-8);
    }
    
    .hidden { display: none; }
    
    /* ===== HEADER ===== */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-5);
      padding-bottom: var(--space-6);
      border-bottom: 1px solid var(--border);
      animation: fadeSlideUp 0.5s ease-out;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }
    
    .header-logo {
      width: 44px;
      height: 44px;
      border-radius: var(--radius);
    }
    
    .title-block h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--text-primary);
    }
    
    .title-block p {
      margin: var(--space-1) 0 0;
      font-size: 0.8rem;
      letter-spacing: 0.02em;
      color: var(--text-muted);
    }

    /* Header Controls */
    .header-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }
    
    .live-wrapper {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    
    .refresh-indicator {
      text-align: right;
      font-size: 0.75rem;
    }
    
    .refresh-label {
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-disabled);
      font-size: 0.65rem;
    }
    
    .refresh-value {
      color: var(--text-secondary);
      font-feature-settings: "tnum" 1;
    }
    
    /* Live Indicator - Slow Rhythmic Pulse */
    .live-indicator {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }
    
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      background: var(--success);
    }
    
    .live-label { font-weight: 600; }
    
    @keyframes live-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    
    .live-indicator[data-state="live"] .live-dot {
      animation: live-pulse 2.5s ease-in-out infinite;
    }
    
    .live-indicator[data-state="stale"] .live-dot {
      background: var(--warning);
      animation: none;
    }
    
    .live-indicator[data-state="cold"] .live-dot {
      background: var(--danger);
      animation: none;
    }
    
    /* Info Button */
    .info-btn {
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .info-btn:hover {
      border-color: var(--border-muted);
      color: var(--text-secondary);
      background: var(--zinc-800);
    }
    
    .info-pill {
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.65rem;
      color: var(--text-muted);
    }
    
    .info-pill-flag {
      border-color: rgba(34, 197, 94, 0.4);
      color: var(--success);
    }
    
    .info-icon {
      width: 20px;
      height: 20px;
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
    }

    /* Changelog Styles */
    .cl-ver { font-weight: 700; color: var(--accent); }
    .cl-date { font-size: 0.75rem; color: var(--text-soft); }
    .cl-changes { padding-left: 16px; margin: 0; color: #d1d5db; }
    .cl-changes li { margin-bottom: 4px; }
    .btn-xs { padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; background: rgba(239,68,68,0.1); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); cursor: pointer; }
    .btn-xs:hover { background: rgba(239,68,68,0.2); }
    
    .field-row { margin-bottom: 12px; }
    .input-sm { padding: 6px 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); color: white; border-radius: 6px; width: 100%; }
    .input-area { padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); color: white; border-radius: 6px; width: 100%; height: 80px; resize: vertical; margin-bottom: 8px; }

    /* ===== MAIN CONTENT ===== */
    main {
      display: flex;
      flex-direction: column;
      gap: var(--section-gap);
    }
    
    /* Cards - Professional Style */
    .card {
      background: linear-gradient(135deg, var(--bg-card) 0%, rgba(20, 21, 28, 0.95) 100%);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      padding: var(--space-6);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation: fadeSlideUp 0.5s ease-out backwards;
      position: relative;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    .card:hover {
      border-color: var(--border-hover);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      transform: translateY(-2px);
    }
    
    .card h2 {
      margin: 0 0 var(--space-5);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    
    .section-header {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      margin-bottom: var(--space-2);
      font-weight: 600;
    }
    
    .section-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-4);
    }
    
    .section-title-row h2 {
      margin-bottom: 0;
    }
    
    .btn-toggle-all {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .btn-toggle-all:hover {
      background: var(--accent-muted);
      border-color: var(--accent);
      color: var(--accent-light);
    }
    
    .btn-toggle-all svg {
      width: 14px;
      height: 14px;
    }
    
    .btn-toggle-all .icon-expand {
      display: none;
    }
    
    .btn-toggle-all[data-expanded="false"] .icon-collapse {
      display: none;
    }
    
    .btn-toggle-all[data-expanded="false"] .icon-expand {
      display: block;
    }
    
    .section-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: var(--space-5);
      line-height: 1.5;
    }
    
    /* Config card unified styling */
    .config-card {
      background: var(--bg-card);
    }

    .config-card h2 {
      color: var(--text-secondary);
    }

    /* Remote Config Form */
    .rc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--space-4);
    }

    .rc-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: var(--space-4);
      background: var(--bg-elevated);
      border: 1px solid var(--border-muted);
      border-radius: var(--radius);
      transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    }

    .rc-field:hover {
      border-color: var(--border-hover);
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(0,0,0,0.25);
    }

    .rc-field label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      font-weight: 600;
    }

    .rc-input, .rc-select {
      padding: 10px 12px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s ease;
      font-variant-numeric: tabular-nums;
    }

    .rc-input:focus, .rc-select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(59,130,246,0.18);
    }

    .rc-hint {
      font-size: 0.75rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .rc-section-title {
      margin-top: var(--space-4);
      margin-bottom: var(--space-2);
      font-size: 0.75rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--text-disabled);
    }

    .rc-section-desc {
      margin-bottom: var(--space-4);
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .rc-actions {
      display: flex;
      gap: var(--space-3);
      margin-top: var(--space-4);
      flex-wrap: wrap;
      align-items: center;
    }

    .rc-status {
      margin-top: var(--space-3);
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .rc-status.ok {
      color: var(--success);
    }

    .rc-status.err {
      color: var(--danger);
    }

    .rc-warning {
      margin-top: var(--space-3);
      margin-bottom: var(--space-3);
      padding: 12px 14px;
      border-radius: var(--radius);
      border: 1px solid rgba(234, 179, 8, 0.55);
      background: linear-gradient(135deg, rgba(234, 179, 8, 0.12), rgba(234, 179, 8, 0.06));
      color: #fcd34d;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      box-shadow: inset 0 0 0 1px rgba(234, 179, 8, 0.08);
    }

    .rc-warning.is-off {
      border-color: var(--border);
      background: var(--bg-surface);
      color: var(--text-muted);
    }

    .rc-warning-title {
      font-weight: 600;
      font-size: 0.85rem;
      letter-spacing: 0.02em;
    }

    .rc-warning-body {
      font-size: 0.78rem;
      color: inherit;
      margin-top: 2px;
      line-height: 1.4;
    }

    .health-banner {
      margin-top: var(--space-4);
      margin-bottom: var(--space-4);
      padding: 14px 16px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .health-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .health-chip {
      font-size: 0.65rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-muted);
    }

    .health-chip.ok {
      color: var(--success);
      border-color: rgba(34, 197, 94, 0.45);
      background: rgba(34, 197, 94, 0.12);
    }

    .health-chip.warn {
      color: var(--warning);
      border-color: rgba(234, 179, 8, 0.55);
      background: rgba(234, 179, 8, 0.12);
    }

    .health-chip.critical {
      color: var(--danger);
      border-color: rgba(239, 68, 68, 0.55);
      background: rgba(239, 68, 68, 0.12);
    }

    .health-banner.ok {
      border-color: rgba(34, 197, 94, 0.45);
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.04));
    }

    .health-banner.warn {
      border-color: rgba(234, 179, 8, 0.55);
      background: linear-gradient(135deg, rgba(234, 179, 8, 0.12), rgba(234, 179, 8, 0.04));
    }

    .health-banner.critical {
      border-color: rgba(239, 68, 68, 0.55);
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
    }

    .health-status {
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-size: 0.72rem;
    }

    .health-reasons {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .health-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
      margin-top: 6px;
    }

    .health-metric {
      background: rgba(255,255,255,0.03);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      padding: 8px 10px;
      font-size: 0.78rem;
      color: var(--text-secondary);
    }

    .health-metric strong {
      display: block;
      color: var(--text-primary);
      font-size: 0.9rem;
    }

    .health-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 8px;
      margin-top: 10px;
    }

    .health-detail {
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: rgba(255,255,255,0.02);
      padding: 10px 12px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .health-detail strong {
      display: block;
      margin-top: 4px;
      font-size: 0.9rem;
      color: var(--text-primary);
    }
    
    /* Grid Layouts */
    .grid-5 {
      display: grid;
      grid-template-columns: repeat(5, minmax(120px, 280px));
      gap: var(--space-2);
    }
    
    .grid-5 .metric {
      max-width: 280px;
      min-width: 120px;
      padding: var(--space-4);
    }
    
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-4);
    }
    
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-4);
    }
    
    .split-section {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-5);
    }
    
    /* ===== METRIC CARDS (KPI) ===== */
    .metric {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-4);
      border-radius: var(--radius);
      background: var(--bg-surface);
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }
    
    .metric:hover {
      border-color: var(--border);
    }
    
    .metric-compact {
      padding: var(--space-3);
    }
    
    .metric-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--text-muted);
      font-weight: 500;
    }
    
    .metric-value {
      font-size: 2.25rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: var(--text-primary);
      line-height: 1;
    }
    
    .metric-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: var(--space-1);
    }

    .metric-good .metric-value { color: var(--success); }
    .metric-warn .metric-value { color: var(--warning); }
    .metric-bad .metric-value { color: var(--danger); }

    .empty-state {
      margin-top: var(--space-3);
      font-size: 0.8rem;
      color: var(--text-disabled);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-sm);
      border: 1px dashed var(--border);
      background: var(--bg-surface);
    }

    @keyframes flash-green {
      0% { background-color: rgba(34, 197, 94, 0.2); }
      100% { background-color: transparent; }
    }
    @keyframes text-flash {
      0% {
        color: #fff;
        text-shadow: 0 0 10px rgba(255,255,255,0.5);
      }
      100% {
        color: inherit;
        text-shadow: none;
      }
    }
    .updated {
      animation: flash-green 1.5s ease-out;
    }
    .updated .metric-value,
    .updated strong,
    .updated .quota-val,
    .updated .live-indicator .live-dot {
      animation: text-flash 1.5s ease-out;
    }

    /* ===== TABLES ===== */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }
    th, td {
      padding: var(--space-2);
      text-align: left;
    }
    th {
      font-weight: 600;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-disabled);
      border-bottom: 1px solid var(--border);
    }
    td {
      color: var(--text-secondary);
    }
    tr:not(:last-child) td {
      border-bottom: 1px solid var(--bg-surface);
    }
    tr:hover td {
      color: var(--text-primary);
      background: rgba(255,255,255,0.02);
    }

    /* Breakdown Grid */
    .breakdown-grid {
      margin-top: var(--space-2);
      align-items: start;
    }
    .breakdown-block {
      border-radius: var(--radius);
      border: 1px solid var(--border);
      padding: var(--space-4);
      background: var(--bg-surface);
      transition: border-color 0.2s ease, padding 0.3s ease;
      height: auto;
    }
    
    .breakdown-block.collapsed {
      padding-bottom: var(--space-4);
    }
    
    .breakdown-block:hover {
      border-color: var(--border-muted);
    }

    /* Collapsible breakdown sections - animations handled via max-height */
    .breakdown-block .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
      margin-bottom: 0;
    }
    /* Toggle Button - Enhanced Visual */
    .breakdown-toggle {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.25s ease;
      flex-shrink: 0;
    }
    .breakdown-toggle svg {
      width: 14px;
      height: 14px;
      transition: transform 0.25s ease;
    }
    .breakdown-toggle:hover {
      background: var(--accent-muted);
      border-color: var(--accent);
      color: var(--accent-light);
    }
    .breakdown-block.collapsed .breakdown-toggle {
      transform: rotate(90deg);
    }
    
    .breakdown-content {
      margin-top: var(--space-4);
      max-height: 600px;
      overflow: hidden;
      opacity: 1;
      transition: max-height 0.3s ease, opacity 0.25s ease, margin-top 0.3s ease;
    }
    
    .breakdown-block.collapsed .breakdown-content {
      max-height: 0;
      opacity: 0;
      margin-top: 0;
    }

    /* External links bar */
    .external-links {
      display: flex;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
    }
    .btn-external {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius);
      border: 1px solid var(--border-hover);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      font-size: 0.8rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      box-shadow: var(--shadow-sm);
    }
    .btn-external:hover {
      border-color: var(--accent);
      color: var(--text-primary);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }
    .btn-external.oracle {
      border-color: rgba(147, 51, 234, 0.5);
      background: rgba(147, 51, 234, 0.08);
    }
    .btn-external.oracle:hover {
      background: rgba(147, 51, 234, 0.18);
      border-color: rgba(147, 51, 234, 0.8);
      color: #c4b5fd;
    }
    .btn-external.uptime {
      border-color: rgba(34, 197, 94, 0.5);
      background: rgba(34, 197, 94, 0.08);
    }
    .btn-external.uptime:hover {
      background: rgba(34, 197, 94, 0.18);
      border-color: rgba(34, 197, 94, 0.8);
      color: #86efac;
    }
    .btn-external.github {
      border-color: rgba(255, 255, 255, 0.25);
      background: rgba(255, 255, 255, 0.05);
    }
    .btn-external.github:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.5);
      color: #ffffff;
    }
    .btn-external.sheets {
      border-color: rgba(52, 168, 83, 0.5);
      background: rgba(52, 168, 83, 0.08);
    }
    .btn-external.sheets:hover {
      background: rgba(52, 168, 83, 0.18);
      border-color: rgba(52, 168, 83, 0.8);
      color: #6ee7a8;
    }

    /* Success/Failure Donut Chart */
    .donut-chart {
      position: relative;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    .donut-chart-center {
      position: absolute;
      width: 66px;
      height: 66px;
      background: var(--bg-card);
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 2px 8px rgba(0,0,0,0.2);
    }
    .donut-chart-percent {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .donut-chart-label {
      font-size: 0.6rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .totals-with-chart {
      display: flex;
      align-items: center;
      gap: var(--space-5);
    }

    /* Count unique badge */
    .unique-count {
      font-size: 0.7rem;
      color: var(--text-soft);
      background: rgba(255,255,255,0.05);
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 6px;
    }

    /* Hot Summary - 2-line breakdown header */
    .hot-summary {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-bottom: 16px;
      border-radius: 10px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-surface);
      overflow: hidden;
    }
    .hot-row {
      display: flex;
      align-items: center;
      padding: 10px 14px;
      gap: 16px;
    }
    .hot-row + .hot-row {
      border-top: 1px solid var(--border-subtle);
    }
    .hot-row-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent-light);
      font-weight: 600;
      min-width: 70px;
    }
    .hot-row-items {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      flex: 1;
    }
    .hot-item {
      min-width: 90px;
    }
    .hot-label {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-soft);
      margin-bottom: 2px;
    }
    .hot-value {
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--text-main);
    }

    /* Toggle rotation for collapsed state */
    .breakdown-toggle {
      transition: transform 0.2s ease;
    }
    .breakdown-block.collapsed .breakdown-toggle {
      transform: rotate(180deg);
    }

    /* ===== BUTTONS - ORACLE STYLE ===== */
    button.btn {
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      color: var(--text-secondary);
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      transition: all var(--transition-normal);
    }
    button.btn:hover {
      border-color: var(--border-hover);
      background: var(--bg-hover);
      color: var(--text-primary);
      transform: translateY(-1px);
    }
    button.btn:active {
      transform: translateY(0);
      background: var(--bg-surface);
    }
    .btn-bullet {
      font-size: 1.1em;
      line-height: 0;
      color: var(--accent);
    }

    /* Quota Tags */
    .quota-tag {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-full);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
      cursor: help;
    }

    /* ===== TOOLTIPS - POLISHED STYLE ===== */
    [data-tooltip] {
      position: relative;
      cursor: help;
    }

    [data-tooltip]::after {
      position: absolute;
      left: 50%;
      transform: translateX(-50%) translateY(0);
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease-out;
      pointer-events: none;
      z-index: 100;
      content: attr(data-tooltip);
      bottom: calc(100% + 8px);
      padding: 10px 14px;
      background: #1a1d26;
      border: 1px solid var(--border-hover);
      color: var(--text-primary);
      font-size: 0.8rem;
      font-weight: 500;
      line-height: 1.4;
      border-radius: var(--radius);
      white-space: normal;
      max-width: 280px;
      text-align: left;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    [data-tooltip]:hover::after {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(-4px);
    }

    /* ===== STATE TAGS ===== */
    .state-unknown, .flag-unknown {
      background: var(--bg-surface);
      color: var(--text-secondary);
      border: 1px dashed var(--border);
    }

    .state-sleeping, .state-super-chill, .state-chill, .state-easy, .state-kinda-easy {
      background: var(--bg-surface);
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }

    .state-normal, .state-slightly-busy {
      background: var(--accent-muted);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .state-kinda-busy, .state-busy, .state-very-busy, .state-super-busy {
      background: var(--warning-muted);
      color: #fdba74;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .state-emergency, .state-critical, .state-cut-power {
      background: var(--danger-muted);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .flag-easy { background: var(--success-muted); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.3); }
    .flag-normal { background: var(--accent-muted); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3); }
    .flag-hard { background: var(--warning-muted); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.3); }
    .flag-critical { background: var(--danger-muted); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }

    /* ===== DANGER ZONE - GUARDED STYLE ===== */
    .danger-zone {
      border: 1px solid rgba(220, 38, 38, 0.5);
      background: var(--danger-soft);
      position: relative;
      overflow: hidden;
    }

    .danger-zone:hover {
      border-color: rgba(220, 38, 38, 0.7);
    }
    .danger-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .danger-title {
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: #f87171;
      font-weight: 700;
    }
    
    /* Danger Section Groups */
    .danger-section {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid rgba(239, 68, 68, 0.12);
    }
    .danger-section:first-of-type {
      margin-top: 12px;
      border-top: none;
      padding-top: 0;
    }
    .danger-section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      color: rgba(252, 165, 165, 0.8);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    .danger-section-title svg {
      opacity: 0.7;
    }
    
    .danger-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      margin: 6px 0;
      border-radius: 8px;
      background: rgba(239, 68, 68, 0.04);
      transition: background 0.15s ease;
    }
    .danger-row:hover {
      background: rgba(239, 68, 68, 0.08);
    }
    .danger-desc {
      font-size: 0.9rem;
      color: #fca5a5;
      font-weight: 500;
    }
    .danger-sub {
      font-size: 0.75rem;
      color: rgba(254, 202, 202, 0.6);
      margin-top: 2px;
    }
    .btn-danger {
      padding: 8px 16px;
      font-size: 0.85rem;
      border-radius: 8px;
      border: 1px solid rgba(239, 68, 68, 0.4);
      background: rgba(127, 29, 29, 0.25);
      color: #fca5a5;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: var(--danger);
      color: #fecaca;
      box-shadow: 0 0 16px rgba(239, 68, 68, 0.2);
    }
    .btn-danger:active {
      background: var(--danger);
      color: #fff;
      transform: scale(0.98);
    }
    .btn-danger.destructive {
      background: rgba(185, 28, 28, 0.3);
      border-color: var(--danger);
      color: #fecaca;
    }
    .btn-danger.destructive:hover {
      background: var(--danger);
      color: #fff;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.35);
    }
    
    .btn-primary {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid var(--accent);
      background: var(--accent);
      color: white;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-primary:hover { background: #2563eb; }
    .btn-primary:active { background: #1d4ed8; }

    .btn-secondary {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: rgba(255,255,255,0.05);
      color: var(--text-main);
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-secondary:hover { background: rgba(255,255,255,0.1); }

    .auth-btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: rgba(255,255,255,0.05);
      color: var(--text-muted);
      cursor: pointer;
      transition: background 0.2s;
    }
    .auth-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-main); }

    .auth-bar {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .auth-input {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(248, 113, 113, 0.3);
      color: #fca5a5;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      outline: none;
      transition: all 0.2s;
    }
    .auth-input:focus {
      border-color: #ef4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
    }
    .auth-btn {
      padding: 6px 12px;
      font-size: 0.75rem;
      border-radius: 6px;
      border: 1px solid rgba(239, 68, 68, 0.5);
      background: transparent;
      color: #fca5a5;
      cursor: pointer;
    }
    .auth-btn:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    .danger-status-hint {
      font-size: 0.78rem;
      color: #fecaca;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .danger-status-label {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.7rem;
      color: rgba(254,202,202,0.8);
    }
    .danger-status-value {
      font-weight: 600;
    }
    .danger-status-value.enabled {
      color: #bbf7d0;
    }
    .danger-status-value.disabled {
      color: #fecaca;
    }
    .danger-chip {
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(248,113,113,0.8);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: rgba(127,29,29,0.5);
    }

    .code-block {
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 0.8rem;
      background: rgba(0,0,0,0.3);
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid rgba(148,163,184,0.1);
      color: #94a3b8;
      word-break: break-all;
      user-select: all;
    }
    .code-block:hover {
      color: #e2e8f0;
      border-color: rgba(148,163,184,0.3);
    }
    .code-block-large {
      display: block;
      margin-top: 8px;
      max-height: 260px;
      overflow: auto;
      padding: 8px 10px;
      background: rgba(15,23,42,0.9);
    }

    .quota-panel {
      background: var(--bg-surface);
      border-radius: 8px;
      padding: 16px;
      border: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .quota-stat {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      border-radius: 6px;
      transition: background 0.5s;
    }
    .quota-label {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .quota-val {
      font-weight: 600;
      font-size: 0.95rem;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .modal-overlay.open {
      display: flex;
      opacity: 1;
    }
    .modal {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      width: 100%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      transform: scale(0.95);
      transition: transform 0.2s;
      position: relative;
    }
    .modal-overlay.open .modal {
      transform: scale(1);
    }
    .modal h3 {
      margin-top: 0;
      font-size: 1.2rem;
    }
    .modal-section {
      margin-top: 16px;
    }
    .modal-section h4 {
      font-size: 0.85rem;
      color: var(--text-soft);
      text-transform: uppercase;
      margin-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 4px;
    }
    .modal-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      padding: 6px 0;
      border-bottom: 1px dashed rgba(255,255,255,0.05);
    }
    .modal-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 8px 0 10px;
    }
    .close-modal {
      position: absolute;
      top: 16px;
      right: 16px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1.2rem;
    }
    .close-modal:hover {
      color: #fff;
    }

    /* ===== MOBILE RESPONSIVE ===== */
    @media (max-width: 1024px) {
      .grid-4 { grid-template-columns: repeat(2, 1fr); }
      .main-content { padding: var(--space-5); }
    }
    
    @media (max-width: 768px) {
      /* Hide sidebar, show hamburger */
      .sidebar-nav {
        transform: translateX(-100%);
      }
      
      .sidebar-nav.open {
        transform: translateX(0);
        animation: slideInLeft 0.3s ease;
      }
      
      .hamburger-btn {
        display: flex;
      }
      
      .sidebar-overlay.active {
        display: block;
        animation: fadeIn 0.2s ease;
      }
      
      .main-content {
        margin-left: 0;
        padding: var(--space-4);
        padding-top: calc(var(--space-4) + 60px); /* Space for hamburger */
      }
      
      .page {
        gap: var(--space-4);
      }
      
      header {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-3);
      }
      
      .header-controls {
        width: 100%;
        justify-content: space-between;
        flex-wrap: wrap;
      }
      
      .grid-4,
      .grid-3 {
        grid-template-columns: 1fr;
      }
      
      .split-section {
        grid-template-columns: 1fr;
        gap: var(--space-4);
      }
      
      .card {
        padding: var(--space-5);
        border-radius: var(--radius);
      }
      
      .metric-value {
        font-size: 1.75rem;
      }
      
      .breakdown-grid {
        grid-template-columns: 1fr;
      }
      
      .hot-row {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      
      .hot-row-items {
        width: 100%;
        overflow-x: auto;
      }
      
      .danger-row {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-3);
      }
      
      .danger-row button {
        width: 100%;
      }
      
      .auth-bar {
        width: 100%;
        flex-direction: column;
        gap: var(--space-2);
      }
      
      .auth-input {
        width: 100%;
      }
      
      .modal {
        margin: var(--space-4);
        max-height: 90vh;
      }
    }
    
    @media (max-width: 480px) {
      body {
        padding: var(--space-2);
      }
      
      .title-block h1 {
        font-size: 1.25rem;
      }
      
      .card {
        padding: var(--space-3);
      }
      
      .metric-value {
        font-size: 1.25rem;
      }
    }
    
    /* Base version pill */
    .cqd-brand-version {
      font-weight: 600;
      color: #005dd7;
      background: #e3edff;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-block;
    }
    .cqd-brand-version:hover {
      background: #005dd7;
      color: white;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
    }
    
    /* STATES */
    .cqd-pill-minor {
      background: #005dd7 !important;
      color: #fff !important;
    }
    .cqd-pill-minor:hover {
      background: #2563eb !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4) !important;
    }
    
    .cqd-pill-major {
      background: #ef4444 !important;
      color: #fff !important;
    }
    .cqd-pill-major:hover {
      background: #dc2626 !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(239, 68, 68, 0.4) !important;
    }

    /* EFFECTS */
    .cqd-effect-glow-blue {
      box-shadow: 0 0 10px #00d2ff, 0 0 5px #007bff !important;
      border-color: #00d2ff !important;
    }
    .cqd-effect-glow-blue:hover {
      box-shadow: 0 0 15px #00d2ff, 0 0 10px #007bff, 0 4px 8px rgba(0, 210, 255, 0.3) !important;
    }
    
    .cqd-effect-glow-red {
      box-shadow: 0 0 10px #f87171, 0 0 5px #ef4444 !important;
      border-color: #f87171 !important;
    }
    .cqd-effect-glow-red:hover {
      box-shadow: 0 0 15px #f87171, 0 0 10px #ef4444, 0 4px 8px rgba(248, 113, 113, 0.3) !important;
    }

    @keyframes pulse-blue {
      0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
      100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
    }
    .cqd-effect-pulse-blue { animation: pulse-blue 2s infinite; }
    .cqd-effect-pulse-blue:hover { animation: pulse-blue 1s infinite; }

    @keyframes pulse-red {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .cqd-effect-pulse-red { animation: pulse-red 2s infinite; }
    .cqd-effect-pulse-red:hover { animation: pulse-red 1s infinite; }

    /* Release Manager Enhanced Styles */
    .cl-history-item {
      padding: 16px;
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      margin-bottom: 12px;
      transition: all 0.2s ease;
    }
    .cl-history-item:hover {
      background: rgba(255,255,255,0.04);
      border-color: rgba(59, 130, 246, 0.3);
    }
    .cl-history-item.editing {
      border-color: #f59e0b;
      background: rgba(245, 158, 11, 0.05);
    }
    .cl-history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .cl-history-meta {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cl-version-badge {
      font-weight: 700;
      color: #fff;
      background: var(--accent);
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 0.85em;
    }
    .cl-date {
      font-size: 0.8em;
      color: var(--text-soft);
    }
    .cl-actions {
      display: flex;
      gap: 6px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .cl-history-item:hover .cl-actions {
      opacity: 1;
    }
    .cl-action-btn {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid var(--border-subtle);
      background: rgba(255,255,255,0.05);
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    .cl-action-btn:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
      transform: translateY(-1px);
    }
    .cl-action-btn.edit-cl-btn:hover {
      border-color: #3b82f6;
      color: #60a5fa;
    }
    .cl-action-btn.delete-cl-btn:hover {
      border-color: #ef4444;
      color: #f87171;
    }
    .cl-changes-list {
      margin: 0;
      padding-left: 18px;
      font-size: 0.9em;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .cl-changes-list li {
      margin-bottom: 4px;
    }
    .cl-empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-soft);
    }
    .cl-empty-state p {
      margin: 12px 0 4px;
      font-size: 1em;
      color: var(--text-muted);
    }
    .cl-empty-state span {
      font-size: 0.85em;
    }

    .edit-mode-banner {
      display: none;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: var(--warning-soft);
      border: 1px solid var(--warning);
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .edit-mode-banner.active {
      display: flex;
    }
    .edit-mode-banner svg {
      color: #f59e0b;
    }
    .edit-mode-banner .edit-mode-text {
      flex: 1;
      font-size: 0.9em;
      color: #fbbf24;
    }
    .edit-mode-banner .edit-mode-text strong {
      color: #fcd34d;
    }
    .btn-cancel-edit {
      padding: 5px 12px;
      font-size: 0.8em;
      background: transparent;
      border: 1px solid rgba(245, 158, 11, 0.5);
      color: #fbbf24;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-cancel-edit:hover {
      background: rgba(245, 158, 11, 0.2);
      border-color: #f59e0b;
    }

    /* Character Counter */
    .textarea-wrapper {
      position: relative;
    }
    .char-counter {
      position: absolute;
      bottom: 8px;
      right: 10px;
      font-size: 0.7em;
      color: var(--text-soft);
      pointer-events: none;
    }
    .char-counter.warning { color: #f59e0b; }
    .char-counter.error { color: #ef4444; }

    .cl-help-btn {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 1px solid var(--border-subtle);
      background: rgba(255,255,255,0.08);
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .cl-help-btn:hover {
      color: var(--text-primary);
      border-color: rgba(59, 130, 246, 0.5);
      background: rgba(59,130,246,0.12);
    }
    .cl-render-preview h4 {
      margin: 0 0 4px;
      font-size: 0.86em;
      color: #cbd5e1;
    }
    .cl-render-preview .cl-preview-summary {
      margin: 0 0 8px;
      font-size: 0.82em;
      color: #d1d5db;
      line-height: 1.55;
    }
    .cl-render-preview ul {
      margin: 0 0 8px 16px;
      padding: 0;
      color: #9ca3af;
      font-size: 0.8em;
      line-height: 1.5;
    }
    .cl-revision-item {
      padding: 8px 10px;
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      background: rgba(255,255,255,0.02);
      font-size: 0.77em;
      color: #9ca3af;
      line-height: 1.45;
    }
    .cl-revision-item strong {
      color: #e5e7eb;
      font-size: 0.95em;
    }
    .cl-preview-empty {
      color: #94a3b8;
      font-size: 0.82em;
      font-style: italic;
    }

    /* Loading State */
    .btn-loading {
      position: relative;
      pointer-events: none;
      opacity: 0.8;
    }
    .btn-loading::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-left: 8px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Release Count Badge */
    .release-count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      font-size: 0.75em;
      font-weight: 600;
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      border-radius: 999px;
      margin-left: 8px;
    }

    /* Unsaved Changes Indicator */
    .unsaved-dot {
      display: none;
      width: 8px;
      height: 8px;
      background: #f59e0b;
      border-radius: 50%;
      margin-left: 8px;
      animation: pulse-orange 2s infinite;
    }
    .unsaved-dot.active {
      display: inline-block;
    }
    @keyframes pulse-orange {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Rule Preview in List */
    .rule-preview-mini {
      display: inline-block;
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 6px;
    }
  </style>
</head>
<body>
  <!-- Hamburger Menu Button -->
  <button class="hamburger-btn" id="hamburger-btn" aria-label="Toggle navigation">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  </button>
  
  <!-- Sidebar Overlay -->
  <div class="sidebar-overlay" id="sidebar-overlay"></div>

  <!-- Sidebar Navigation -->
  <nav class="sidebar-nav" id="sidebar">
    <div class="nav-header">
      <div class="nav-brand nav-utc" id="nav-utc-clock" data-tooltip="Current UTC time. All analytics and flush windows use UTC.">
        <div class="nav-utc-row">
          <span class="nav-utc-dot"></span>
          <small>UTC</small>
        </div>
        <span class="nav-utc-time">--:--:--</span>
      </div>
    </div>
    
    <div class="nav-section">Analytics</div>
    <a href="#overview" class="nav-item active" data-section="overview">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      Overview
    </a>
    <a href="#breakdown" class="nav-item" data-section="breakdown">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
      Breakdown
    </a>
    
    <div class="nav-section">System</div>
    <a href="#system" class="nav-item" data-section="system">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0-1.18-2.82H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08z"/></svg>
      Environment
    </a>
    <a href="#quota" class="nav-item" data-section="quota">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      Quota & Mode
    </a>
    <a href="#remote-config" class="nav-item" data-section="remote-config">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v6"/><path d="M12 17v6"/><path d="M4.22 4.22l4.24 4.24"/><path d="M15.54 15.54l4.24 4.24"/><path d="M1 12h6"/><path d="M17 12h6"/><path d="M4.22 19.78l4.24-4.24"/><path d="M15.54 8.46l4.24-4.24"/></svg>
      Remote Config
    </a>
    
    <div class="nav-section">Tools</div>
    <a href="#debug" class="nav-item" data-section="debug">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Debug & Actions
    </a>
    <a href="#raw" class="nav-item" data-section="raw">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      Raw JSON
    </a>
    
    <div class="nav-section">Security</div>
    <a href="#security" class="nav-item" data-section="security">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Security Settings
    </a>
    
    <div class="nav-section">Data</div>
    <a href="#datahub" class="nav-item" data-section="datahub">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
      Data Hub
    </a>
    
    <div class="nav-section">Admin</div>
    <a href="#danger" class="nav-item danger-nav" data-section="danger">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Danger Zone
    </a>
  </nav>

  <!-- Main Content -->
  <div class="main-content">
    <div class="page">
    <header>
      <div class="header-left">
        <div class="title-block">
          <h1>CQD Extension Analytics Dashboard</h1>
          <p>Real-time metrics from Cloudflare Worker & Durable Objects. Manual refresh only</p>
        </div>
      </div>
      <div class="header-controls">
        <button class="info-btn" id="info-btn" title="View Context & Legend" type="button">
          <span class="info-pill" id="header-pill-status">${stateTag.label}</span>
          <span class="info-pill info-pill-flag" id="header-pill-flag">${flag.label}</span>
          <span class="info-icon">!</span>
        </button>
        <div class="live-wrapper">
          <div class="live-indicator" id="live-indicator" data-state="live">
            <span class="live-dot"></span>
            <span class="live-label" id="live-label">Live</span>
          </div>
          <div class="refresh-indicator">
            <div class="refresh-label">Last refresh</div>
            <div class="refresh-value" id="last-refresh-label">—</div>
          </div>
        </div>
      </div>
    </header>

    <!-- External Links Bar -->
    <div class="external-links">
      <a href="/dashboard/website" class="btn-external oracle" data-tooltip="Open full website data console (KV, D1, telemetry, flush correlation)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 8h10"></path><path d="M7 12h10"></path><path d="M7 16h6"></path></svg>
        Open Website Data Console
      </a>
      <a href="https://classroom-quick-downloader-website.pages.dev/" target="_blank" class="btn-external oracle" data-tooltip="Open the public CQD website">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a15 15 0 0 1 0 18"></path><path d="M12 3a15 15 0 0 0 0 18"></path></svg>
        Website
      </a>
      <a href="https://github.com/adhamhaithameid/Classroom-Quick-Downloader" target="_blank" class="btn-external github" data-tooltip="View source code on GitHub">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        GitHub
      </a>
      <a href="${escapeHtml(oracleDashboardUrl)}" target="_blank" class="btn-external oracle" data-tooltip="View Oracle analytics source">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        Oracle
      </a>
      <a href="https://docs.google.com/spreadsheets/d/1ptzLKUVnAkyXnT635Zgb1C6Img9aeAZ1se3nRz_QZmI/edit?usp=sharing" target="_blank" class="btn-external sheets" data-tooltip="View historical analytics data and trends">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
        Sheets
      </a>
      <a href="${escapeHtml(uptimeStatusUrl)}" target="_blank" class="btn-external uptime" data-tooltip="Check system pipeline health">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        Status
      </a>
    </div>

    <main>
      <!-- Top Cards -->
      <section class="card" id="overview">
        <div class="grid-5">
          <div class="metric" id="card-downloads" data-tooltip="Downloads completed successfully (status=success)">
            <div class="metric-label">Total Downloads</div>
            <div class="metric-value" data-bind="totalDownloads">${stats.totalDownloads}</div>
          </div>
          <div class="metric" id="card-success" data-tooltip="All events with status=success">
            <div class="metric-label">Total Success</div>
            <div class="metric-value" data-bind="totalSuccess" style="color:var(--success)">${stats.totalSuccess}</div>
          </div>
          <div class="metric" id="card-fail" data-tooltip="All events with status=fail">
            <div class="metric-label">Total Fail</div>
            <div class="metric-value" data-bind="totalFail" style="color:var(--danger)">${stats.totalFail}</div>
          </div>
          <div class="metric" id="card-cancelled" data-tooltip="All events with status=cancelled">
            <div class="metric-label">Total Cancelled</div>
            <div class="metric-value" data-bind="totalCancelled" style="color:var(--warning)">${stats.totalCancelled ?? 0}</div>
          </div>
          <div class="metric" id="card-events" data-tooltip="Total events received by DO">
            <div class="metric-label">Total Events</div>
            <div class="metric-value" data-bind="totalEvents">${stats.totalEvents}</div>
          </div>
        </div>
        <div class="totals-with-chart" style="margin-top:12px;">
          <!-- Donut Chart -->
          <div class="donut-chart" style="background: ${donutGradient};" data-tooltip="Visual breakdown of success (green) vs failure (red)">
            <div class="donut-chart-center">
              <div class="donut-chart-percent">${successPercentText}</div>
              <div class="donut-chart-label">Success</div>
            </div>
          </div>
          <!-- Rate Metrics -->
          <div style="display:flex; flex-wrap:wrap; gap:12px;">
            <div class="metric metric-compact ${srMeta.className}" id="card-success-rate" data-tooltip="Successful downloads / (success + fail)">
              <div class="metric-label">Success rate</div>
              <div class="metric-value" data-bind="successRate">${srMeta.text}</div>
              <div class="metric-sub" data-bind="successRateBadge">${srMeta.badge}</div>
            </div>
            <div class="metric metric-compact" id="card-fail-rate" data-tooltip="Failed downloads / (success + fail)">
              <div class="metric-label">Fail rate</div>
              <div class="metric-value" data-bind="failRate">${failRateText}</div>
              <div class="metric-sub">of attempts</div>
            </div>
          </div>
        </div>
        <div id="empty-state" class="empty-state${
          stats.totalEvents > 0 ? " hidden" : ""
        }">
          No events yet – install the extension and trigger a download to see analytics here.
        </div>
      </section>
      <section class="card" id="pipeline-health">
        <div class="health-header">
          <h2>Pipeline Health</h2>
          <span class="health-chip ok" id="pipeline-health-chip">OK</span>
        </div>
        <div class="section-subtitle" style="margin-bottom: 14px; color: var(--text-muted); font-size: 0.85rem;">
          Derived from <code>${pipelineHealthUrl}</code>. Tracks backlog, failures, and flush staleness.
        </div>
        <div class="health-banner ok" id="pipeline-health-banner">
          <div class="health-status" id="pipeline-health-status">Pipeline Health: OK</div>
          <div class="health-reasons" id="pipeline-health-reasons">No issues detected.</div>
          <div class="health-metrics" id="pipeline-health-metrics">
            <div class="health-metric">
              <span>Pending Batches</span>
              <strong id="pipeline-health-pending">0</strong>
            </div>
            <div class="health-metric">
              <span>Oldest Pending</span>
              <strong id="pipeline-health-oldest">—</strong>
            </div>
            <div class="health-metric">
              <span>Buffer Util</span>
              <strong id="pipeline-health-buffer">—</strong>
            </div>
            <div class="health-metric">
              <span>Failures</span>
              <strong id="pipeline-health-failures">0</strong>
            </div>
          </div>
        </div>
        <div class="health-details">
          <div class="health-detail">
            Last Flush (UTC)
            <strong id="pipeline-health-last-flush">—</strong>
          </div>
          <div class="health-detail">
            Last Event (UTC)
            <strong id="pipeline-health-last-event">—</strong>
          </div>
          <div class="health-detail">
            Last Health Alert (UTC)
            <strong id="pipeline-health-last-alert">—</strong>
          </div>
          <div class="health-detail">
            Committed Seq
            <strong id="pipeline-health-committed">—</strong>
          </div>
          <div class="health-detail">
            Max Buffer
            <strong id="pipeline-health-max-buffer">—</strong>
          </div>
        </div>
      </section>
      <section class="card" id="breakdown">
        <div class="section-title-row">
          <h2>Breakdown by Dimensions</h2>
          <button id="breakdown-toggle-all" class="btn-toggle-all" type="button" data-expanded="false">
            <svg class="icon-collapse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            <svg class="icon-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            <span class="btn-label">Expand All</span>
          </button>
        </div>
        <div class="hot-summary">
          <div class="hot-row">
            <div class="hot-row-label">Top Today</div>
            <div class="hot-row-items">
              <div class="hot-item">
                <div class="hot-label">Type</div>
                <div class="hot-value" data-bind="hotType">${escapeHtml(hotType)}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">Browser</div>
                <div class="hot-value" data-bind="hotBrowser">${escapeHtml(hotBrowser)}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">OS</div>
                <div class="hot-value" data-bind="hotOs">${escapeHtml(hotOs)}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">Country</div>
                <div class="hot-value" data-bind="hotCountry"${hotCountryTooltipAttr}>${escapeHtml(hotCountry)}</div>
              </div>
            </div>
          </div>
          <div class="hot-row">
            <div class="hot-row-label">All Time</div>
            <div class="hot-row-items">
              <div class="hot-item">
                <div class="hot-label">Type</div>
                <div class="hot-value" data-bind="hotTypeAllTime">${escapeHtml(hotType)}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">Browser</div>
                <div class="hot-value" data-bind="hotBrowserAllTime">${escapeHtml(hotBrowser)}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">OS</div>
                <div class="hot-value" data-bind="hotOsAllTime">${escapeHtml(hotOs)}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">Country</div>
                <div class="hot-value" data-bind="hotCountryAllTime"${hotCountryTooltipAttr}>${escapeHtml(hotCountry)}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-3 breakdown-grid">
          <div class="breakdown-block collapsed" data-tooltip="Event types: download, install, update, etc.">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Type <span class="unique-count">${uniqueType} unique</span></span>
              <button class="breakdown-toggle" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Type</th><th>Count</th></tr></thead>
                <tbody id="tbody-type">${byTypeRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block collapsed" data-tooltip="Event status: success, fail, cancelled, etc.">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Status <span class="unique-count">${uniqueStatus} unique</span></span>
              <button class="breakdown-toggle" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody id="tbody-status">${byStatusRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block collapsed" data-tooltip="User browser: Chrome, Firefox, Edge, etc.">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Browser <span class="unique-count">${uniqueBrowser} unique</span></span>
              <button class="breakdown-toggle" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Browser</th><th>Count</th></tr></thead>
                <tbody id="tbody-browser">${byBrowserRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block collapsed" data-tooltip="Operating system: Windows, macOS, Linux, etc.">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By OS <span class="unique-count">${uniqueOs} unique</span></span>
              <button class="breakdown-toggle" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>OS</th><th>Count</th></tr></thead>
                <tbody id="tbody-os">${byOsRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block collapsed" data-tooltip="Extension version installed by users">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Extension Version <span class="unique-count">${uniqueExtVersion} unique</span></span>
              <button class="breakdown-toggle" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Version</th><th>Count</th></tr></thead>
                <tbody id="tbody-ext">${byExtVersionRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block collapsed" data-tooltip="Browser/OS language locale">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Language <span class="unique-count">${uniqueLang} unique</span></span>
              <button class="breakdown-toggle" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Lang</th><th>Count</th></tr></thead>
                <tbody id="tbody-lang">${byLangRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block collapsed" data-tooltip="Geographic country based on IP">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Country <span class="unique-count">${uniqueCountry} unique</span></span>
              <button class="breakdown-toggle" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Country</th><th>Count</th></tr></thead>
                <tbody id="tbody-country">${byCountryRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block collapsed" data-tooltip="Error types for failed operations">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Error Reason <span class="unique-count">${uniqueError} unique</span></span>
              <button class="breakdown-toggle" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Error</th><th>Count</th></tr></thead>
                <tbody id="tbody-error">${byErrorRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </section>


      <!-- Buffer, Timing & Environment -->
      <section class="card" id="system">
        <h2>Buffer, Timing & Environment</h2>
        <div class="grid-3">
          <div id="card-buffer">
            <div class="section-header">Buffer</div>
            <div class="metric-sub">
              Pending:
              <strong style="color:white" data-bind="pendingEvents">${stats.pendingEvents}</strong>
            </div>
            <div class="metric-sub">
              Age: <strong data-bind="ageLastEvent">${ageLastEvent}</strong>
            </div>
            <div class="metric-sub">Next flush: ${nextAutoFlush}</div>
          </div>
          <div id="card-timeline">
            <div class="section-header">Timeline</div>
            <div class="metric-sub">
              Last event: <span data-bind="lastEventAt">${lastEventAt}</span>
            </div>
            <div class="metric-sub">
              Last flush: <span data-bind="lastFlushAt">${lastFlushAt}</span>
            </div>
            <div class="metric-sub">
              Flush age:
              <strong data-bind="ageLastFlush">${ageLastFlush}</strong>
            </div>
          </div>
          <div>
            <div class="section-header">Environment</div>
            <div class="metric-sub">
              MAX_BATCH_EVENTS: <code>${maxBatchEvents}</code>
            </div>
            <div class="metric-sub">
              ORACLE_ENDPOINT:
              <code>${
                oracleEndpoint.startsWith("http")
                  ? "configured"
                  : oracleEndpoint
              }</code>
            </div>
          </div>
        </div>
      </section>

      <!-- Worker Quota & Mode -->
      <section class="card" id="quota">
        <h2>Worker Quota & Mode</h2>
        <div class="split-section">
          <!-- Left: Usage -->
          <div class="quota-panel" id="panel-usage">
            <div class="section-header" style="border:none; margin:0">
              Usage Statistics
            </div>
            <div class="quota-stat">
              <span class="quota-label">Requests Today</span>
              <span class="quota-val" data-bind="requestsToday">${requestsToday}</span>
            </div>
            <div class="quota-stat">
              <span class="quota-label">Unique IPs / Countries</span>
              <span class="quota-val" data-bind="uniqueIps" style="color:${isApproximated ? 'var(--warning)' : 'inherit'}">${uniqueIpsDisplay}</span>
            </div>
            <div class="quota-stat">
              <span class="quota-label">Status</span>
              <span
                class="quota-tag ${stateTag.className}"
                id="tag-status"
                data-tooltip="${stateTag.description}"
              >${stateTag.label}</span>
            </div>
            <div class="quota-stat">
              <span class="quota-label">Flag</span>
              <span
                class="quota-tag ${flag.className}"
                id="tag-flag"
                data-tooltip="${flag.description}"
              >${flag.label}</span>
            </div>
          </div>
          <!-- Right: Config -->
          <div class="quota-panel" id="panel-config">
            <div class="section-header" style="border:none; margin:0">
              Configuration
            </div>
            <div class="quota-stat">
              <span
                class="quota-label"
                data-tooltip="When ENABLED, the browser extension sends analytics events to this Worker via /track. When DISABLED, remote tracking is cut and the extension should keep analytics local to protect Cloudflare quota."
              >
                Remote Analytics
              </span>
              <span
                class="quota-val"
                id="val-remote"
                style="color:${
                  remoteEnabled ? "var(--success)" : "var(--danger)"
                }"
              >${remoteEnabled ? "ENABLED" : "DISABLED"}</span>
            </div>
            <div class="quota-stat">
              <span class="quota-label">Quota Level</span>
              <span
                class="quota-val"
                style="font-size:0.85rem"
                data-bind="quotaLevel"
              >${quotaLevel}</span>
            </div>
            <div class="quota-stat">
              <span class="quota-label">Suggested Batch</span>
              <span class="quota-val">
                <span data-bind="batchSize">${batchSize}</span> events / POST
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Remote Config -->
      <section class="card" id="remote-config">
        <h2>Remote Config</h2>
        <div class="section-subtitle">
          Controls pushed to the extension. Changes apply on the next config fetch.
          <span style="display:inline-block; margin-left:8px; color:var(--text-disabled); font-size:0.78rem;">
            Config v<span id="cfg-version">${cfgVersion}</span>
          </span>
        </div>
        <div class="rc-status" id="remote-enabled-status" data-tooltip="Reason remote analytics is enabled or paused by backpressure.">
          Remote analytics: <strong>${remoteEnabled ? "ENABLED" : "PAUSED"}</strong> · Reason: <span id="remote-enabled-reason">${cfgRemoteReason}</span>
        </div>
        <div class="rc-warning ${cfgAllowLegacy ? "" : "is-off"}" id="legacy-warning">
          <div>
            <div class="rc-warning-title">Legacy Event Acceptance</div>
            <div class="rc-warning-body" id="legacy-warning-text">
              ${cfgAllowLegacy
                ? "Enabled — missing event IDs will be auto-assigned. Disable after clients update."
                : "Disabled — events without IDs will be rejected."}
            </div>
          </div>
          <label class="toggle-switch" title="Toggle legacy event acceptance">
            <input type="checkbox" id="cfg-allow-legacy" ${cfgAllowLegacy ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="rc-grid">
          <div class="rc-field" data-tooltip="Events per POST from the extension. Higher values reduce requests but increase payload size.">
            <label>Batch Size</label>
            <input class="rc-input" type="number" id="cfg-batch-size" min="1" max="1000" value="${cfgBatchSize}">
            <div class="rc-hint">Events per POST from the extension.</div>
          </div>
          <div class="rc-field" data-tooltip="Upper bound for extension flushes per UTC day. Prevents runaway requests.">
            <label>Max Daily Requests</label>
            <input class="rc-input" type="number" id="cfg-max-daily" min="1" max="1000" value="${cfgMaxDaily}">
            <div class="rc-hint">Upper bound for extension flushes per UTC day.</div>
          </div>
          <div class="rc-field" data-tooltip="Drop events after this many failed retries. Use 0 to disable retries.">
            <label>Max Retry</label>
            <input class="rc-input" type="number" id="cfg-max-retry" min="0" max="20" value="${cfgMaxRetry}">
            <div class="rc-hint">Drop events after this many failed retries.</div>
          </div>
          <div class="rc-field" data-tooltip="Hard limit enforced on /track requests. Protects the worker and DO memory.">
            <label>Max Events / Request</label>
            <input class="rc-input" type="number" id="cfg-max-events" min="1" max="50000" value="${cfgMaxEvents}">
            <div class="rc-hint">Worker-side request limit enforced on /track.</div>
          </div>
          <div class="rc-field" data-tooltip="Durable Object buffer capacity. When full, /track is rejected to prevent overload.">
            <label>Max Buffer Size</label>
            <input class="rc-input" type="number" id="cfg-max-buffer" min="1" max="500000" value="${cfgMaxBuffer}">
            <div class="rc-hint">Durable Object buffer capacity before rejecting /track.</div>
          </div>
          <div class="rc-field" data-tooltip="Choose daily window flush (UTC) or time-based thresholds.">
            <label>Flush Mode</label>
            <select class="rc-select" id="cfg-flush-mode">
              <option value="next_day" ${cfgFlushMode === "next_day" ? "selected" : ""}>Next Day (UTC window)</option>
              <option value="time_based" ${cfgFlushMode === "time_based" ? "selected" : ""}>Time Based</option>
            </select>
            <div class="rc-hint">Controls whether daily window or time-based flushes are used.</div>
          </div>
          <div class="rc-field" data-tooltip="Minutes between flushes when the queue is small (< 15 events).">
            <label>Time Flush (Low)</label>
            <input class="rc-input" type="number" id="cfg-time-low" min="1" max="10080" value="${cfgTimeLow}">
            <div class="rc-hint">Minutes when queue &lt; 15 events.</div>
          </div>
          <div class="rc-field" data-tooltip="Minutes between flushes for mid-size queues (15–35).">
            <label>Time Flush (Mid)</label>
            <input class="rc-input" type="number" id="cfg-time-mid" min="1" max="10080" value="${cfgTimeMid}">
            <div class="rc-hint">Minutes when queue is 15–35 events.</div>
          </div>
          <div class="rc-field" data-tooltip="Minutes between flushes for large queues (> 35).">
            <label>Time Flush (High)</label>
            <input class="rc-input" type="number" id="cfg-time-high" min="1" max="10080" value="${cfgTimeHigh}">
            <div class="rc-hint">Minutes when queue &gt; 35 events.</div>
          </div>
          <div class="rc-field" data-tooltip="UTC hour when the daily randomized flush window begins.">
            <label>Daily Window Start (UTC hour)</label>
            <input class="rc-input" type="number" id="cfg-window-start" min="0" max="23" value="${cfgDailyStart}">
            <div class="rc-hint">Start hour for daily flush window in UTC.</div>
          </div>
          <div class="rc-field" data-tooltip="Length of the daily randomized flush window in minutes.">
            <label>Daily Window Minutes</label>
            <input class="rc-input" type="number" id="cfg-window-minutes" min="1" max="1440" value="${cfgDailyMinutes}">
            <div class="rc-hint">Window length in minutes for randomized daily flushes.</div>
          </div>
          <div class="rc-field" data-tooltip="Delay before the cancel button becomes active. Helps prevent accidental cancels.">
            <label>Cancel Hold Delay (ms)</label>
            <input class="rc-input" type="number" id="cfg-cancel-hold" min="0" max="10000" value="${cfgCancelHold}">
            <div class="rc-hint">Delay before cancel button becomes active.</div>
          </div>
        </div>
        <div class="rc-section-title">Pipeline Health Thresholds</div>
        <div class="rc-section-desc">
          Control when <code>/pipeline-health</code> flips to warn/critical based on backlog, failures, and staleness.
        </div>
        <div class="rc-grid">
          <div class="rc-field" data-tooltip="Warn when pending batch count reaches this number.">
            <label>Pending Batches (Warn)</label>
            <input class="rc-input" type="number" id="cfg-health-pending-warn" min="0" max="1000" value="${cfgHealthWarnPending}">
            <div class="rc-hint">Warn when pending batches ≥ this value.</div>
          </div>
          <div class="rc-field" data-tooltip="Critical when pending batch count reaches this number.">
            <label>Pending Batches (Critical)</label>
            <input class="rc-input" type="number" id="cfg-health-pending-critical" min="0" max="2000" value="${cfgHealthCritPending}">
            <div class="rc-hint">Critical when pending batches ≥ this value.</div>
          </div>
          <div class="rc-field" data-tooltip="Warn when consecutive Oracle failures reach this number.">
            <label>Failures (Warn)</label>
            <input class="rc-input" type="number" id="cfg-health-fail-warn" min="0" max="100" value="${cfgHealthWarnFailures}">
            <div class="rc-hint">Warn when failures ≥ this value.</div>
          </div>
          <div class="rc-field" data-tooltip="Critical when consecutive Oracle failures reach this number.">
            <label>Failures (Critical)</label>
            <input class="rc-input" type="number" id="cfg-health-fail-critical" min="0" max="100" value="${cfgHealthCritFailures}">
            <div class="rc-hint">Critical when failures ≥ this value.</div>
          </div>
          <div class="rc-field" data-tooltip="Warn when the time since last flush exceeds this many hours.">
            <label>Flush Stale (Warn, hours)</label>
            <input class="rc-input" type="number" id="cfg-health-stale-warn" min="0" max="720" value="${cfgHealthWarnStaleHours}">
            <div class="rc-hint">Warn if no flush for this many hours.</div>
          </div>
          <div class="rc-field" data-tooltip="Critical when the time since last flush exceeds this many hours.">
            <label>Flush Stale (Critical, hours)</label>
            <input class="rc-input" type="number" id="cfg-health-stale-critical" min="0" max="720" value="${cfgHealthCritStaleHours}">
            <div class="rc-hint">Critical if no flush for this many hours.</div>
          </div>
          <div class="rc-field" data-tooltip="Warn when buffer utilization reaches this percentage.">
            <label>Buffer Util (Warn %)</label>
            <input class="rc-input" type="number" id="cfg-health-buffer-warn" min="0" max="100" value="${cfgHealthWarnBufferPct}">
            <div class="rc-hint">Warn when buffer ≥ this percent.</div>
          </div>
          <div class="rc-field" data-tooltip="Critical when buffer utilization reaches this percentage.">
            <label>Buffer Util (Critical %)</label>
            <input class="rc-input" type="number" id="cfg-health-buffer-critical" min="0" max="100" value="${cfgHealthCritBufferPct}">
            <div class="rc-hint">Critical when buffer ≥ this percent.</div>
          </div>
        </div>
        <div class="rc-section-title">Health Alert Timing</div>
        <div class="rc-section-desc">
          Controls how often the alert webhook can fire for WARN and CRITICAL states. Shorter intervals increase noise.
          Recommended defaults: Warn 30 min, Critical 10 min.
        </div>
        <div class="rc-grid">
          <div class="rc-field" data-tooltip="Minimum minutes between WARN alerts.">
            <label>Warn Alert Interval (min)</label>
            <input class="rc-input" type="number" id="cfg-health-notify-warn" min="1" max="1440" value="${cfgHealthNotifyWarnMin}">
            <div class="rc-hint">Lower values notify more frequently.</div>
          </div>
          <div class="rc-field" data-tooltip="Minimum minutes between CRITICAL alerts.">
            <label>Critical Alert Interval (min)</label>
            <input class="rc-input" type="number" id="cfg-health-notify-critical" min="1" max="1440" value="${cfgHealthNotifyCritMin}">
            <div class="rc-hint">Recommended shorter than WARN.</div>
          </div>
        </div>
        <div class="rc-actions">
          <button class="btn" id="btn-config-reset" type="button" data-tooltip="Load default values locally. Click Save to publish.">
            <span class="btn-bullet">•</span> Reset to defaults
          </button>
          <button class="btn" id="btn-config-save" type="button" data-tooltip="Publish these config values to all extensions.">
            <span class="btn-bullet">•</span> Save Remote Config
          </button>
        </div>
        <div class="rc-status" id="config-status" data-tooltip="Status of the last config operation.">Idle</div>
      </section>

      <!-- Debug & Actions -->
      <section class="card" id="debug">
        <h2>Debug & Actions</h2>
        <div class="split-section">
          <!-- Debug & Endpoints -->
          <div>
            <div class="section-header">Endpoints</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div>
                <span class="metric-label">Worker Base</span><br />
                <span class="code-block">${workerUrl}/</span>
              </div>
              <div>
                <span class="metric-label">Track Endpoint</span><br />
                <span class="code-block">${workerUrl}/track</span>
              </div>
              <div>
                <span class="metric-label">Stats (JSON)</span><br />
                <span class="code-block">${workerUrl}/stats</span>
              </div>
              <div>
                <span class="metric-label">Health</span><br />
                <span class="code-block">${workerUrl}/health</span>
              </div>
              <div>
                <span class="metric-label">Debug Flush</span><br />
                <span class="code-block">${workerUrl}/debug/flush</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div>
            <div class="section-header">Manual only – no auto polling</div>
            <div style="display:flex; flex-direction:column; gap:12px;">
              <button class="btn" id="btn-reload" type="button">
                <span class="btn-bullet">•</span> Reload stats
              </button>
              <button
                class="btn"
                onclick="window.open('/stats', '_blank')"
                type="button"
              >
                <span class="btn-bullet">•</span> Open /stats JSON
              </button>
              <button
                class="btn"
                onclick="window.open('/health', '_blank')"
                type="button"
              >
                <span class="btn-bullet">•</span> Open /health
              </button>
              <button
                class="btn"
                onclick="window.open('/pipeline-health', '_blank')"
                type="button"
              >
                <span class="btn-bullet">•</span> Open /pipeline-health
              </button>
              <button class="btn" id="btn-debug-flush-action" type="button">
                <span class="btn-bullet">•</span> POST /debug/flush
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="card" id="legacy-changelog-disabled">
        <h2>Extension Changelog Controls Moved</h2>
        <div class="section-subtitle" style="margin-bottom: 12px;">
          Legacy Cloudflare sections <strong>📢 Release Publishing</strong> and
          <strong> 🔔 Notification Styling</strong> are disabled.
        </div>
        <div class="metric-sub">
          Manage extension changelog entries and changelog pill rules in the
          Oracle Dashboard under <code>Extension Changelog</code>.
        </div>
      </section>

      <!-- Raw /stats payload -->
      <section class="card" id="raw">
        <h2>Raw /stats payload</h2>
        <div class="metric-sub">
          Direct JSON returned by <code>/stats</code>
        </div>
        <pre id="raw-stats-json" class="code-block code-block-large">${rawStatsJson}</pre>
      </section>
      <section class="card" id="raw-pipeline-health">
        <h2>Raw /pipeline-health payload</h2>
        <div class="metric-sub">
          Direct JSON returned by <code>/pipeline-health</code>
        </div>
        <pre id="raw-health-json" class="code-block code-block-large">${rawHealthJson}</pre>
      </section>

      <!-- Security Settings -->
      <section class="card" id="security">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Security Settings
        </h2>
        <div class="section-subtitle" style="margin-bottom: 20px; color: var(--text-muted); font-size: 0.85rem;">
          Manage access restrictions and security policies for this dashboard.
        </div>
        
        <!-- IP Protection Toggle -->
        <div class="security-row" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 16px;">
          <div>
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">IP Protection</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Restrict dashboard access to allowlisted IPs only</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="ip-protection-toggle">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="security-row" style="padding: 16px 20px; background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:16px;">
            <div>
              <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">Blocked-IP login policy</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Allow blocked IPs to step up using admin danger password.</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="blocked-ip-stepup-toggle" checked>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        
        <!-- Current Session Info -->
        <div class="session-info" style="display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 200px; padding: 14px 18px; background: var(--bg-surface); border-radius: var(--radius-sm); border: 1px solid var(--border);">
            <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-disabled); margin-bottom: 6px;">Your IP</div>
            <div id="current-ip" style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); font-family: monospace;">Loading...</div>
          </div>
          <div style="flex: 1; min-width: 200px; padding: 14px 18px; background: var(--bg-surface); border-radius: var(--radius-sm); border: 1px solid var(--border);">
            <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-disabled); margin-bottom: 6px;">Status</div>
            <div id="ip-status" style="font-size: 0.95rem; font-weight: 600; color: var(--success); margin-bottom: 8px;">Allowed</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <span id="ip-allowlist-badge" style="font-size:0.7rem; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:var(--text-primary); background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); padding:3px 8px; border-radius:999px;">Allowlist: OFF</span>
              <span id="ip-stepup-badge" style="font-size:0.7rem; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#93c5fd; background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.3); padding:3px 8px; border-radius:999px;">Blocked IP Login: Step-Up ON</span>
            </div>
          </div>
        </div>
        
        <!-- IP Allowlist Management -->
        <div style="padding: 20px; background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">IP Allowlist</span>
            <span id="ip-count" style="font-size: 0.75rem; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 3px 10px; border-radius: var(--radius-sm);">0 IPs</span>
          </div>
          
          <!-- Add IP Form -->
          <div style="display: flex; gap: 10px; margin-bottom: 16px;">
            <input type="text" id="add-ip-input" placeholder="Enter IP/CIDR (e.g., 192.168.1.1, 10.0.0.0/8, 2001:db8::/32)" style="flex: 1; padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.9rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
            <button id="btn-add-ip" class="btn" style="background: var(--accent); color: white; border: none; padding: 10px 18px; font-weight: 600;">
              + Add
            </button>
          </div>
          
          <!-- Quick Add Current IP -->
          <button id="btn-add-my-ip" class="btn" style="width: 100%; justify-content: center; margin-bottom: 16px; background: var(--accent-muted); color: var(--accent-hover); border: 1px solid rgba(139, 92, 246, 0.3);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Add My Current IP
          </button>
          
          <!-- IP List -->
          <div id="ip-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
            <div style="padding: 12px; text-align: center; color: var(--text-disabled); font-size: 0.85rem;">Loading allowlist...</div>
          </div>
        </div>
        
        <!-- Security Cards Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 20px;">
          
          <!-- Login Rate Limiting Card -->
          <div class="info-card" style="padding: 20px; background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
              <span style="font-size: 1.2rem;">⏱️</span>
              <div style="font-weight: 600; color: var(--text-primary);">Login Rate Limiting</div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">
              Protects against brute-force attacks by limiting failed login attempts.
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted);">Status:</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span id="rate-limit-status" style="color: var(--success); font-weight: 600;">Enabled</span>
                  <label class="toggle-switch" style="transform: scale(0.8);">
                    <input type="checkbox" id="rate-limit-toggle" checked>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted);">Max attempts:</span>
                <input type="number" id="rate-limit-max-attempts" value="5" min="1" max="20" style="width: 60px; padding: 6px 10px; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.85rem; text-align: center;">
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted);">Lockout period:</span>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <input type="number" id="rate-limit-lockout" value="15" min="1" max="60" style="width: 60px; padding: 6px 10px; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.85rem; text-align: center;">
                  <span style="color: var(--text-muted);">min</span>
                </div>
              </div>
              <button id="btn-save-rate-limit" class="btn" style="padding: 8px 12px; background: var(--accent); color: white; border: none; font-size: 0.8rem; font-weight: 500; margin-top: 8px;">
                Save Settings
              </button>
            </div>
          </div>
          
          <!-- Session Security Card -->
          <div class="info-card" style="padding: 20px; background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
              <span style="font-size: 1.2rem;">🔑</span>
              <div style="font-weight: 600; color: var(--text-primary);">Session Security</div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">
              HttpOnly cookies with HMAC-SHA256 signed tokens.
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Token type:</span>
                <span style="color: var(--accent); font-weight: 500; font-family: monospace;">HMAC-SHA256</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Cookie flags:</span>
                <span style="color: var(--text-secondary); font-weight: 500;">HttpOnly, SameSite</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Expiry:</span>
                <span style="color: var(--text-secondary); font-weight: 500;">1 hour</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Data Hub -->
      <section class="card" id="datahub">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          Data Hub
        </h2>
        <div class="section-subtitle" style="margin-bottom: 20px; color: var(--text-muted); font-size: 0.85rem;">
          Manage analytics data synchronization with Oracle backend.
        </div>
        
        <!-- Data Hub Cards Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
          
          <!-- Current Buffer Card -->
          <div class="info-card" style="padding: 20px; background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span style="font-size: 1.2rem;">📊</span>
              <div style="font-weight: 600; color: var(--text-primary);">Current Buffer</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);" data-bind="pendingEvents">${stats.pendingEvents}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Events in buffer</div>
              </div>
              <div>
                <div style="font-size: 2rem; font-weight: 700; color: var(--success);">${stats.totalDownloads ?? 0}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Total downloads</div>
              </div>
            </div>
          </div>
          
          <!-- Oracle Sync Card -->
          <div class="info-card" style="padding: 20px; background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
              <span style="font-size: 1.2rem;">☁️</span>
              <div style="font-weight: 600; color: var(--text-primary);">Oracle Sync</div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">
              Export all analytics data to Oracle backend.
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 12px;">
              <button id="btn-datahub-flush" class="btn" style="flex: 1; justify-content: center; padding: 10px; background: var(--accent); color: white; border: none; font-weight: 500; font-size: 0.8rem;">
                Export All Data
              </button>
              <button id="btn-datahub-sync" class="btn" style="flex: 1; justify-content: center; padding: 10px; background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border); font-weight: 500; font-size: 0.8rem;">
                Sync Counters Only
              </button>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-align: center;">
              Last sync: ${ageLastFlush}
            </div>
          </div>
          
          <!-- Website Sync Card -->
          <div class="info-card" style="padding: 20px; background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
              <span style="font-size: 1.2rem;">🌐</span>
              <div style="font-weight: 600; color: var(--text-primary);">Website Sync</div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 14px;">
              Manage public website metrics snapshot and website-control actions.
            </div>
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom: 12px;">
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.78rem;">
                <span style="color: var(--text-muted);">Last Batch Slot</span>
                <strong id="website-last-batch-slot" style="color:var(--text-primary);">—</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.78rem;">
                <span style="color: var(--text-muted);">Telemetry Queue</span>
                <strong id="website-telemetry-queue" style="color:var(--text-primary);">—</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.78rem;">
                <span style="color: var(--text-muted);">Telemetry Retry Count</span>
                <strong id="website-telemetry-retry-count" style="color:var(--text-primary);">—</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.78rem;">
                <span style="color: var(--text-muted);">Last Telemetry Created (UTC)</span>
                <strong id="website-last-telemetry-created" style="color:var(--text-primary);">—</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.78rem;">
                <span style="color: var(--text-muted);">Last Telemetry Sent (UTC)</span>
                <strong id="website-last-telemetry-sent" style="color:var(--text-primary);">—</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.78rem;">
                <span style="color: var(--text-muted);">Telemetry Dead-Letter</span>
                <strong id="website-telemetry-dlq" style="color:var(--text-primary);">—</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.78rem;">
                <span style="color: var(--text-muted);">Last Refresh (UTC)</span>
                <strong id="website-last-refresh-at" style="color:var(--text-primary);">—</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.78rem;">
                <span style="color: var(--text-muted);">Refresh Mode</span>
                <strong id="website-refresh-mode" style="color:var(--text-primary);">—</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.78rem;">
                <span style="color: var(--text-muted);">Last Manual Flush (UTC)</span>
                <strong id="website-last-manual-flush" style="color:var(--text-primary);">—</strong>
              </div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.78rem;">
                <span style="color: var(--text-muted);">Last Telemetry ACK (UTC)</span>
                <strong id="website-last-telemetry-ack" style="color:var(--text-primary);">—</strong>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom: 10px;">
              <label style="display:flex; align-items:center; gap:8px; font-size:0.78rem; color:var(--text-secondary);">
                <input id="website-refresh-enabled" type="checkbox" checked />
                Enable scheduled website refreshes
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:0.78rem; color:var(--text-secondary);">
                <input id="website-override-enabled" type="checkbox" />
                Enable public website override
              </label>
              <input id="website-override-downloads" type="number" min="0" placeholder="Override total downloads" style="width:100%; padding:8px 10px; background: var(--bg-elevated); border:1px solid var(--border); color:var(--text-primary); border-radius:8px; font-size:0.8rem;" />
              <textarea id="website-override-countries" placeholder='Override countries JSON [{"countryCode":"US","count":123}]' style="width:100%; min-height:84px; padding:8px 10px; resize:vertical; background: var(--bg-elevated); border:1px solid var(--border); color:var(--text-primary); border-radius:8px; font-size:0.78rem;"></textarea>
            </div>
            <div style="display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px;">
              <button id="btn-website-status-refresh" class="btn" style="justify-content:center; padding: 8px 10px; font-size:0.78rem;">Refresh State</button>
              <button id="btn-website-flush-now" class="btn" style="justify-content:center; padding: 8px 10px; font-size:0.78rem;">Flush Data Now</button>
              <button id="btn-website-refresh-toggle" class="btn" style="justify-content:center; padding: 8px 10px; font-size:0.78rem;">Save Refresh Toggle</button>
              <button id="btn-website-override-save" class="btn" style="justify-content:center; padding: 8px 10px; font-size:0.78rem;">Save Override</button>
              <button id="btn-website-replay-dlq" class="btn" style="justify-content:center; padding: 8px 10px; font-size:0.78rem;">Replay Dead-Letter</button>
            </div>
            <pre id="website-admin-output" class="code-block code-block-large" style="margin-top:10px; max-height:180px; overflow:auto;">{"status":"idle"}</pre>
          </div>
        </div>
      </section>

      <!-- Admin Controls / Danger Zone -->
      <section class="card danger-zone" id="danger">
        <div class="danger-header">
          <div>
            <div class="danger-title">Admin Controls / Danger Zone</div>
            <div class="danger-status-hint" id="danger-status-hint">
              <span class="danger-status-label">Remote analytics</span>
              <span
                class="danger-status-value ${
                  remoteEnabled ? "enabled" : "disabled"
                }"
                id="danger-remote-state"
              >
                ${remoteEnabled ? "ENABLED" : "DISABLED"}
              </span>
              <span
                class="danger-chip"
                id="danger-remote-chip"
                style="display:${remoteEnabled ? "none" : "inline-block"}"
              >
                CUT POWER ACTIVE
              </span>
            </div>
          </div>
        </div>

        <!-- Oracle Sync Section -->
        <div class="danger-section">
          <div class="danger-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
            Oracle Sync
          </div>
          <div
            class="danger-row"
            data-tooltip="Immediately pushes all pending analytics events from the Durable Object buffer to ORACLE_ENDPOINT, even if the batch threshold is not reached."
          >
            <div>
              <div class="danger-desc">Flush Buffer to Oracle</div>
              <div class="danger-sub">Force pushes all pending events immediately.</div>
            </div>
            <button class="btn-danger" id="btn-force-flush" type="button">Flush now</button>
          </div>
          <div
            class="danger-row"
            data-tooltip="Repeatedly flushes until the Durable Object buffer is completely empty. Best used off-peak when you want a fully drained buffer."
          >
            <div>
              <div class="danger-desc">Full Sync</div>
              <div class="danger-sub">Repeatedly flushes until buffer is empty.</div>
            </div>
            <button class="btn-danger" id="btn-full-sync" type="button">Sync all</button>
          </div>
        </div>

        <!-- Power Control Section -->
        <div class="danger-section">
          <div class="danger-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            Power Control
          </div>
          <div
            class="danger-row"
            data-tooltip="Disables remote analytics for all extensions. The Worker will tell extensions to stop sending to /track. Use in emergencies to protect Cloudflare quota."
          >
            <div>
              <div class="danger-desc">Cut Power (Remote OFF)</div>
              <div class="danger-sub">Disables remote analytics for all extensions.</div>
            </div>
            <button class="btn-danger destructive" id="btn-cut-power" type="button">Cut power</button>
          </div>
          <div
            class="danger-row"
            data-tooltip="Re-enables remote analytics if you previously cut power. Extensions will resume sending events to /track."
          >
            <div>
              <div class="danger-desc">Restore Power (Remote ON)</div>
              <div class="danger-sub">Re-enables remote analytics if previously cut.</div>
            </div>
            <button class="btn-danger" id="btn-restore-power" type="button">Restore</button>
          </div>
        </div>

        <!-- Data Management Section -->
        <div class="danger-section">
          <div class="danger-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>
            Data Management
          </div>
          <div
            class="danger-row"
            data-tooltip="Clears all buffered events from the Durable Object. Does NOT sync to Oracle first - events will be lost."
          >
            <div>
              <div class="danger-desc">Clear Buffer Only</div>
              <div class="danger-sub">Removes pending events without syncing.</div>
            </div>
            <button class="btn-danger" id="btn-clear-buffer" type="button">Clear buffer</button>
          </div>
          <div
            class="danger-row"
            data-tooltip="Resets all analytics counters to zero. Config and changelog are preserved. Cannot be undone."
          >
            <div>
              <div class="danger-desc">Reset Counters</div>
              <div class="danger-sub">Resets all counters, preserves config.</div>
            </div>
            <button class="btn-danger destructive" id="btn-reset-counters" type="button">Reset counters</button>
          </div>
          <div
            class="danger-row"
            data-tooltip="Permanently deletes ALL analytics data including events, counters, and breakdowns. Config and changelog are preserved. CANNOT BE UNDONE."
          >
            <div>
              <div class="danger-desc">Full Data Reset</div>
              <div class="danger-sub">Deletes all analytics data permanently.</div>
            </div>
            <button class="btn-danger destructive" id="btn-full-reset" type="button">Full reset</button>
          </div>
        </div>
      </section>
    </main>

    <!-- Context Modal -->
    <div class="modal-overlay" id="info-modal">
      <div class="modal">
        <button class="close-modal" id="close-modal" type="button">×</button>
        <h3>Dashboard Context</h3>

        <div class="modal-section">
          <h4>Flags (Quota)</h4>
          <div class="modal-pills">
            <span class="quota-tag flag-easy">easy</span>
            <span class="quota-tag flag-normal">normal</span>
            <span class="quota-tag flag-hard">hard</span>
            <span class="quota-tag flag-critical">critical</span>
          </div>
          <div class="modal-item"><span>EASY</span> <span>&lt; 20k reqs</span></div>
          <div class="modal-item"><span>NORMAL</span> <span>&lt; 50k reqs</span></div>
          <div class="modal-item"><span>HARD</span> <span>&lt; 80k reqs</span></div>
          <div class="modal-item"><span>CRITICAL</span> <span>&gt; 80k reqs</span></div>
        </div>

        <div class="modal-section">
          <h4>Status States</h4>
          <div class="modal-pills">
            <span class="quota-tag state-sleeping">sleeping</span>
            <span class="quota-tag state-chill">chill</span>
            <span class="quota-tag state-normal">normal</span>
            <span class="quota-tag state-busy">busy</span>
            <span class="quota-tag state-emergency">emergency</span>
            <span class="quota-tag state-cut-power">cut the power rn</span>
          </div>
        </div>

        <div class="modal-section">
          <h4>Variables</h4>
          <div class="modal-item">
            <span>MAX_BATCH_EVENTS</span>
            <span>Threshold for auto-flush</span>
          </div>
          <div class="modal-item">
            <span>ORACLE_ENDPOINT</span>
            <span>Backend ingestion URL</span>
          </div>
          <div class="modal-item">
            <span>Batch Size</span>
            <span>Events sent per POST request</span>
          </div>
        </div>

        <div class="modal-section">
          <h4>Notes</h4>
          <p style="font-size:0.8rem; color:var(--text-muted)">
            This dashboard does not auto-poll to save Worker requests.
            Use the "Reload" action to get fresh data without refreshing the page.
          </p>
        </div>
      </div>
    </div>

    <!-- Danger Password Modal -->
    <div class="modal-overlay" id="danger-modal">
      <div class="modal">
        <button class="close-modal" id="close-danger-modal" type="button">×</button>
        <h3 id="danger-modal-title">Confirm admin action</h3>
        <p id="danger-modal-desc" style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">
          This action requires active session authorization.
        </p>
        <div id="danger-modal-error" class="login-error" style="display:none; margin-top:8px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button type="button" class="auth-btn" id="danger-cancel-btn">Cancel</button>
          <button type="button" class="btn-danger" id="danger-confirm-btn">Confirm</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      // XSS prevention: HTML escape for untrusted data
      function escapeHtmlJS(unsafe) {
        if (typeof unsafe !== 'string') return String(unsafe);
        return unsafe
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
      let lastRefreshAt = 0;
      let configDirty = false;

      // Enforce CSRF header for same-origin mutating requests made from dashboard UI.
      const nativeFetch = window.fetch.bind(window);
      window.fetch = function patchedFetch(input, init) {
        try {
          const requestUrl = (() => {
            if (typeof input === "string" || input instanceof URL) {
              return new URL(String(input), window.location.href);
            }
            if (input && typeof input.url === "string") {
              return new URL(input.url, window.location.href);
            }
            return null;
          })();
          const method = (
            (init && init.method) ||
            (input && typeof input === "object" && "method" in input ? input.method : "GET") ||
            "GET"
          ).toUpperCase();
          const isMutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
          const isSameOrigin = requestUrl && requestUrl.origin === window.location.origin;
          if (isMutating && isSameOrigin) {
            const headers = new Headers(init && init.headers ? init.headers : (input && "headers" in input ? input.headers : undefined));
            if (!headers.has("X-Requested-With")) {
              headers.set("X-Requested-With", "XMLHttpRequest");
            }
            return nativeFetch(input, { ...(init || {}), headers });
          }
        } catch (err) {
          console.warn("fetch patch fallback", err);
        }
        return nativeFetch(input, init);
      };

      function formatTs(ts) {
        if (!ts) return "—";
        const d = new Date(ts);
        return d.toLocaleString("en-US", {
          timeZone: "UTC",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }
      function formatAge(ts) {
        if (!ts) return "—";
        const diff = Date.now() - ts;
        if (diff <= 0) return "just now";
        const sec = Math.floor(diff / 1000);
        const min = Math.floor(sec / 60);
        const hr = Math.floor(min / 60);
        const day = Math.floor(hr / 24);
        if (day > 0) return day + "d";
        if (hr > 0) return hr + "h";
        if (min > 0) return min + "m";
        return sec + "s";
      }

      var clockIs24 = localStorage.getItem("cqd_clock_24h") !== "false";

      function formatUtcClock(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString("en-US", {
          timeZone: "UTC",
          hour12: !clockIs24,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }

      function updateUtcClock() {
        const wrap = document.getElementById("nav-utc-clock");
        if (!wrap) return;
        const label = wrap.querySelector(".nav-utc-time");
        if (!label) return;
        const now = Date.now();
        const next = formatUtcClock(now);
        if (label.textContent !== next) {
          label.textContent = next;
        }
        // Dynamic size: smaller for 12h format (has AM/PM)
        if (clockIs24) {
          label.classList.remove("is-12h");
        } else {
          label.classList.add("is-12h");
        }
      }

      updateUtcClock();
      setInterval(updateUtcClock, 1000);

      const utcClock = document.getElementById("nav-utc-clock");
      if (utcClock) {
        utcClock.addEventListener("click", () => {
          clockIs24 = !clockIs24;
          localStorage.setItem("cqd_clock_24h", clockIs24 ? "true" : "false");
          updateUtcClock();
        });
      }

      // Breakdown toggle all button
      const toggleAllBtn = document.getElementById("breakdown-toggle-all");
      if (toggleAllBtn) {
        toggleAllBtn.addEventListener("click", () => {
          const isExpanded = toggleAllBtn.getAttribute("data-expanded") === "true";
          const blocks = document.querySelectorAll(".breakdown-grid .breakdown-block");
          blocks.forEach((block) => {
            if (isExpanded) {
              block.classList.add("collapsed");
            } else {
              block.classList.remove("collapsed");
            }
          });
          toggleAllBtn.setAttribute("data-expanded", isExpanded ? "false" : "true");
          toggleAllBtn.querySelector(".btn-label").textContent = isExpanded ? "Expand All" : "Collapse All";
        });
      }

      function quotaStateFromRequests(n) {
        if (!Number.isFinite(n)) n = 0;
        if (n <= 1000)   return { label: "sleeping",     className: "state-sleeping",     description: "Very low traffic today." };
        if (n <= 5000)   return { label: "super chill",  className: "state-super-chill",  description: "Extension is barely touching the Worker." };
        if (n <= 10000)  return { label: "chill",        className: "state-chill",        description: "Plenty of headroom." };
        if (n <= 20000)  return { label: "easy",         className: "state-easy",         description: "Still well below limits." };
        if (n <= 30000)  return { label: "kinda easy",   className: "state-kinda-easy",   description: "Load is fine. Batch size may start increasing soon." };
        if (n <= 40000)  return { label: "normal",       className: "state-normal",       description: "Normal daily traffic." };
        if (n <= 50000)  return { label: "slightly busy",className: "state-slightly-busy",description: "Worker is warming up." };
        if (n <= 60000)  return { label: "kinda busy",   className: "state-kinda-busy",   description: "Closer to quota, batching should be stronger." };
        if (n <= 70000)  return { label: "busy",         className: "state-busy",         description: "We are in the hard-normal zone." };
        if (n <= 80000)  return { label: "very busy",    className: "state-very-busy",    description: "High traffic. Worker is protecting quota." };
        if (n <= 90000)  return { label: "super busy",   className: "state-super-busy",   description: "Approaching Cloudflare free tier limits." };
        if (n <= 95000)  return { label: "emergency",    className: "state-emergency",    description: "Emergency mode. Batch sizes should be huge." };
        if (n <= 99000)  return { label: "critical",     className: "state-critical",     description: "We are basically at the limit. Prepare cut power." };
        return { label: "cut the power rn", className: "state-cut-power", description: "Remote analytics should be OFF; everything local." };
      }

      function quotaFlagFromRequests(n) {
        if (!Number.isFinite(n)) n = 0;
        if (n <= 20000) return { label: "easy",   className: "flag-easy",   description: "Way below limits (<20k)." };
        if (n <= 50000) return { label: "normal", className: "flag-normal", description: "Comfortable usage (<50k)." };
        if (n <= 80000) return { label: "hard",   className: "flag-hard",   description: "High traffic (<80k)." };
        return { label: "critical", className: "flag-critical", description: "Basically at limits (>80k)." };
      }

      function classifySuccessRateJS(success, fail) {
        var total = (success || 0) + (fail || 0);
        if (!total) {
          return { text: "—", badge: "No data", className: "" };
        }
        var rate = (success / total) * 100;
        if (rate >= 98) {
          return {
            text: rate.toFixed(1) + "%",
            badge: "Excellent",
            className: "metric-good",
          };
        }
        if (rate >= 95) {
          return {
            text: rate.toFixed(1) + "%",
            badge: "Healthy",
            className: "metric-warn",
          };
        }
        return {
          text: rate.toFixed(1) + "%",
          badge: "Unstable",
          className: "metric-bad",
        };
      }

      const COUNTRY_CODE_RE = /^[A-Z]{2}$/;
      const COUNTRY_ALIASES = {
        UK: "United Kingdom",
        EL: "Greece",
      };
      const countryDisplayNamesJS =
        typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
          ? new Intl.DisplayNames(["en"], { type: "region" })
          : null;

      function countryNameFromCodeJS(code) {
        const normalized = String(code || "").trim().toUpperCase();
        if (!COUNTRY_CODE_RE.test(normalized)) return "";
        if (normalized === "XX" || normalized === "ZZ" || normalized === "UN" || normalized === "EU") return "";
        if (COUNTRY_ALIASES[normalized]) return COUNTRY_ALIASES[normalized];
        if (!countryDisplayNamesJS) return "";
        try {
          return countryDisplayNamesJS.of(normalized) || "";
        } catch (_) {
          return "";
        }
      }

      function renderTableRowsJS(data, dimension) {
        const entries = Object.entries(data || {});
        if (!entries.length) return "<tr><td colspan='2'>—</td></tr>";
        entries.sort((a, b) => b[1] - a[1]);
        return entries
          .map(function ([k, v]) {
            const numeric = Number(v);
            const safeValue = Number.isFinite(numeric) ? numeric.toString() : "0";
            const countryName = dimension === "country" ? countryNameFromCodeJS(k) : "";
            const tooltipAttr = countryName ? ' data-tooltip="' + escapeHtmlJS(countryName) + '"' : "";
            return "<tr><td" + tooltipAttr + ">" + escapeHtmlJS(k) + "</td><td>" + safeValue + "</td></tr>";
          })
          .join("");
      }

      function topKeyJS(data) {
        const entries = Object.entries(data || {});
        if (!entries.length) return "—";
        entries.sort(function (a, b) {
          return b[1] - a[1];
        });
        return entries[0][0];
      }

      function updateHotToday(counters) {
        if (!counters) return;
        const values = {
          hotType: topKeyJS(counters.byType),
          hotBrowser: topKeyJS(counters.byBrowser),
          hotOs: topKeyJS(counters.byOs),
          hotCountry: topKeyJS(counters.byCountry),
          hotCountryAllTime: topKeyJS(counters.byCountry),
        };
        Object.entries(values).forEach(function ([key, value]) {
          const els = document.querySelectorAll('[data-bind="' + key + '"]');
          els.forEach(function (el) {
            const current = el.textContent || "";
            const next = value || "—";
            if (current !== next) {
              el.textContent = next;
              const parent =
                el.closest(".hot-item") ||
                el.closest(".hot-today") ||
                el.parentElement;
              if (parent) {
                parent.classList.remove("updated");
                void parent.offsetWidth;
                parent.classList.add("updated");
              }
            }
            if (key === "hotCountry" || key === "hotCountryAllTime") {
              const countryName = countryNameFromCodeJS(next);
              if (countryName) {
                el.setAttribute("data-tooltip", countryName);
              } else {
                el.removeAttribute("data-tooltip");
              }
            } else {
              el.removeAttribute("data-tooltip");
            }
          });
        });
      }

      function updateBreakdowns(counters) {
        if (!counters) return;
        const mapping = [
          ["tbody-type", counters.byType, "type"],
          ["tbody-status", counters.byStatus, "status"],
          ["tbody-browser", counters.byBrowser, "browser"],
          ["tbody-os", counters.byOs, "os"],
          ["tbody-ext", counters.byExtVersion, "ext"],
          ["tbody-lang", counters.byLanguage, "language"],
          ["tbody-country", counters.byCountry, "country"],
          ["tbody-error", counters.byErrorType, "error"], // NEW
        ];
        mapping.forEach(function (item) {
          const id = item[0];
          const data = item[1] || {};
          const dimension = item[2] || "";
          const el = document.getElementById(id);
          if (!el) return;
          const next = renderTableRowsJS(data, dimension);
          if (el.innerHTML !== next) {
            el.innerHTML = next;
            const parent =
              el.closest(".breakdown-block") || el.closest("table");
            if (parent) {
              parent.classList.remove("updated");
              void parent.offsetWidth;
              parent.classList.add("updated");
            }
          }
        });
        updateHotToday(counters);
      }

      function updateQuotaChips(quota) {
        if (!quota) return;
        const n = quota.requestsToday || 0;
        const st = quotaStateFromRequests(n);
        const fl = quotaFlagFromRequests(n);

        var tagStatus = document.getElementById("tag-status");
        if (tagStatus) {
          var changed =
            tagStatus.textContent !== st.label ||
            tagStatus.getAttribute("data-tooltip") !== st.description;
          tagStatus.textContent = st.label;
          tagStatus.className = "quota-tag " + st.className;
          tagStatus.setAttribute("data-tooltip", st.description);
          if (changed) {
            var parentS =
              tagStatus.closest(".quota-stat") || tagStatus.parentElement;
            if (parentS) {
              parentS.classList.remove("updated");
              void parentS.offsetWidth;
              parentS.classList.add("updated");
            }
          }
        }

        var tagFlag = document.getElementById("tag-flag");
        if (tagFlag) {
          var changedF =
            tagFlag.textContent !== fl.label ||
            tagFlag.getAttribute("data-tooltip") !== fl.description;
          tagFlag.textContent = fl.label;
          tagFlag.className = "quota-tag " + fl.className;
          tagFlag.setAttribute("data-tooltip", fl.description);
          if (changedF) {
            var parentF =
              tagFlag.closest(".quota-stat") || tagFlag.parentElement;
            if (parentF) {
              parentF.classList.remove("updated");
              void parentF.offsetWidth;
              parentF.classList.add("updated");
            }
          }
        }

        var headerStatus = document.getElementById("header-pill-status");
        if (headerStatus) {
          if (headerStatus.textContent !== st.label) {
            headerStatus.textContent = st.label;
            headerStatus.classList.remove("updated");
            void headerStatus.offsetWidth;
            headerStatus.classList.add("updated");
          }
        }
        var headerFlag = document.getElementById("header-pill-flag");
        if (headerFlag) {
          if (headerFlag.textContent !== fl.label) {
            headerFlag.textContent = fl.label;
            headerFlag.classList.remove("updated");
            void headerFlag.offsetWidth;
            headerFlag.classList.add("updated");
          }
        }
      }

      function updateLastRefreshLabel() {
        var el = document.getElementById("last-refresh-label");
        lastRefreshAt = Date.now();
        if (!el) return;
        var v = formatTs(lastRefreshAt);
        if (el.textContent !== v) {
          el.textContent = v;
          var parent = el.parentElement;
          if (parent) {
            parent.classList.remove("updated");
            void parent.offsetWidth;
            parent.classList.add("updated");
          }
        }
        updateLiveIndicator();
      }

      function updateLiveIndicator() {
        var wrap = document.getElementById("live-indicator");
        var label = document.getElementById("live-label");
        if (!wrap || !label) return;

        // If no manual reload yet, just treat as "Live" with no special tag
        if (!lastRefreshAt) {
          wrap.setAttribute("data-state", "live");
          var text0 = "Live";
          if (label.textContent !== text0) {
            label.textContent = text0;
            var parent0 = label.parentElement;
            if (parent0) {
              parent0.classList.remove("updated");
              void parent0.offsetWidth;
              parent0.classList.add("updated");
            }
          }
          return;
        }

        var ageSec = Math.floor((Date.now() - lastRefreshAt) / 1000);
        var state = "live";
        var text = "Live";
        if (ageSec >= 30 && ageSec < 180) {
          state = "stale";
          text = "Stale";
        } else if (ageSec >= 180) {
          state = "cold";
          text = "Cold";
        }
        wrap.setAttribute("data-state", state);
        if (label.textContent !== text) {
          label.textContent = text;
          var parent = label.parentElement;
          if (parent) {
            parent.classList.remove("updated");
            void parent.offsetWidth;
            parent.classList.add("updated");
          }
        }
      }

      // 1. Reload logic
      const btnReload = document.getElementById("btn-reload");

      function fetchPipelineHealth() {
        return fetch("/pipeline-health")
          .then((r) =>
            r
              .json()
              .catch(() => ({ ok: false })),
          )
          .then((h) => updatePipelineHealth(h))
          .catch(() => updatePipelineHealth({ ok: false }));
      }

      async function refreshStats() {
        if (!btnReload) return;
        btnReload.textContent = "Loading...";
        try {
          const res = await fetch("/stats");
          const data = await res.json();
          if (!data.ok) throw new Error("Stats fetch failed");
          updateUI(data);
          fetchPipelineHealth();
          btnReload.innerHTML =
            '<span class="btn-bullet">•</span> Reload stats';
        } catch (e) {
          console.error(e);
          btnReload.textContent = "Error";
          setTimeout(function () {
            btnReload.innerHTML =
              '<span class="btn-bullet">•</span> Reload stats';
          }, 2000);
        }
      }

      function updateUI(stats) {
        const map = {
          totalDownloads: stats.totalDownloads,
          totalSuccess: stats.totalSuccess,
          totalFail: stats.totalFail,
          totalEvents: stats.totalEvents,
          pendingEvents: stats.pendingEvents,
          ageLastEvent: formatAge(stats.lastEventAt),
          lastEventAt: formatTs(stats.lastEventAt),
          lastFlushAt: formatTs(stats.lastFlushAt),
          ageLastFlush: formatAge(stats.lastFlushAt),
        };

        if (stats.quota) {
          map.requestsToday = stats.quota.requestsToday || 0;
          map.quotaLevel = stats.quota.quotaLevel || "UNKNOWN";
          map.batchSize = stats.quota.batchSizeSuggestion || 0;
        }
        const requestsToday = Number(map.requestsToday ?? stats.requestsToday ?? 0);
        
        const uniqueCountriesAllTime = Number.isFinite(stats.uniqueCountriesAllTime)
          ? Number(stats.uniqueCountriesAllTime)
          : Object.keys(stats.counters?.byCountry || {}).filter(function (country) {
              var normalized = String(country || "").trim().toLowerCase();
              return normalized !== "" && normalized !== "xx" && normalized !== "unknown";
            }).length;
        const uniqueIpsCount = stats.uniqueRequestsToday ?? stats.uniqueIpsToday ?? 0;
        const useCountryReach = uniqueCountriesAllTime > 0;
        const isApproximated = !useCountryReach && (stats.isApproximated ?? false);
        const uniqueReach = useCountryReach ? uniqueCountriesAllTime : uniqueIpsCount;
        map.uniqueIps = isApproximated
          ? uniqueReach.toLocaleString() + "+ (capped)"
          : uniqueReach.toLocaleString();

        for (const [key, val] of Object.entries(map)) {
          const els = document.querySelectorAll('[data-bind="' + key + '"]');
          els.forEach((el) => {
            const current = el.textContent;
            const next = String(val);
            if (current !== next) {
              el.textContent = next;
              // APPROXIMATION-AWARE: Apply warning color for capped unique IPs
              if (key === "uniqueIps") {
                el.style.color = isApproximated ? "var(--warning)" : "inherit";
              }
              const parent =
                el.closest(".metric, .quota-stat, .quota-panel") ||
                el.parentElement;
              if (!parent) return;
              parent.classList.remove("updated");
              void parent.offsetWidth;
              parent.classList.add("updated");
            }
          });
        }

        // Empty state toggle
        const emptyEl = document.getElementById("empty-state");
        if (emptyEl) {
          if ((stats.totalEvents || 0) === 0) {
            emptyEl.classList.remove("hidden");
          } else if (!emptyEl.classList.contains("hidden")) {
            emptyEl.classList.add("hidden");
          }
        }

        // Success / fail rate cards
        var success = stats.totalSuccess || 0;
        var fail = stats.totalFail || 0;
        var total = success + fail;
        var srMeta = classifySuccessRateJS(success, fail);
        var srEls = document.querySelectorAll('[data-bind="successRate"]');
        var srBadgeEls = document.querySelectorAll(
          '[data-bind="successRateBadge"]',
        );
        var frEls = document.querySelectorAll('[data-bind="failRate"]');
        var failRateText =
          total > 0 ? ((fail / total) * 100).toFixed(1) + "%" : "—";

        var srCard = document.getElementById("card-success-rate");
        if (srCard) {
          srCard.classList.remove("metric-good", "metric-warn", "metric-bad");
          if (srMeta.className) {
            srCard.classList.add(srMeta.className);
          }
        }

        srEls.forEach(function (el) {
          var current = el.textContent || "";
          if (current !== srMeta.text) {
            el.textContent = srMeta.text;
            var parent =
              el.closest(".metric") || el.closest("#card-success-rate");
            if (parent) {
              parent.classList.remove("updated");
              void parent.offsetWidth;
              parent.classList.add("updated");
            }
          }
        });
        srBadgeEls.forEach(function (el) {
          var current = el.textContent || "";
          if (current !== srMeta.badge) {
            el.textContent = srMeta.badge;
          }
        });
        frEls.forEach(function (el) {
          var current = el.textContent || "";
          if (current !== failRateText) {
            el.textContent = failRateText;
            var parent =
              el.closest(".metric") || el.closest("#card-fail-rate");
            if (parent) {
              parent.classList.remove("updated");
              void parent.offsetWidth;
              parent.classList.add("updated");
            }
          }
        });

        const elRemote = document.getElementById("val-remote");
        if (elRemote && stats.quota) {
          const txt = stats.quota.remoteEnabled ? "ENABLED" : "DISABLED";
          if (elRemote.textContent.trim() !== txt) {
            elRemote.textContent = txt;
            elRemote.style.color = stats.quota.remoteEnabled
              ? "var(--success)"
              : "var(--danger)";
            elRemote.parentElement &&
              elRemote.parentElement.classList.add("updated");
          }

          var hintState = document.getElementById("danger-remote-state");
          var hintChip = document.getElementById("danger-remote-chip");
          var hintWrap = document.getElementById("danger-status-hint");
          if (hintState) {
            var oldTxt = (hintState.textContent || "").trim();
            if (oldTxt !== txt) {
              hintState.textContent = txt;
              hintState.classList.toggle("enabled", stats.quota.remoteEnabled);
              hintState.classList.toggle(
                "disabled",
                !stats.quota.remoteEnabled,
              );
              if (hintWrap) {
                hintWrap.classList.remove("updated");
                void hintWrap.offsetWidth;
                hintWrap.classList.add("updated");
              }
            }
          }
          if (hintChip) {
            hintChip.style.display = stats.quota.remoteEnabled
              ? "none"
              : "inline-block";
          }
        }

        const rawEl = document.getElementById("raw-stats-json");
        if (rawEl) {
          const next = JSON.stringify(stats, null, 2);
          if (rawEl.textContent !== next) {
            rawEl.textContent = next;
            rawEl.parentElement &&
              rawEl.parentElement.classList.add("updated");
          }
        }

        updateQuotaChips(stats.quota);
        updateBreakdowns(stats.counters);
        updateLastRefreshLabel();
        updateRemoteConfigForm(stats.remoteConfig || {}, stats.quota || {});
      }

      function formatDuration(ms) {
        if (ms == null) return "—";
        if (!Number.isFinite(ms) || ms < 0) return "—";
        const sec = Math.floor(ms / 1000);
        const min = Math.floor(sec / 60);
        const hr = Math.floor(min / 60);
        const day = Math.floor(hr / 24);
        if (day > 0) return day + "d";
        if (hr > 0) return hr + "h";
        if (min > 0) return min + "m";
        return sec + "s";
      }

      function updatePipelineHealth(health) {
        const banner = document.getElementById("pipeline-health-banner");
        const statusEl = document.getElementById("pipeline-health-status");
        const reasonsEl = document.getElementById("pipeline-health-reasons");
        const chipEl = document.getElementById("pipeline-health-chip");
        const pendingEl = document.getElementById("pipeline-health-pending");
        const oldestEl = document.getElementById("pipeline-health-oldest");
        const bufferEl = document.getElementById("pipeline-health-buffer");
        const failuresEl = document.getElementById("pipeline-health-failures");
        const lastFlushEl = document.getElementById("pipeline-health-last-flush");
        const lastEventEl = document.getElementById("pipeline-health-last-event");
        const lastAlertEl = document.getElementById("pipeline-health-last-alert");
        const committedEl = document.getElementById("pipeline-health-committed");
        const maxBufferEl = document.getElementById("pipeline-health-max-buffer");
        const rawEl = document.getElementById("raw-health-json");

        if (!banner || !statusEl || !reasonsEl) return;
        const ok = !(health && health.ok === false);
        const statusRaw = ok ? (health?.status || "unknown") : "unknown";
        const status =
          statusRaw === "critical" || statusRaw === "warn" || statusRaw === "ok"
            ? statusRaw
            : "unknown";
        banner.classList.remove("ok", "warn", "critical");
        if (status === "critical") banner.classList.add("critical");
        else if (status === "warn") banner.classList.add("warn");
        else if (status === "ok") banner.classList.add("ok");
        else banner.classList.add("warn");

        if (chipEl) {
          chipEl.classList.remove("ok", "warn", "critical");
          if (status === "critical") chipEl.classList.add("critical");
          else if (status === "warn") chipEl.classList.add("warn");
          else if (status === "ok") chipEl.classList.add("ok");
          chipEl.textContent = String(status).toUpperCase();
        }

        statusEl.textContent = "Pipeline Health: " + String(status).toUpperCase();
        const reasons = Array.isArray(health?.reasons) ? health.reasons : [];
        reasonsEl.textContent = ok
          ? reasons.length
            ? reasons.join(", ")
            : "No issues detected."
          : "Unable to load pipeline health.";

        if (pendingEl) pendingEl.textContent = ok ? String(health?.pendingBatches ?? "—") : "—";
        if (oldestEl) {
          oldestEl.textContent = ok
            ? formatDuration(health?.oldestPendingAgeMs ?? null)
            : "—";
        }
        if (bufferEl) {
          const util = ok ? health?.bufferUtilization : null;
          bufferEl.textContent = Number.isFinite(util) ? Math.round(util * 100) + "%" : "—";
        }
        if (failuresEl) {
          failuresEl.textContent = ok ? String(health?.consecutiveFailures ?? "—") : "—";
        }
        if (lastFlushEl) {
          lastFlushEl.textContent = ok ? formatTs(health?.lastFlushAt ?? null) : "—";
        }
        if (lastEventEl) {
          lastEventEl.textContent = ok ? formatTs(health?.lastEventAt ?? null) : "—";
        }
        if (lastAlertEl) {
          if (!ok) {
            lastAlertEl.textContent = "—";
          } else if (health?.lastHealthNotifyAt) {
            lastAlertEl.textContent = formatTs(health.lastHealthNotifyAt);
          } else {
            lastAlertEl.textContent = "Never";
          }
        }
        if (committedEl) {
          committedEl.textContent = ok ? String(health?.committedSeq ?? "—") : "—";
        }
        if (maxBufferEl) {
          maxBufferEl.textContent = ok ? String(health?.maxBufferSize ?? "—") : "—";
        }
        if (rawEl) {
          const payload = ok ? health : { ok: false, status: "unknown" };
          const next = JSON.stringify(payload, null, 2);
          if (rawEl.textContent !== next) {
            rawEl.textContent = next;
          }
        }
      }

      if (btnReload) {
        btnReload.onclick = refreshStats;
      }

      if (btnReload) {
        btnReload.onclick = refreshStats;
      }

      // --- Remote Config Logic ---
      const cfgDefaults = {
        batchSize: 50,
        maxDailyRequests: 50,
        maxRetry: 5,
        maxEventsPerRequest: 5000,
        maxBufferSize: 50000,
        allowLegacyEvents: true,
        flushMode: "next_day",
        timeFlushMinutes: { low: 1440, mid: 1440, high: 1440 },
        dailyFlushWindowStartUtc: 1,
        dailyFlushWindowMinutes: 120,
        cancelHoldDelayMs: 1000,
        healthThresholds: {
          warnPendingBatches: 10,
          criticalPendingBatches: 25,
          warnFailures: 3,
          criticalFailures: 5,
          warnStaleMs: 6 * 60 * 60 * 1000,
          criticalStaleMs: 24 * 60 * 60 * 1000,
          warnBufferUtil: 0.8,
          criticalBufferUtil: 0.95,
        },
        healthNotifyIntervalsMs: {
          warn: 30 * 60 * 1000,
          critical: 10 * 60 * 1000,
        },
      };

      function clampInt(value, min, max, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return Math.min(max, Math.max(min, Math.floor(num)));
      }

      function clampFloat(value, min, max, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return Math.min(max, Math.max(min, num));
      }

      function msToHours(valueMs, fallback) {
        const num = Number(valueMs);
        if (!Number.isFinite(num) || num < 0) return fallback;
        return Math.round(num / 3600000);
      }

      function msToMinutes(valueMs, fallback) {
        const num = Number(valueMs);
        if (!Number.isFinite(num) || num < 0) return fallback;
        return Math.round(num / 60000);
      }

      function ratioToPercent(value, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) return fallback;
        return Math.round(num * 100);
      }

      function setConfigStatus(text, cls) {
        const el = document.getElementById("config-status");
        if (!el) return;
        el.textContent = text;
        el.classList.remove("ok", "err");
        if (cls) el.classList.add(cls);
      }

      function setConfigDirty(flag) {
        configDirty = flag;
        if (configDirty) {
          setConfigStatus("Unsaved changes", "");
        }
      }

      function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = String(value);
      }

      function setToggle(id, checked) {
        const el = document.getElementById(id);
        if (el && typeof checked === "boolean") {
          el.checked = checked;
        }
      }

      function setConfigFromRemote(cfg, force) {
        if (configDirty && !force) return;
        const merged = {
          batchSize: cfg.batchSize ?? cfgDefaults.batchSize,
          maxDailyRequests: cfg.maxDailyRequests ?? cfgDefaults.maxDailyRequests,
          maxRetry: cfg.maxRetry ?? cfgDefaults.maxRetry,
          maxEventsPerRequest: cfg.maxEventsPerRequest ?? cfgDefaults.maxEventsPerRequest,
          maxBufferSize: cfg.maxBufferSize ?? cfgDefaults.maxBufferSize,
          allowLegacyEvents: typeof cfg.allowLegacyEvents === "boolean"
            ? cfg.allowLegacyEvents
            : cfgDefaults.allowLegacyEvents,
          flushMode: cfg.flushMode ?? cfgDefaults.flushMode,
          timeFlushMinutes: cfg.timeFlushMinutes || cfgDefaults.timeFlushMinutes,
          dailyFlushWindowStartUtc: cfg.dailyFlushWindowStartUtc ?? cfgDefaults.dailyFlushWindowStartUtc,
          dailyFlushWindowMinutes: cfg.dailyFlushWindowMinutes ?? cfgDefaults.dailyFlushWindowMinutes,
          cancelHoldDelayMs: cfg.cancelHoldDelayMs ?? cfgDefaults.cancelHoldDelayMs,
          healthThresholds: cfg.healthThresholds || cfgDefaults.healthThresholds,
          healthNotifyIntervalsMs: cfg.healthNotifyIntervalsMs || cfgDefaults.healthNotifyIntervalsMs,
          configVersion: cfg.configVersion,
        };

        setValue("cfg-batch-size", merged.batchSize);
        setValue("cfg-max-daily", merged.maxDailyRequests);
        setValue("cfg-max-retry", merged.maxRetry);
        setValue("cfg-max-events", merged.maxEventsPerRequest);
        setValue("cfg-max-buffer", merged.maxBufferSize);
        setToggle("cfg-allow-legacy", merged.allowLegacyEvents);
        setValue("cfg-time-low", merged.timeFlushMinutes.low);
        setValue("cfg-time-mid", merged.timeFlushMinutes.mid);
        setValue("cfg-time-high", merged.timeFlushMinutes.high);
        setValue("cfg-window-start", merged.dailyFlushWindowStartUtc);
        setValue("cfg-window-minutes", merged.dailyFlushWindowMinutes);
        setValue("cfg-cancel-hold", merged.cancelHoldDelayMs);
        setValue("cfg-health-pending-warn", merged.healthThresholds.warnPendingBatches);
        setValue("cfg-health-pending-critical", merged.healthThresholds.criticalPendingBatches);
        setValue("cfg-health-fail-warn", merged.healthThresholds.warnFailures);
        setValue("cfg-health-fail-critical", merged.healthThresholds.criticalFailures);
        setValue("cfg-health-stale-warn", msToHours(merged.healthThresholds.warnStaleMs, 6));
        setValue("cfg-health-stale-critical", msToHours(merged.healthThresholds.criticalStaleMs, 24));
        setValue("cfg-health-buffer-warn", ratioToPercent(merged.healthThresholds.warnBufferUtil, 80));
        setValue("cfg-health-buffer-critical", ratioToPercent(merged.healthThresholds.criticalBufferUtil, 95));
        setValue("cfg-health-notify-warn", msToMinutes(merged.healthNotifyIntervalsMs.warn, 30));
        setValue("cfg-health-notify-critical", msToMinutes(merged.healthNotifyIntervalsMs.critical, 10));

        const flushEl = document.getElementById("cfg-flush-mode");
        if (flushEl) flushEl.value = merged.flushMode;
        toggleTimeFields(merged.flushMode);

        const versionEl = document.getElementById("cfg-version");
        if (versionEl && merged.configVersion != null) {
          versionEl.textContent = String(merged.configVersion);
        }

        setConfigStatus("Loaded", "ok");
        configDirty = false;
      }

      function updateRemoteConfigForm(cfg, quota) {
        setConfigFromRemote(cfg, false);
        const enabled = quota && typeof quota.remoteEnabled === "boolean"
          ? quota.remoteEnabled
          : true;
        const reason = (cfg && cfg.remoteEnabledReason) ? cfg.remoteEnabledReason : "ok";
        const statusEl = document.getElementById("remote-enabled-status");
        const reasonEl = document.getElementById("remote-enabled-reason");
        const legacyEnabled = cfg && typeof cfg.allowLegacyEvents === "boolean"
          ? cfg.allowLegacyEvents
          : cfgDefaults.allowLegacyEvents;
        const legacyEl = document.getElementById("legacy-warning");
        const legacyText = document.getElementById("legacy-warning-text");
        if (legacyEl) {
          legacyEl.classList.toggle("is-off", !legacyEnabled);
        }
        if (legacyText) {
          legacyText.textContent = legacyEnabled
            ? "Enabled — missing event IDs will be auto-assigned. Disable after clients update."
            : "Disabled — events without IDs will be rejected.";
        }
        if (statusEl) {
          statusEl.classList.remove("ok", "err");
          statusEl.classList.add(enabled ? "ok" : "err");

          statusEl.textContent = "";
          statusEl.appendChild(document.createTextNode("Remote analytics: "));
          const strong = document.createElement("strong");
          strong.textContent = enabled ? "ENABLED" : "PAUSED";
          statusEl.appendChild(strong);
          statusEl.appendChild(document.createTextNode(" · Reason: "));
          const span = document.createElement("span");
          span.id = "remote-enabled-reason";
          span.textContent = reason;
          statusEl.appendChild(span);
        } else if (reasonEl) {
          reasonEl.textContent = reason;
        }
      }

      function toggleTimeFields(mode) {
        const disable = mode !== "time_based";
        ["cfg-time-low", "cfg-time-mid", "cfg-time-high"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.disabled = disable;
        });
      }

      function readNum(id, min, max, fallback) {
        const el = document.getElementById(id);
        if (!el) return fallback;
        return clampInt(el.value, min, max, fallback);
      }

      function readFloat(id, min, max, fallback) {
        const el = document.getElementById(id);
        if (!el) return fallback;
        return clampFloat(el.value, min, max, fallback);
      }

      function readHoursMs(id, fallbackMs) {
        const hours = readFloat(id, 0, 720, fallbackMs / 3600000);
        return Math.round(hours * 3600000);
      }

      function readMinutesMs(id, fallbackMs) {
        const minutes = readFloat(id, 1, 1440, fallbackMs / 60000);
        return Math.round(minutes * 60000);
      }

      function readPercentRatio(id, fallbackRatio) {
        const pct = readFloat(id, 0, 100, fallbackRatio * 100);
        return pct / 100;
      }

      async function sendRemoteConfigUpdate(payload) {
        const btnSave = document.getElementById("btn-config-save");
        if (btnSave) {
          btnSave.classList.add("btn-loading");
          btnSave.style.pointerEvents = "none";
        }
        setConfigStatus("Saving...", "");

        try {
          const res = await fetch("/admin/update-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!data.ok) {
            setConfigStatus("Error: " + (data.error || "unknown"), "err");
          } else {
            setConfigStatus("Saved", "ok");
            setConfigDirty(false);
            if (data.config) {
              setConfigFromRemote(data.config, true);
            }
            refreshStats();
          }
        } catch (e) {
          setConfigStatus("Network error", "err");
        } finally {
          if (btnSave) {
            btnSave.classList.remove("btn-loading");
            btnSave.style.pointerEvents = "";
          }
        }
      }

      const cfgInputs = [
        "cfg-batch-size",
        "cfg-max-daily",
        "cfg-max-retry",
        "cfg-max-events",
        "cfg-max-buffer",
        "cfg-allow-legacy",
        "cfg-flush-mode",
        "cfg-time-low",
        "cfg-time-mid",
        "cfg-time-high",
        "cfg-window-start",
        "cfg-window-minutes",
        "cfg-cancel-hold",
        "cfg-health-pending-warn",
        "cfg-health-pending-critical",
        "cfg-health-fail-warn",
        "cfg-health-fail-critical",
        "cfg-health-stale-warn",
        "cfg-health-stale-critical",
        "cfg-health-buffer-warn",
        "cfg-health-buffer-critical",
        "cfg-health-notify-warn",
        "cfg-health-notify-critical",
      ];
      cfgInputs.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener("input", () => setConfigDirty(true));
          el.addEventListener("change", () => {
            if (id === "cfg-flush-mode") {
              toggleTimeFields(el.value);
            }
            if (id === "cfg-allow-legacy") {
              const legacyEl = document.getElementById("legacy-warning");
              const legacyText = document.getElementById("legacy-warning-text");
              const enabled = !!el.checked;
              if (legacyEl) {
                legacyEl.classList.toggle("is-off", !enabled);
              }
              if (legacyText) {
                legacyText.textContent = enabled
                  ? "Enabled — missing event IDs will be auto-assigned. Disable after clients update."
                  : "Disabled — events without IDs will be rejected.";
              }
            }
            setConfigDirty(true);
          });
        }
      });

      const btnCfgReset = document.getElementById("btn-config-reset");
      if (btnCfgReset) {
        btnCfgReset.onclick = () => {
          setConfigFromRemote(cfgDefaults, true);
          setConfigDirty(true);
          setConfigStatus("Defaults loaded (not saved)", "");
        };
      }

      const btnCfgSave = document.getElementById("btn-config-save");
      if (btnCfgSave) {
        btnCfgSave.onclick = () => {
          const flushEl = document.getElementById("cfg-flush-mode");
          const flushModeValue = flushEl ? flushEl.value : cfgDefaults.flushMode;
          const legacyEl = document.getElementById("cfg-allow-legacy");
          const allowLegacyEvents = legacyEl
            ? !!legacyEl.checked
            : cfgDefaults.allowLegacyEvents;
          const payload = {
            batchSize: readNum("cfg-batch-size", 1, 1000, cfgDefaults.batchSize),
            maxDailyRequests: readNum("cfg-max-daily", 1, 1000, cfgDefaults.maxDailyRequests),
            maxRetry: readNum("cfg-max-retry", 0, 20, cfgDefaults.maxRetry),
            maxEventsPerRequest: readNum("cfg-max-events", 1, 50000, cfgDefaults.maxEventsPerRequest),
            maxBufferSize: readNum("cfg-max-buffer", 1, 500000, cfgDefaults.maxBufferSize),
            allowLegacyEvents,
            flushMode: flushModeValue,
            timeFlushMinutes: {
              low: readNum("cfg-time-low", 1, 10080, cfgDefaults.timeFlushMinutes.low),
              mid: readNum("cfg-time-mid", 1, 10080, cfgDefaults.timeFlushMinutes.mid),
              high: readNum("cfg-time-high", 1, 10080, cfgDefaults.timeFlushMinutes.high),
            },
            dailyFlushWindowStartUtc: readNum("cfg-window-start", 0, 23, cfgDefaults.dailyFlushWindowStartUtc),
            dailyFlushWindowMinutes: readNum("cfg-window-minutes", 1, 1440, cfgDefaults.dailyFlushWindowMinutes),
            cancelHoldDelayMs: readNum("cfg-cancel-hold", 0, 10000, cfgDefaults.cancelHoldDelayMs),
            healthThresholds: {
              warnPendingBatches: readNum("cfg-health-pending-warn", 0, 1000, cfgDefaults.healthThresholds.warnPendingBatches),
              criticalPendingBatches: readNum("cfg-health-pending-critical", 0, 2000, cfgDefaults.healthThresholds.criticalPendingBatches),
              warnFailures: readNum("cfg-health-fail-warn", 0, 100, cfgDefaults.healthThresholds.warnFailures),
              criticalFailures: readNum("cfg-health-fail-critical", 0, 100, cfgDefaults.healthThresholds.criticalFailures),
              warnStaleMs: readHoursMs("cfg-health-stale-warn", cfgDefaults.healthThresholds.warnStaleMs),
              criticalStaleMs: readHoursMs("cfg-health-stale-critical", cfgDefaults.healthThresholds.criticalStaleMs),
              warnBufferUtil: readPercentRatio("cfg-health-buffer-warn", cfgDefaults.healthThresholds.warnBufferUtil),
              criticalBufferUtil: readPercentRatio("cfg-health-buffer-critical", cfgDefaults.healthThresholds.criticalBufferUtil),
            },
            healthNotifyIntervalsMs: {
              warn: readMinutesMs("cfg-health-notify-warn", cfgDefaults.healthNotifyIntervalsMs.warn),
              critical: readMinutesMs("cfg-health-notify-critical", cfgDefaults.healthNotifyIntervalsMs.critical),
            },
          };
          sendRemoteConfigUpdate(payload);
        };
      }

      const statsEl = document.getElementById("raw-stats-json");
      if (statsEl) {
        try {
          const initialStats = JSON.parse(statsEl.textContent || "{}");
          if (initialStats && initialStats.remoteConfig) {
            setConfigFromRemote(initialStats.remoteConfig, true);
            updateRemoteConfigForm(initialStats.remoteConfig, initialStats.quota || {});
          }
        } catch (e) {
          setConfigStatus("Config load error", "err");
        }
      }

      // Changelog Logic
      /*
       * ===========================================================================
       * IMPORTANT: Browser-Side JavaScript Rules
       * ===========================================================================
       * This script runs IN THE BROWSER, not on the server. You MUST follow these
       * rules to avoid breaking the entire dashboard:
       *
       * 1. NO TypeScript syntax allowed (e.g., "as HTMLInputElement", "as any")
       *    ❌ const el = document.querySelector('.foo') as HTMLInputElement;
       *    ✅ const el = document.querySelector('.foo');
       *    ✅ const value = el ? el.value : 'default';
       *
       * 2. NO TypeScript type annotations (e.g., "x: string", "fn(): void")
       *    ❌ function foo(x: string): void { ... }
       *    ✅ function foo(x) { ... }
       *
       * 3. Use optional chaining (?) and nullish coalescing (??) carefully
       *    These are supported in modern browsers but combine with explicit checks
       *
       * 4. Test in browser DevTools console for syntax errors after changes
       * ===========================================================================
       */
      const btnSaveAll = document.getElementById("btn-save-all");
      const btnSaveText = document.getElementById("btn-save-text");
      const btnSaveRules = document.getElementById("btn-save-rules");
      const btnPublishDraft = document.getElementById("btn-publish-draft");
      const btnSyncNow = document.getElementById("btn-sync-now");
      const btnSaveMode = document.getElementById("btn-save-mode");
      const rulesSaveStatusEl = document.getElementById("rules-save-status");
      const changelogActionStatusEl = document.getElementById("cl-action-status");
      const markdownInputEl = document.getElementById("new-cl-markdown");
      const markdownUrlInputEl = document.getElementById("new-cl-markdown-url");
      const modeInputEl = document.getElementById("cl-apply-mode");
      const autoSyncEnabledInputEl = document.getElementById("cl-auto-sync-enabled");
      const autoSyncIntervalInputEl = document.getElementById("cl-auto-sync-interval");
      const syncStatusEl = document.getElementById("cl-sync-status");
      const syncErrorEl = document.getElementById("cl-sync-error");
      const draftPreviewEl = document.getElementById("cl-draft-preview");
      const currentPreviewEl = document.getElementById("cl-current-preview");
      const revisionHistoryEl = document.getElementById("cl-revision-history");
      
      function setChangelogActionStatus(message, tone) {
        if (!changelogActionStatusEl) return;
        changelogActionStatusEl.textContent = message || "Idle";
        changelogActionStatusEl.style.color = tone === "ok" ? "#86efac" : tone === "err" ? "#fca5a5" : "var(--text-soft)";
      }

      function setRuleStatus(message, tone) {
        if (!rulesSaveStatusEl) return;
        rulesSaveStatusEl.textContent = message || "Idle";
        rulesSaveStatusEl.style.color = tone === "ok" ? "#86efac" : tone === "err" ? "#fca5a5" : "var(--text-soft)";
      }

      async function callChangelogAdmin(endpoint, payload) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "same-origin",
          body: JSON.stringify(payload || {})
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          const error = (data && data.error) ? data.error : "request_failed";
          throw new Error(error);
        }
        return data;
      }

      async function fetchAdminChangelogState() {
        const res = await fetch("/admin/changelog", { credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "state_load_failed");
        }
        return data;
      }

      async function refreshLivePreviewFromPublicEndpoint() {
        if (!currentPreviewEl) return;
        currentPreviewEl.innerHTML = '<div class="cl-preview-empty">Loading public /changelog…</div>';
        try {
          const res = await fetch("/changelog", { credentials: "same-origin", cache: "no-store" });
          const data = await res.json();
          renderReleasePreview(currentPreviewEl, Array.isArray(data.entries) ? data.entries : []);
        } catch (_) {
          currentPreviewEl.innerHTML = '<div class="cl-preview-empty">Failed to load public /changelog preview.</div>';
        }
      }

      function renderSyncStatus(sync) {
        if (!syncStatusEl || !syncErrorEl) return;
        const status = String(sync && sync.lastAutoSyncStatus || "idle");
        const text = status === "ok" ? "Auto sync healthy" : status === "error" ? "Auto sync error" : "Auto sync idle";
        syncStatusEl.textContent = text;
        syncStatusEl.style.color = status === "ok" ? "#86efac" : status === "error" ? "#fca5a5" : "var(--text-soft)";
        syncErrorEl.textContent = String(sync && sync.lastAutoSyncError || "");
      }

      function syncChangelogUiFromState(state) {
        if (!state || state.ok !== true) return;
        const liveEntries = state.live && Array.isArray(state.live.entries)
          ? state.live.entries
          : (Array.isArray(state.entries) ? state.entries : []);
        const draftEntries = state.draft && Array.isArray(state.draft.entries) ? state.draft.entries : [];
        renderReleasePreview(draftPreviewEl, draftEntries);
        renderReleasePreview(currentPreviewEl, liveEntries);
        const cfg = state.config || {};
        if (markdownInputEl && state.draft && typeof state.draft.markdown === "string") {
          markdownInputEl.value = state.draft.markdown;
        }
        if (markdownUrlInputEl) {
          const sourceUrl = (state.draft && state.draft.markdownUrl) || cfg.markdownSourceUrl || "";
          markdownUrlInputEl.value = sourceUrl;
        }
        if (modeInputEl) modeInputEl.value = cfg.applyMode === "auto_github" ? "auto_github" : "manual";
        if (autoSyncEnabledInputEl) autoSyncEnabledInputEl.checked = cfg.autoSyncEnabled === true;
        if (autoSyncIntervalInputEl) autoSyncIntervalInputEl.value = String(cfg.autoSyncIntervalMinutes || 60);
        renderSyncStatus(state.sync || cfg || {});
        const rawStatsEl = document.getElementById("raw-stats-json");
        if (rawStatsEl) {
          try {
            const parsedRaw = JSON.parse(rawStatsEl.textContent || "{}");
            parsedRaw.changelog = liveEntries;
            parsedRaw.changelogConfig = cfg;
            rawStatsEl.textContent = JSON.stringify(parsedRaw, null, 2);
          } catch (_) {
            // ignore
          }
        }
        updateModeDependentControls();
      }

      async function sendChangelogUpdate(payload) {
        try {
          setChangelogActionStatus("Saving…", "info");
          const data = await callChangelogAdmin("/admin/changelog", payload || {});
          syncChangelogUiFromState(data);
          await loadChangelogHistory();
          setChangelogActionStatus("Saved", "ok");
          return data;
        } catch (error) {
          const msg = error instanceof Error ? error.message : "save_failed";
          setChangelogActionStatus("Error: " + msg, "err");
          throw error;
        }
      }

      function escapeHtmlUnsafe(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function clearChildren(node) {
        if (!node) return;
        while (node.firstChild) node.removeChild(node.firstChild);
      }

      function setPreviewMessage(node, message) {
        if (!node) return;
        clearChildren(node);
        const el = document.createElement("div");
        el.className = "cl-preview-empty";
        el.textContent = message;
        node.appendChild(el);
      }

      function renderReleasePreview(container, entries) {
        if (!container) return;
        const list = Array.isArray(entries) ? entries.slice(0, 3) : [];
        if (list.length === 0) {
          setPreviewMessage(container, "No entries to preview.");
          return;
        }
        clearChildren(container);
        list.forEach((entry) => {
          const summary = entry.summary || '';
          const added = Array.isArray(entry.added) ? entry.added : [];
          const changed = Array.isArray(entry.changed) ? entry.changed : [];
          const fixed = Array.isArray(entry.fixed) ? entry.fixed : [];
          const article = document.createElement("article");
          article.style.marginBottom = "10px";
          article.style.borderBottom = "1px dashed var(--border-subtle)";
          article.style.paddingBottom = "8px";

          const heading = document.createElement("h4");
          heading.textContent = "v" + String(entry.version || "");
          article.appendChild(heading);

          const summaryNode = document.createElement("p");
          summaryNode.className = "cl-preview-summary";
          summaryNode.textContent = String(summary || (entry.changes && entry.changes[0]) || "");
          article.appendChild(summaryNode);

          const appendCategory = (title, color, points) => {
            if (!Array.isArray(points) || points.length === 0) return;
            const titleNode = document.createElement("div");
            titleNode.style.fontSize = "0.75em";
            titleNode.style.color = color;
            titleNode.style.marginBottom = "2px";
            titleNode.textContent = title;
            article.appendChild(titleNode);

            const listNode = document.createElement("ul");
            points.slice(0, 3).forEach((point) => {
              const li = document.createElement("li");
              li.textContent = String(point || "");
              listNode.appendChild(li);
            });
            article.appendChild(listNode);
          };

          appendCategory("Added", "#86efac", added);
          appendCategory("Changed", "#93c5fd", changed);
          appendCategory("Fixed", "#fca5a5", fixed);
          container.appendChild(article);
        });
      }

      async function loadChangelogHistory() {
        if (!revisionHistoryEl) return;
        revisionHistoryEl.innerHTML = '<div class="cl-preview-empty">Loading revisions…</div>';
        try {
          const data = await fetchAdminChangelogState();
          syncChangelogUiFromState(data);
          await refreshLivePreviewFromPublicEndpoint();
          const history = Array.isArray(data.history) ? data.history : [];
          if (!history.length) {
            revisionHistoryEl.innerHTML = '<div class="cl-preview-empty">No revisions saved yet.</div>';
            return;
          }
          revisionHistoryEl.innerHTML = history.slice(0, 15).map((row) => {
            const when = new Date(Number(row.createdAt || 0)).toLocaleString('en-US', { timeZone: 'UTC' });
            const source = String(row.source || 'manual');
            const valid = row.valid === true ? 'valid' : 'needs check';
            const releases = Number(row.releases || 0);
            return '<div class="cl-revision-item"><strong>' + escapeHtmlUnsafe(source) + '</strong> · ' +
              escapeHtmlUnsafe(valid) + ' · ' + releases + ' releases<br>' +
              '<span>' + escapeHtmlUnsafe(when) + ' UTC</span></div>';
          }).join('');
        } catch (_) {
          revisionHistoryEl.innerHTML = '<div class="cl-preview-empty">Failed to load revision history.</div>';
        }
      }

      async function previewMarkdownDraft(fromUrlOnly) {
        const markdown = markdownInputEl ? markdownInputEl.value.trim() : '';
        const markdownUrl = markdownUrlInputEl ? markdownUrlInputEl.value.trim() : '';
        if (!markdown && !markdownUrl) {
          if (draftPreviewEl) draftPreviewEl.innerHTML = '<div class="cl-preview-empty">Paste markdown or provide a URL first.</div>';
          return;
        }
        const payload = {};
        if (!fromUrlOnly && markdown) payload.markdown = markdown;
        if (markdownUrl) payload.markdownUrl = markdownUrl;
        if (fromUrlOnly && !markdownUrl) {
          if (draftPreviewEl) draftPreviewEl.innerHTML = '<div class="cl-preview-empty">Provide a markdown URL to import.</div>';
          return;
        }
        if (draftPreviewEl) draftPreviewEl.innerHTML = '<div class="cl-preview-empty">Parsing markdown…</div>';
        try {
          const res = await fetch('/admin/changelog/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!data.ok) {
            const msg = data.error || 'parse_failed';
            if (draftPreviewEl) draftPreviewEl.innerHTML = '<div class="cl-preview-empty">Parse failed: ' + escapeHtmlUnsafe(msg) + '</div>';
            return;
          }
          if (fromUrlOnly && markdownInputEl && Array.isArray(data.entries) && data.entries.length > 0) {
            markdownInputEl.value = data.entries.map((entry) => entry.markdown || '').filter(Boolean).join('\\n\\n');
          }
          if (Array.isArray(data.errors) && data.errors.length > 0 && draftPreviewEl) {
            const errList = data.errors.slice(0, 4).map((e) => '<li>' + escapeHtmlUnsafe(e) + '</li>').join('');
            draftPreviewEl.innerHTML = '<div style="font-size:0.82em; color:#fca5a5; margin-bottom:6px;">Parser warnings:</div><ul>' + errList + '</ul>';
          }
          renderReleasePreview(draftPreviewEl, data.entries || []);
        } catch (_) {
          if (draftPreviewEl) draftPreviewEl.innerHTML = '<div class="cl-preview-empty">Preview request failed.</div>';
        }
      }

      (function initChangelogPreviewState() {
        const raw = document.getElementById('raw-stats-json');
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw.textContent || '{}');
          const entries = Array.isArray(parsed.changelog) ? parsed.changelog : [];
          renderReleasePreview(currentPreviewEl, entries);
        } catch (_) {
          renderReleasePreview(currentPreviewEl, []);
        }
      })();

      const previewBtn = document.getElementById('btn-preview-markdown');
      if (previewBtn) previewBtn.onclick = () => previewMarkdownDraft(false);

      const importBtn = document.getElementById('btn-import-markdown-url');
      if (importBtn) importBtn.onclick = () => previewMarkdownDraft(true);

      const helpBtn = document.getElementById('cl-format-help');
      if (helpBtn) {
        helpBtn.onclick = () => {
          alert(
            "Format:\\n\\n## v1.3.8\\n### Summary\\nOne summary line.\\n### Added\\n- Bullet\\n### Changed\\n- Bullet\\n### Fixed\\n- Bullet\\n\\nSource file: user-friendly-changelog.md on GitHub."
          );
        };
      }

      loadChangelogHistory();

      function buildLegacyEditorMarkdown() {
        const versionEl = document.getElementById("new-cl-version");
        const changesEl = document.getElementById("new-cl-changes");
        if (!versionEl || !changesEl) return "";
        let version = String(versionEl.value || "").trim();
        if (version.toLowerCase().startsWith("v")) {
          version = version.slice(1);
        }
        const rows = String(changesEl.value || "")
          .split("\\n")
          .map((row) => row.trim())
          .filter(Boolean);
        if (!version || rows.length === 0) return "";
        const summary = rows[0].replace(/^[-*][ \t]+/, "");
        const bullets = rows.map((row) => row.replace(/^[-*][ \t]+/, ""));
        return [
          "## v" + version,
          "### Summary",
          summary,
          "### Added",
          ...bullets.map((row) => "- " + row),
          "### Changed",
          "- No structural changes documented.",
          "### Fixed",
          "- No fixes documented.",
        ].join("\\n");
      }

      function readModePayload() {
        return {
          applyMode: modeInputEl ? modeInputEl.value : "manual",
          autoSyncEnabled: autoSyncEnabledInputEl ? autoSyncEnabledInputEl.checked : false,
          autoSyncIntervalMinutes: autoSyncIntervalInputEl ? Number(autoSyncIntervalInputEl.value || "60") : 60,
          markdownSourceUrl: markdownUrlInputEl ? String(markdownUrlInputEl.value || "").trim() : "",
        };
      }

      function updateModeDependentControls() {
        const mode = modeInputEl ? modeInputEl.value : "manual";
        const isAuto = mode === "auto_github";
        if (autoSyncEnabledInputEl) autoSyncEnabledInputEl.disabled = !isAuto;
        if (autoSyncIntervalInputEl) autoSyncIntervalInputEl.disabled = !isAuto;
        if (btnPublishDraft) btnPublishDraft.disabled = isAuto;
        if (btnSyncNow) btnSyncNow.disabled = !isAuto;
      }
      if (modeInputEl) {
        modeInputEl.addEventListener("change", updateModeDependentControls);
      }
      updateModeDependentControls();

      if (btnSaveMode) {
        btnSaveMode.onclick = async () => {
          try {
            setChangelogActionStatus("Saving mode…", "info");
            const data = await callChangelogAdmin("/admin/changelog/mode", readModePayload());
            syncChangelogUiFromState(data);
            await loadChangelogHistory();
            setChangelogActionStatus("Mode saved", "ok");
          } catch (error) {
            const msg = error instanceof Error ? error.message : "mode_save_failed";
            setChangelogActionStatus("Mode save failed: " + msg, "err");
          }
        };
      }

      if (btnSyncNow) {
        btnSyncNow.onclick = async () => {
          try {
            setChangelogActionStatus("Running sync…", "info");
            const data = await callChangelogAdmin("/admin/changelog/sync-now", {});
            syncChangelogUiFromState(data);
            await loadChangelogHistory();
            setChangelogActionStatus("Auto sync completed", "ok");
          } catch (error) {
            const msg = error instanceof Error ? error.message : "sync_now_failed";
            setChangelogActionStatus("Sync failed: " + msg, "err");
          }
        };
      }

      if (btnPublishDraft) {
        btnPublishDraft.onclick = async () => {
          try {
            setChangelogActionStatus("Publishing draft…", "info");
            const data = await callChangelogAdmin("/admin/changelog/publish", {});
            syncChangelogUiFromState(data);
            await loadChangelogHistory();
            setChangelogActionStatus("Draft published", "ok");
          } catch (error) {
            const msg = error instanceof Error ? error.message : "publish_failed";
            setChangelogActionStatus("Publish failed: " + msg, "err");
          }
        };
      }

      // --- NEW RULES ENGINE LOGIC ---
      
      // Init rules from server state
      let activeRules = window.CURRENT_RULES || [];
      
      function renderRulesList() {
         const container = document.getElementById("rules-list-container");
         const countEl = document.getElementById("rules-count");
         if (!container) return;
         
         if (countEl) countEl.textContent = activeRules.length + " rules";

         while (container.firstChild) {
            container.removeChild(container.firstChild);
         }

         if (activeRules.length === 0) {
            const emptyDiv = document.createElement("div");
            emptyDiv.style.cssText = "padding: 12px; text-align: center; color: var(--text-soft); font-style: italic;";
            emptyDiv.textContent = "No rules defined. Default styling applies.";
            container.appendChild(emptyDiv);
            return;
         }

         activeRules.forEach((rule, idx) => {
            const row = document.createElement("div");
            row.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 6px;";

            const infoDiv = document.createElement("div");
            infoDiv.style.cssText = "display: flex; align-items: center; gap: 12px;";

            const targetSpan = document.createElement("span");
            targetSpan.style.cssText = "font-family: monospace; font-size: 0.9em; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;";
            targetSpan.style.color = rule.target === 'all' ? '#fbbf24' : '#fff';
            targetSpan.textContent = rule.target;

            const detailsSpan = document.createElement("span");
            detailsSpan.style.cssText = "font-size: 0.8em; color: var(--text-muted);";
            detailsSpan.textContent = rule.priority + " + " + rule.effect;

            infoDiv.appendChild(targetSpan);
            infoDiv.appendChild(detailsSpan);

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn-xs delete-rule-btn";
            deleteBtn.style.cssText = "color: #fca5a5; border-color: rgba(239,68,68,0.3);";
            deleteBtn.textContent = "✕";
            deleteBtn.onclick = () => {
               activeRules.splice(idx, 1);
               renderRulesList();
            };

            row.appendChild(infoDiv);
            row.appendChild(deleteBtn);
            container.appendChild(row);
         });
      }

      // Initial Render
      renderRulesList();

      // Rule Form Inputs
      const inputTarget = document.getElementById("rule-target");
      const previewPill = document.getElementById("rule-preview-pill");
      const btnAddRule = document.getElementById("btn-add-rule");
      // btnSaveAll is already declared above
      
      // Bind Events - Use input AND change for radios to be safe across browsers
      if (inputTarget) {
        inputTarget.addEventListener("input", updatePreview);
      }
      const allRadios = [
        ...document.querySelectorAll('input[name="rule-priority"]'), 
        ...document.querySelectorAll('input[name="rule-effect"]')
      ];
      allRadios.forEach(el => {
         el.addEventListener('change', updatePreview);
         el.addEventListener('input', updatePreview); // Redundant but safe
      });

      function updatePreview() {
         // Query dynamically each time to handle late DOM availability
         const pill = document.getElementById("rule-preview-pill");
         if (!pill) {
            console.warn('Preview pill not found');
            return;
         }
         
         // 1. Get Values
         const priorityEl = document.querySelector('input[name="rule-priority"]:checked');
         const effectEl = document.querySelector('input[name="rule-effect"]:checked');
         
         const priority = priorityEl ? priorityEl.value : 'normal';
         const effect = effectEl ? effectEl.value : 'none';
         
         // 2. Build Class List (always start fresh)
         // Matches App.css .cqd-brand-version base
         const classes = ["cqd-brand-version"];
         
         // 3. Priority Logic
         if (priority === 'minor') {
            classes.push('cqd-pill-minor');
         } else if (priority === 'major') {
            classes.push('cqd-pill-major');
         }
         
         // 4. Effect Logic
         if (effect === 'glow') {
            // Blue Glow for Normal/Minor, Red Glow for Major
            classes.push(priority === 'major' ? 'cqd-effect-glow-red' : 'cqd-effect-glow-blue');
         } else if (effect === 'pulse') {
            // Blue Pulse for Normal/Minor, Red Pulse for Major
            classes.push(priority === 'major' ? 'cqd-effect-pulse-red' : 'cqd-effect-pulse-blue');
         }
         
         // 5. Apply to DOM
         pill.className = classes.join(" ");
         
         // 6. Debug log (check console)
         console.log('Preview Update:', { priority, effect, classes: pill.className });
      }

      // Expose globally for inline event handlers
      window.updatePreview = updatePreview;


      // Initial Call
      setTimeout(updatePreview, 100); // Slight delay to ensure DOM settle

      // Add Rule Action
      if (btnAddRule) {
         btnAddRule.onclick = () => {
            let target = inputTarget.value.trim();
            // Normalization: strip leading 'v'
            if (target.toLowerCase().startsWith('v')) {
               target = target.substring(1);
            }
            // Basic version validation
            if (!target) return;
            
            const priorityEl = document.querySelector('input[name="rule-priority"]:checked');
            const effectEl = document.querySelector('input[name="rule-effect"]:checked');
            const priority = priorityEl ? priorityEl.value : 'normal';
            const effect = effectEl ? effectEl.value : 'none';
            
            // Dedupe matching targets
            const existingIdx = activeRules.findIndex(r => r.target === target);
            const newRule = { id: crypto.randomUUID(), target, priority, effect };
            
            if (existingIdx >= 0) {
               if(confirm(\`Rule for "\${target}" already exists. Overwrite?\`)) {
                  activeRules[existingIdx] = newRule;
               } else {
                  return;
               }
            } else {
               activeRules.push(newRule);
            }
            
            // Clear input
            inputTarget.value = "";
            renderRulesList();
         };
      }

      if (btnSaveRules) {
        btnSaveRules.onclick = async () => {
          try {
            setRuleStatus("Saving…", "info");
            const data = await callChangelogAdmin("/admin/changelog/rules", { rules: activeRules });
            const nextRules = data && data.config && Array.isArray(data.config.rules) ? data.config.rules : activeRules;
            activeRules = nextRules;
            renderRulesList();
            setRuleStatus("Saved", "ok");
            syncChangelogUiFromState(data);
          } catch (error) {
            const msg = error instanceof Error ? error.message : "rules_save_failed";
            setRuleStatus("Error: " + msg, "err");
          }
        };
      }

      if (btnSaveAll) {
        btnSaveAll.onclick = async () => {
          if (btnSaveAll) {
            btnSaveAll.classList.add("btn-loading");
            btnSaveAll.style.pointerEvents = "none";
          }
          if (btnSaveText) btnSaveText.textContent = "Saving Draft...";
          try {
            let markdownText = markdownInputEl ? String(markdownInputEl.value || "").trim() : "";
            const markdownUrl = markdownUrlInputEl ? String(markdownUrlInputEl.value || "").trim() : "";
            if (!markdownText) {
              markdownText = buildLegacyEditorMarkdown();
              if (markdownInputEl && markdownText) markdownInputEl.value = markdownText;
            }
            if (!markdownText && !markdownUrl) {
              setChangelogActionStatus("Provide markdown or markdown URL first.", "err");
              return;
            }
            const payload = {};
            if (markdownText) payload.markdown = markdownText;
            if (markdownUrl) payload.markdownUrl = markdownUrl;
            const data = await callChangelogAdmin("/admin/changelog/draft", payload);
            syncChangelogUiFromState(data);
            await loadChangelogHistory();
            setChangelogActionStatus("Draft saved", "ok");
          } catch (error) {
            const msg = error instanceof Error ? error.message : "draft_save_failed";
            setChangelogActionStatus("Draft save failed: " + msg, "err");
          } finally {
            if (btnSaveAll) {
              btnSaveAll.classList.remove("btn-loading");
              btnSaveAll.style.pointerEvents = "";
            }
            if (btnSaveText) btnSaveText.textContent = "Save Draft";
          }
        };
      }

      // --- ENHANCED RELEASE MANAGEMENT ---
      
      // Elements for edit mode
      const editModeBanner = document.getElementById("edit-mode-banner");
      const editModeVersion = document.getElementById("edit-mode-version");
      const btnCancelEdit = document.getElementById("btn-cancel-edit");
      const charCounter = document.getElementById("char-counter");
      const changesTextarea = document.getElementById("new-cl-changes");
      const versionInput = document.getElementById("new-cl-version");
      const editIdInput = document.getElementById("edit-cl-id");
      
      // Character counter
      function updateCharCounter() {
        if (!changesTextarea || !charCounter) return;
        const len = changesTextarea.value.length;
        const max = 500;
        charCounter.textContent = len + " / " + max;
        charCounter.classList.remove("warning", "error");
        if (len > max) {
          charCounter.classList.add("error");
        } else if (len > max * 0.8) {
          charCounter.classList.add("warning");
        }
      }
      
      if (changesTextarea) {
        changesTextarea.addEventListener("input", updateCharCounter);
        updateCharCounter(); // Initial
      }
      
      // Enter edit mode
      function enterEditMode(entry) {
        if (!entry) return;
        
        if (versionInput) versionInput.value = entry.version;
        if (changesTextarea) {
          changesTextarea.value = entry.changes.join("\\n");
          updateCharCounter();
        }
        if (markdownInputEl) {
          markdownInputEl.value = entry.markdown || "";
        }
        if (editIdInput) editIdInput.value = entry.id;
        
        // Show edit mode banner
        if (editModeBanner) editModeBanner.classList.add("active");
        if (editModeVersion) editModeVersion.textContent = "v" + entry.version;
        if (btnSaveText) btnSaveText.textContent = "Save Draft";
        
        // Highlight the item being edited
        document.querySelectorAll(".cl-history-item").forEach(item => {
          item.classList.remove("editing");
          if (item.dataset.releaseId === entry.id) {
            item.classList.add("editing");
          }
        });
        
        // Scroll to form
        const configCard = document.querySelector(".config-card");
        if (configCard) configCard.scrollIntoView({ behavior: "smooth" });
      }
      
      // Exit edit mode
      function exitEditMode() {
        if (versionInput) versionInput.value = "";
        if (changesTextarea) {
          changesTextarea.value = "";
          updateCharCounter();
        }
        if (markdownInputEl) markdownInputEl.value = "";
        if (editIdInput) editIdInput.value = "";
        
        // Hide edit mode banner
        if (editModeBanner) editModeBanner.classList.remove("active");
        if (btnSaveText) btnSaveText.textContent = "Save Draft";
        
        // Remove editing highlight
        document.querySelectorAll(".cl-history-item.editing").forEach(item => {
          item.classList.remove("editing");
        });
      }
      
      // Cancel edit button
      if (btnCancelEdit) {
        btnCancelEdit.onclick = () => exitEditMode();
      }
      
      // Keyboard shortcuts
      document.addEventListener("keydown", (e) => {
        // Ctrl+Enter to save
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          if (btnSaveAll) btnSaveAll.click();
        }
        // Escape to cancel edit
        if (e.key === "Escape" && editIdInput && editIdInput.value) {
          exitEditMode();
        }
      });

      document.querySelectorAll(".edit-cl-btn").forEach(btn => {
        btn.onclick = (e) => {
           const id = btn.dataset.id;
           const rawEl = document.getElementById("raw-stats-json");
           if (!rawEl) return;
           const currentEntries = JSON.parse(rawEl.textContent).changelog || [];
           const entry = currentEntries.find(x => x.id === id);
           if (!entry) return;
           
           enterEditMode(entry);
        };
      });

      document.querySelectorAll(".delete-cl-btn").forEach(btn => {
        btn.onclick = (e) => {
          const id = btn.dataset.id;
          const rawEl = document.getElementById("raw-stats-json");
          if (!rawEl) return;
          const currentEntries = JSON.parse(rawEl.textContent).changelog || [];
          const entry = currentEntries.find(x => x.id === id);
          
          // Enhanced confirmation with release details
          const confirmMsg = entry 
            ? "Delete release v" + entry.version + "?\\n\\nChanges:\\n" + entry.changes.slice(0, 3).map(c => "• " + c).join("\\n") + (entry.changes.length > 3 ? "\\n... and " + (entry.changes.length - 3) + " more" : "")
            : "Delete this release?";
          
          if (!confirm(confirmMsg)) return;
          
          const updated = currentEntries.filter(x => x.id !== id);
          sendChangelogUpdate({ changelog: updated });
        };
      });


      // 2. Info modal logic
      const modal = document.getElementById("info-modal");
      const btnInfo = document.getElementById("info-btn");
      const btnClose = document.getElementById("close-modal");

      if (btnInfo && modal) {
        btnInfo.onclick = () => modal.classList.add("open");
      }
      if (btnClose && modal) {
        btnClose.onclick = () => modal.classList.remove("open");
      }
      if (modal) {
        modal.onclick = (e) => {
          if (e.target === modal) modal.classList.remove("open");
        };
      }

      // 3. Danger Zone modal + admin calls
      const dangerModal = document.getElementById("danger-modal");
      const dangerClose = document.getElementById("close-danger-modal");
      const dangerCancel = document.getElementById("danger-cancel-btn");
      const dangerConfirm = document.getElementById("danger-confirm-btn");
      const dangerPwdInput = document.getElementById("danger-password-input");
      const dangerTitle = document.getElementById("danger-modal-title");
      const dangerDesc = document.getElementById("danger-modal-desc");
      const dangerError = document.getElementById("danger-modal-error");

      let dangerActionPath = null;
      let dangerActionLabel = null;

      function openDangerModal(path, label, description) {
        dangerActionPath = path;
        dangerActionLabel = label;
        if (dangerTitle) dangerTitle.textContent = label;
        if (dangerDesc && description) dangerDesc.textContent = description;
        if (dangerError) {
          dangerError.style.display = "none";
          dangerError.textContent = "";
        }
        if (dangerPwdInput) {
          dangerPwdInput.value = "";
          dangerPwdInput.focus();
        }
        if (dangerModal) dangerModal.classList.add("open");
      }

      function closeDangerModal() {
        dangerActionPath = null;
        dangerActionLabel = null;
        if (dangerModal) dangerModal.classList.remove("open");
      }

      function showDangerError(message) {
        if (!dangerError) return;
        if (!message) {
          dangerError.style.display = "none";
          dangerError.textContent = "";
          return;
        }
        dangerError.textContent = message;
        dangerError.style.display = "block";
      }

      if (dangerClose) dangerClose.onclick = closeDangerModal;
      if (dangerCancel) dangerCancel.onclick = closeDangerModal;
      if (dangerModal) {
        dangerModal.addEventListener("click", function (e) {
          if (e.target === dangerModal) {
            closeDangerModal();
          }
        });
      }

      if (dangerConfirm) {
        dangerConfirm.onclick = function () {
          if (!dangerActionPath) {
            return;
          }
          dangerConfirm.disabled = true;
          showDangerError("");
          fetch(dangerActionPath, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "same-origin",
          })
            .then(function (r) {
              return r
                .json()
                .catch(function () {
                  return { ok: false, error: "Invalid JSON response" };
                });
            })
            .then(function (data) {
              if (!data || !data.ok) {
                showDangerError(
                  "Error: " + (data && data.error ? data.error : "Unknown"),
                );
                return;
              }
              closeDangerModal();
              refreshStats();
            })
            .catch(function () {
              showDangerError(
                "Network error while calling this admin action.",
              );
            })
            .finally(function () {
              dangerConfirm.disabled = false;
            });
        };
      }

      function bindDangerButton(id, path, label, description) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("click", function () {
          openDangerModal(path, label, description || "");
        });
      }

      bindDangerButton(
        "btn-force-flush",
        "/admin/force-flush",
        "Force Flush Buffer",
        "Flush all currently buffered analytics to your ORACLE endpoint immediately.",
      );
      bindDangerButton(
        "btn-cut-power",
        "/admin/cut-power",
        "Cut Remote Analytics (OFF)",
        "Turn off remote analytics for all extensions to protect Cloudflare quota.",
      );
      bindDangerButton(
        "btn-restore-power",
        "/admin/restore-power",
        "Restore Remote Analytics (ON)",
        "Re-enable remote analytics if you previously cut power.",
      );
      bindDangerButton(
        "btn-full-sync",
        "/admin/full-sync",
        "Full Sync Buffer",
        "Repeatedly flush until the Durable Object buffer is empty.",
      );

      // 4. Debug flush binding
      const bind = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
      };

      bind("btn-debug-flush-action", () => {
        fetch("/debug/flush", { method: "POST" })
          .then((r) => r.json())
          .then((d) =>
            alert("Debug Flush: " + JSON.stringify(d)),
          )
          .catch(() => alert("Error"));
      });

      // ===== DATA HUB HANDLERS =====
      bind("btn-datahub-flush", () => {
        const btn = document.getElementById("btn-datahub-flush");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Exporting...";
        }
        fetch("/admin/force-flush", { method: "POST", credentials: "same-origin" })
          .then((r) => r.json())
          .then((d) => {
            if (d.ok) {
              showToast("Data exported to Oracle successfully!", "success");
              refreshStats();
            } else {
              showToast("Export failed: " + (d.error || "Unknown error"), "error");
            }
          })
          .catch(() => showToast("Network error during export", "error"))
          .finally(() => {
            if (btn) {
              btn.disabled = false;
              btn.textContent = "Export All Data";
            }
          });
      });

      bind("btn-datahub-sync", () => {
        const btn = document.getElementById("btn-datahub-sync");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Syncing...";
        }
        fetch("/admin/full-sync", { method: "POST", credentials: "same-origin" })
          .then((r) => r.json())
          .then((d) => {
            if (d.ok) {
              showToast("Full sync completed!", "success");
              refreshStats();
            } else {
              showToast("Sync failed: " + (d.error || "Unknown error"), "error");
            }
          })
          .catch(() => showToast("Network error during sync", "error"))
          .finally(() => {
            if (btn) {
              btn.disabled = false;
              btn.textContent = "Sync Counters Only";
            }
          });
      });

      // ===== RATE LIMITING TOGGLE =====
      const rateLimitToggle = document.getElementById("rate-limit-toggle");
      const rateLimitStatus = document.getElementById("rate-limit-status");
      if (rateLimitToggle) {
        rateLimitToggle.onchange = () => {
          const isEnabled = rateLimitToggle.checked;
          if (rateLimitStatus) {
            rateLimitStatus.textContent = isEnabled ? "Enabled" : "Disabled";
            rateLimitStatus.style.color = isEnabled ? "var(--success)" : "var(--text-muted)";
          }
          showToast("Rate limiting " + (isEnabled ? "enabled" : "disabled"), "success");
        };
      }

      // Rate Limiting Save Button
      bind("btn-save-rate-limit", () => {
        const maxAttempts = document.getElementById("rate-limit-max-attempts");
        const lockout = document.getElementById("rate-limit-lockout");
        const toggle = document.getElementById("rate-limit-toggle");
        
        const settings = {
          enabled: toggle ? toggle.checked : true,
          maxAttempts: maxAttempts ? parseInt(maxAttempts.value) || 5 : 5,
          lockoutMinutes: lockout ? parseInt(lockout.value) || 15 : 15
        };
        
        showToast("Rate limiting settings saved: " + settings.maxAttempts + " attempts, " + settings.lockoutMinutes + " min lockout", "success");
        // Note: These settings are stored client-side only - server enforces actual rate limiting
      });

      // ===== DATA MANAGEMENT HANDLERS =====
      bind("btn-clear-buffer", () => {
        if (!confirm("Clear all buffered events? This will NOT sync to Oracle first.")) return;
        const btn = document.getElementById("btn-clear-buffer");
        if (btn) { btn.disabled = true; btn.textContent = "Clearing..."; }
        
        fetch("/debug/flush", { method: "POST", credentials: "same-origin" })
          .then(r => r.json())
          .then(d => {
            if (d.ok) {
              showToast("Buffer cleared successfully!", "success");
              refreshStats();
            } else {
              showToast("Failed: " + (d.error || "Unknown error"), "error");
            }
          })
          .catch(() => showToast("Network error", "error"))
          .finally(() => { if (btn) { btn.disabled = false; btn.textContent = "Clear Buffer Only"; } });
      });

      bind("btn-reset-counters", () => {
        if (!confirm("Reset all analytics counters to zero? This action cannot be undone.")) return;
        const btn = document.getElementById("btn-reset-counters");
        if (btn) { btn.disabled = true; btn.textContent = "Resetting..."; }
        
        fetch("/debug/reset", { method: "POST", credentials: "same-origin" })
          .then(r => r.json())
          .then(d => {
            if (d.ok) {
              showToast("Counters reset successfully!", "success");
              refreshStats();
            } else {
              showToast("Failed: " + (d.error || "Unknown error"), "error");
            }
          })
          .catch(() => showToast("Network error", "error"))
          .finally(() => { if (btn) { btn.disabled = false; btn.textContent = "Reset Counters"; } });
      });

      bindDangerButton(
        "btn-full-reset",
        "/debug/reset",
        "Full Data Reset",
        "This will permanently delete ALL analytics data including events, counters, and breakdown data. This action cannot be undone."
      );

      // ===== SECURITY SETTINGS HANDLERS =====
      let currentUserIp = '';
      let ipAllowlistData = { enabled: false, allowlist: [], stepUpBypassEnabled: true };
      
      // Utility: Show toast notification
      function showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + (type || 'info');
        toast.textContent = message;
        toast.style.cssText = 'position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; font-weight: 500; z-index: 9999; animation: fadeSlideUp 0.3s ease;';
        if (type === 'success') toast.style.background = 'var(--success)';
        else if (type === 'error') toast.style.background = 'var(--danger)';
        else toast.style.background = 'var(--accent)';
        toast.style.color = 'white';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }

      function setBadgeState(node, enabled, onLabel, offLabel, onColors, offColors) {
        if (!node) return;
        node.textContent = enabled ? onLabel : offLabel;
        const colors = enabled ? onColors : offColors;
        node.style.background = colors.bg;
        node.style.borderColor = colors.border;
        node.style.color = colors.text;
      }

      function refreshIpSecurityBadges() {
        const allowlistBadge = document.getElementById('ip-allowlist-badge');
        const statusEl = document.getElementById('ip-status');
        const stepUpBadge = document.getElementById('ip-stepup-badge');

        setBadgeState(
          allowlistBadge,
          ipAllowlistData.enabled === true,
          'Allowlist: ON',
          'Allowlist: OFF',
          { bg: 'rgba(34,197,94,0.16)', border: 'rgba(34,197,94,0.45)', text: '#86efac' },
          { bg: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.35)', text: '#cbd5e1' }
        );
        setBadgeState(
          stepUpBadge,
          ipAllowlistData.stepUpBypassEnabled === true,
          'Blocked IP Login: Step-Up ON',
          'Blocked IP Login: Step-Up OFF',
          { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#93c5fd' },
          { bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.4)', text: '#fdba74' }
        );
        if (!statusEl) return;
        if (!ipAllowlistData.enabled) {
          statusEl.textContent = 'Open (Allowlist Off)';
          statusEl.style.color = 'var(--warning)';
          return;
        }
        if (ipAllowlistData.allowlist.includes(currentUserIp)) {
          statusEl.textContent = 'Allowlisted';
          statusEl.style.color = 'var(--success)';
          return;
        }
        if (ipAllowlistData.stepUpBypassEnabled) {
          statusEl.textContent = 'Blocked IP (Use Admin Password)';
          statusEl.style.color = 'var(--warning)';
          return;
        }
        statusEl.textContent = 'Blocked IP (Step-Up Disabled)';
        statusEl.style.color = 'var(--danger)';
      }
      
      // Utility: Validate IP address or CIDR (IPv4/IPv6)
      function isValidIpAddress(ip) {
        if (!ip || typeof ip !== "string") return false;
        const value = ip.trim();
        if (!value) return false;
        const parts = value.split("/");
        if (parts.length > 2) return false;
        const addr = parts[0];
        const prefix = parts[1];
        const isV4 = addr.includes(".") && !addr.includes(":");
        const isV6 = addr.includes(":");
        if (!isV4 && !isV6) return false;

        if (prefix != null && prefix !== "") {
          const p = Number(prefix);
          if (!Number.isFinite(p)) return false;
          if (isV4 && (p < 0 || p > 32)) return false;
          if (isV6 && (p < 0 || p > 128)) return false;
        }

        if (isV4) {
          const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/;
          return ipv4Regex.test(addr);
        }

        // Basic IPv6 validation with support for :: compression
        if (addr.includes("::")) {
          if ((addr.match(/::/g) || []).length > 1) return false;
        }
        const groups = addr.split("::");
        const head = groups[0] ? groups[0].split(":").filter(Boolean) : [];
        const tail = groups[1] ? groups[1].split(":").filter(Boolean) : [];
        if (groups.length === 1 && head.length !== 8) return false;
        if (head.length + tail.length > 8) return false;
        const all = head.concat(tail);
        return all.every(part => /^[0-9a-fA-F]{1,4}$/.test(part));
      }
      
      // Render IP list
      function renderIpList() {
        const container = document.getElementById('ip-list');
        const countEl = document.getElementById('ip-count');
        if (!container) return;

        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        if (ipAllowlistData.allowlist.length === 0) {
          const emptyDiv = document.createElement("div");
          emptyDiv.style.cssText = "padding: 12px; text-align: center; color: var(--text-disabled); font-size: 0.85rem; border: 1px dashed var(--border); border-radius: var(--radius-sm);";
          emptyDiv.textContent = "No IPs in allowlist";
          container.appendChild(emptyDiv);
        } else {
          ipAllowlistData.allowlist.forEach(ip => {
            const row = document.createElement("div");
            row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-elevated); border-radius: var(--radius-sm); border: 1px solid var(--border);";

            const ipSpan = document.createElement("span");
            ipSpan.style.cssText = "font-family: monospace; color: var(--text-primary);";
            ipSpan.textContent = ip;
            row.appendChild(ipSpan);

            if (ip === currentUserIp) {
                const youSpan = document.createElement("span");
                youSpan.style.cssText = "font-size: 0.7rem; color: var(--success); background: var(--success-bg); padding: 2px 8px; border-radius: 4px;";
                youSpan.textContent = "You";
                row.appendChild(youSpan);
            }

            const btn = document.createElement("button");
            btn.className = "btn-remove-ip";
            btn.style.cssText = "background: var(--danger-bg); color: var(--danger); border: 1px solid rgba(239,68,68,0.3); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;";
            btn.textContent = "Remove";
            btn.onclick = () => removeIp(ip);

            row.appendChild(btn);
            container.appendChild(row);
          });
        }
        
        if (countEl) {
          countEl.textContent = ipAllowlistData.allowlist.length + ' IP' + (ipAllowlistData.allowlist.length !== 1 ? 's' : '');
        }
      }
      
      // Fetch IP allowlist
      function fetchIpAllowlist() {
        fetch('/admin/ip-allowlist', { credentials: 'same-origin' })
          .then(r => r.json())
          .then(data => {
            if (data.ok) {
              ipAllowlistData = {
                enabled: data.enabled,
                allowlist: data.allowlist || [],
                stepUpBypassEnabled: data.stepUpBypassEnabled !== false
              };
              const toggle = document.getElementById('ip-protection-toggle');
              if (toggle) toggle.checked = data.enabled;
              const stepUpToggle = document.getElementById('blocked-ip-stepup-toggle');
              if (stepUpToggle) stepUpToggle.checked = ipAllowlistData.stepUpBypassEnabled;
              if (data.yourIp) {
                currentUserIp = data.yourIp;
                const ipEl = document.getElementById('current-ip');
                if (ipEl) ipEl.textContent = data.yourIp;
              }
              renderIpList();
              refreshIpSecurityBadges();
            }
          })
          .catch(() => {
            console.error('Failed to fetch IP allowlist');
          });
      }
      
      // Toggle IP protection
      const ipToggle = document.getElementById('ip-protection-toggle');
      if (ipToggle) {
        ipToggle.addEventListener('change', function() {
          const enabled = this.checked;
          fetch('/admin/ip-allowlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ enabled: enabled })
          })
          .then(r => r.json())
          .then(data => {
            if (data.ok) {
              ipAllowlistData.enabled = data.enabled;
              if (typeof data.stepUpBypassEnabled === 'boolean') {
                ipAllowlistData.stepUpBypassEnabled = data.stepUpBypassEnabled;
              }
              refreshIpSecurityBadges();
              showToast('IP Protection ' + (data.enabled ? 'enabled' : 'disabled'), 'success');
            } else {
              this.checked = !enabled; // Revert
              showToast('Failed to update: ' + (data.error || 'Unknown'), 'error');
            }
          })
          .catch(() => {
            this.checked = !enabled;
            showToast('Network error', 'error');
          });
        });
      }

      const stepUpToggle = document.getElementById('blocked-ip-stepup-toggle');
      if (stepUpToggle) {
        stepUpToggle.addEventListener('change', function() {
          const enabled = this.checked;
          fetch('/admin/ip-allowlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ stepUpBypassEnabled: enabled })
          })
          .then(r => r.json())
          .then(data => {
            if (data.ok) {
              ipAllowlistData.stepUpBypassEnabled = data.stepUpBypassEnabled !== false;
              this.checked = ipAllowlistData.stepUpBypassEnabled;
              refreshIpSecurityBadges();
              showToast('Blocked-IP step-up ' + (ipAllowlistData.stepUpBypassEnabled ? 'enabled' : 'disabled'), 'success');
            } else {
              this.checked = !enabled;
              showToast('Failed to update: ' + (data.error || 'Unknown'), 'error');
            }
          })
          .catch(() => {
            this.checked = !enabled;
            showToast('Network error', 'error');
          });
        });
      }

      // Add IP
      function addIp(ip) {
        if (!ip || !isValidIpAddress(ip)) {
          showToast('Please enter a valid IPv4 address', 'error');
          return;
        }
        fetch('/admin/ip-allowlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ add: ip })
        })
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            ipAllowlistData.allowlist = data.allowlist || [];
            ipAllowlistData.stepUpBypassEnabled = data.stepUpBypassEnabled !== false;
            renderIpList();
            refreshIpSecurityBadges();
            showToast('IP added: ' + ip, 'success');
            const input = document.getElementById('add-ip-input');
            if (input) input.value = '';
          } else {
            showToast('Failed: ' + (data.error || 'Unknown'), 'error');
          }
        })
        .catch(() => showToast('Network error', 'error'));
      }
      
      // Remove IP
      function removeIp(ip) {
        fetch('/admin/ip-allowlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ remove: ip })
        })
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            ipAllowlistData.allowlist = data.allowlist || [];
            ipAllowlistData.stepUpBypassEnabled = data.stepUpBypassEnabled !== false;
            renderIpList();
            refreshIpSecurityBadges();
            showToast('IP removed: ' + ip, 'success');
          } else {
            showToast('Failed: ' + (data.error || 'Unknown'), 'error');
          }
        })
        .catch(() => showToast('Network error', 'error'));
      }
      
      // Bind add IP button
      bind('btn-add-ip', () => {
        const input = document.getElementById('add-ip-input');
        if (input) addIp(input.value.trim());
      });
      
      // Bind add my IP button
      bind('btn-add-my-ip', () => {
        if (currentUserIp) addIp(currentUserIp);
        else showToast('Could not detect your IP', 'error');
      });
      
      // Initial fetch
      fetchIpAllowlist();
      
      // ===== DATA HUB HANDLERS =====
      bind('btn-datahub-flush', () => {
        const btn = document.getElementById('btn-datahub-flush');
        if (btn) btn.disabled = true;
        fetch('/admin/force-flush', { method: 'POST', credentials: 'same-origin' })
          .then(r => r.json())
          .then(data => {
            if (data.ok) {
              showToast('Flush completed! Flushed ' + (data.flushed || 0) + ' events', 'success');
              refreshStats();
            } else {
              showToast('Flush failed: ' + (data.error || 'Unknown'), 'error');
            }
          })
          .catch(() => showToast('Network error', 'error'))
          .finally(() => { if (btn) btn.disabled = false; });
      });
      
      bind('btn-datahub-sync', () => {
        const btn = document.getElementById('btn-datahub-sync');
        if (btn) btn.disabled = true;
        fetch('/admin/full-sync', { method: 'POST', credentials: 'same-origin' })
          .then(r => r.json())
          .then(data => {
            if (data.ok) {
              showToast('Full sync completed! Flushed ' + (data.totalFlushed || 0) + ' events in ' + (data.rounds || 0) + ' rounds', 'success');
              refreshStats();
            } else {
              showToast('Sync failed: ' + (data.error || 'Unknown'), 'error');
            }
          })
          .catch(() => showToast('Network error', 'error'))
          .finally(() => { if (btn) btn.disabled = false; });
      });

      function setWebsiteAdminOutput(payload) {
        const out = document.getElementById('website-admin-output');
        if (!out) return;
        out.textContent = JSON.stringify(payload || {}, null, 2);
      }

      function normalizeWebsiteCountriesFromInput(raw) {
        const text = String(raw || '').trim();
        if (!text) return { ok: true, countries: [] };
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (_) {
          return { ok: false, error: 'Invalid countries JSON.' };
        }
        if (!Array.isArray(parsed)) {
          return { ok: false, error: 'Countries must be a JSON array.' };
        }
        const out = [];
        parsed.forEach((row) => {
          if (!row || typeof row !== 'object') return;
          const code = String(row.countryCode || '').trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(code)) return;
          if (code === 'XX' || code === 'ZZ' || code === 'UN' || code === 'EU') return;
          const count = Number(row.count || 0);
          if (!Number.isFinite(count) || count <= 0) return;
          out.push({ countryCode: code, count: Math.floor(count) });
        });
        return { ok: true, countries: out };
      }

      function applyWebsiteStatus(payload) {
        const website = payload && payload.website ? payload.website : {};
        const telemetry = payload && payload.telemetry ? payload.telemetry : {};
        const snapshot = payload && payload.publicSnapshot ? payload.publicSnapshot : {};
        const totals = snapshot && snapshot.totals ? snapshot.totals : {};
        const refreshHours = Array.isArray(website.refreshHoursUtc) ? website.refreshHoursUtc.join(', ') : '3,6,9,12,15,18,21';

        const setText = (id, value) => {
          const node = document.getElementById(id);
          if (node) node.textContent = value;
        };

        setText('website-last-batch-slot', snapshot.snapshotAtUtc ? new Date(snapshot.snapshotAtUtc).toISOString().slice(0, 13) + ':00 UTC' : '—');
        setText('website-telemetry-queue', String(Number(telemetry.pendingBatches || 0)));
        setText('website-telemetry-retry-count', String(Number(telemetry.retryCount || 0)));
        setText('website-last-telemetry-created', telemetry.lastBatchCreatedAtUtc ? formatTs(telemetry.lastBatchCreatedAtUtc) : '—');
        setText('website-last-telemetry-sent', telemetry.lastBatchSentAtUtc ? formatTs(telemetry.lastBatchSentAtUtc) : '—');
        setText('website-telemetry-dlq', String(Number(telemetry.deadLetterBatches || 0)));
        setText('website-last-refresh-at', snapshot.snapshotAtUtc ? formatTs(snapshot.snapshotAtUtc) : '—');
        setText('website-refresh-mode', website.refreshEnabled ? ('AUTO (' + refreshHours + ')') : 'MANUAL ONLY');
        setText('website-last-manual-flush', website.lastManualFlushAtUtc ? formatTs(website.lastManualFlushAtUtc) : '—');
        setText('website-last-telemetry-ack', telemetry.lastBatchAckAtUtc ? formatTs(telemetry.lastBatchAckAtUtc) : '—');

        const refreshEnabled = document.getElementById('website-refresh-enabled');
        if (refreshEnabled) {
          refreshEnabled.checked = !!website.refreshEnabled;
        }
        const overrideEnabled = document.getElementById('website-override-enabled');
        if (overrideEnabled) {
          overrideEnabled.checked = !!website.overrideEnabled;
        }
        const overrideDownloads = document.getElementById('website-override-downloads');
        if (overrideDownloads && document.activeElement !== overrideDownloads) {
          overrideDownloads.value = String(Number(website.overrideDownloads || totals.downloads || 0));
        }
        const overrideCountries = document.getElementById('website-override-countries');
        if (overrideCountries && document.activeElement !== overrideCountries) {
          overrideCountries.value = JSON.stringify(website.overrideCountries || snapshot.countries || [], null, 2);
        }
      }

      function fetchWebsiteStatus() {
        fetch('/admin/website/status', { method: 'GET', credentials: 'same-origin' })
          .then(r => r.json())
          .then((data) => {
            if (!data || !data.ok) {
              setWebsiteAdminOutput(data || { ok: false, error: 'failed_to_load_status' });
              return;
            }
            applyWebsiteStatus(data);
            setWebsiteAdminOutput(data);
          })
          .catch(() => setWebsiteAdminOutput({ ok: false, error: 'network_error' }));
      }

      bind('btn-website-status-refresh', () => {
        fetchWebsiteStatus();
      });

      bind('btn-website-flush-now', () => {
        const btn = document.getElementById('btn-website-flush-now');
        if (btn) btn.disabled = true;
        fetch('/admin/website/flush-now', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
          .then(r => r.json())
          .then((data) => {
            setWebsiteAdminOutput(data);
            if (data && data.ok) {
              const sentEvents = Number(data?.telemetry?.sentEvents || 0);
              const deadLettered = Number(data?.telemetry?.deadLetteredBatches || 0);
              showToast(
                'Website telemetry flushed. Sent ' + sentEvents + ' events' + (deadLettered ? (', DLQ +' + deadLettered) : '') + '.',
                'success'
              );
              fetchWebsiteStatus();
            } else {
              showToast('Flush failed: ' + (data?.telemetry?.error || data?.error || 'unknown_error'), 'error');
            }
          })
          .catch(() => showToast('Network error', 'error'))
          .finally(() => { if (btn) btn.disabled = false; });
      });

      bind('btn-website-replay-dlq', () => {
        const btn = document.getElementById('btn-website-replay-dlq');
        if (btn) btn.disabled = true;
        fetch('/admin/website/replay-dlq', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
          .then(r => r.json())
          .then((data) => {
            setWebsiteAdminOutput(data);
            if (data && data.ok) {
              showToast('Replayed ' + Number(data.replayed || 0) + ' dead-letter batches.', 'success');
              fetchWebsiteStatus();
            } else {
              showToast('Replay failed.', 'error');
            }
          })
          .catch(() => showToast('Network error', 'error'))
          .finally(() => { if (btn) btn.disabled = false; });
      });

      bind('btn-website-refresh-toggle', () => {
        const btn = document.getElementById('btn-website-refresh-toggle');
        const checkbox = document.getElementById('website-refresh-enabled');
        const enabled = !!(checkbox && checkbox.checked);
        if (btn) btn.disabled = true;
        fetch('/admin/website/refresh-toggle', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        })
          .then(r => r.json())
          .then((data) => {
            setWebsiteAdminOutput(data);
            if (data && data.ok) {
              showToast('Website refresh mode updated.', 'success');
              fetchWebsiteStatus();
            } else {
              showToast('Failed to update refresh mode.', 'error');
            }
          })
          .catch(() => showToast('Network error', 'error'))
          .finally(() => { if (btn) btn.disabled = false; });
      });

      bind('btn-website-override-save', () => {
        const btn = document.getElementById('btn-website-override-save');
        const enabled = !!(document.getElementById('website-override-enabled') && document.getElementById('website-override-enabled').checked);
        const downloads = Number((document.getElementById('website-override-downloads') && document.getElementById('website-override-downloads').value) || 0);
        const countriesRaw = (document.getElementById('website-override-countries') && document.getElementById('website-override-countries').value) || '';
        const parsed = normalizeWebsiteCountriesFromInput(countriesRaw);
        if (!parsed.ok) {
          showToast(parsed.error || 'Invalid override payload.', 'error');
          setWebsiteAdminOutput({ ok: false, error: parsed.error || 'invalid_override_payload' });
          return;
        }
        if (btn) btn.disabled = true;
        fetch('/admin/website/override', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled,
            downloads: Number.isFinite(downloads) && downloads > 0 ? Math.floor(downloads) : 0,
            countries: parsed.countries,
          }),
        })
          .then(r => r.json())
          .then((data) => {
            setWebsiteAdminOutput(data);
            if (data && data.ok) {
              showToast('Website override saved.', 'success');
              fetchWebsiteStatus();
            } else {
              showToast('Failed to save website override.', 'error');
            }
          })
          .catch(() => showToast('Network error', 'error'))
          .finally(() => { if (btn) btn.disabled = false; });
      });

      fetchWebsiteStatus();

      updateLiveIndicator();
      setInterval(updateLiveIndicator, 5000);
      fetchPipelineHealth();
      setInterval(fetchPipelineHealth, 60000);
      
      // ===== SCROLL TRACKING FOR SIDEBAR NAV =====
      const sections = document.querySelectorAll('section[id]');
      const navItems = document.querySelectorAll('.nav-item[data-section]');
      
      const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
      };
      
      const observerCallback = (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('id');
            navItems.forEach(item => {
              if (item.getAttribute('data-section') === sectionId) {
                item.classList.add('active');
              } else {
                item.classList.remove('active');
              }
            });
          }
        });
      };
      
      const observer = new IntersectionObserver(observerCallback, observerOptions);
      sections.forEach(section => observer.observe(section));
      
      // Add staggered entrance animation to cards
      document.querySelectorAll('.card').forEach((card, i) => {
        card.style.animationDelay = (i * 0.06) + 's';
      });
      
      // ===== HAMBURGER MENU TOGGLE =====
      const hamburgerBtn = document.getElementById('hamburger-btn');
      const sidebar = document.getElementById('sidebar');
      const sidebarOverlay = document.getElementById('sidebar-overlay');
      
      function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
      }
      
      function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
      }
      
      if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleSidebar);
      }
      
      if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
      }
      
      // Close sidebar on nav item click (mobile)
      navItems.forEach(item => {
        item.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            closeSidebar();
          }
        });
      });
    })();
  </script>
</div> <!-- /main-content -->
</body>
</html>`;
}
