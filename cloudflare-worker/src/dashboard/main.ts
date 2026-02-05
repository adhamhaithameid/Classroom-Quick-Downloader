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


export function renderDashboard(stats: StatsResponse): string {
  return "";
}