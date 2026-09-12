<script lang="ts">
  import { defaultPlacements, resolvePlacementSvg } from '$lib/svgCatalog/placements';

  /** The overview (+ its editor) render their own editor-connected entity
   *  layer; every other route gets this shared one. */
  export let withFloats = true;

  const floatEntities = defaultPlacements
    .filter((p) => !p.hidden)
    .slice()
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
</script>

<div class="l2-page-orbs" aria-hidden="true">
  <span class="aurora-orb ao-1"></span>
  <span class="aurora-orb ao-2"></span>
  <span class="aurora-orb ao-3"></span>
  <span class="aurora-orb ao-4"></span>
  <span class="aurora-orb ao-5"></span>
  <span class="aurora-orb ao-6"></span>
</div>
<div class="l2-page-grid" aria-hidden="true"></div>
{#if withFloats}
  <div class="l2-page-floats" aria-hidden="true">
    {#each floatEntities as p (p.id)}
      {@const resolved = resolvePlacementSvg(p)}
      <div
        class="l2-float-el"
        style="
          left: {p.x}%;
          top: {p.y}%;
          width: {p.size}px;
          height: {p.size}px;
          opacity: {p.opacity};
          color: {p.color || 'var(--gc-green)'};
          --placement-rotate: {p.rotate}deg;
          animation-duration: {p.animDuration}s;
          z-index: {p.zIndex ?? 0};
        "
      >
        <svg
          viewBox={resolved.viewBox}
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="width:100%;height:100%;"
        >
          {@html resolved.svg}
        </svg>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* ── Shared ambient background ───────────────────────────────────────
     ONE background for every route: blurred aurora orbs drifting over a
     slow hue cycle, the 60px engineering grid, and the catalog's floating
     entities. Mounted once by +layout.svelte; pages must never
     re-implement these layers. Fixed positioning keeps the field constant
     while content scrolls; the body carries the opaque --bg canvas and
     these layers paint behind .site-shell (transparent) at z-index -1,
     except the entity layer, which floats above content (z-index 3) but
     below the navbar, mirroring the overview's incumbent look. */
  .l2-page-orbs,
  .l2-page-grid {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
  }

  .l2-page-orbs {
    animation: aurora-hue 40s linear infinite;
  }

  .aurora-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(90px);
    animation: aurora-drift 26s ease-in-out infinite alternate;
  }

  .ao-1 { width: 620px; height: 620px; left: -8%; top: -12%; background: radial-gradient(circle at 32% 32%, #bbf7d0 0%, rgba(26, 139, 85, 0.55) 100%); opacity: 0.34; }
  .ao-2 { width: 520px; height: 520px; right: -6%; top: -6%; background: radial-gradient(circle at 60% 40%, #a5f3fc 0%, rgba(66, 133, 244, 0.5) 100%); opacity: 0.28; animation-duration: 32s; animation-direction: alternate-reverse; }
  .ao-3 { width: 460px; height: 460px; left: 38%; top: 16%; background: radial-gradient(circle at 50% 50%, #e0e7ff 0%, rgba(251, 188, 4, 0.35) 100%); opacity: 0.24; animation-duration: 22s; }
  .ao-4 { width: 560px; height: 560px; left: -6%; bottom: -12%; background: radial-gradient(circle at 40% 62%, #bbf7d0 0%, rgba(19, 122, 71, 0.5) 100%); opacity: 0.3; animation-duration: 30s; animation-direction: alternate-reverse; }
  .ao-5 { width: 480px; height: 480px; right: -4%; bottom: -8%; background: radial-gradient(circle at 55% 45%, #a5f3fc 0%, rgba(16, 185, 129, 0.45) 100%); opacity: 0.26; animation-duration: 24s; }
  .ao-6 { width: 400px; height: 400px; left: 56%; bottom: 22%; background: radial-gradient(circle at 50% 50%, #e0e7ff 0%, rgba(87, 187, 138, 0.4) 100%); opacity: 0.2; animation-duration: 28s; }

  /* The vertical + horizontal grid lines shared by every page. */
  .l2-page-grid {
    opacity: 0.07;
    background-image: linear-gradient(var(--text) 1px, transparent 1px),
      linear-gradient(90deg, var(--text) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* Floating entities — the same catalog the overview's editor-connected
     layer renders. Hidden below 900px to match the overview's placement
     breakpoint; suppressed per route via the withFloats prop. */
  .l2-page-floats {
    position: fixed;
    inset: 0;
    z-index: 3;
    overflow: hidden;
    pointer-events: none;
  }

  .l2-float-el {
    position: absolute;
    color: var(--gc-green);
    animation: float-a ease-in-out infinite;
    pointer-events: none;
    will-change: transform;
  }

  @keyframes float-a {
    0%, 100% { transform: translateY(0) rotate(var(--placement-rotate, 0deg)); }
    25% { transform: translateY(-20px) rotate(calc(var(--placement-rotate, 0deg) + 5deg)); }
    50% { transform: translateY(10px) rotate(calc(var(--placement-rotate, 0deg) - 3deg)); }
    75% { transform: translateY(-15px) rotate(calc(var(--placement-rotate, 0deg) + 4deg)); }
  }

  @keyframes aurora-drift {
    0% { transform: translate(0, 0) scale(1); }
    100% { transform: translate(64px, -52px) scale(1.08); }
  }

  @keyframes aurora-hue {
    0% { filter: hue-rotate(0deg); }
    100% { filter: hue-rotate(360deg); }
  }

  @media (max-width: 900px) {
    .l2-page-floats {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .l2-page-orbs,
    .aurora-orb,
    .l2-float-el {
      animation: none;
    }
  }
</style>
