/* ── Magnetic scroll stop ────────────────────────────────────────────────
   The pre-footer detent: scrolling into the capture band just before the
   sticky sheet pins (the page's "end") is caught and eased to the hold
   point — the sheet resting exactly at the page end with NOTHING of the
   footer showing (the last section composes as the end of the page) — and
   stays there until the user pushes ~260px of sustained scrolling more,
   which releases it into the footer reveal.

   Two catch paths, because input arrives two ways:
   - Active wheel/trackpad ticks are CANCELABLE: the first tick inside the
     band is intercepted (preventDefault) and the detent eases from there —
     this is the felt magnetic catch. While engaged, cancelable ticks are
     also prevented, so native scroll never fights the ease; their deltas
     accumulate as intent, and only a SUSTAINED push (~260px within ~250ms
     gaps) breaks out — one tick, or tick-then-pause, never releases. The
     settle-in doubles as the separator beat: the sheet edge and shadow
     always play in full before push-through can fire.
   - Rest arrivals (touch, momentum tails, scrollbar, keyboard): when a
     gesture goes quiet inside the band, the same ease starts from rest.
     Non-cancelable momentum is never prevented — it blows through the
     band naturally, and the takeover abort keeps the ease from wrestling
     it (the GSAP ScrollTrigger snap contract).

   Keyboard scrolling stays native: keys produce ordinary scroll events
   and can always move through the zone. Touch only ever takes the rest
   path — intervention starts after momentum has decayed, never mid-fling
   (iOS cannot resolve programmatic vs. momentum scrolls). Reduced motion,
   embed mode, and reveal-off pages never engage via isEligible.
   ----------------------------------------------------------------------- */

/** Scroll distance below the pin the hold rests at. Zero: the page's last
    section reads as the end of the document — the footer stays fully hidden
    until the detent releases (approved 2026-09-20; the old 56px peek read
    as the footer being trivially accessible). */
export const HOLD_OFFSET_PX = 0;
/** Capture band above the pin: resting here pulls forward to the hold. */
export const PULL_BAND_PX = 150;
/** Resting this far past the hold is outside the detent — free scroll. */
export const ESCAPE_PX = 160;
/** Deliberate sustained push (px) accumulated while held that breaks the
    magnet — sized above a mouse-wheel tick (~105px) so a single tick never
    releases. */
export const INTENT_PX = 260;
/** A gap longer than this between pushes starts the count over: one tick,
    or tick-then-pause, never releases — "scroll more" must be sustained. */
export const INTENT_DECAY_MS = 250;
/** Gesture quiet time before a rest counts as "caught". */
export const QUIET_MS = 150;
/** Exponential settle rate per 60fps frame (~250ms to cover the band). */
export const SETTLE_RATE = 0.2;
/** Scroll deltas beyond this from our last written position are the user. */
const TAKEOVER_PX = 1.5;
/** Sub-gesture drift absorbed while settling (rounding, scroll anchoring).
    A real hand moves at least ~8px per frame; anything under this is noise. */
const DRIFT_ABSORB_PX = 4;

export interface DetentZone {
  lo: number;
  hi: number;
  hold: number;
}

export function detentZone(
  pinY: number,
  holdOffset: number = HOLD_OFFSET_PX,
  pullBand: number = PULL_BAND_PX,
  escape: number = ESCAPE_PX
): DetentZone {
  return { lo: pinY - pullBand, hi: pinY + holdOffset + escape, hold: pinY + holdOffset };
}

export function inZone(y: number, zone: DetentZone): boolean {
  return y >= zone.lo && y <= zone.hi;
}

/** One frame of the exponential settle — frame-rate independent. */
export function settleStep(y: number, target: number, frames: number, rate: number = SETTLE_RATE): number {
  return y + (target - y) * (1 - Math.pow(1 - rate, frames));
}

export interface MagneticPinOptions {
  /** Live eligibility: reveal-live shell, no reduced motion, not embed. */
  isEligible(): boolean;
  /** Scroll position where the sheet pins (translate-independent). */
  getPinY(): number;
  holdOffsetPx?: number;
  pullBandPx?: number;
  escapePx?: number;
  intentPx?: number;
  quietMs?: number;
}

export type DetentPhase = 'free' | 'settling' | 'holding';



export function initMagneticPin(options: MagneticPinOptions): () => void {
  const holdOffset = options.holdOffsetPx ?? HOLD_OFFSET_PX;
  const pullBand = options.pullBandPx ?? PULL_BAND_PX;
  const escape = options.escapePx ?? ESCAPE_PX;
  const intentLimit = options.intentPx ?? INTENT_PX;
  const quietMs = options.quietMs ?? QUIET_MS;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let phase: DetentPhase = 'free';
  let armed = true;
  let intent = 0;
  let lastIntentAt = 0;
  let lastY = window.scrollY;
  let lastTime = performance.now();
  let expectedY = window.scrollY;
  let quietTimer: ReturnType<typeof setTimeout> | null = null;
  let settleRaf = 0;

  const zone = (): DetentZone => detentZone(options.getPinY(), holdOffset, pullBand, escape);

  function cancelQuiet(): void {
    if (quietTimer) {
      clearTimeout(quietTimer);
      quietTimer = null;
    }
  }

  function stopSettle(): void {
    if (settleRaf) {
      cancelAnimationFrame(settleRaf);
      settleRaf = 0;
    }
  }

  function scheduleCatch(): void {
    if (quietTimer) clearTimeout(quietTimer);
    quietTimer = setTimeout(checkCatch, quietMs);
  }

  function checkCatch(): void {
    quietTimer = null;
    if (phase !== 'free' || reduced.matches || !options.isEligible()) return;
    const y = window.scrollY;
    if (!armed || !inZone(y, zone())) return;
    beginSettle();
  }

  function beginSettle(): void {
    phase = 'settling';
    intent = 0;
    lastTime = performance.now();
    const step = (): void => {
      settleRaf = 0;
      const y = window.scrollY;
      const drift = y - expectedY;
      /* User takeover: the detent never wrestles an active gesture. Tiny
         drift (rounding, scroll anchoring) is absorbed and the ease
         re-anchors; anything bigger hands control back immediately. */
      if (Math.abs(drift) > TAKEOVER_PX) {
        if (Math.abs(drift) > DRIFT_ABSORB_PX) {
          intent += Math.abs(drift);
          phase = 'free';
          expectedY = y;
          scheduleCatch();
          return;
        }
        expectedY = y;
      }
      const now = performance.now();
      const frames = Math.min(2.5, (now - lastTime) / 16.7);
      lastTime = now;
      const target = zone().hold;
      const next = settleStep(y, target, frames);
      /* Sub-pixel tails never converge through fractional scrollTo: the
         browser floors the position, and once the geometric step (20% of
         the remaining gap) drops below the flooring loss the ease stalls
         — measured stuck at 1px, then at 2px, short of the integer
         target. Snap across that whole stall band (a <=4px correction
         mid-ease is invisible). */
      expectedY = Math.abs(target - next) < 4 ? Math.round(target) : next;
      /* behavior:'instant' is required: the root carries CSS
         scroll-behavior: smooth, and an animated scrollTo would trail the
         settle's own per-frame writes, tripping the takeover check every
         frame. The settle IS the animation. */
      window.scrollTo({ top: expectedY, behavior: 'instant' });
      if (Math.abs(expectedY - target) < 0.5) {
        phase = 'holding';
        return;
      }
      settleRaf = requestAnimationFrame(step);
    };
    settleRaf = requestAnimationFrame(step);
  }

  function release(): void {
    /* Hands back to native scrolling at the hold: the pushed ticks were
       absorbed as resistance, and the reveal now plays at the user's own
       scroll pace — no jump, the separator beat reads in full. */
    phase = 'free';
    armed = false;
    stopSettle();
    cancelQuiet();
    expectedY = window.scrollY;
    lastY = expectedY;
  }

  /** Wheel deltas are not always pixels — normalize line/page modes. */
  function normalizedDelta(event: WheelEvent): number {
    if (event.deltaMode === 1) return event.deltaY * 16;
    if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
    return event.deltaY;
  }

  function onWheel(event: WheelEvent): void {
    const dy = normalizedDelta(event);

    if (phase === 'free') {
      /* Active-gesture catch: the first cancelable downward tick inside the
         band is intercepted and eased to the hold. Rest-arrivals are
         handled by the quiet timer instead. */
      if (!armed || !event.cancelable || dy <= 0) return;
      if (reduced.matches || !options.isEligible()) return;
      if (!inZone(window.scrollY, zone())) return;
      event.preventDefault();
      cancelQuiet();
      intent = 0;
      beginSettle();
      return;
    }

    /* Engaged: cancelable input is prevented outright so native scroll
       never runs underneath the ease. Momentum (non-cancelable) falls
       through to native scrolling and is absorbed by the takeover logic
       instead — never prevent it, never double-count it. */
    if (event.cancelable) {
      event.preventDefault();
      /* Sustained-push contract: a gap longer than INTENT_DECAY_MS means
         the last push was a separate gesture — start counting over. */
      const now = performance.now();
      if (now - lastIntentAt > INTENT_DECAY_MS) intent = 0;
      lastIntentAt = now;
      intent += dy;
      /* The settle-in is the separator beat: the sheet edge + shadow always
         play in full before push-through can fire. */
      if (phase === 'holding') {
        if (intent >= intentLimit) release();
        else if (intent <= -intentLimit) release();
      }
    }
  }

  function onScroll(): void {
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    const z = zone();
    const inside = inZone(y, z);

    if (!inside) {
      /* Leaving the zone re-arms the magnet for the next approach. */
      if (!armed) {
        armed = true;
        intent = 0;
      }
      if (phase === 'holding') phase = 'free';
    }

    if (phase === 'settling') return; /* takeover is judged in the settle step */

    if (phase === 'holding') {
      if (Math.abs(y - expectedY) <= TAKEOVER_PX) return; /* rounding echo */
      if (inside) {
        /* Native movement while held (momentum, scrollbar): signed intent,
           either direction can break the hold. Cancelable wheel input is
           counted in onWheel instead — it never produces scroll events.
           Momentum gaps longer than INTENT_DECAY_MS restart the count. */
        const now = performance.now();
        if (now - lastIntentAt > INTENT_DECAY_MS) intent = 0;
        lastIntentAt = now;
        intent += dy;
        if (intent >= intentLimit) {
          release(); /* already moved natively */
          return;
        }
        if (intent <= -intentLimit) {
          release();
          return;
        }
      }
      phase = 'free';
    }

    expectedY = y;
    if (inside && armed && !reduced.matches && options.isEligible()) scheduleCatch();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onWheel);
    cancelQuiet();
    if (settleRaf) cancelAnimationFrame(settleRaf);
  };
}
