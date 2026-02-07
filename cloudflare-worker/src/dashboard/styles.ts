// filepath: cloudflare-worker/src/dashboard/styles.ts
/**
 * Dashboard CSS styles - Professional Zinc/Slate Theme
 * Designed for Classroom Quick Downloader Analytics Dashboard
 */

export const DASHBOARD_STYLES = `
/* ===== DESIGN SYSTEM - ZINC/SLATE THEME ===== */
:root {
  color-scheme: dark;
  
  /* Base Colors - Zinc Palette */
  --zinc-950: #09090b;
  --zinc-900: #18181b;
  --zinc-800: #27272a;
  --zinc-700: #3f3f46;
  --zinc-600: #52525b;
  --zinc-500: #71717a;
  --zinc-400: #a1a1aa;
  --zinc-300: #d4d4d8;
  --zinc-200: #e4e4e7;
  --zinc-100: #f4f4f5;
  
  /* Semantic Colors */
  --bg: var(--zinc-950);
  --bg-elevated: var(--zinc-900);
  --bg-surface: #0f0f12;
  --border: var(--zinc-800);
  --border-muted: var(--zinc-700);
  
  /* Accent */
  --accent: #3b82f6;
  --accent-muted: rgba(59, 130, 246, 0.15);
  
  /* Status Colors */
  --success: #22c55e;
  --success-muted: rgba(34, 197, 94, 0.12);
  --warning: #f59e0b;
  --warning-muted: rgba(245, 158, 11, 0.12);
  --danger: #ef4444;
  --danger-muted: rgba(239, 68, 68, 0.08);
  
  /* Typography */
  --text-primary: var(--zinc-100);
  --text-secondary: var(--zinc-300);
  --text-muted: var(--zinc-500);
  --text-disabled: var(--zinc-600);
  
  /* Spacing Grid - 8px base */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  
  /* Border Radius */
  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 16px;
  --radius-full: 9999px;
}

/* ===== RESET & BASE ===== */
* { box-sizing: border-box; }

body {
  margin: 0;
  padding: var(--space-6);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.page {
  max-width: 1120px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.hidden { display: none; }

/* ===== HEADER ===== */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.header-logo {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
}

.title-block h1 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.title-block p {
  margin: var(--space-1) 0 0;
  font-size: 0.875rem;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.live-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.refresh-indicator {
  text-align: right;
  font-size: 0.75rem;
}

.refresh-label {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.65rem;
  color: var(--text-disabled);
}

.refresh-value {
  color: var(--text-secondary);
  font-feature-settings: "tnum" 1;
}

/* Live Indicator - Slow Pulse */
.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
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

/* ===== MAIN CONTENT ===== */
main {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Cards - Clean Zinc Surface */
.card {
  background: var(--bg-elevated);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  padding: var(--space-6);
  transition: border-color 0.2s ease;
}

.card:hover {
  border-color: var(--border-muted);
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
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-disabled);
  margin-bottom: var(--space-2);
  font-weight: 600;
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
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.03em;
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

/* Update Animations */
@keyframes flash-green {
  0% { background-color: var(--success-muted); }
  100% { background-color: transparent; }
}

@keyframes text-flash {
  0% { color: #fff; }
  100% { color: inherit; }
}

.updated { animation: flash-green 1.5s ease-out; }
.updated .metric-value,
.updated strong,
.updated .quota-val,
.updated .live-dot {
  animation: text-flash 1.5s ease-out;
}

/* ===== TABLES ===== */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

th, td {
  padding: var(--space-2) var(--space-2);
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
  background: rgba(255, 255, 255, 0.02);
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

.breakdown-toggle {
  background: none;
  border: none;
  color: var(--text-disabled);
  font-size: 0.85rem;
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all 0.2s;
  line-height: 1;
}

.breakdown-toggle:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.breakdown-block.collapsed .breakdown-toggle {
  transform: rotate(180deg);
}

.breakdown-content {
  margin-top: var(--space-3);
}

/* Hot Summary */
.hot-summary {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--space-4);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  overflow: hidden;
}

.hot-row {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  gap: var(--space-4);
}

.hot-row + .hot-row {
  border-top: 1px solid var(--border);
}

.hot-row-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  font-weight: 600;
  min-width: 70px;
}

.hot-row-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  flex: 1;
}

.hot-item {
  min-width: 80px;
}

.hot-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-disabled);
  margin-bottom: var(--space-1);
}

.hot-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* Legacy hot-today support */
.hot-today {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-surface);
}

/* Count unique badge */
.unique-count {
  font-size: 0.65rem;
  color: var(--text-disabled);
  background: var(--bg-elevated);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  margin-left: var(--space-2);
}

/* ===== BUTTONS ===== */
button.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  transition: all 0.2s ease;
}

button.btn:hover {
  border-color: var(--border-muted);
  background: var(--zinc-800);
  color: var(--text-primary);
}

button.btn:active {
  transform: translateY(1px);
}

.btn-bullet {
  font-size: 1.2em;
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

/* ===== ADVANCED TOOLTIPS - GLASSMORPHISM ===== */
[data-tooltip] {
  position: relative;
  cursor: help;
}

[data-tooltip]::before,
[data-tooltip]::after {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  pointer-events: none;
  z-index: 100;
}

[data-tooltip]::after {
  content: attr(data-tooltip);
  bottom: calc(100% + 10px);
  padding: var(--space-2) var(--space-3);
  background: rgba(24, 24, 27, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-muted);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 400;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  max-width: 280px;
  text-align: center;
}

[data-tooltip]::before {
  content: '';
  bottom: calc(100% + 4px);
  border: 6px solid transparent;
  border-top-color: var(--border-muted);
}

[data-tooltip]:hover::before,
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
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.danger-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #f87171;
  margin: 0;
}

.danger-subtitle {
  font-size: 0.75rem;
  color: var(--text-disabled);
  margin: var(--space-1) 0 0;
}

.danger-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) 0;
  border-bottom: 1px solid rgba(127, 29, 29, 0.2);
}

.danger-row:last-child {
  border-bottom: none;
}

.danger-desc {
  font-size: 0.85rem;
  color: #fecaca;
  font-weight: 500;
}

.danger-sub {
  font-size: 0.7rem;
  color: var(--text-disabled);
  margin-top: var(--space-1);
}

.btn-danger {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(127, 29, 29, 0.5);
  background: rgba(127, 29, 29, 0.15);
  color: #fca5a5;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-danger:hover {
  background: rgba(153, 27, 27, 0.25);
  border-color: rgba(153, 27, 27, 0.7);
}

.btn-danger:active {
  transform: translateY(1px);
}

/* Danger grid (legacy) */
.danger-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.danger-card {
  padding: var(--space-3);
  border-radius: var(--radius);
  border: 1px solid rgba(127, 29, 29, 0.3);
  background: rgba(127, 29, 29, 0.05);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.danger-btn {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(127, 29, 29, 0.4);
  background: rgba(127, 29, 29, 0.1);
  color: #fca5a5;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  transition: all 0.2s ease;
}

.danger-btn:hover {
  background: rgba(153, 27, 27, 0.2);
  border-color: rgba(153, 27, 27, 0.6);
}

.danger-btn:active {
  transform: translateY(1px);
}

.danger-btn-icon { font-size: 1rem; }

.danger-status-hint {
  font-size: 0.75rem;
  color: #fecaca;
  margin-top: var(--space-1);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.danger-status-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.65rem;
  color: var(--text-disabled);
}

.danger-status-value {
  font-weight: 600;
}

.danger-status-value.enabled { color: #86efac; }
.danger-status-value.disabled { color: #fecaca; }

.danger-chip {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  border: 1px solid rgba(248, 113, 113, 0.5);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(127, 29, 29, 0.4);
}

/* Raw Output */
.raw-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--text-muted);
  transition: color 0.2s;
}

.raw-toggle:hover {
  color: var(--text-secondary);
}

.raw-output {
  margin-top: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--bg);
  border: 1px solid var(--border);
  font-size: 0.7rem;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-muted);
  max-height: 400px;
  overflow-y: auto;
}

/* Code Block */
.code-block {
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 0.75rem;
  background: var(--bg);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  color: var(--text-muted);
  word-break: break-all;
  user-select: all;
}

.code-block:hover {
  color: var(--text-secondary);
  border-color: var(--border-muted);
}

.code-block-large {
  display: block;
  margin-top: var(--space-2);
  max-height: 280px;
  overflow: auto;
  padding: var(--space-3);
}

/* Quota Panel */
.quota-panel {
  background: var(--bg-surface);
  border-radius: var(--radius);
  padding: var(--space-4);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.quota-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) 0;
}

.quota-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.quota-val {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(9, 9, 11, 0.9);
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
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  position: relative;
  transform: scale(0.95);
  transition: transform 0.2s;
}

.modal-overlay.open .modal {
  transform: scale(1);
}

.modal h3 {
  margin: 0 0 var(--space-4);
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.modal-section {
  margin-top: var(--space-4);
}

.modal-section h4 {
  font-size: 0.7rem;
  color: var(--text-disabled);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border);
}

.modal-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--bg-surface);
}

.modal-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0 var(--space-3);
}

.close-modal {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.25rem;
  padding: var(--space-1);
  line-height: 1;
}

.close-modal:hover {
  color: var(--text-primary);
}

/* Auth */
.auth-bar {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.auth-input {
  background: var(--bg);
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: #fca5a5;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  outline: none;
  transition: all 0.2s;
}

.auth-input:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
}

.auth-btn {
  padding: var(--space-2) var(--space-3);
  font-size: 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: transparent;
  color: #fca5a5;
  cursor: pointer;
  transition: all 0.2s;
}

.auth-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* External Links */
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

/* Donut Chart */
.donut-chart {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.donut-chart-center {
  position: absolute;
  width: 52px;
  height: 52px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.donut-chart-percent {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--success);
}

.donut-chart-label {
  font-size: 0.5rem;
  color: var(--text-disabled);
  text-transform: uppercase;
}

.totals-with-chart {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

/* Version Pills */
.cqd-brand-version {
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-muted);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: 0.7rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cqd-brand-version:hover {
  background: rgba(59, 130, 246, 0.25);
}

.cqd-pill-minor {
  background: var(--accent) !important;
  color: #fff !important;
}

.cqd-pill-major {
  background: var(--danger) !important;
  color: #fff !important;
}

.cqd-effect-glow-blue {
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.4) !important;
}

.cqd-effect-glow-red {
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.4) !important;
}

@keyframes pulse-blue {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
}

.cqd-effect-pulse-blue { animation: pulse-blue 2s infinite; }

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
}

.cqd-effect-pulse-red { animation: pulse-red 2s infinite; }

/* Release Manager */
.cl-history-item {
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: var(--space-3);
  transition: all 0.2s ease;
}

.cl-history-item:hover {
  border-color: var(--border-muted);
}

.cl-history-item.editing {
  border-color: var(--warning);
  background: var(--warning-muted);
}

.cl-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.cl-history-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.cl-version-badge {
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}

.cl-date {
  font-size: 0.75rem;
  color: var(--text-disabled);
}

.cl-actions {
  display: flex;
  gap: var(--space-2);
  opacity: 0;
  transition: opacity 0.2s;
}

.cl-history-item:hover .cl-actions {
  opacity: 1;
}

.cl-action-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.cl-action-btn:hover {
  background: var(--zinc-800);
  color: var(--text-primary);
}

.cl-action-btn.edit-cl-btn:hover {
  border-color: var(--accent);
  color: #60a5fa;
}

.cl-action-btn.delete-cl-btn:hover {
  border-color: var(--danger);
  color: #f87171;
}

.cl-changes-list {
  margin: 0;
  padding-left: var(--space-4);
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.cl-changes-list li {
  margin-bottom: var(--space-1);
}

.cl-empty-state {
  text-align: center;
  padding: var(--space-10) var(--space-5);
  color: var(--text-disabled);
}

.cl-empty-state p {
  margin: var(--space-3) 0 var(--space-1);
  font-size: 1rem;
  color: var(--text-muted);
}

.cl-empty-state span {
  font-size: 0.85rem;
}

.edit-mode-banner {
  display: none;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--warning-muted);
  border: 1px solid var(--warning);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-4);
}

.edit-mode-banner.active {
  display: flex;
}

.edit-mode-banner svg {
  color: var(--warning);
}

.edit-mode-banner .edit-mode-text {
  flex: 1;
  font-size: 0.85rem;
  color: #fbbf24;
}

.edit-mode-banner .edit-mode-text strong {
  color: #fcd34d;
}

.btn-cancel-edit {
  padding: var(--space-1) var(--space-3);
  font-size: 0.8rem;
  background: transparent;
  border: 1px solid rgba(245, 158, 11, 0.5);
  color: #fbbf24;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel-edit:hover {
  background: rgba(245, 158, 11, 0.15);
}

/* Character Counter */
.textarea-wrapper {
  position: relative;
}

.char-counter {
  position: absolute;
  bottom: var(--space-2);
  right: var(--space-3);
  font-size: 0.65rem;
  color: var(--text-disabled);
  pointer-events: none;
}

.char-counter.warning { color: var(--warning); }
.char-counter.error { color: var(--danger); }

/* Loading State */
.btn-loading {
  position: relative;
  pointer-events: none;
  opacity: 0.7;
}

.btn-loading::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
  margin-left: var(--space-2);
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
  padding: 0 var(--space-2);
  font-size: 0.7rem;
  font-weight: 600;
  background: var(--accent-muted);
  color: #60a5fa;
  border-radius: var(--radius-full);
  margin-left: var(--space-2);
}

/* Unsaved Changes */
.unsaved-dot {
  display: none;
  width: 8px;
  height: 8px;
  background: var(--warning);
  border-radius: var(--radius-full);
  margin-left: var(--space-2);
  animation: pulse-orange 2s infinite;
}

.unsaved-dot.active {
  display: inline-block;
}

@keyframes pulse-orange {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Rule Preview */
.rule-preview-mini {
  display: inline-block;
  font-size: 0.6rem;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  margin-left: var(--space-2);
}

/* Form Elements */
.field-row { margin-bottom: var(--space-3); }

.input-sm {
  padding: var(--space-2) var(--space-3);
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  width: 100%;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.input-sm:focus {
  border-color: var(--border-muted);
  outline: none;
}

.input-area {
  padding: var(--space-3);
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  width: 100%;
  height: 100px;
  resize: vertical;
  font-size: 0.85rem;
  font-family: inherit;
  transition: all 0.2s;
}

.input-area:focus {
  border-color: var(--border-muted);
  outline: none;
}

/* Changelog Styles */
.cl-ver { font-weight: 700; color: var(--accent); }
.cl-changes { padding-left: var(--space-4); margin: 0; color: var(--text-secondary); }
.cl-changes li { margin-bottom: var(--space-1); }
.btn-xs {
  padding: var(--space-1) var(--space-2);
  font-size: 0.7rem;
  border-radius: var(--radius-sm);
  background: var(--danger-muted);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
  cursor: pointer;
  transition: all 0.2s;
}
.btn-xs:hover { background: rgba(239, 68, 68, 0.15); }

/* ===== RESPONSIVE ===== */
@media (max-width: 1024px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  body {
    padding: var(--space-4);
  }
  
  header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }
  
  .header-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .grid-4,
  .grid-3 {
    grid-template-columns: 1fr;
  }
  
  .split-section {
    grid-template-columns: 1fr;
  }
  
  .danger-grid {
    grid-template-columns: 1fr;
  }
  
  .card {
    padding: var(--space-4);
  }
  
  .metric-value {
    font-size: 1.5rem;
  }
  
  .hot-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  
  .hot-row-items {
    width: 100%;
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
    flex-direction: column;
    width: 100%;
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
    padding: var(--space-3);
  }
  
  .title-block h1 {
    font-size: 1.125rem;
  }
  
  .card {
    padding: var(--space-3);
  }
  
  .metric-value {
    font-size: 1.25rem;
  }
}
`;

export const LOGIN_STYLES = `
:root {
  color-scheme: dark;
  --bg: #09090b;
  --bg-elevated: #18181b;
  --border: #27272a;
  --accent: #3b82f6;
  --text-primary: #f4f4f5;
  --text-muted: #71717a;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  min-height: 100vh;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  -webkit-font-smoothing: antialiased;
}

.login-card {
  width: 100%;
  max-width: 360px;
  border-radius: 16px;
  padding: 32px 28px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}

.login-title {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.login-subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.login-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.login-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: var(--accent);
}

.login-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  margin: 0;
}

.field input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s;
}

.field input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.login-error {
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 0.8rem;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.login-button {
  padding: 12px 20px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  background: var(--accent);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  white-space: nowrap;
}

.login-button:hover {
  background: #2563eb;
}

.login-button:active {
  transform: translateY(1px);
}
`;
