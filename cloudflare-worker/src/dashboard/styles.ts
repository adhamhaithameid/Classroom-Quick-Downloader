// filepath: cloudflare-worker/src/dashboard/styles.ts
/**
 * Dashboard CSS styles.
 */

export const DASHBOARD_STYLES = `
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
  margin: 0; padding: 24px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: radial-gradient(circle at top, #111827 0, #020617 60%, #020617 100%);
  color: var(--text-main); line-height: 1.5;
}
.page { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; position: relative; }
.hidden { display: none; }

header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 8px; }
.header-left { display: flex; align-items: center; gap: 16px; }
.header-logo { width: 42px; height: 42px; }
.title-block h1 { margin: 0; font-size: 1.75rem; letter-spacing: -0.01em; font-weight: 700; background: linear-gradient(to right, #e5e7eb, #9ca3af); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.title-block p { margin: 0; font-size: 0.95rem; color: var(--text-muted); }

.header-controls { display: flex; flex-direction: row-reverse; align-items: flex-end; gap: 8px; }
.live-wrapper { display: flex; flex-direction: row-reverse; align-items: center; justify-content: flex-center; gap: 8px; }
.refresh-indicator { text-align: right; font-size: 0.75rem; }
.refresh-label { text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-soft); }
.refresh-value { color: var(--text-main); font-feature-settings: "tnum" 1; }

.live-indicator { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.4); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
.live-dot { width: 7px; height: 7px; border-radius: 999px; background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.7); }
.live-label { font-weight: 600; }

@keyframes live-pulse { 0% { transform: scale(0.9); opacity: 0.7; } 50% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.7; } }
.live-indicator[data-state="live"] .live-dot { animation: live-pulse 1.5s infinite; }
.live-indicator[data-state="stale"] .live-dot { background: #f59e0b; box-shadow: 0 0 8px rgba(245,158,11,0.7); animation: none; }
.live-indicator[data-state="cold"] .live-dot { background: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.7); animation: none; }

.info-btn { border-radius: 999px; border: 1px solid var(--border-subtle); background: rgba(15,23,42,0.9); color: var(--text-muted); display: inline-flex; align-items: end; gap: 6px; padding: 6px 10px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
.info-btn:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59,130,246,0.15); }
.info-pill { padding: 2px 8px; border-radius: 999px; background: rgba(31,41,55,0.9); border: 1px solid rgba(148,163,184,0.5); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.65rem; color: var(--text-muted); }
.info-pill-flag { border-color: rgba(34,197,94,0.7); color: #22c55e; }
.info-icon { width: 18px; height: 18px; border-radius: 999px; border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: center; font-size: 0.85rem; }

main { display: flex; flex-direction: column; gap: 20px; }
.card { background: rgba(15,23,42,0.6); backdrop-filter: blur(10px); border-radius: 16px; border: 1px solid rgba(148,163,184,0.12); padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
.card:hover { border-color: rgba(148,163,184,0.25); }
.card h2 { margin: 0 0 16px; font-size: 0.95rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 8px; }

.section-header { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; }

.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.split-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

.metric { display: flex; flex-direction: column; gap: 4px; padding: 8px; border-radius: 8px; transition: background 0.5s; position: relative; }
.metric-compact { padding: 6px; }
.metric-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-soft); font-weight: 600; }
.metric-value { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; transition: color 0.3s; }
.metric-sub { font-size: 0.8rem; color: var(--text-muted); }
.metric-good .metric-value { color: var(--success); }
.metric-warn .metric-value { color: var(--warning); }
.metric-bad .metric-value { color: var(--danger); }

.empty-state { margin-top: 12px; font-size: 0.8rem; color: var(--text-soft); padding: 8px 10px; border-radius: 8px; border: 1px dashed rgba(148,163,184,0.35); background: rgba(15,23,42,0.8); }

@keyframes flash-green { 0% { background-color: rgba(34, 197, 94, 0.2); } 100% { background-color: transparent; } }
@keyframes text-flash { 0% { color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.5); } 100% { color: inherit; text-shadow: none; } }
.updated { animation: flash-green 1.5s ease-out; }
.updated .metric-value, .updated strong, .updated .quota-val, .updated .live-indicator .live-dot { animation: text-flash 1.5s ease-out; }

table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
th, td { padding: 6px 4px; text-align: left; }
th { font-weight: 600; color: var(--text-soft); border-bottom: 1px solid rgba(148,163,184,0.1); }
td { color: var(--text-main); }
tr:not(:last-child) td { border-bottom: 1px dashed rgba(148,163,184,0.1); }
tr:hover td { color: #fff; background: rgba(255,255,255,0.02); }

.breakdown-grid { margin-top: 4px; }
.breakdown-block { border-radius: 12px; border: 1px solid rgba(148,163,184,0.14); padding: 12px 12px 10px; background: rgba(15,23,42,0.75); transition: background 0.3s, border-color 0.3s; }

.hot-today { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(148,163,184,0.2); background: rgba(15,23,42,0.7); }
.hot-item { min-width: 120px; }
.hot-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-soft); margin-bottom: 2px; }
.hot-value { font-size: 0.9rem; font-weight: 500; color: var(--text-main); }

button.btn { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-subtle); background: rgba(15,23,42,0.8); color: var(--text-main); font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; font-weight: 500; }
button.btn:hover { border-color: var(--accent); background: rgba(15,23,42,1); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59,130,246,0.15); }
button.btn:active { transform: translateY(0); }
.btn-bullet { font-size: 1.4em; line-height: 0; color: var(--accent); margin-right: 4px; }

.quota-tag { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.1); cursor: help; }

[data-tooltip] { position: relative; cursor: help; }
[data-tooltip]:hover::after { content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); padding: 6px 10px; background: #0f172a; border: 1px solid var(--border-subtle); color: #e2e8f0; font-size: 0.75rem; border-radius: 6px; white-space: nowrap; pointer-events: none; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.3); margin-bottom: 6px; }

.state-unknown, .flag-unknown { background: rgba(148,163,184,0.05); color: #e5e7eb; border: 1px dashed rgba(148,163,184,0.3); }
.state-sleeping, .state-super-chill, .state-chill, .state-easy, .state-kinda-easy { background: rgba(148,163,184,0.1); color: #d1d5db; border: 1px solid rgba(148,163,184,0.3); }
.state-normal, .state-slightly-busy { background: rgba(59,130,246,0.1); color: #93c5fd; border: 1px solid rgba(59,130,246,0.4); }
.state-kinda-busy, .state-busy, .state-very-busy, .state-super-busy { background: rgba(249,115,22,0.1); color: #fdba74; border: 1px solid rgba(249,115,22,0.4); }
.state-emergency, .state-critical, .state-cut-power { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.5); }

.flag-easy { background: rgba(34,197,94,0.1); color: #86efac; border: 1px solid rgba(34,197,94,0.4); }
.flag-normal { background: rgba(59,130,246,0.1); color: #93c5fd; border: 1px solid rgba(59,130,246,0.4); }
.flag-hard { background: rgba(245,158,11,0.1); color: #fcd34d; border: 1px solid rgba(245,158,11,0.4); }
.flag-fuck { background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.6); }

.danger-zone { border: 1px solid rgba(220, 38, 38, 0.5); background: rgba(69, 10, 10, 0.25); transition: all 0.3s ease; }
.danger-zone:hover { background: rgba(127, 29, 29, 0.3); border-color: rgba(239, 68, 68, 0.8); box-shadow: 0 0 20px rgba(220, 38, 38, 0.15); }
.danger-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.danger-icon { font-size: 1.2rem; }
.danger-title { font-size: 1rem; font-weight: 600; color: #fca5a5; margin: 0; }
.danger-subtitle { font-size: 0.8rem; color: var(--text-soft); margin: 4px 0 0; }
.danger-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.danger-card { padding: 12px; border-radius: 10px; border: 1px solid rgba(220, 38, 38, 0.25); background: rgba(15, 23, 42, 0.6); display: flex; flex-direction: column; gap: 8px; height: 100%; }
.danger-btn { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(220, 38, 38, 0.5); background: rgba(220, 38, 38, 0.1); color: #fca5a5; font-size: 0.8rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; }
.danger-btn:hover { background: rgba(220, 38, 38, 0.25); border-color: rgba(239, 68, 68, 0.8); transform: translateY(-1px); box-shadow: 0 4px 8px rgba(220, 38, 38, 0.2); }
.danger-btn:active { transform: translateY(0); }
.danger-btn-icon { font-size: 1rem; }
.danger-desc { font-size: 0.75rem; color: var(--text-soft); line-height: 1.4; flex: 1; }

.raw-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.8rem; color: var(--text-muted); transition: color 0.2s; }
.raw-toggle:hover { color: var(--text-main); }
.raw-output { margin-top: 12px; padding: 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); font-size: 0.75rem; font-family: "SF Mono", Monaco, Consolas, monospace; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: var(--text-muted); max-height: 400px; overflow-y: auto; }

@media (max-width: 768px) {
  .grid-4, .grid-3, .split-section, .danger-grid { grid-template-columns: 1fr; }
  header { flex-direction: column; text-align: center; }
  .header-controls { flex-direction: column; align-items: center; }
}
`;

export const LOGIN_STYLES = `
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
`;
