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
`;
