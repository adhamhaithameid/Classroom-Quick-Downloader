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




`;
