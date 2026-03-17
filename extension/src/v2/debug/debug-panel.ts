// filepath: extension/src/v2/debug/debug-panel.ts
/**
 * ============================================================================
 * DEBUG PANEL — In-Page V2 Decision Viewer
 * ============================================================================
 *
 * A draggable overlay injected into the page that shows:
 * 1. Engine state: mode, active engines, view kind
 * 2. Flag decisions: per-post verdict, scores, confidence
 * 3. Shadow comparison: mismatch count and details
 * 4. Performance: scan count, average scan time
 *
 * ACTIVATION:
 * - Set cqdDebugPanel=true in chrome.storage.local
 * - Or run: window.__CQD_DEBUG_PANEL_TOGGLE?.()
 * - Or press Ctrl+Shift+D on a Classroom page
 *
 * The panel auto-refreshes every 5 seconds to show live data.
 * It does NOT affect flag detection or rendering — it's read-only.
 *
 * @author Adham — the debugging surface from plan2.md A5/D4
 * @since v4.0.0
 */

import { engineRegistry } from '../../engines/engine-registry';
import { orchestrator } from '../orchestrator/orchestrator';

// ============================================================================
// CONSTANTS
// ============================================================================

const PANEL_ID = 'cqd-debug-panel';
const STORAGE_KEY = 'cqdDebugPanel';
const REFRESH_INTERVAL = 5_000;

// ============================================================================
// STYLES
// ============================================================================

const PANEL_STYLES = `
  #${PANEL_ID} {
    position: fixed;
    bottom: 16px;
    right: 16px;
    width: 420px;
    max-height: 70vh;
    background: rgba(15, 15, 25, 0.95);
    color: #e0e0e0;
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 11px;
    line-height: 1.5;
    border: 1px solid rgba(100, 100, 255, 0.3);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(100, 100, 255, 0.1);
    z-index: 999999;
    overflow: auto;
    backdrop-filter: blur(20px);
    scrollbar-width: thin;
    scrollbar-color: rgba(100, 100, 255, 0.3) transparent;
  }
  #${PANEL_ID} * { box-sizing: border-box; }
  #${PANEL_ID}-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: linear-gradient(135deg, rgba(60, 60, 180, 0.3), rgba(40, 40, 100, 0.3));
    border-bottom: 1px solid rgba(100, 100, 255, 0.2);
    border-radius: 12px 12px 0 0;
    cursor: move;
    user-select: none;
  }
  #${PANEL_ID}-header h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: #a0a0ff;
    letter-spacing: 0.5px;
  }
  #${PANEL_ID}-close {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 16px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  #${PANEL_ID}-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
  #${PANEL_ID}-body { padding: 10px 14px; }
  .cqd-dbg-section {
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .cqd-dbg-section:last-child { border-bottom: none; margin-bottom: 0; }
  .cqd-dbg-label {
    font-size: 10px;
    font-weight: 700;
    color: #7a7aff;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .cqd-dbg-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
  }
  .cqd-dbg-key { color: #999; }
  .cqd-dbg-val { color: #e0e0e0; font-weight: 500; }
  .cqd-dbg-val.good { color: #4caf50; }
  .cqd-dbg-val.warn { color: #ff9800; }
  .cqd-dbg-val.bad { color: #f44336; }
  .cqd-dbg-flag {
    padding: 4px 8px;
    margin: 2px 0;
    background: rgba(255,255,255,0.03);
    border-radius: 6px;
    border-left: 3px solid transparent;
  }
  .cqd-dbg-flag.comment { border-left-color: #2196F3; }
  .cqd-dbg-flag.edited { border-left-color: #FF9800; }
  .cqd-dbg-flag.both { border-left-color: #9C27B0; }
  .cqd-dbg-flag.none { border-left-color: #444; opacity: 0.5; }
`;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// PANEL CLASS
// ============================================================================

export class DebugPanel {
  private panelEl: HTMLElement | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private visible = false;

  /**
   * Toggle panel visibility.
   */
  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Show the debug panel.
   */
  show(): void {
    if (this.panelEl) {
      this.panelEl.style.display = 'block';
      this.visible = true;
      this.startRefresh();
      return;
    }

    this.createPanel();
    this.visible = true;
    this.startRefresh();
    this.refresh();
  }

  /**
   * Hide the debug panel.
   */
  hide(): void {
    if (this.panelEl) {
      this.panelEl.style.display = 'none';
    }
    this.visible = false;
    this.stopRefresh();
  }

  /**
   * Destroy the panel completely.
   */
  destroy(): void {
    this.stopRefresh();
    this.panelEl?.remove();
    this.panelEl = null;
    this.visible = false;

    // Remove style element
    document.getElementById(`${PANEL_ID}-styles`)?.remove();
  }

  // ========================================================================
  // PANEL CREATION
  // ========================================================================

  private createPanel(): void {
    // Inject styles
    if (!document.getElementById(`${PANEL_ID}-styles`)) {
      const style = document.createElement('style');
      style.id = `${PANEL_ID}-styles`;
      style.textContent = PANEL_STYLES;
      document.head.appendChild(style);
    }

    // Create panel
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div id="${PANEL_ID}-header">
        <h3>🔍 CQD Debug Panel</h3>
        <button id="${PANEL_ID}-close" title="Close">&times;</button>
      </div>
      <div id="${PANEL_ID}-body">Loading...</div>
    `;

    document.body.appendChild(panel);
    this.panelEl = panel;

    // Close button
    panel.querySelector(`#${PANEL_ID}-close`)?.addEventListener('click', () => {
      this.hide();
    });

    // Make draggable
    this.makeDraggable(panel);
  }

  private makeDraggable(panel: HTMLElement): void {
    const header = panel.querySelector(`#${PANEL_ID}-header`) as HTMLElement;
    if (!header) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let origRight = 16, origBottom = 16;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      origRight = window.innerWidth - rect.right;
      origBottom = window.innerHeight - rect.bottom;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.right = `${Math.max(0, origRight - dx)}px`;
      panel.style.bottom = `${Math.max(0, origBottom - dy)}px`;
    });

    document.addEventListener('mouseup', () => { isDragging = false; });
  }

  // ========================================================================
  // REFRESH
  // ========================================================================

  private startRefresh(): void {
    this.stopRefresh();
    this.refreshTimer = setInterval(() => this.refresh(), REFRESH_INTERVAL);
  }

  private stopRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Refresh the panel content with current engine state.
   */
  refresh(): void {
    if (!this.panelEl) return;

    const body = this.panelEl.querySelector(`#${PANEL_ID}-body`);
    if (!body) return;

    const mode = engineRegistry.getMode();
    const activeEngines = orchestrator.getActiveEngines();
    const currentView = orchestrator.getCurrentView();
    const v2Engine = engineRegistry.getEngine('engine-v2');
    const shadowReport = orchestrator.getShadowReport();

    let html = '';
    const safeMode = escapeHtml(mode);
    const safeCurrentView = escapeHtml(currentView || 'none');
    const safeActiveEngines = escapeHtml(
      activeEngines.map((e) => `${e.name} v${e.version}`).join(', ') || 'none',
    );

    // --- Engine State Section ---
    html += `
      <div class="cqd-dbg-section">
        <div class="cqd-dbg-label">Engine State</div>
        <div class="cqd-dbg-row">
          <span class="cqd-dbg-key">Mode</span>
          <span class="cqd-dbg-val ${mode === 'shadow' ? 'warn' : mode === 'v2' ? 'good' : ''}">${safeMode}</span>
        </div>
        <div class="cqd-dbg-row">
          <span class="cqd-dbg-key">View</span>
          <span class="cqd-dbg-val">${safeCurrentView}</span>
        </div>
        <div class="cqd-dbg-row">
          <span class="cqd-dbg-key">Active Engines</span>
          <span class="cqd-dbg-val">${safeActiveEngines}</span>
        </div>
      </div>
    `;

    // --- Shadow Comparison Section ---
    if (mode === 'shadow' && shadowReport) {
      const matchClass = shadowReport.matchPercentage >= 95 ? 'good' :
                         shadowReport.matchPercentage >= 80 ? 'warn' : 'bad';
      html += `
        <div class="cqd-dbg-section">
          <div class="cqd-dbg-label">Shadow Comparison</div>
          <div class="cqd-dbg-row">
            <span class="cqd-dbg-key">Match Rate</span>
            <span class="cqd-dbg-val ${matchClass}">${shadowReport.matchPercentage.toFixed(1)}%</span>
          </div>
          <div class="cqd-dbg-row">
            <span class="cqd-dbg-key">Posts Analyzed</span>
            <span class="cqd-dbg-val">${shadowReport.postsAnalyzed}</span>
          </div>
          <div class="cqd-dbg-row">
            <span class="cqd-dbg-key">Mismatches</span>
            <span class="cqd-dbg-val ${shadowReport.mismatchCount > 0 ? 'bad' : 'good'}">${shadowReport.mismatchCount}</span>
          </div>
          <div class="cqd-dbg-row">
            <span class="cqd-dbg-key">Duration</span>
            <span class="cqd-dbg-val">${shadowReport.duration_ms}ms</span>
          </div>
        </div>
      `;
    }

    // --- V2 Flag Decisions Section ---
    if (v2Engine) {
      const flagDecisions = v2Engine.getFlagDecisions();
      const trackedPosts = v2Engine.getTrackedPosts();

      html += `
        <div class="cqd-dbg-section">
          <div class="cqd-dbg-label">V2 Flags (${flagDecisions.length} decisions, ${trackedPosts.length} posts)</div>
      `;

      if (flagDecisions.length === 0) {
        html += `<div style="color: #666; font-style: italic;">No flag decisions yet</div>`;
      } else {
        // Show at most 10 flag decisions
        const shown = flagDecisions.slice(0, 10);
        for (const decision of shown) {
          const verdictClass = decision.finalVerdict === 'both' ? 'both' :
                              decision.finalVerdict === 'comment' ? 'comment' :
                              decision.finalVerdict === 'edited' ? 'edited' : 'none';
          const safePostId = escapeHtml(`${decision.postId.slice(0, 12)}…`);
          const safeVerdict = escapeHtml(decision.finalVerdict);
          const safeCommentScore = escapeHtml(decision.commentScore);
          const safeEditedScore = escapeHtml(decision.editedScore);
          const safeConfidence = escapeHtml(decision.confidence);
          html += `
            <div class="cqd-dbg-flag ${verdictClass}">
              <div class="cqd-dbg-row">
                <span class="cqd-dbg-key">${safePostId}</span>
                <span class="cqd-dbg-val">${safeVerdict}</span>
              </div>
              <div class="cqd-dbg-row" style="font-size: 10px; opacity: 0.7;">
                <span>C:${safeCommentScore} E:${safeEditedScore}</span>
                <span>conf: ${safeConfidence}</span>
              </div>
            </div>
          `;
        }
        if (flagDecisions.length > 10) {
          html += `<div style="color: #666; text-align: center;">+${flagDecisions.length - 10} more</div>`;
        }
      }

      html += `</div>`;
    }

    // --- V2 Performance Section ---
    if (v2Engine) {
      const posts = v2Engine.getTrackedPosts();
      const placements = v2Engine.getPlacementDecisions();

      html += `
        <div class="cqd-dbg-section">
          <div class="cqd-dbg-label">V2 Model</div>
          <div class="cqd-dbg-row">
            <span class="cqd-dbg-key">Tracked Posts</span>
            <span class="cqd-dbg-val">${posts.length}</span>
          </div>
          <div class="cqd-dbg-row">
            <span class="cqd-dbg-key">Total Files</span>
            <span class="cqd-dbg-val">${posts.reduce((sum, p) => sum + p.files.length, 0)}</span>
          </div>
          <div class="cqd-dbg-row">
            <span class="cqd-dbg-key">Placements</span>
            <span class="cqd-dbg-val">${placements.length}</span>
          </div>
        </div>
      `;
    }

    body.innerHTML = html;
  }
}

// ============================================================================
// SINGLETON & GLOBAL TOGGLE
// ============================================================================

export const debugPanel = new DebugPanel();

/**
 * Initialize the debug panel.
 * Reads cqdDebugPanel from storage and sets up keyboard shortcut.
 */
export async function initDebugPanel(): Promise<void> {
  // Check storage for auto-show
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY] === true) {
        debugPanel.show();
      }
    }
  } catch {
    // Ignore storage errors
  }

  // Keyboard shortcut: Ctrl+Shift+D
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      debugPanel.toggle();
    }
  });

  // Global toggle function for console access
  (window as any).__CQD_DEBUG_PANEL_TOGGLE = () => debugPanel.toggle();
  (window as any).__CQD_DEBUG_PANEL = debugPanel;
}
