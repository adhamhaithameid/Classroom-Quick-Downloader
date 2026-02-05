// filepath: cloudflare-worker/src/dashboard/main.ts
import type { StatsResponse, QuotaDescriptor, ChangelogEntry, ChangelogConfig } from "../types";
import { FAVICON_PNG_DATA_URI } from "../assets";

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

// Notification Rules Engine UI
function renderNotificationSection(entries: ChangelogEntry[], config: ChangelogConfig): string {
  // ... (existing content preserved via context matching? no, I should use insertion)
  // To avoid re-pasting huge block, I will target the END of renderNotificationSection or START of renderDashboard.
  // renderDashboard matches `export function renderDashboard`
  return `
    <section class="card config-card" id="config">
      <!-- ... (previous content) ... -->
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
  return "";
}