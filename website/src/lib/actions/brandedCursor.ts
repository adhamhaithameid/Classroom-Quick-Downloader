/* Branded cursor pointer engine (docs/CURSOR.md).
 *
 * Svelte action mounted on the CursorLayer root. Owns the pointer loop:
 * resolves the state under the pointer, drives the layer's data-state /
 * clear class / --seek rotation, positions the whole cursor (ring and
 * icon move together — the trailing layer experiment was cut) with the
 * approved 100ms exponential lag, and animates the progress fill.
 *
 * Gates: fine-pointer + hover devices only. Touch never activates. Under
 * prefers-reduced-motion the layer still shows (the pointer is always
 * marked) but with zero lag, instant positioning and no transitions.
 * While active, html.cqd-cursor-live stands the native cursors down
 * site-wide via the app.css rule — the branded layer always marks the
 * pointer, so clicking stays exact.
 */

import {
  ACTION_SELECTOR,
  CLEAR_SELECTOR,
  CURSOR_LAG_MS,
  CURSOR_SIZE_PX,
  PROGRESS_FILL,
  RING_SELECTOR,
  SEEK_SELECTOR,
  TEXT_ACTION_SELECTOR,
  clamp01,
  easeExponential,
  resolveCursorState,
  seekAngleDeg
} from '../cursor/cursorStates';

export const CURSOR_LIVE_CLASS = 'cqd-cursor-live';
/** Progress fill loop period when some surface sets cursor: progress. */
const PROGRESS_PERIOD_MS = 2400;

interface SeekTarget {
  left: number;
  top: number;
  right: number;
  bottom: number;
  x: number;
  y: number;
}

export function brandedCursor(node: HTMLElement) {
  const fine = window.matchMedia('(pointer: fine) and (hover: hover)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const rootEl = document.documentElement;
  const pfRect = node.querySelector<SVGRectElement>('.pf-rect');

  let rafId = 0;
  let lastTs = 0;
  let px = -1;
  let py = -1;
  let cx = -1;
  let cy = -1;
  let pressed = false;
  let dirty = true;
  let sampleX = -1;
  let sampleY = -1;
  let lastState = '';
  let lastClear: boolean | null = null;
  let lastSeek = NaN;
  let targets: SeekTarget[] = [];

  function setProgress(p: number): void {
    pfRect?.setAttribute('y', String(PROGRESS_FILL.top));
    pfRect?.setAttribute('height', String(clamp01(p) * (PROGRESS_FILL.bottom - PROGRESS_FILL.top)));
  }

  function hide(): void {
    px = -1;
    py = -1;
    node.style.visibility = 'hidden';
  }

  function indexSeekTargets(): void {
    targets = [];
    for (const element of document.querySelectorAll(SEEK_SELECTOR)) {
      const r = element.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) {
        continue;
      }
      targets.push({
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        x: (Math.max(0, r.left) + Math.min(window.innerWidth, r.right)) / 2,
        y: (Math.max(0, r.top) + Math.min(window.innerHeight, r.bottom)) / 2
      });
    }
    dirty = false;
  }

  function nearestSeekTarget(): SeekTarget | null {
    let nearest: SeekTarget | null = null;
    let best = Infinity;
    for (const t of targets) {
      const dx = Math.max(t.left - px, 0, px - t.right);
      const dy = Math.max(t.top - py, 0, py - t.bottom);
      const d = Math.hypot(dx, dy);
      if (d < best) {
        best = d;
        nearest = t;
      }
    }
    return nearest;
  }

  function sample(): void {
    const element = document.elementFromPoint(px, py);
    if (!element) {
      node.style.visibility = 'hidden';
      return;
    }
    if (dirty) indexSeekTargets();

    const demo = element.closest<HTMLElement>('[data-cursor-state]');
    const action = element.closest(ACTION_SELECTOR);
    const clearer = element.closest(CLEAR_SELECTOR);
    const ringTarget = element.closest(RING_SELECTOR);
    const disabled = Boolean(action && (action.matches(':disabled') || action.closest('[inert],[aria-disabled="true"]')));
    const keyword = window.getComputedStyle(element).cursor;
    const selection = pressed ? document.getSelection() : null;
    const textSelected = Boolean(selection && !selection.isCollapsed && selection.toString().length > 0);

    const state = resolveCursorState({
      keyword,
      hasDemo: Boolean(demo),
      isAction: Boolean(action),
      isDisabled: disabled,
      isTextAction: Boolean(action?.matches(TEXT_ACTION_SELECTOR)),
      isRingTarget: Boolean(ringTarget),
      textSelected
    });

    /* Demo surfaces may carry any branded state; actions and cards clear
       the glass so the page reads through the cursor. */
    const clear = Boolean(clearer) || Boolean(action && !disabled && !demo) || state === 'pointer' || state === 'cta';

    if (state !== lastState) {
      node.setAttribute('data-state', state);
      lastState = state;
    }
    if (clear !== lastClear) {
      node.classList.toggle('clear', clear);
      lastClear = clear;
    }

    if (state === 'default' || state === 'auto') {
      const target = nearestSeekTarget();
      const seek = target && !reduced.matches ? seekAngleDeg(px, py, target.x, target.y) : 0;
      if (seek !== lastSeek) {
        node.style.setProperty('--seek', `${seek}deg`);
        lastSeek = seek;
      }
    }
  }

  function tick(ts: number): void {
    rafId = 0;
    const dt = lastTs ? Math.min(250, ts - lastTs) : 16;
    lastTs = ts;

    const moved = px !== sampleX || py !== sampleY || dirty;
    if (px >= 0) {
      if (moved) {
        sampleX = px;
        sampleY = py;
        sample();
      }

      /* Whole-cursor follow: ring and icon share one eased position. */
      const tau = reduced.matches ? 0 : CURSOR_LAG_MS;
      cx = easeExponential(cx, px, dt, tau);
      cy = easeExponential(cy, py, dt, tau);

      node.style.transform = `translate3d(${cx - CURSOR_SIZE_PX / 2}px, ${cy - CURSOR_SIZE_PX / 2}px, 0)`;
      node.style.visibility = 'visible';

      if (lastState === 'progress') {
        setProgress((ts % PROGRESS_PERIOD_MS) / PROGRESS_PERIOD_MS);
      }
    }

    if (px >= 0) rafId = requestAnimationFrame(tick);
  }

  function wake(): void {
    if (!rafId) {
      lastTs = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    px = event.clientX;
    py = event.clientY;
    if (cx < 0) {
      /* First appearance: start eased position at the pointer so the
         cursor never flies in from a stale corner. */
      cx = px;
      cy = py;
    }
    wake();
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button === 0) pressed = true;
  }

  function handlePointerUp(): void {
    pressed = false;
    /* pressed gates the selection check, so force a resample even if the
       pointer never moved — otherwise the text state would stick. */
    sampleX = -1;
    wake();
  }

  function handlePointerOut(event: PointerEvent): void {
    if (!event.relatedTarget) hide();
  }

  function handleWindowBlur(): void {
    hide();
  }

  function handleVisibilityChange(): void {
    if (document.hidden) hide();
  }

  function handleScrollOrResize(): void {
    dirty = true;
    wake();
  }

  function handleGateChange(): void {
    /* activate() re-attach is deduped by the browser (same handler refs),
       so flipping the gate on later is safe. */
    if (fine.matches) activate();
    else deactivate();
  }

  function activate(): void {
    rootEl.classList.add(CURSOR_LIVE_CLASS);
    node.style.setProperty('--cqd-cursor-size', `${CURSOR_SIZE_PX}px`);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    document.addEventListener('pointerout', handlePointerOut);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    fine.addEventListener('change', handleGateChange);
    reduced.addEventListener('change', handleGateChange);
  }

  function deactivate(): void {
    rootEl.classList.remove(CURSOR_LIVE_CLASS);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerdown', handlePointerDown);
    window.removeEventListener('pointerup', handlePointerUp);
    document.removeEventListener('pointerout', handlePointerOut);
    window.removeEventListener('blur', handleWindowBlur);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('scroll', handleScrollOrResize, { capture: true } as AddEventListenerOptions);
    window.removeEventListener('resize', handleScrollOrResize);
    fine.removeEventListener('change', handleGateChange);
    reduced.removeEventListener('change', handleGateChange);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    hide();
  }

  /* The gate decides everything: off (touch), the layer never shows and
     native cursors stay; on, the branded cursor owns the pointer. */
  if (typeof window !== 'undefined' && fine.matches) {
    activate();
  }

  return {
    destroy() {
      deactivate();
    }
  };
}
