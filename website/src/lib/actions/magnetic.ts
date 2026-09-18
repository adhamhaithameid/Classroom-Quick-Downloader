import {
  HOVER_LIFT_PX,
  HOVER_SCALE,
  MAGNETIC_DEFAULTS,
  pullTarget,
  springConverged,
  springStep,
  type MagneticParams,
  type SpringState
} from '../motion/magneticField';

/* Magnetic hover for primary green CTAs: the button eases toward a fine
   pointer that comes near it, then glides home. Feel is locked to the
   approved "Subtle" prototype (MAGNETIC_DEFAULTS + the hover constants in
   magneticField); label-depth parallax was explicitly rejected.

   House conventions, mirroring gridBend.ts: gated on `(pointer: fine)` and
   no `(prefers-reduced-motion: reduce)` with live response to gate changes;
   one shared passive window pointermove listener for every registered button
   (never per-element listeners, never per-event layout reads — rects are
   cached and refreshed on scroll/resize); a self-stopping rAF loop so idle
   cost is zero — including while the pointer sits parked inside the radius,
   where the button rests at its target and the loop only wakes on the next
   pointermove, scroll, or gate change; full cleanup on destroy.

   While engaged the action owns the inline transform (including the -2px
   hover lift the CSS :hover rule would otherwise provide) and tags the node
   with `magnetic-live`, which app.css uses to drop `transform` out of the
   CSS transition list so per-frame writes are not lagged. On release the
   spring glides home, the inline style and class are cleared, and CSS hover
   works exactly as before. */

const MAX_DT = 1 / 30;

interface Entry {
  node: HTMLElement;
  rect: DOMRect | null;
  state: SpringState;
  target: { x: number; y: number };
  engaged: boolean;
  /* Spring has arrived at the target while engaged: styles rest at the
     pulled position and the loop skips this entry until the target moves. */
  parked: boolean;
  enabled: boolean;
}

const entries = new Set<Entry>();
const params: MagneticParams = MAGNETIC_DEFAULTS;

let listening = false;
let running = false;
let rectsDirty = true;
let lastTime = 0;
let pointerX = -1e4;
let pointerY = -1e4;
let wakeRaf = 0;

/* Resolved lazily on first action mount, never at module import: this module
   loads during SSR renders too (node has no `window`), and the house pattern
   keeps matchMedia out of import side effects. */
let finePointer: MediaQueryList | null = null;
let reducedMotion: MediaQueryList | null = null;
let gatesResolved = false;

function resolveGates(): void {
  if (gatesResolved) return;
  gatesResolved = true;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    finePointer = window.matchMedia('(pointer: fine)');
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    finePointer.addEventListener('change', applyGates);
    reducedMotion.addEventListener('change', applyGates);
  }
}

const gatesPass = (): boolean => Boolean(finePointer?.matches) && !Boolean(reducedMotion?.matches);

function clearStyles(entry: Entry): void {
  entry.node.style.transform = '';
  entry.node.classList.remove('magnetic-live');
}

function resetEntry(entry: Entry): void {
  entry.state.x = 0;
  entry.state.y = 0;
  entry.state.vx = 0;
  entry.state.vy = 0;
  entry.target.x = 0;
  entry.target.y = 0;
  entry.engaged = false;
  entry.parked = false;
  clearStyles(entry);
}

function writeTransform(entry: Entry, lift: number, scale: number): void {
  entry.node.style.transform = `translate3d(${entry.state.x.toFixed(2)}px, ${(
    entry.state.y + lift
  ).toFixed(2)}px, 0) scale(${scale})`;
  entry.node.classList.add('magnetic-live');
}

function refreshRects(): void {
  for (const entry of entries) {
    if (entry.enabled) entry.rect = entry.node.getBoundingClientRect();
  }
  rectsDirty = false;
}

function retarget(): void {
  for (const entry of entries) {
    if (!entry.enabled || !entry.rect) continue;
    const pull = pullTarget(entry.rect, pointerX, pointerY, params);
    if (pull.x !== entry.target.x || pull.y !== entry.target.y || pull.engaged !== entry.engaged) {
      entry.parked = false;
      entry.target.x = pull.x;
      entry.target.y = pull.y;
      entry.engaged = pull.engaged;
    }
  }
}

function frame(now: number): void {
  if (rectsDirty) refreshRects();
  retarget();
  const dt = Math.min((now - lastTime) / 1000 || 1 / 60, MAX_DT);
  lastTime = now;
  let live = false;

  for (const entry of entries) {
    if (!entry.enabled || entry.parked) continue;
    if (springConverged(entry.state, entry.target)) {
      // Snap to the exact rest frame. Engaged buttons park here with the
      // hover lift applied (styles stay until retarget unparks them);
      // released ones clear inline styles so CSS hover resumes.
      entry.state.x = entry.target.x;
      entry.state.y = entry.target.y;
      entry.state.vx = 0;
      entry.state.vy = 0;
      if (entry.engaged) {
        entry.parked = true;
        writeTransform(entry, HOVER_LIFT_PX, HOVER_SCALE);
      } else {
        clearStyles(entry);
      }
      continue;
    }
    entry.state = springStep(entry.state, entry.target, params, dt);
    writeTransform(entry, entry.engaged ? HOVER_LIFT_PX : 0, entry.engaged ? HOVER_SCALE : 1);
    live = true;
  }

  if (live) {
    requestAnimationFrame(frame);
  } else {
    running = false;
  }
}

function wake(): void {
  if (!gatesPass() || running || entries.size === 0) return;
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(frame);
}

function onPointerMove(event: PointerEvent): void {
  pointerX = event.clientX;
  pointerY = event.clientY;
  wake();
}

function release(): void {
  pointerX = -1e4;
  pointerY = -1e4;
  wake(); // let springs glide home, then the loop stops itself
}

function onScrollOrResize(): void {
  rectsDirty = true;
  if (wakeRaf) return;
  wakeRaf = requestAnimationFrame(() => {
    wakeRaf = 0;
    wake();
  });
}

function bind(): void {
  if (listening) return;
  listening = true;
  rectsDirty = true;
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  document.documentElement.addEventListener('pointerleave', release);
  window.addEventListener('blur', release);
}

function unbind(): void {
  if (!listening) return;
  listening = false;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('scroll', onScrollOrResize);
  window.removeEventListener('resize', onScrollOrResize);
  document.documentElement.removeEventListener('pointerleave', release);
  window.removeEventListener('blur', release);
  if (wakeRaf) {
    cancelAnimationFrame(wakeRaf);
    wakeRaf = 0;
  }
  running = false;
  release();
  for (const entry of entries) resetEntry(entry);
}

function applyGates(): void {
  resolveGates();
  if (gatesPass()) bind();
  else unbind();
}

/**
 * Svelte action: `<a use:magnetic>` or conditionally `use:magnetic={enabled}`
 * (the hero loops pass the detected-browser test so only the green variant
 * pulls, and the uninstall submit disables while sending). A disabled or
 * re-enabled update is handled live.
 */
export function magnetic(
  node: HTMLElement,
  enabled = true
): { update(next: boolean): void; destroy(): void } {
  const entry: Entry = {
    node,
    rect: null,
    state: { x: 0, y: 0, vx: 0, vy: 0 },
    target: { x: 0, y: 0 },
    engaged: false,
    parked: false,
    enabled
  };
  entries.add(entry);
  if (entry.enabled) {
    rectsDirty = true;
    applyGates();
  }

  return {
    update(next: boolean): void {
      if (next === entry.enabled) return;
      entry.enabled = next;
      if (next) {
        rectsDirty = true;
        applyGates();
      } else {
        resetEntry(entry);
      }
    },
    destroy(): void {
      entry.enabled = false;
      resetEntry(entry);
      entries.delete(entry);
      if (entries.size === 0) unbind();
    }
  };
}
