/**
 * ============================================================================
 * PAGE CELEBRATION OVERLAY — milestone banner + confetti on Classroom pages
 * (1.9.1 page celebrations)
 * ============================================================================
 *
 * The popup plays the celebration for cqd_download_stats_v1's
 * milestonePending; this module plays the same one celebration over the
 * active Classroom tab. The overlay is garnish: it must never block or break
 * the host page.
 *
 *  - The confetti canvas rides the shared fireConfettiBurst() (aria-hidden,
 *    pointer-events:none, ~1.5-2.5s of physics, self-removing).
 *  - The banner is a small bottom-corner card: role=status aria-live=polite,
 *    a close button, Esc closes, auto-dismiss after PAGE_BANNER_DISMISS_MS.
 *    The positioning layer is pointer-events:none so Classroom stays
 *    clickable everywhere; only the card itself is interactive.
 *  - Injected-style conventions: one <style id="cqd-celebration-style">
 *    carrying cqd-celebration-* classes only. The entrance animation
 *    collapses under the OS prefers-reduced-motion media query AND the
 *    extension's mirrored .cqd-reduce-motion class on <html> (the same
 *    double gate every CQD sheet uses).
 */

import { fireConfettiBurst } from './confetti';
import { formatMilestoneCount, levelFor } from '../history/download-stats';

export const PAGE_BANNER_DISMISS_MS = 6000;

const SHEET_ID = 'cqd-celebration-style';

/**
 * The popup's toast copy contract, reused verbatim: level 1 is singular,
 * every other rung names the level and the compact count.
 */
export function pageBannerCopy(milestone: number): string {
  return milestone === 1
    ? 'Level 1 reached — first file downloaded!'
    : `Level ${levelFor(milestone)} reached — ${formatMilestoneCount(milestone)} files!`;
}

const CELEBRATION_SHEET = `
  .cqd-celebration-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 2147483647;
  }
  .cqd-celebration-banner {
    position: absolute;
    right: 16px;
    bottom: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-sizing: border-box;
    max-width: 320px;
    padding: 10px 12px;
    background: #ffffff;
    color: #202124;
    border: 1px solid #dadce0;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(60, 64, 67, 0.25);
    font: 500 13px/1.4 'Google Sans', Roboto, Arial, sans-serif;
    text-align: left;
    pointer-events: auto;
    animation: cqd-celebration-in 240ms cubic-bezier(0.2, 0, 0, 1);
  }
  .cqd-celebration-tick {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #1a73e8;
    color: #ffffff;
    font-size: 13px;
  }
  .cqd-celebration-close {
    flex: none;
    border: none;
    background: transparent;
    color: #5f6368;
    font-size: 16px;
    line-height: 1;
    padding: 4px;
    margin: -2px -2px -2px 2px;
    border-radius: 50%;
    cursor: pointer;
  }
  .cqd-celebration-close:hover {
    background: #f1f3f4;
    color: #202124;
  }
  @keyframes cqd-celebration-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  /* Reduced motion, both gates: the OS query holds regardless of the
     extension setting; the mirrored class holds when the OS allows motion
     but the user asked the extension for calm. */
  @media (prefers-reduced-motion: reduce) {
    .cqd-celebration-banner { animation: none; }
  }
  .cqd-reduce-motion .cqd-celebration-banner { animation: none; }
`;

/** Inject the celebration sheet once per page; later calls are no-ops. */
function ensureCelebrationSheet(): void {
  if (document.getElementById(SHEET_ID)) return;
  const style = document.createElement('style');
  style.id = SHEET_ID;
  style.textContent = CELEBRATION_SHEET;
  (document.head ?? document.documentElement).appendChild(style);
}

/**
 * Play one page celebration for a milestone rung. Confetti is fired only
 * when the caller's reduced-motion double gate says so; the banner always
 * shows. Returns the dismiss fn (idempotent — the auto-dismiss timer and
 * manual dismissal share it).
 */
export function showPageCelebration(
  milestone: number,
  playConfetti: boolean,
): () => void {
  ensureCelebrationSheet();
  if (playConfetti) void fireConfettiBurst();

  const layer = document.createElement('div');
  layer.className = 'cqd-celebration-layer';

  const banner = document.createElement('div');
  banner.className = 'cqd-celebration-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  const tick = document.createElement('span');
  tick.className = 'cqd-celebration-tick';
  tick.setAttribute('aria-hidden', 'true');
  tick.textContent = '✓';

  const text = document.createElement('span');
  text.className = 'cqd-celebration-text';
  text.textContent = pageBannerCopy(milestone);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cqd-celebration-close';
  close.setAttribute('aria-label', 'Dismiss celebration');
  close.textContent = '×';

  banner.append(tick, text, close);
  layer.appendChild(banner);
  document.body.appendChild(layer);

  let dismissed = false;
  const onKeydown = (event: Event): void => {
    if ((event as KeyboardEvent).key !== 'Escape') return;
    dismiss();
  };

  function dismiss(): void {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(timer);
    document.removeEventListener('keydown', onKeydown, true);
    layer.remove();
  }

  const timer = setTimeout(dismiss, PAGE_BANNER_DISMISS_MS);
  close.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKeydown, true);

  return dismiss;
}
