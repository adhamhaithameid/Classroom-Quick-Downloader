import { BEND_DEFAULTS, DPR_CAP, FOLLOW, GRID_PITCH, SAMPLE_PX, bendOffset } from '../grid/bendField';

/* Settle thresholds: once cursor catch-up and influence easing drop below
   these, the loop snaps to the exact rest frame and stops — zero idle cost. */
const CATCHUP_PX = 0.1;
const INFLUENCE_EPS = 0.001;
const LEAVE_EASE = 0.88;

export interface GridBendParams {
  /**
   * True while the host layer is known to be invisible — occluded by the
   * sheet or behind the hidden footer window. The canvas switches off (the
   * static CSS grid stands back in) and the window listeners no-op, so a
   * hidden instance never paints. Driven by +layout.svelte's reveal state
   * through AmbientBackground's `paused` prop; Svelte calls `update` when
   * it flips.
   */
  paused?: boolean;
}

/**
 * Paints the 60px engineering grid on a viewport-fixed canvas and bends the
 * lines gently around a fine pointer. Activation is gated on
 * `(pointer: fine)` and no `(prefers-reduced-motion: reduce)` — when the
 * gates fail the canvas never renders and the page keeps the static CSS
 * grid. While active the canvas replaces the wrapper's gradient via the
 * `bend-live` class on `canvas.parentElement`; the wrapper's own
 * `opacity: 0.05` composites the strokes, so none is set here.
 *
 * Pointer-gated: the canvas only ever paints for an actual pointer — the
 * first pointermove activates it, and it deactivates again once the field
 * fully relaxes. Without a pointer there is nothing to bend around, and the
 * CSS twin paints the same grid for free; auto-activating on mount or
 * un-pause used to keep a full-viewport canvas redrawing through every
 * scroll frame of the footer reveal with the pointer parked, and end each
 * reveal with a canvas→CSS swap.
 *
 * Sleep-at-rest: once the pointer leaves and the influence fully relaxes,
 * the canvas is drawing the unbent grid — pixel-true with the CSS twin —
 * so the action deactivates and the CSS gradient scrolls for free. (On the
 * footer-window instance the CSS twin is doc-aligned via --ft-grid-y,
 * written by +layout.svelte, so that swap cannot shift the grid phase.)
 *
 * House conventions: passive listeners, no per-event layout reads, cursor
 * smoothing is frame-rate independent, and the rAF loop fully stops once
 * the field settles.
 */
export function gridBend(
  canvas: HTMLCanvasElement,
  params?: GridBendParams
): { update(params?: GridBendParams): void; destroy(): void } {
  const finePointer = window.matchMedia('(pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ctx = canvas.getContext('2d');
  let stroke = '#1a1a2e';
  let vw = 0;
  let vh = 0;
  let active = false;
  let paused = params?.paused ?? false;
  let raf = 0;
  let lastTime = 0;
  let dirty = true;
  let seenPointer = false;
  let inside = false;
  let influence = 0;
  let targetX = 0;
  let targetY = 0;
  let smoothX = 0;
  let smoothY = 0;

  const gatesPass = (): boolean => finePointer.matches && !reducedMotion.matches;

  function size(): void {
    vw = window.innerWidth;
    vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }

  function draw(): void {
    if (!ctx) return;
    const ox = window.scrollX;
    const oy = window.scrollY;
    const params = { ...BEND_DEFAULTS, strength: BEND_DEFAULTS.strength * influence };
    const cx = smoothX + ox;
    const cy = smoothY + oy;
    ctx.clearRect(0, 0, vw, vh);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;

    // Vertical lines: one path per document column, sampled down the
    // viewport. The constant axis carries the +0.5 subpixel offset so idle
    // strokes land on the same pixels as the CSS 1px gradients.
    for (let x = Math.floor(ox / GRID_PITCH) * GRID_PITCH; x <= ox + vw; x += GRID_PITCH) {
      const baseX = x - ox + 0.5;
      const lastSampleY = Math.floor(vh / SAMPLE_PX) * SAMPLE_PX;
      let lastX = baseX;
      ctx.beginPath();
      for (let py = 0; py <= lastSampleY; py += SAMPLE_PX) {
        const off = bendOffset(x, py + oy, cx, cy, params);
        lastX = baseX + (off?.dx ?? 0);
        const ly = py + (off?.dy ?? 0);
        if (py === 0) ctx.moveTo(lastX, ly);
        else ctx.lineTo(lastX, ly);
      }
      // Tail-clamp: when vh is not a SAMPLE_PX multiple, extend the stroke
      // to the exact bottom edge reusing the last sample's offset.
      if (lastSampleY < vh) ctx.lineTo(lastX, vh);
      ctx.stroke();
    }

    // Horizontal lines: one path per document row, sampled across the
    // viewport.
    for (let y = Math.floor(oy / GRID_PITCH) * GRID_PITCH; y <= oy + vh; y += GRID_PITCH) {
      const baseY = y - oy + 0.5;
      const lastSampleX = Math.floor(vw / SAMPLE_PX) * SAMPLE_PX;
      let lastY = baseY;
      ctx.beginPath();
      for (let px = 0; px <= lastSampleX; px += SAMPLE_PX) {
        const off = bendOffset(px + ox, y, cx, cy, params);
        const lx = px + (off?.dx ?? 0);
        lastY = baseY + (off?.dy ?? 0);
        if (px === 0) ctx.moveTo(lx, lastY);
        else ctx.lineTo(lx, lastY);
      }
      // Tail-clamp: when vw is not a SAMPLE_PX multiple, extend the stroke
      // to the exact right edge reusing the last sample's offset.
      if (lastSampleX < vw) ctx.lineTo(vw, lastY);
      ctx.stroke();
    }
  }

  function frame(now: number): void {
    raf = 0;
    const dt = Math.min(64, now - lastTime || 16.7);
    lastTime = now;
    const f = dt / 16.7;
    smoothX += (targetX - smoothX) * (1 - Math.pow(1 - FOLLOW, f));
    smoothY += (targetY - smoothY) * (1 - Math.pow(1 - FOLLOW, f));
    influence += ((inside ? 1 : 0) - influence) * (1 - Math.pow(LEAVE_EASE, f));
    draw();
    const catchingUp = Math.abs(targetX - smoothX) + Math.abs(targetY - smoothY) > CATCHUP_PX;
    const easing = Math.abs((inside ? 1 : 0) - influence) > INFLUENCE_EPS;
    if (dirty || catchingUp || easing) {
      dirty = false;
      raf = requestAnimationFrame(frame);
    } else if (!inside && active) {
      // Fully relaxed with the pointer gone: the canvas is painting the
      // unbent grid — identical to the CSS twin — so stand down and let
      // the CSS gradient scroll for free until the next pointer contact.
      deactivate();
    } else {
      // Snap to the exact rest frame so the settled grid is pixel-true.
      smoothX = targetX;
      smoothY = targetY;
      influence = inside ? 1 : 0;
      draw();
    }
  }

  function startLoop(): void {
    if (!active || paused || raf || document.hidden) return;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stopLoop(): void {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (paused) return;
    const woke = !active;
    if (woke) {
      if (!gatesPass() || !ctx) return;
      activate();
    }
    targetX = event.clientX;
    targetY = event.clientY;
    inside = true;
    if (!seenPointer || woke) {
      // First contact — or waking from sleep, where the old smoothed
      // position is stale — initializes at the pointer: no swoosh.
      seenPointer = true;
      smoothX = targetX;
      smoothY = targetY;
    }
    startLoop();
  }

  function onLeave(): void {
    if (paused || !active) return;
    inside = false;
    startLoop();
  }

  function onScroll(): void {
    /* A sleeping canvas paints the unbent grid; the CSS twin already
       scrolls for free, so only an active, unpaused canvas repaints. */
    if (paused || !active) return;
    dirty = true;
    startLoop();
  }

  function onResize(): void {
    if (paused || !active) return;
    size();
    startLoop();
  }

  function onVisibility(): void {
    if (document.hidden) stopLoop();
    else startLoop();
  }

  function onGatesChange(): void {
    if (paused) return;
    if (!gatesPass() && active) {
      deactivate();
    }
    /* Gates becoming passable never auto-activates: the next pointermove
       wakes the canvas (see onPointerMove). */
  }

  function activate(): void {
    if (!ctx) return; // no 2d context: never blank the grid behind the canvas
    active = true;
    canvas.style.display = 'block';
    canvas.parentElement?.classList.add('bend-live');
    stroke =
      getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1a1a2e';
    size();
    draw(); // one immediate draw makes the CSS → canvas swap seamless
    dirty = false;
    startLoop();
  }

  function deactivate(): void {
    active = false;
    stopLoop();
    canvas.parentElement?.classList.remove('bend-live');
    canvas.style.display = 'none';
  }

  function applyPaused(next: boolean): void {
    if (paused === next) return;
    paused = next;
    if (paused) {
      stopLoop();
      deactivate();
    } else {
      /* Un-pausing stays dark: without a pointer there is nothing to bend
         around, and the CSS twin paints the same grid. The next pointermove
         activates (and re-inits smoothing — no swoosh from a stale (0, 0)). */
      seenPointer = false;
    }
  }

  /* No auto-activation at mount either — pointer-gated for life. */
  finePointer.addEventListener?.('change', onGatesChange);
  reducedMotion.addEventListener?.('change', onGatesChange);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    update(next?: GridBendParams): void {
      applyPaused(next?.paused ?? false);
    },
    destroy(): void {
      deactivate();
      finePointer.removeEventListener?.('change', onGatesChange);
      reducedMotion.removeEventListener?.('change', onGatesChange);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
