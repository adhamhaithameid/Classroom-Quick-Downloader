// filepath: cloudflare-worker/src/dashboard/main.ts
import type { StatsResponse, QuotaDescriptor, ChangelogEntry, ChangelogConfig } from "../types";
import { FAVICON_PNG_DATA_URI } from "../assets";

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidIp(ip: string): boolean {
  // Simple IPv4 validation
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

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
    label: "fuck",
    className: "flag-fuck",
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
    <p class="login-subtitle">Unlock analytics dashboard & danger controls.</p>
    
    <div class="login-row">
      <div class="field">
        <input id="password-input" name="password" type="password" placeholder="Password..." autofocus required />
      </div>
      <button class="login-button" type="submit">Unlock →</button>
    </div>
    ${errorMessage ? `<div class="login-error">${errorMessage}</div>` : ""}
  <script>document.getElementById("password-input")?.focus();</script>
</body>
</html>`;
}

// Notification Rules Engine UI
function renderNotificationSection(entries: ChangelogEntry[], config: ChangelogConfig): string {
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const knownVersions = Array.from(new Set(sorted.map(e => e.version)));
  const dataListOptions = [
    '<option value="all">Global (All Versions)</option>',
    ...knownVersions.map(v => `<option value="${v}">v${v}</option>`)
  ].join('');

  const rulesJson = JSON.stringify(config.rules || []);

  return `
    <section class="card config-card" id="config">
      <h2>
        <span>🔔</span> Notification Styling
        <span class="unsaved-dot" id="unsaved-indicator" title="Unsaved changes"></span>
      </h2>
      
      <script>window.CURRENT_RULES = ${rulesJson};</script>
      
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div style="font-size: 0.85em; color: var(--text-soft); margin-bottom: 12px;">
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
        
        <div>
          <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
             <span style="font-size: 0.85em; color: var(--text-soft);">Active Rules <span style="font-size: 0.8em; opacity: 0.7;">(specific versions override 'all')</span></span>
             <span id="rules-count" style="font-size: 0.8em; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">0 rules</span>
          </div>
          <div id="rules-list-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; padding-right: 4px;">
             <!-- Renders via JS -->
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderReleaseManagementSection(entries: ChangelogEntry[], config: ChangelogConfig): string {
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Versions for DataList
  const knownVersions = Array.from(new Set(sorted.map(e => e.version)));
  const dataListOptions = [
    '<option value="all">Global (All Versions)</option>',
    ...knownVersions.map(v => `<option value="${v}">v${v}</option>`)
  ].join('');

  const releaseCount = sorted.length;
  const historyHtml = sorted.map(e => `
    <div class="cl-history-item" data-release-id="${e.id}">
      <div class="cl-history-header">
        <div class="cl-history-meta">
          <span class="cl-version-badge">v${e.version}</span>
          <span class="cl-date">${new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <div class="cl-actions">
           <button class="cl-action-btn edit-cl-btn" data-id="${e.id}" title="Edit release">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
           </button>
           <button class="cl-action-btn delete-cl-btn" data-id="${e.id}" title="Delete release">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
           </button>
        </div>
      </div>
      <ul class="cl-changes-list">
        ${e.changes.map(c => `<li>${c}</li>`).join('')}
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

       <!-- Edit Mode Banner -->
       <div id="edit-mode-banner" class="edit-mode-banner">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
         <span class="edit-mode-text">Editing <strong id="edit-mode-version">v1.0.0</strong></span>
         <button id="btn-cancel-edit" class="btn-cancel-edit">Cancel</button>
       </div>

       <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border: 1px solid var(--border-subtle); margin-bottom: 20px;">
          <input type="hidden" id="edit-cl-id" value="">
          
          <div style="margin-bottom: 14px;">
             <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 6px;">Version</label>
             <input list="known-versions-release" id="new-cl-version" placeholder="e.g. 1.2.4" class="input-field" style="width: 100%; padding: 10px 12px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: white; border-radius: 8px; font-size: 0.95em;">
             <datalist id="known-versions-release">
               ${dataListOptions}
             </datalist>
          </div>

          <div style="margin-bottom: 6px;">
             <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 6px;">Changes (one per line)</label>
             <div class="textarea-wrapper">
               <textarea id="new-cl-changes" rows="5" class="input-field" placeholder="- Added new feature X&#10;- Fixed bug with Y&#10;- Improved performance" style="width: 100%; padding: 10px 12px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: white; border-radius: 8px; font-size: 0.9em; line-height: 1.5; resize: vertical;"></textarea>
               <span id="char-counter" class="char-counter">0 / 500</span>
             </div>
          </div>
       </div>
       
       <div style="margin-bottom: 24px;">
         <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
           <span style="font-size: 0.85em; color: var(--text-soft);">Historical Releases</span>
           <span style="font-size: 0.75em; color: var(--text-muted);">${releaseCount} releases</span>
         </div>
         <div class="cl-history-list" style="overflow-y: auto; max-height: 400px; padding-right: 8px;">
           ${historyHtml}
         </div>
       </div>

       <div style="display: flex; gap: 12px; flex-wrap: wrap;">
         <button id="btn-save-all" class="btn btn-primary" style="flex: 1; min-width: 200px; padding: 16px 24px; background: var(--success); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span id="btn-save-text">Save Configuration & Publish</span>
         </button>
       </div>

       <div style="margin-top: 12px; font-size: 0.75em; color: var(--text-soft); text-align: center;">
         💡 Tip: Press <kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace;">Ctrl+Enter</kbd> to save quickly
       </div>
    </section>
  `;
}

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

  const renderTableRows = (data: Record<string, number>) => {
    const keys = Object.keys(data).sort((a, b) => data[b] - data[a]);
    if (keys.length === 0) return "<tr><td colspan='2'>—</td></tr>";
    return keys
      .map((k) => `<tr><td>${k}</td><td>${data[k]}</td></tr>`)
      .join("");
  };

  const byTypeRows = renderTableRows(stats.counters.byType || {});
  const byStatusRows = renderTableRows(stats.counters.byStatus || {});
  const byBrowserRows = renderTableRows(stats.counters.byBrowser || {});
  const byOsRows = renderTableRows(stats.counters.byOs || {});
  const byExtVersionRows = renderTableRows(stats.counters.byExtVersion || {});
  const byLangRows = renderTableRows(stats.counters.byLanguage || {});
  const byCountryRows = renderTableRows(stats.counters.byCountry || {});
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

  const rawStatsJson = JSON.stringify(stats, null, 2)
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
      
      /* Background Hierarchy */
      --bg-base: #0f0f14;
      --bg-card: #16161d;
      --bg-elevated: #1e1e28;
      --bg-input: #0a0a0e;
      --bg-hover: #252532;
      
      /* Borders */
      --border: #2a2a38;
      --border-hover: #3a3a4a;
      --border-focus: #8b5cf6;
      
      /* Accent - Purple */
      --accent: #8b5cf6;
      --accent-hover: #a78bfa;
      --accent-muted: rgba(139, 92, 246, 0.15);
      --accent-strong: rgba(139, 92, 246, 0.25);
      
      /* Status */
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.12);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.12);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.1);
      
      /* Typography */
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --text-disabled: #475569;
      
      /* Spacing (4px base) */
      --space-1: 4px;
      --space-2: 8px;
      --space-3: 12px;
      --space-4: 16px;
      --space-5: 20px;
      --space-6: 24px;
      --space-8: 32px;
      --space-10: 40px;
      --space-12: 48px;
      
      /* Border Radius */
      --radius-sm: 8px;
      --radius: 12px;
      --radius-lg: 16px;
      --radius-xl: 20px;
      --radius-full: 9999px;
      
      /* Layout */
      --sidebar-width: 200px;
      --content-max-width: 1400px;
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
      padding: var(--space-5) 0;
      display: flex;
      flex-direction: column;
      z-index: 1000;
      overflow-y: auto;
      transition: transform 0.3s ease;
    }
    
    .nav-header {
      padding: var(--space-4) var(--space-5);
      margin-bottom: var(--space-4);
      border-bottom: 1px solid var(--border);
    }
    
    .nav-brand {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.02em;
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
      background: transparent;
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
      gap: var(--space-7);
    }
    
    /* Cards - Enhanced with Animation */
    .card {
      background: var(--bg-elevated);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      padding: var(--space-7);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      animation: fadeSlideUp 0.5s ease-out backwards;
    }
    
    .card:hover {
      border-color: var(--border-hover);
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
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
    
    /* Grid Layouts */
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
    }
    .breakdown-block {
      border-radius: var(--radius);
      border: 1px solid var(--border);
      padding: var(--space-4);
      background: var(--bg-surface);
      transition: border-color 0.2s ease;
    }
    
    .breakdown-block:hover {
      border-color: var(--border-muted);
    }

    /* Collapsible breakdown sections */
    .breakdown-block.collapsed .breakdown-content {
      display: none;
    }
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
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .breakdown-toggle:hover {
      background: var(--accent-muted);
      border-color: var(--accent);
      color: var(--accent-light);
    }
    .breakdown-block.collapsed .breakdown-toggle {
      transform: rotate(180deg);
    }
    
    .breakdown-content {
      margin-top: var(--space-4);
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
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--bg-surface);
      color: var(--text-muted);
      font-size: 0.75rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
    }
    .btn-external:hover {
      border-color: var(--border-muted);
      color: var(--text-secondary);
    }
    .btn-external.oracle {
      border-color: rgba(124, 58, 237, 0.4);
    }
    .btn-external.oracle:hover {
      background: rgba(124, 58, 237, 0.1);
    }
    .btn-external.uptime {
      border-color: rgba(34, 197, 94, 0.4);
    }
    .btn-external.uptime:hover {
      background: var(--success-muted);
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

    /* ===== BUTTONS - ENHANCED ===== */
    button.btn {
      padding: var(--space-2) var(--space-5);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-muted);
      background: linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-elevated) 100%);
      color: var(--text-secondary);
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }
    button.btn:hover {
      border-color: var(--accent);
      background: linear-gradient(180deg, var(--accent-muted) 0%, var(--bg-surface) 100%);
      color: var(--accent-light);
      box-shadow: 0 2px 8px rgba(79, 142, 247, 0.2);
    }
    button.btn:active {
      transform: translateY(1px);
      box-shadow: none;
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

    [data-tooltip]::before,
    [data-tooltip]::after {
      position: absolute;
      left: 50%;
      transform: translateX(-50%) translateY(0);
      opacity: 0;
      visibility: hidden;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
      z-index: 100;
    }

    [data-tooltip]::after {
      content: attr(data-tooltip);
      bottom: calc(100% + 12px);
      padding: var(--space-2) var(--space-4);
      background: var(--slate-800);
      border: 1px solid var(--accent);
      color: var(--text-primary);
      font-size: 0.78rem;
      font-weight: 500;
      border-radius: var(--radius);
      white-space: nowrap;
      max-width: 320px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(79, 142, 247, 0.25), 0 0 0 1px var(--accent-muted);
    }

    [data-tooltip]::before {
      content: '';
      bottom: calc(100% + 6px);
      border: 7px solid transparent;
      border-top-color: var(--accent);
    }

    [data-tooltip]:hover::before,
    [data-tooltip]:hover::after {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(-6px);
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
    .flag-fuck { background: var(--danger-muted); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }

    /* ===== DANGER ZONE - GUARDED STYLE ===== */
    .danger-zone {
      border: 1px solid rgba(127, 29, 29, 0.6);
      background: rgba(127, 29, 29, 0.08);
    }

    .danger-zone:hover {
      border-color: rgba(153, 27, 27, 0.8);
      background: rgba(127, 29, 29, 0.12);
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
    .danger-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid rgba(239,68,68,0.15);
    }
    .danger-row:last-child {
      border-bottom: none;
    }
    .danger-desc {
      font-size: 0.9rem;
      color: #fca5a5;
      font-weight: 500;
    }
    .danger-sub {
      font-size: 0.75rem;
      color: rgba(254, 202, 202, 0.7);
      margin-top: 2px;
    }
    .btn-danger {
      padding: 8px 16px;
      font-size: 0.85rem;
      border-radius: 8px;
      border: 1px solid var(--danger);
      background: var(--danger-soft);
      color: #fca5a5;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn-danger:hover {
      background: var(--danger);
      border-color: var(--danger);
      color: #fff;
    }
    .btn-danger:active {
      background: var(--danger-hover);
    }

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
      <div class="nav-brand">CQD Analytics</div>
      <div class="nav-subtitle">Worker Dashboard</div>
    </div>
    
    <div class="nav-section">Analytics</div>
    <a href="#overview" class="nav-item active" data-section="overview">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      Overview
    </a>
    <a href="#breakdown" class="nav-item" data-section="breakdown">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
      Breakdown
    </a>
    
    <div class="nav-section">System</div>
    <a href="#system" class="nav-item" data-section="system">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0-1.18-2.82H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 2.82-1.18V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0 1.18 2.82H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/></svg>
      Environment
    </a>
    <a href="#quota" class="nav-item" data-section="quota">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      Quota & Mode
    </a>
    
    <div class="nav-section">Tools</div>
    <a href="#debug" class="nav-item" data-section="debug">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Debug & Actions
    </a>
    <a href="#config" class="nav-item" data-section="config">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      Notifications
    </a>
    <a href="#release" class="nav-item" data-section="release">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      Releases
    </a>
    <a href="#raw" class="nav-item" data-section="raw">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      Raw JSON
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
      <a href="http://129.151.233.229:8080/" target="_blank" class="btn-external oracle" data-tooltip="View Oracle Analytics Dashboard with historical data">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        Oracle Dashboard
      </a>
      <a href="https://docs.google.com/spreadsheets/d/1ptzLKUVnAkyXnT635Zgb1C6Img9aeAZ1se3nRz_QZmI/edit?usp=sharing" target="_blank" class="btn-external oracle" data-tooltip="View historical analytics data and trends">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
        History
      </a>
      <a href="http://129.151.233.229:3001/status/cqd" target="_blank" class="btn-external uptime" data-tooltip="Check service uptime and status via Uptime Kuma">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        Uptime Kuma
      </a>
    </div>

    <main>
      <!-- Top Cards -->
      <section class="card" id="overview">
        <div class="grid-4">
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
      <section class="card" id="breakdown">
        <h2>Breakdown by Dimensions</h2>
        <div class="hot-summary">
          <div class="hot-row">
            <div class="hot-row-label">Top Today</div>
            <div class="hot-row-items">
              <div class="hot-item">
                <div class="hot-label">Type</div>
                <div class="hot-value" data-bind="hotType">${hotType}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">Browser</div>
                <div class="hot-value" data-bind="hotBrowser">${hotBrowser}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">OS</div>
                <div class="hot-value" data-bind="hotOs">${hotOs}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">Country</div>
                <div class="hot-value" data-bind="hotCountry">${hotCountry}</div>
              </div>
            </div>
          </div>
          <div class="hot-row">
            <div class="hot-row-label">All Time</div>
            <div class="hot-row-items">
              <div class="hot-item">
                <div class="hot-label">Type</div>
                <div class="hot-value" data-bind="hotTypeAllTime">${hotType}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">Browser</div>
                <div class="hot-value" data-bind="hotBrowserAllTime">${hotBrowser}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">OS</div>
                <div class="hot-value" data-bind="hotOsAllTime">${hotOs}</div>
              </div>
              <div class="hot-item">
                <div class="hot-label">Country</div>
                <div class="hot-value" data-bind="hotCountryAllTime">${hotCountry}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="grid-3 breakdown-grid">
          <div class="breakdown-block" data-tooltip="Event types: download, install, update, etc.">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Type <span class="unique-count">${uniqueType} unique</span></span>
              <button class="breakdown-toggle" type="button">^</button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Type</th><th>Count</th></tr></thead>
                <tbody id="tbody-type">${byTypeRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block" data-tooltip="Event status: success, fail, cancelled, etc.">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Status <span class="unique-count">${uniqueStatus} unique</span></span>
              <button class="breakdown-toggle" type="button">^</button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody id="tbody-status">${byStatusRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block" data-tooltip="User browser: Chrome, Firefox, Edge, etc.">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Browser <span class="unique-count">${uniqueBrowser} unique</span></span>
              <button class="breakdown-toggle" type="button">^</button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Browser</th><th>Count</th></tr></thead>
                <tbody id="tbody-browser">${byBrowserRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block" data-tooltip="Operating system: Windows, macOS, Linux, etc.">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By OS <span class="unique-count">${uniqueOs} unique</span></span>
              <button class="breakdown-toggle" type="button">^</button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>OS</th><th>Count</th></tr></thead>
                <tbody id="tbody-os">${byOsRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block" data-tooltip="Extension version installed by users">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Extension Version <span class="unique-count">${uniqueExtVersion} unique</span></span>
              <button class="breakdown-toggle" type="button">^</button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Version</th><th>Count</th></tr></thead>
                <tbody id="tbody-ext">${byExtVersionRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block" data-tooltip="Browser/OS language locale">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Language <span class="unique-count">${uniqueLang} unique</span></span>
              <button class="breakdown-toggle" type="button">^</button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Lang</th><th>Count</th></tr></thead>
                <tbody id="tbody-lang">${byLangRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block" data-tooltip="Geographic country based on IP">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Country <span class="unique-count">${uniqueCountry} unique</span></span>
              <button class="breakdown-toggle" type="button">^</button>
            </div>
            <div class="breakdown-content">
              <table>
                <thead><tr><th>Country</th><th>Count</th></tr></thead>
                <tbody id="tbody-country">${byCountryRows}</tbody>
              </table>
            </div>
          </div>
          <div class="breakdown-block" data-tooltip="Error types for failed operations">
            <div class="section-header" onclick="this.parentElement.classList.toggle('collapsed')">
              <span>By Error Reason <span class="unique-count">${uniqueError} unique</span></span>
              <button class="breakdown-toggle" type="button">^</button>
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
              Daily Usage
            </div>
            <div class="quota-stat">
              <span class="quota-label">Requests Today</span>
              <span class="quota-val" data-bind="requestsToday">${requestsToday}</span>
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
              <button class="btn" id="btn-debug-flush-action" type="button">
                <span class="btn-bullet">•</span> POST /debug/flush
              </button>
            </div>
          </div>
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

        <div
          class="danger-row"
          data-tooltip="Immediately pushes all pending analytics events from the Durable Object buffer to ORACLE_ENDPOINT, even if the batch threshold is not reached. Use this to force sync remote storage and any external dashboards."
        >
          <div>
            <div class="danger-desc">Flush Buffer to Oracle</div>
            <div class="danger-sub">
              Force pushes all pending events immediately.
            </div>
          </div>
          <button class="btn-danger" id="btn-force-flush" type="button">
            Flush now
          </button>
        </div>

        <div
          class="danger-row"
          data-tooltip="Sets remoteEnabled to OFF. The Worker will tell all extensions to stop sending analytics to /track and keep everything local. Use this in emergencies to protect your Cloudflare request quota."
        >
          <div>
            <div class="danger-desc">Cut Power (Remote OFF)</div>
            <div class="danger-sub">
              Disables remote analytics for all extensions. Emergency only.
            </div>
          </div>
          <button class="btn-danger" id="btn-cut-power" type="button">
            Cut power
          </button>
        </div>

        <div
          class="danger-row"
          data-tooltip="Re-enables remote analytics if you previously cut power. The Worker will once again accept remote events and extensions may start hitting /track again."
        >
          <div>
            <div class="danger-desc">Restore Power (Remote ON)</div>
            <div class="danger-sub">
              Re-enables remote analytics if previously cut.
            </div>
          </div>
          <button class="btn-danger" id="btn-restore-power" type="button">
            Restore
          </button>
        </div>

        <div
          class="danger-row"
          data-tooltip="Repeatedly flushes until the Durable Object buffer is completely empty. This may issue multiple POSTs to ORACLE_ENDPOINT and is best used off-peak or when you explicitly want a fully drained buffer."
        >
          <div>
            <div class="danger-desc">Full Sync</div>
            <div class="danger-sub">
              Repeatedly flushes until buffer is empty.
            </div>
          </div>
          <button class="btn-danger" id="btn-full-sync" type="button">
            Sync all
          </button>
        </div>
      </section>

      ${renderNotificationSection(stats.changelog || [], stats.changelogConfig || {})}
      ${renderReleaseManagementSection(stats.changelog || [], stats.changelogConfig || {})}
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
            <span class="quota-tag flag-fuck">fuck</span>
          </div>
          <div class="modal-item"><span>EASY</span> <span>&lt; 20k reqs</span></div>
          <div class="modal-item"><span>NORMAL</span> <span>&lt; 50k reqs</span></div>
          <div class="modal-item"><span>HARD</span> <span>&lt; 80k reqs</span></div>
          <div class="modal-item">
            <span style="color:#f87171">FUCK</span>
            <span>&gt; 80k reqs</span>
          </div>
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
          Enter your admin password to run this Danger Zone action.
        </p>
        <div class="field" style="margin-top:12px;">
          <label for="danger-password-input">Admin password</label>
          <input id="danger-password-input" type="password" autocomplete="current-password" />
        </div>
        <div id="danger-modal-error" class="login-error" style="display:none; margin-top:8px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button type="button" class="auth-btn" id="danger-cancel-btn">Cancel</button>
          <button type="button" class="btn-danger" id="danger-confirm-btn">Confirm</button>
        </div>
      </div>
    </div>
  </div>

  <script id="raw-stats-json" type="application/json">
${rawStatsJson}
  </script>
  <script>
    (function () {
      let lastRefreshAt = 0;

      function formatTs(ts) {
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
        return { label: "fuck", className: "flag-fuck", description: "Basically at limits (>80k)." };
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

      function renderTableRowsJS(data) {
        const entries = Object.entries(data || {});
        if (!entries.length) return "<tr><td colspan='2'>—</td></tr>";
        entries.sort((a, b) => b[1] - a[1]);
        return entries
          .map(function ([k, v]) {
            return "<tr><td>" + k + "</td><td>" + v + "</td></tr>";
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
          });
        });
      }

      function updateBreakdowns(counters) {
        if (!counters) return;
        const mapping = [
          ["tbody-type", counters.byType],
          ["tbody-status", counters.byStatus],
          ["tbody-browser", counters.byBrowser],
          ["tbody-os", counters.byOs],
          ["tbody-ext", counters.byExtVersion],
          ["tbody-lang", counters.byLanguage],
          ["tbody-country", counters.byCountry],
          ["tbody-error", counters.byErrorType], // NEW
        ];
        mapping.forEach(function (item) {
          const id = item[0];
          const data = item[1] || {};
          const el = document.getElementById(id);
          if (!el) return;
          const next = renderTableRowsJS(data);
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

      async function refreshStats() {
        if (!btnReload) return;
        btnReload.textContent = "Loading...";
        try {
          const res = await fetch("/stats");
          const data = await res.json();
          if (!data.ok) throw new Error("Stats fetch failed");
          updateUI(data);
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

        for (const [key, val] of Object.entries(map)) {
          const els = document.querySelectorAll('[data-bind="' + key + '"]');
          els.forEach((el) => {
            const current = el.textContent;
            const next = String(val);
            if (current !== next) {
              el.textContent = next;
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
      }

      if (btnReload) {
        btnReload.onclick = refreshStats;
      }

      if (btnReload) {
        btnReload.onclick = refreshStats;
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
      
      async function sendChangelogUpdate(payload) {
        // Show loading state
        if (btnSaveAll) {
          btnSaveAll.classList.add("btn-loading");
          btnSaveAll.style.pointerEvents = "none";
        }
        if (btnSaveText) btnSaveText.textContent = "Saving...";
        
        try {
          const res = await fetch("/admin/changelog", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.ok) {
            // Reload the page to show updated changelog/releases
            window.location.reload();
          } else {
            alert("Error: " + (data.error || "Unknown"));
            // Reset button state
            if (btnSaveAll) {
              btnSaveAll.classList.remove("btn-loading");
              btnSaveAll.style.pointerEvents = "";
            }
            if (btnSaveText) btnSaveText.textContent = "Save Configuration & Publish";
          }
        } catch(e) {
          alert("Network error");
          // Reset button state
          if (btnSaveAll) {
            btnSaveAll.classList.remove("btn-loading");
            btnSaveAll.style.pointerEvents = "";
          }
          if (btnSaveText) btnSaveText.textContent = "Save Configuration & Publish";
        }
      }

      // --- NEW RULES ENGINE LOGIC ---
      
      // Init rules from server state
      let activeRules = window.CURRENT_RULES || [];
      
      function renderRulesList() {
         const container = document.getElementById("rules-list-container");
         const countEl = document.getElementById("rules-count");
         if (!container) return;
         
         if (countEl) countEl.textContent = activeRules.length + " rules";

         if (activeRules.length === 0) {
            container.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-soft); font-style: italic;">No rules defined. Default styling applies.</div>';
            return;
         }

         container.innerHTML = activeRules.map((rule, idx) => \`
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: 6px;">
               <div style="display: flex; align-items: center; gap: 12px;">
                 <span style="font-family: monospace; font-size: 0.9em; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; color: \${rule.target === 'all' ? '#fbbf24' : '#fff'};">\${rule.target}</span>
                 
                 <span style="font-size: 0.8em; color: var(--text-muted);">
                    \${rule.priority} + \${rule.effect}
                 </span>
               </div>
               <button type="button" class="btn-xs delete-rule-btn" data-idx="\${idx}" style="color: #fca5a5; border-color: rgba(239,68,68,0.3);">✕</button>
            </div>
         \`).join('');
         
         // Attach delete listeners
         container.querySelectorAll(".delete-rule-btn").forEach(btn => {
            btn.onclick = () => {
               const idx = parseInt(btn.dataset.idx);
               activeRules.splice(idx, 1);
               renderRulesList();
            };
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

      if (btnSaveAll) {
        btnSaveAll.onclick = () => {
          // 1. Gather Config (Active Rules)
          const payload = {
            config: { rules: activeRules }
          };

          // 2. Gather New/Edit Release (if ANY text entered)
          let ver = document.getElementById("new-cl-version").value.trim();
          // Normalize version: strip leading 'v' or 'V' to prevent double-v display (e.g., "vv1.2.3")
          if (ver.toLowerCase().startsWith('v')) {
            ver = ver.substring(1);
          }
          const text = document.getElementById("new-cl-changes").value.trim();
          const editId = document.getElementById("edit-cl-id").value;
          
          if (ver && text) {
            const changes = text.split("\\n").map(l => l.trim()).filter(Boolean);
            
            // Access raw stats to append/update
            const statsEl = document.getElementById("raw-stats-json");
            const currentEntries = statsEl ? (JSON.parse(statsEl.textContent).changelog || []) : [];
            
            if (editId) {
               // UPDATE existing
               const updated = currentEntries.map(e => e.id === editId ? { ...e, version: ver, changes } : e);
               payload.changelog = updated;
            } else {
               // CREATE new
               const newEntry = {
                 id: crypto.randomUUID(),
                 version: ver,
                 date: new Date().toISOString(),
                 changes: changes,
                 isImportant: false
               };
               payload.changelog = [newEntry, ...currentEntries];
            }

          } else if (ver || text) {
             if (!confirm("Release fields are partially filled but will NOT be saved. Proceed with saving ONLY config?")) {
               return;
             }
          }

          sendChangelogUpdate(payload);
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
        if (editIdInput) editIdInput.value = entry.id;
        
        // Show edit mode banner
        if (editModeBanner) editModeBanner.classList.add("active");
        if (editModeVersion) editModeVersion.textContent = "v" + entry.version;
        if (btnSaveText) btnSaveText.textContent = "Update Release & Save Config";
        
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
        if (editIdInput) editIdInput.value = "";
        
        // Hide edit mode banner
        if (editModeBanner) editModeBanner.classList.remove("active");
        if (btnSaveText) btnSaveText.textContent = "Save Configuration & Publish";
        
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

      updateLiveIndicator();
      setInterval(updateLiveIndicator, 5000);
      
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