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
    :root { color-scheme: dark; --bg: #050816; --accent: #3b82f6; --text-main: #e5e7eb; --text-soft: #6b7280; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { min-height: 100vh; font-family: system-ui, sans-serif; background: radial-gradient(circle at top, #111827 0, #020617 60%); color: var(--text-main); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .login-card { width: 100%; max-width: 380px; border-radius: 20px; padding: 24px 22px 20px; background: rgba(15,23,42,0.92); border: 1px solid rgba(148,163,184,0.45); box-shadow: 0 24px 60px rgba(0,0,0,0.75); }
    .login-title { font-size: 1.35rem; font-weight: 600; margin-bottom: 4px; }
    .login-subtitle { font-size: 0.85rem; color: var(--text-soft); margin-bottom: 16px; }
    .login-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.5); background: rgba(59,130,246,0.1); font-size: 0.75rem; text-transform: uppercase; color: #9ca3af; margin-bottom: 10px; }
    .login-badge-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--accent); }
    .login-row { display: flex; align-items: center; gap: 8px; margin-top: 16px; }
    .field { display: flex; flex-direction: column; gap: 4px; flex: 1; margin: 0; }
    .field input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(148,163,184,0.6); background: rgba(15,23,42,0.95); color: #f9fafb; outline: none; transition: all 0.2s; }
    .field input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(59,130,246,0.25); }
    .login-error { margin-top: 12px; padding: 6px 8px; border-radius: 8px; font-size: 0.78rem; color: #fecaca; background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.6); }
    .login-button { padding: 10px 16px; border-radius: 10px; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; background: linear-gradient(135deg, #3b82f6, #6366f1); color: #f9fafb; display: inline-flex; align-items: center; transition: all 0.2s; white-space: nowrap; height: 100%; }
    .login-button:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .login-button:active { transform: translateY(0); }
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
function renderChangelogSection(entries: ChangelogEntry[], config: ChangelogConfig): string {
  const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Versions for DataList
  const knownVersions = Array.from(new Set(sorted.map(e => e.version)));
  const dataListOptions = [
    '<option value="all">Global (All Versions)</option>',
    ...knownVersions.map(v => `<option value="${v}">v${v}</option>`)
  ].join('');

  const historyHtml = sorted.map(e => `
    <div class="cl-history-item" style="border-bottom: 1px dashed var(--border-subtle); padding: 12px 0;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
        <div>
          <span style="font-weight: 700; color: var(--accent);">${e.version}</span>
          <span style="font-size: 0.8em; color: var(--text-soft); margin-left: 8px;">${new Date(e.date).toLocaleDateString()}</span>
        </div>
        <div style="display: flex; gap: 8px;">
           <button class="btn-xs edit-cl-btn" data-id="${e.id}" style="opacity: 0.7;">✏️</button>
           <button class="btn-xs delete-cl-btn" data-id="${e.id}" style="opacity: 0.7;">🗑</button>
        </div>
      </div>
      <ul style="margin: 0; padding-left: 20px; font-size: 0.9em; color: var(--text-muted);">
        ${e.changes.map(c => `<li>${c}</li>`).join('')}
      </ul>
    </div>
  `).join('') || '<div style="text-align: center; color: var(--text-soft); padding: 20px;">No releases yet</div>';

  const rulesJson = JSON.stringify(config.rules || []);

  // EXACT CSS FROM EXTENSION (App.css) - WITH HOVER EFFECTS
  const extensionStyles = `
    /* Base version pill */
    .cqd-brand-version {
      font-weight: 600;
      color: #005dd7; /* cqd-blue */
      background: #e3edff; /* cqd-blue-soft */
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
    /* Glow (Blue) */
    .cqd-effect-glow-blue {
      box-shadow: 0 0 10px #00d2ff, 0 0 5px #007bff !important;
      border-color: #00d2ff !important;
    }
    .cqd-effect-glow-blue:hover {
      box-shadow: 0 0 15px #00d2ff, 0 0 10px #007bff, 0 4px 8px rgba(0, 210, 255, 0.3) !important;
    }
    
    /* Glow (Red) */
    .cqd-effect-glow-red {
      box-shadow: 0 0 10px #f87171, 0 0 5px #ef4444 !important;
      border-color: #f87171 !important;
    }
    .cqd-effect-glow-red:hover {
      box-shadow: 0 0 15px #f87171, 0 0 10px #ef4444, 0 4px 8px rgba(248, 113, 113, 0.3) !important;
    }

    /* Pulse (Blue) */
    @keyframes pulse-blue {
      0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
      100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
    }
    .cqd-effect-pulse-blue {
      animation: pulse-blue 2s infinite;
    }
    .cqd-effect-pulse-blue:hover {
      animation: pulse-blue 1s infinite;
    }

    /* Pulse (Red) */
    @keyframes pulse-red {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .cqd-effect-pulse-red {
      animation: pulse-red 2s infinite;
    }
    .cqd-effect-pulse-red:hover {
      animation: pulse-red 1s infinite;
    }
  `;

  return `
    <section class="card config-card" style="border-color: #3b82f6;">
      <h2 style="color: #3b82f6; display: flex; align-items: center; gap: 8px;">
        <span>📜</span> Notification & Release Manager
      </h2>

      <!-- Inject Server State & Styles -->
      <script>window.CURRENT_RULES = ${rulesJson};</script>
      <style>${extensionStyles}</style>

      <div class="split-layout" style="display: flex; gap: 40px; flex-wrap: wrap;">
        
        <!-- =======================
             LEFT: NOTIFICATION STYLING
             ======================= -->
        <div style="flex: 1; min-width: 350px; display: flex; flex-direction: column; gap: 20px;">
          <div class="section-header" style="color: var(--accent);">1. Notification Styling</div>
          <div style="font-size: 0.85em; color: var(--text-soft); margin-bottom: 12px;">
            Define how the extension badge looks for specific versions.
          </div>
          
          <div style="padding: 20px; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid var(--border-subtle);">
            
            <!-- Target Selection -->
            <div style="margin-bottom: 16px;">
               <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 6px;">Target Version</label>
               <input list="known-versions" id="rule-target" placeholder="e.g. 1.2.3 or 'all'" class="input-field" style="width: 100%; padding: 8px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: white; border-radius: 6px;" oninput="window.updatePreview && window.updatePreview()">
               <datalist id="known-versions">
                 ${dataListOptions}
               </datalist>
               <div style="font-size: 0.7em; color: var(--text-muted); margin-top: 4px;">Select from history or type new.</div>
            </div>
            
            <div style="border-top: 1px dashed var(--border-subtle); margin: 16px 0; padding-top: 16px;">
              <!-- Priority -->
              <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 8px;">Priority (Color Scheme)</label>
              <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                  <input type="radio" name="rule-priority" value="normal" checked onclick="window.updatePreview && window.updatePreview()">
                  <span style="font-size: 0.85em;">Normal</span>
                </label>
                <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(59,130,246,0.1); border-radius: 6px;">
                  <input type="radio" name="rule-priority" value="minor" onclick="window.updatePreview && window.updatePreview()">
                  <span style="font-size: 0.85em; color: #60a5fa;">Minor (Blue)</span>
                </label>
                <label style="cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(239,68,68,0.1); border-radius: 6px;">
                  <input type="radio" name="rule-priority" value="major" onclick="window.updatePreview && window.updatePreview()">
                  <span style="font-size: 0.85em; color: #f87171; font-weight: 600;">Major (Red)</span>
                </label>
              </div>

              <!-- Effect -->
              <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 8px;">Animation Effect</label>
              <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                  <input type="radio" name="rule-effect" value="none" checked onclick="window.updatePreview && window.updatePreview()">
                  <span>None</span>
                </label>
                <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                  <input type="radio" name="rule-effect" value="glow" onclick="window.updatePreview && window.updatePreview()">
                  <span>✨ Glow</span>
                </label>
                <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                  <input type="radio" name="rule-effect" value="pulse" onclick="window.updatePreview && window.updatePreview()">
                  <span>📡 Pulse</span>
                </label>
              </div>
            </div>

            <!-- LIVE PREVIEW CONTAINER -->
            <div style="background: #000; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #333; margin-bottom: 16px;">
               <div style="font-size: 0.7em; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Live Extension Preview</div>
               <span id="rule-preview-pill" class="cqd-brand-version">v1.2.3</span>
            </div>
            
            <!-- INLINE SCRIPT: Simple if/else preview logic -->
            <script>
            (function() {
              var pill = document.getElementById('rule-preview-pill');
              
              function updatePreview() {
                if (!pill) return;
                
                // Get selected values
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
                
                // Build class string - simple if/else
                var cls = 'cqd-brand-version';
                
                if (priority === 'minor') cls += ' cqd-pill-minor';
                if (priority === 'major') cls += ' cqd-pill-major';
                
                if (effect === 'glow') {
                  cls += (priority === 'major') ? ' cqd-effect-glow-red' : ' cqd-effect-glow-blue';
                }
                if (effect === 'pulse') {
                  cls += (priority === 'major') ? ' cqd-effect-pulse-red' : ' cqd-effect-pulse-blue';
                }
                
                pill.className = cls;
              }
              
              // Attach to radio buttons
              var allRadios = document.querySelectorAll('input[name="rule-priority"], input[name="rule-effect"]');
              for (var i = 0; i < allRadios.length; i++) {
                allRadios[i].onclick = updatePreview;
              }
              
              // Make global
              window.updatePreview = updatePreview;
              
              // Initial call
              updatePreview();
            })();
            </script>

            <button id="btn-add-rule" class="btn" style="width: 100%; justify-content: center; background: var(--accent); color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer;">
               Append Rule
            </button>
          </div>

          <!-- Rules List -->
          <div>
            <div class="metric-sub" style="margin-bottom: 8px; display: flex; justify-content: space-between;">
               <span>Active Rules Priority: Specific versions override 'all'</span>
               <span id="rules-count">0 rules</span>
            </div>
            <div id="rules-list-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto;">
               <!-- JS renders here -->
            </div>
          </div>
        </div>

        <!-- =======================
             RIGHT: RELEASE PUBLISHING
             ======================= -->
        <div style="flex: 1; min-width: 350px; border-left: 1px solid var(--border-subtle); padding-left: 40px; display: flex; flex-direction: column; gap: 20px;">
           
           <div class="section-header" style="color: var(--warning);">2. Release Publishing</div>
           <div style="font-size: 0.85em; color: var(--text-soft); margin-bottom: 12px;">
             Publish a new changelog entry. This text appears when users click the version pill.
           </div>

           <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border: 1px solid var(--border-subtle);">
              <input type="hidden" id="edit-cl-id" value="">
              
              <div style="margin-bottom: 12px;">
                 <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 6px;">Version</label>
                 <!-- Reusing the same datalist for convenience -->
                 <input list="known-versions" id="new-cl-version" placeholder="e.g. 1.2.4" class="input-field" style="width: 100%; padding: 10px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: white; border-radius: 6px;">
              </div>

              <div style="margin-bottom: 12px;">
                 <label style="font-size: 0.75em; color: var(--text-soft); display: block; margin-bottom: 6px;">Changes (Markdown-ish)</label>
                 <textarea id="new-cl-changes" rows="4" class="input-field" placeholder="- Added new feature..." style="width: 100%; padding: 10px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: white; border-radius: 6px;"></textarea>
              </div>
           </div>
           
           <div style="flex: 1; display: flex; flex-direction: column;">
             <div class="metric-sub" style="margin-bottom: 12px;">Historical Releases</div>
             <div class="cl-history-list" style="flex: 1; overflow-y: auto; max-height: 400px; padding-right: 8px;">
               ${historyHtml}
             </div>
           </div>

        </div>
      </div>
      
      <hr style="border: 0; border-top: 1px solid var(--border-subtle); margin: 24px 0 16px;">
      
      <button id="btn-save-all" class="btn btn-primary" style="width: 100%; padding: 16px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
         💾 Save Configuration & Publish
      </button>

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
    :root {
      color-scheme: dark;
      --bg: #050816;
      --bg-elevated: #111827;
      --border-subtle: #1f2937;
      --accent: #3b82f6;
      --danger: #ef4444;
      --text-main: #e5e7eb;
      --text-muted: #9ca3af;
      --text-soft: #6b7280;
      --success: #22c55e;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(circle at top, #111827 0, #020617 60%, #020617 100%);
      color: var(--text-main);
      line-height: 1.5;
    }
    .page {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
    }
    .hidden {
      display: none;
    }


    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 8px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header-logo {
      width: 42px;
      height: 42px;
    }
    .title-block h1 {
      margin: 0;
      font-size: 1.75rem;
      letter-spacing: -0.01em;
      font-weight: 700;
      background: linear-gradient(to right, #e5e7eb, #9ca3af);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .title-block p {
      margin: 0;
      font-size: 0.95rem;
      color: var(--text-muted);
    }

    .header-controls {
      display: flex;
      flex-direction: row-reverse;
      align-items: flex-end;
      gap: 8px;
    }
    .live-wrapper {
      display: flex;
      flex-direction: row-reverse;
      align-items: center;
      justify-content: flex-center;
      gap: 8px;
    }
    .refresh-indicator {
      text-align: right;
      font-size: 0.75rem;
    }
    .refresh-label {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-soft);
    }
    .refresh-value {
      color: var(--text-main);
      font-feature-settings: "tnum" 1;
    }

    .live-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.4);
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }
    .live-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #22c55e;
      box-shadow: 0 0 8px rgba(34,197,94,0.7);
    }
    .live-label { font-weight: 600; }

    @keyframes live-pulse {
      0% { transform: scale(0.9); opacity: 0.7; }
      50% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.7; }
    }
    .live-indicator[data-state="live"] .live-dot {
      animation: live-pulse 1.5s infinite;
    }
    .live-indicator[data-state="stale"] .live-dot {
      background: #f59e0b;
      box-shadow: 0 0 8px rgba(245,158,11,0.7);
      animation: none;
    }
    .live-indicator[data-state="cold"] .live-dot {
      background: #ef4444;
      box-shadow: 0 0 8px rgba(239,68,68,0.7);
      animation: none;
    }

    .info-btn {
      border-radius: 999px;
      border: 1px solid var(--border-subtle);
      background: rgba(15,23,42,0.9);
      color: var(--text-muted);
      display: inline-flex;
      align-items: end;
      gap: 6px;
      padding: 6px 10px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .info-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59,130,246,0.15);
    }
    .info-pill {
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(31,41,55,0.9);
      border: 1px solid rgba(148,163,184,0.5);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.65rem;
      color: var(--text-muted);
    }
    .info-pill-flag {
      border-color: rgba(34,197,94,0.7);
      color: #22c55e;
    }
    .info-icon {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 1px solid var(--border-subtle);
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

    main {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .card {
      background: rgba(15,23,42,0.6);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,0.12);
      padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    }
    .card:hover {
      border-color: rgba(148,163,184,0.25);
    }
    .card h2 {
      margin: 0 0 16px;
      font-size: 0.95rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-muted);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-header {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 8px;
      font-weight: 600;
    }

    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .split-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .metric {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      border-radius: 8px;
      transition: background 0.5s;
      position: relative;
    }
    .metric-compact {
      padding: 6px;
    }
    .metric-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-soft);
      font-weight: 600;
    }
    .metric-value {
      font-size: 1.6rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      transition: color 0.3s;
    }
    .metric-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .metric-good .metric-value {
      color: var(--success);
    }
    .metric-warn .metric-value {
      color: var(--warning);
    }
    .metric-bad .metric-value {
      color: var(--danger);
    }

    .empty-state {
      margin-top: 12px;
      font-size: 0.8rem;
      color: var(--text-soft);
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px dashed rgba(148,163,184,0.35);
      background: rgba(15,23,42,0.8);
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

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }
    th, td {
      padding: 6px 4px;
      text-align: left;
    }
    th {
      font-weight: 600;
      color: var(--text-soft);
      border-bottom: 1px solid rgba(148,163,184,0.1);
    }
    td {
      color: var(--text-main);
    }
    tr:not(:last-child) td {
      border-bottom: 1px dashed rgba(148,163,184,0.1);
    }
    tr:hover td {
      color: #fff;
      background: rgba(255,255,255,0.02);
    }

    .breakdown-grid {
      margin-top: 4px;
    }
    .breakdown-block {
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.14);
      padding: 12px 12px 10px;
      background: rgba(15,23,42,0.75);
      transition: background 0.3s, border-color 0.3s;
    }

    .hot-today {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(15,23,42,0.7);
    }
    .hot-item {
      min-width: 120px;
    }
    .hot-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-soft);
      margin-bottom: 2px;
    }
    .hot-value {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-main);
    }

    button.btn {
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid var(--border-subtle);
      background: rgba(15,23,42,0.8);
      color: var(--text-main);
      font-size: 0.85rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
      font-weight: 500;
    }
    button.btn:hover {
      border-color: var(--accent);
      background: rgba(15,23,42,1);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59,130,246,0.15);
    }
    button.btn:active {
      transform: translateY(0);
    }
    .btn-bullet {
      font-size: 1.4em;
      line-height: 0;
      color: var(--accent);
      margin-right: 4px;
    }

    .quota-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      cursor: help;
    }

    [data-tooltip] { position: relative; cursor: help; }
    [data-tooltip]:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 10px;
      background: #0f172a;
      border: 1px solid var(--border-subtle);
      color: #e2e8f0;
      font-size: 0.75rem;
      border-radius: 6px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 10;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      margin-bottom: 6px;
    }

    .state-unknown,
    .flag-unknown {
      background: rgba(148,163,184,0.05);
      color: #e5e7eb;
      border: 1px dashed rgba(148,163,184,0.3);
    }
    .state-sleeping,
    .state-super-chill,
    .state-chill,
    .state-easy,
    .state-kinda-easy {
      background: rgba(148,163,184,0.1);
      color: #d1d5db;
      border: 1px solid rgba(148,163,184,0.3);
    }
    .state-normal,
    .state-slightly-busy {
      background: rgba(59,130,246,0.1);
      color: #93c5fd;
      border: 1px solid rgba(59,130,246,0.4);
    }
    .state-kinda-busy,
    .state-busy,
    .state-very-busy,
    .state-super-busy {
      background: rgba(249,115,22,0.1);
      color: #fdba74;
      border: 1px solid rgba(249,115,22,0.4);
    }
    .state-emergency,
    .state-critical,
    .state-cut-power {
      background: rgba(239,68,68,0.15);
      color: #fca5a5;
      border: 1px solid rgba(239,68,68,0.5);
    }

    .flag-easy   { background: rgba(34,197,94,0.1);  color: #86efac; border: 1px solid rgba(34,197,94,0.4); }
    .flag-normal { background: rgba(59,130,246,0.1); color: #93c5fd; border: 1px solid rgba(59,130,246,0.4); }
    .flag-hard   { background: rgba(245,158,11,0.1); color: #fcd34d; border: 1px solid rgba(245,158,11,0.4); }
    .flag-fuck   { background: rgba(239,68,68,0.2);  color: #fca5a5; border: 1px solid rgba(239,68,68,0.6); }

    .danger-zone {
      border: 1px solid rgba(220, 38, 38, 0.5);
      background: rgba(69, 10, 10, 0.25);
      transition: all 0.3s ease;
    }
    .danger-zone:hover {
      background: rgba(127, 29, 29, 0.3);
      border-color: rgba(239, 68, 68, 0.8);
      box-shadow: 0 0 20px rgba(220, 38, 38, 0.15);
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
      border: 1px solid rgba(239, 68, 68, 0.5);
      background: transparent;
      color: #fca5a5;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn-danger:hover {
      background: rgba(220,38,38,0.3);
      border-color: #ef4444;
      color: #fff;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(220,38,38,0.15);
    }
    .btn-danger:active {
      transform: translateY(0);
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
      background: rgba(0,0,0,0.2);
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(255,255,255,0.03);
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
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
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
      background: #1e293b;
      border: 1px solid var(--border-subtle);
      width: 100%;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
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

    @media (max-width: 900px) {
      .grid-4,
      .grid-3,
      .split-section {
        grid-template-columns: 1fr;
      }
      .auth-bar {
        width: 100%;
        justify-content: space-between;
        margin-top: 8px;
      }
      .danger-header {
        flex-direction: column;
        align-items: flex-start;
      }
      header {
        flex-direction: column;
        gap: 8px;
      }
      .header-controls {
        align-self: flex-end;
      }
    }
  </style>
</head>
<body>
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

    <main>
      <!-- Top Cards -->
      <section class="card">
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
        <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:12px;">
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
        <div id="empty-state" class="empty-state${
          stats.totalEvents > 0 ? " hidden" : ""
        }">
          No events yet – install the extension and trigger a download to see analytics here.
        </div>
      </section>

      <!-- Buffer, Timing & Environment -->
      <section class="card">
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
      <section class="card">
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
      <section class="card">
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

      <!-- Breakdown -->
      <section class="card">
        <h2>Breakdown by Dimensions</h2>
        <div class="hot-today">
          <div class="hot-item">
            <div class="hot-label">Top type today</div>
            <div class="hot-value" data-bind="hotType">${hotType}</div>
          </div>
          <div class="hot-item">
            <div class="hot-label">Top browser</div>
            <div class="hot-value" data-bind="hotBrowser">${hotBrowser}</div>
          </div>
          <div class="hot-item">
            <div class="hot-label">Top OS</div>
            <div class="hot-value" data-bind="hotOs">${hotOs}</div>
          </div>
          <div class="hot-item">
            <div class="hot-label">Top country</div>
            <div class="hot-value" data-bind="hotCountry">${hotCountry}</div>
          </div>
        </div>
        <div class="grid-3 breakdown-grid">
          <div class="breakdown-block">
            <div class="section-header">By Type</div>
            <table>
              <thead><tr><th>Type</th><th>Count</th></tr></thead>
              <tbody id="tbody-type">${byTypeRows}</tbody>
            </table>
          </div>
          <div class="breakdown-block">
            <div class="section-header">By Status</div>
            <table>
              <thead><tr><th>Status</th><th>Count</th></tr></thead>
              <tbody id="tbody-status">${byStatusRows}</tbody>
            </table>
          </div>
          <div class="breakdown-block">
            <div class="section-header">By Browser</div>
            <table>
              <thead><tr><th>Browser</th><th>Count</th></tr></thead>
              <tbody id="tbody-browser">${byBrowserRows}</tbody>
            </table>
          </div>
          <div class="breakdown-block">
            <div class="section-header">By OS</div>
            <table>
              <thead><tr><th>OS</th><th>Count</th></tr></thead>
              <tbody id="tbody-os">${byOsRows}</tbody>
            </table>
          </div>
          <div class="breakdown-block">
            <div class="section-header">By Extension Version</div>
            <table>
              <thead><tr><th>Version</th><th>Count</th></tr></thead>
              <tbody id="tbody-ext">${byExtVersionRows}</tbody>
            </table>
          </div>
          <div class="breakdown-block">
            <div class="section-header">By Language</div>
            <table>
              <thead><tr><th>Lang</th><th>Count</th></tr></thead>
              <tbody id="tbody-lang">${byLangRows}</tbody>
            </table>
          </div>
          <div class="breakdown-block">
            <div class="section-header">By Country</div>
            <table>
              <thead><tr><th>Country</th><th>Count</th></tr></thead>
              <tbody id="tbody-country">${byCountryRows}</tbody>
            </table>
          </div>
          <div class="breakdown-block">
            <div class="section-header">By Error Reason</div>
            <table>
              <thead><tr><th>Error</th><th>Count</th></tr></thead>
              <tbody id="tbody-error">${byErrorRows}</tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Danger Zone -->
      <section class="card danger-zone">
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

      <!-- Raw /stats payload -->
      <section class="card">
        <h2>Raw /stats payload</h2>
        <div class="metric-sub">
          Direct JSON returned by <code>/stats</code>
        </div>
        <pre id="raw-stats-json" class="code-block code-block-large">${rawStatsJson}</pre>
      </section>

      ${renderChangelogSection(stats.changelog || [], stats.changelogConfig || {})}
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
      const btnSaveAll = document.getElementById("btn-save-all");
      
      async function sendChangelogUpdate(payload) {
        const pwd = prompt("Enter Admin Password:");
        if (!pwd) return;
        
        try {
          const res = await fetch("/admin/changelog", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "X-Admin-Secret": pwd
            },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.ok) {
            refreshStats();
            // Clear inputs ONLY if successful
            const verInput = document.getElementById("new-cl-version");
            const txtInput = document.getElementById("new-cl-changes");
            const idInput = document.getElementById("edit-cl-id");
            if (verInput) verInput.value = "";
            if (txtInput) txtInput.value = "";
            if (idInput) idInput.value = "";
            const btn = document.getElementById("btn-save-all");
            if (btn) btn.innerHTML = "💾 Save Changes (Config & Release)";
          } else {
            alert("Error: " + (data.error || "Unknown"));
          }
        } catch(e) {
          alert("Network error");
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
                 <span style="font-family: monospace; font-size: 0.9em; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; color: \${rule.target === 'all' ? '#fbbf24' : '#fff'};\সামরিক">\${rule.target}</span>
                 
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
      const btnSaveAll = document.getElementById("btn-save-all");
      
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
         const priorityEl = document.querySelector('input[name="rule-priority"]:checked') as HTMLInputElement;
         const effectEl = document.querySelector('input[name="rule-effect"]:checked') as HTMLInputElement;
         
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
      (window as any).updatePreview = updatePreview;


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
            
            const priority = (document.querySelector('input[name="rule-priority"]:checked') as HTMLInputElement)?.value || 'normal';
            const effect = (document.querySelector('input[name="rule-effect"]:checked') as HTMLInputElement)?.value || 'none';
            
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
          const ver = document.getElementById("new-cl-version").value.trim();
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

      document.querySelectorAll(".edit-cl-btn").forEach(btn => {
        btn.onclick = (e) => {
           const id = e.target.dataset.id;
           const currentEntries = JSON.parse(document.getElementById("raw-stats-json").textContent).changelog || [];
           const entry = currentEntries.find(x => x.id === id);
           if (!entry) return;
           
           document.getElementById("new-cl-version").value = entry.version;
           document.getElementById("new-cl-changes").value = entry.changes.join("\\n");
           document.getElementById("edit-cl-id").value = entry.id;
           
           document.getElementById("btn-save-all").innerHTML = "💾 Update Release & Save Config";
           // scroll to top of form
           document.querySelector(".config-card").scrollIntoView({ behavior: "smooth" });
        };
      });

      document.querySelectorAll(".delete-cl-btn").forEach(btn => {
        btn.onclick = (e) => {
          if(!confirm("Delete this release?")) return;
          const id = e.target.dataset.id;
          const currentEntries = JSON.parse(document.getElementById("raw-stats-json").textContent).changelog || [];
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
          if (!dangerActionPath || !dangerPwdInput) {
            return;
          }
          const pwd = dangerPwdInput.value.trim();
          if (!pwd) {
            showDangerError("Password is required.");
            return;
          }
          dangerConfirm.disabled = true;
          showDangerError("");
          fetch(dangerActionPath, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Admin-Secret": pwd,
            },
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
    })();
  </script>
</body>
</html>`;
}