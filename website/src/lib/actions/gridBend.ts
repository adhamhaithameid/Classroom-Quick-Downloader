import { BEND_DEFAULTS, DPR_CAP, FOLLOW, GRID_PITCH, SAMPLE_PX, bendOffset } from '../grid/bendField';

/* Settle thresholds: once cursor catch-up and influence easing drop below
   these, the loop snaps to the exact rest frame and stops — zero idle cost. */
const CATCHUP_PX = 0.1;
const INFLUENCE_EPS = 0.001;
const LEAVE_EASE = 0.88;

/**
 * Paints the 60px engineering grid on a viewport-fixed canvas and bends the
 * lines gently around a fine pointer. Activation is gated on
 * `(pointer: fine)` and no `(prefers-reduced-motion: reduce)` — when the
 * gates fail the canvas never renders and the page keeps the static CSS
 * grid. While active the canvas replaces the wrapper's gradient via the
 * `bend-live` class on `canvas.parentElement`; the wrapper's own
 * `opacity: 0.05` composites the strokes, so none is set here.
 *
 * House conventions: passive listeners, no per-event layout reads, cursor
 * smoothing is frame-rate independent, and the rAF loop fully stops once
 * the field settles.
 */
export function gridBend(canvas: HTMLCanvasElement): { destroy(): void } {
  const finePointer = window.matchMedia('(pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ctx = canvas.getContext('2d');
  let stroke = '#1a1a2e';
  let vw = 0;
  let vh = 0;
  let active = false;
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
    } else {
      // Snap to the exact rest frame so the settled grid is pixel-true.
      smoothX = targetX;
      smoothY = targetY;
      influence = inside ? 1 : 0;
      draw();
    }
  }

  function startLoop(): void {
    if (!active || raf || document.hidden) return;
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
    targetX = event.clientX;
    targetY = event.clientY;
    inside = true;
    if (!seenPointer) {
      // First contact initializes the smoothed position: no swoosh from (0, 0).
      seenPointer = true;
      smoothX = targetX;
      smoothY = targetY;
    }
    startLoop();
  }

  function onLeave(): void {
    inside = false;
    startLoop();
  }

  function onScroll(): void {
    dirty = true;
    startLoop();
  }

  function onResize(): void {
    size();
    startLoop();
  }

  function onVisibility(): void {
    if (document.hidden) stopLoop();
    else startLoop();
  }

  function onGatesChange(): void {
    if (gatesPass()) {
      if (!active) activate();
    } else if (active) {
      deactivate();
    }
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

  if (gatesPass()) activate();
  finePointer.addEventListener?.('change', onGatesChange);
  reducedMotion.addEventListener?.('change', onGatesChange);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  document.addEventListener('visibilitychange', onVisibility);

  return {
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
