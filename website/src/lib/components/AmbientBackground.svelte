<script lang="ts">
  import { gridBend } from '../actions/gridBend';

  /* `lens=false` renders only the orbs + static CSS grid — used by copies
     of the ambient that must not carry a cursor-lens canvas. */
  export let lens = true;

  /* `paused=true` marks this instance as known-invisible (occluded by the
     sheet or behind the hidden footer window): the orb drift freezes and
     the lens canvas switches off entirely. Two instances used to keep
     painting and compositing all the time — a full-viewport canvas redraw
     per pointer/scroll frame each, plus 12 blur(120px) layers apiece —
     even when nothing of the instance was on screen. */
  export let paused = false;
</script>

<div class="l2-page-orbs" class:ambient-paused={paused} aria-hidden="true">
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>
  <div class="orb orb-4"></div>
  <div class="orb orb-5"></div>
  <div class="orb orb-6"></div>
  <div class="orb orb-7"></div>
  <div class="orb orb-8"></div>
  <div class="orb orb-9"></div>
  <div class="orb orb-10"></div>
  <div class="orb orb-11"></div>
  <div class="orb orb-12"></div>
</div>
<div class="l2-page-grid" class:ambient-paused={paused} aria-hidden="true">
  {#if lens}
    <canvas class="l2-grid-canvas" aria-hidden="true" use:gridBend={{ paused }}></canvas>
  {/if}
</div>

<style>
  /* ── Shared ambient background ───────────────────────────────────────
     The user's original look (deployed from origin/main b7820fe7),
     rebuilt as one layer mounted by +layout.svelte on every route:
     a pastel 12-orb drifting field over the 60px engineering grid.
     Absolute positioning spans the whole document (the field scrolls
     with the page, like the old per-page layers). The floating entities
     are NOT part of this layer — the overview/editor render their own
     editor-connected ones. On fine-pointer devices the grid lines bend
     gently around the cursor (lib/actions/gridBend); reduced motion and
     touch keep the static grid. */
  .l2-page-orbs,
  .l2-page-grid {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 0;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
  }

  /* Hero-region orbs */
  .orb-1 { width: 560px; height: 560px; background: #bbf7d0; top: 1%; right: -4%; opacity: 0.35; animation: orb-drift 18s ease-in-out infinite alternate; }
  .orb-2 { width: 480px; height: 480px; background: #a5f3fc; top: 8%; left: -4%; opacity: 0.28; animation: orb-drift 22s ease-in-out infinite alternate-reverse; }
  .orb-3 { width: 360px; height: 360px; background: #e0e7ff; top: 5%; left: 42%; opacity: 0.22; animation: orb-drift 15s ease-in-out infinite alternate; }
  /* Mid-page orbs */
  .orb-4 { width: 500px; height: 500px; background: #bbf7d0; top: 30%; left: -3%; opacity: 0.25; animation: orb-drift 20s ease-in-out infinite alternate; }
  .orb-5 { width: 440px; height: 440px; background: #a5f3fc; top: 45%; right: -2%; opacity: 0.22; animation: orb-drift 24s ease-in-out infinite alternate-reverse; }
  /* Lower-page orbs */
  .orb-6 { width: 520px; height: 520px; background: #bbf7d0; top: 65%; right: 5%; opacity: 0.28; animation: orb-drift 19s ease-in-out infinite alternate; }
  .orb-7 { width: 400px; height: 400px; background: #e0e7ff; top: 80%; left: 5%; opacity: 0.2; animation: orb-drift 26s ease-in-out infinite alternate-reverse; }
  /* Extra density orbs */
  .orb-8 { width: 380px; height: 380px; background: #bbf7d0; top: 20%; right: 15%; opacity: 0.2; animation: orb-drift 21s ease-in-out infinite alternate; }
  .orb-9 { width: 420px; height: 420px; background: #a5f3fc; top: 38%; left: 20%; opacity: 0.18; animation: orb-drift 25s ease-in-out infinite alternate-reverse; }
  .orb-10 { width: 460px; height: 460px; background: #e0e7ff; top: 55%; right: -2%; opacity: 0.2; animation: orb-drift 17s ease-in-out infinite alternate; }
  .orb-11 { width: 340px; height: 340px; background: #bbf7d0; top: 72%; left: 30%; opacity: 0.22; animation: orb-drift 23s ease-in-out infinite alternate-reverse; }
  .orb-12 { width: 480px; height: 480px; background: #a5f3fc; top: 90%; right: 8%; opacity: 0.18; animation: orb-drift 27s ease-in-out infinite alternate; }

  /* The vertical + horizontal grid lines shared by every page. */
  .l2-page-grid {
    opacity: 0.05;
    background-image: linear-gradient(var(--text) 1px, transparent 1px),
      linear-gradient(90deg, var(--text) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* Cursor-bend twin of the grid, painted by the gridBend action. It lives
     inside the wrapper so the wrapper's opacity: 0.05 composites the whole
     subtree — the canvas itself carries no opacity. Sticky (not fixed) so
     it stays inside the container it decorates — when the sticky sheet
     reveal translates the page, the lens grid travels with the sheet
     instead of escaping over the footer window. */
  .l2-grid-canvas {
    position: sticky;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    pointer-events: none;
    z-index: 0;
    display: none;
  }

  /* While the canvas paints, the CSS gradient stands down. bend-live is
     toggled at runtime by the action, so the dynamic class must be
     :global() to survive Svelte's scoped-CSS pruning. */
  .l2-page-grid:global(.bend-live) {
    background-image: none;
  }

  /* A paused instance is known-invisible: freeze its orb drift so the
     blurred layers stop recompositing (visibility:hidden alone does not
     stop animation clocks). The lens canvas is handled by the action's
     paused param. */
  .l2-page-orbs:global(.ambient-paused) .orb {
    animation-play-state: paused;
  }

  @keyframes orb-drift {
    0% { transform: translate(0, 0); }
    100% { transform: translate(30px, -40px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .orb {
      animation: none;
    }
  }
</style>
