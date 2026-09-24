<script lang="ts">
  import { brandedCursor } from '../actions/brandedCursor';
</script>

<!-- Branded cursor layer (docs/CURSOR.md). Mounted once by +layout.svelte.
     Everything the pointer engine drives lands on this root: data-state,
     the clear class, --seek, visibility, transform, and the progress
     rect. All state visuals are pure CSS off data-state, so state changes
     transition instead of re-rendering. -->
<div
  class="cqd-cursor"
  data-state="default"
  aria-hidden="true"
  style="visibility: hidden;"
  use:brandedCursor
>
  <div class="glass"></div>
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <clipPath id="cqd-cursor-progress-clip">
        <!-- Height is driven by the engine from the progress value; the
             bright arrow below reveals top-down through this window. -->
        <rect class="pf-rect" x="3" y="11.8" width="26" height="0" />
      </clipPath>
    </defs>

    <g class="rotor">
      <circle class="ring dashed" cx="16" cy="16" r="10.62" />
      <circle class="ring arc" cx="16" cy="16" r="13.8" stroke-width="1.9" stroke-linecap="round" stroke-dasharray="36.4 50.3" />
    </g>

    <circle class="ring main" cx="16" cy="16" r="10.62" />

    <line class="slash" x1="8.93" y1="8.93" x2="23.07" y2="23.07" />

    <g class="badge">
      <circle cx="23.5" cy="8.5" r="4.1" />
      <g class="badge-plus"><path d="M23.5 6.7v3.6M21.7 8.5h3.6" /></g>
      <g class="badge-shortcut"><path d="M21.9 10.1l3.1-3.1M25.2 9.3V6.9h-2.4" /></g>
    </g>

    <g class="pfill" clip-path="url(#cqd-cursor-progress-clip)">
      <g class="arrow-scale"><path class="arrow-path" d="M197.238 115.411C202.055 115.411 206.122 119.303 206.122 124.098V188.644L206.121 188.667L205.743 200.551L209.999 196.108L227.784 177.472C229.434 175.645 231.768 174.751 233.987 174.75C238.535 174.75 242.199 178.126 242.199 182.77C242.199 185.204 241.109 187.059 239.607 188.648L239.585 188.671L239.561 188.695L203.651 223.463L203.65 223.462C202.636 224.47 201.63 225.197 200.55 225.664C199.455 226.136 198.365 226.309 197.238 226.309C194.989 226.309 192.936 225.56 190.911 223.464L154.918 188.696L154.909 188.688L154.901 188.68C153.256 187.041 152.278 185.172 152.278 182.77C152.278 178.163 155.737 174.751 160.406 174.75C162.585 174.75 165.025 175.62 166.621 177.484L184.477 196.107L184.478 196.108L188.77 200.59L188.439 188.662V124.098C188.439 119.314 192.495 115.411 197.238 115.411Z" /></g>
    </g>

    <!-- Logo arrow glyph: default, pointer, cta, grab, the 8 edge resizes,
         wait and progress (dimmed). Rotation comes from --seek, which the
         engine sets from the seek target or the per-state rotation. -->
    <g class="glyph arrow-g">
      <g class="arrow-scale"><path class="arrow-path" d="M197.238 115.411C202.055 115.411 206.122 119.303 206.122 124.098V188.644L206.121 188.667L205.743 200.551L209.999 196.108L227.784 177.472C229.434 175.645 231.768 174.751 233.987 174.75C238.535 174.75 242.199 178.126 242.199 182.77C242.199 185.204 241.109 187.059 239.607 188.648L239.585 188.671L239.561 188.695L203.651 223.463L203.65 223.462C202.636 224.47 201.63 225.197 200.55 225.664C199.455 226.136 198.365 226.309 197.238 226.309C194.989 226.309 192.936 225.56 190.911 223.464L154.918 188.696L154.909 188.688L154.901 188.68C153.256 187.041 152.278 185.172 152.278 182.77C152.278 178.163 155.737 174.751 160.406 174.75C162.585 174.75 165.025 175.62 166.621 177.484L184.477 196.107L184.478 196.108L188.77 200.59L188.439 188.662V124.098C188.439 119.314 192.495 115.411 197.238 115.411Z" /></g>
    </g>

    <g class="glyph ibeam"><path d="M16 9v14M13.4 9h5.2M13.4 23h5.2" /></g>
    <g class="glyph cross"><path d="M16 8v16M8 16h16" /></g>
    <g class="glyph cell"><path d="M16 11.5v9M11.5 16h9" /></g>
    <g class="glyph move"><path d="M16 7v18M7 16h18M13 10l3-3 3 3M13 22l3 3 3-3M10 13l-3 3 3 3M22 13l3 3-3 3" /></g>
    <g class="glyph scroll"><path d="M16 7v5M16 20v5M7 16h5M20 16h5M13 10l3-3 3 3M13 22l3 3 3-3M10 13l-3 3 3 3M22 13l3 3-3 3" /><circle cx="16" cy="16" r="1.4" /></g>
    <g class="glyph dbl"><path d="M9.5 16h13M12 12.5l-3.5 3.5 3.5 3.5M20 12.5l3.5 3.5-3.5 3.5" /></g>
    <g class="glyph divider"><path d="M16 10.5v11M11 16h2M19 16h2M12.5 13.5l-2 2.5 2 2.5M19.5 13.5l2 2.5-2 2.5" /></g>
    <g class="glyph help"><path d="M13.4 12.6a2.9 2.9 0 1 1 4.3 2.5c-1 .5-1.4 1.2-1.4 2.5M16 20.9v.1" /></g>
    <g class="glyph menu"><path d="M11.5 12h.1M11.5 16h.1M11.5 20h.1M14.5 12h7M14.5 16h7M14.5 20h7" /></g>
    <g class="glyph zoomin"><path d="M12.5 16h7M16 12.5v7" /></g>
    <g class="glyph zoomout"><path d="M12.5 16h7" /></g>
  </svg>
</div>

<style>
  .cqd-cursor {
    position: fixed;
    top: 0;
    left: 0;
    width: var(--cqd-cursor-size, 52px);
    height: var(--cqd-cursor-size, 52px);
    z-index: 2147483647;
    pointer-events: none;
  }

  /* Glass: exactly the ring's background — the disc's diameter is the
     ring's outer diameter, nothing spills past the ring. */
  .glass {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 69.1%;
    height: 69.1%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.11));
    -webkit-backdrop-filter: blur(6px) saturate(150%);
    backdrop-filter: blur(6px) saturate(150%);
    box-shadow:
      0 1px 5px rgba(16, 39, 29, 0.24),
      inset 0 1px 1px rgba(255, 255, 255, 0.65),
      inset 0 -1px 1px rgba(16, 39, 29, 0.13);
    opacity: 1;
    transition:
      opacity 0.3s ease,
      transform 0.34s cubic-bezier(0.3, 1.3, 0.4, 1);
  }

  /* Actions and cards clear the glass so content reads through the cursor.
     The ring state drops the glass too: bare ring, no arrow, no background. */
  .cqd-cursor:global(.clear) .glass,
  .cqd-cursor:global([data-state='ring']) .glass,
  .cqd-cursor:global([data-state='pointer']) .glass,
  .cqd-cursor:global([data-state='cta']) .glass,
  .cqd-cursor:global([data-state='move']) .glass,
  .cqd-cursor:global([data-state='all-scroll']) .glass,
  .cqd-cursor:global([data-state='wait']) .glass,
  .cqd-cursor:global([data-state='progress']) .glass {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.25);
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 1px 0.6px rgba(12, 39, 31, 0.7));
  }

  .ring,
  .glyph,
  .badge,
  .pfill,
  .slash {
    transition-duration: 0.3s;
    transition-timing-function: cubic-bezier(0.3, 1.2, 0.4, 1);
  }

  .ring {
    fill: none;
    stroke: #ffffff;
    stroke-width: 1.33;
    transform-origin: 16px 16px;
    transition-property: opacity, stroke-dasharray, transform;
  }

  .ring.main {
    stroke-linecap: butt;
    /* Full ring expressed as a dasharray so the copy/alias badge cut can
       morph the same property instead of swapping shapes. */
    stroke-dasharray: 0.01 0 66.72 0;
  }

  .cqd-cursor:global([data-state='copy']) .ring.main,
  .cqd-cursor:global([data-state='alias']) .ring.main {
    stroke-dasharray: 5 0 56.73 5;
    transform: rotate(-45deg);
  }

  /* Ring-less states: move and all-scroll travel free; wait and progress
       replace the ring (dashed rotor / working arc). */
  .cqd-cursor:global([data-state='move']) .ring.main,
  .cqd-cursor:global([data-state='all-scroll']) .ring.main,
  .cqd-cursor:global([data-state='wait']) .ring.main,
  .cqd-cursor:global([data-state='progress']) .ring.main {
    opacity: 0;
  }

  .ring.dashed,
  .ring.arc {
    opacity: 0;
    transition-property: opacity;
  }

  .cqd-cursor:global([data-state='wait']) .ring.dashed,
  .cqd-cursor:global([data-state='progress']) .ring.arc {
    opacity: 1;
  }

  .rotor {
    transform-origin: 16px 16px;
    animation: cqd-cursor-spin 1.5s linear infinite;
    animation-play-state: paused;
  }

  .cqd-cursor:global([data-state='wait']) .rotor,
  .cqd-cursor:global([data-state='progress']) .rotor {
    animation-play-state: running;
  }

  @keyframes cqd-cursor-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Prohibition slash: draws in corner to corner of the ring. The arrow
       is gone from these states entirely (no arrow glyph is shown). */
  .slash {
    stroke: #ffffff;
    stroke-width: 2.1;
    stroke-linecap: round;
    stroke-dasharray: 20.4;
    stroke-dashoffset: 20.4;
    opacity: 0;
    transition-property: stroke-dashoffset, opacity;
  }

  .cqd-cursor:global([data-state='not-allowed']) .slash,
  .cqd-cursor:global([data-state='no-drop']) .slash {
    stroke-dashoffset: 0;
    opacity: 1;
  }

  .badge {
    transform-origin: 23.5px 8.5px;
    transform-box: view-box;
    transform: scale(0.4);
    opacity: 0;
    transition-property: transform, opacity;
  }

  .cqd-cursor:global([data-state='copy']) .badge,
  .cqd-cursor:global([data-state='alias']) .badge {
    transform: scale(1);
    opacity: 1;
  }

  .badge circle {
    fill: #ffffff;
    stroke: rgba(16, 39, 29, 0.25);
    stroke-width: 0.6;
  }

  .badge path {
    fill: none;
    stroke: #172b25;
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .badge-plus,
  .badge-shortcut {
    opacity: 0;
  }

  .cqd-cursor:global([data-state='copy']) .badge-plus,
  .cqd-cursor:global([data-state='alias']) .badge-shortcut {
    opacity: 1;
  }

  .pfill {
    opacity: 0;
    transition-property: opacity;
  }

  .cqd-cursor:global([data-state='progress']) .pfill {
    opacity: 1;
  }

  /* The download arrow carries the logo's solid green fill; the ring and
     every other glyph stay white (approved two-tone). The extra class in
     the selector out-specifies the generic `.glyph path` rule. */
  .glyph .arrow-path,
  .pfill .arrow-path {
    fill: #388e3c;
    stroke: #388e3c;
    stroke-width: 1;
  }

  /* Glyphs rest hidden and small; the active state's rule brings its
     glyph in with a spring, so state changes morph instead of swapping. */
  .glyph {
    opacity: 0;
    transform: scale(0.72);
    transform-origin: 16px 16px;
    transform-box: view-box;
    transition-property: opacity, transform;
  }

  .glyph path {
    fill: none;
    stroke: #ffffff;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .glyph.scroll circle {
    fill: #ffffff;
    stroke: none;
  }

  .glyph.arrow-g {
    transform: rotate(var(--seek, 0deg));
  }

  .arrow-scale {
    transform: translate(16px, 16px) scale(0.105) translate(-197.378px, -170.985px);
  }

  .cqd-cursor:global([data-state='default']) .arrow-g,
  .cqd-cursor:global([data-state='auto']) .arrow-g,
  .cqd-cursor:global([data-state='pointer']) .arrow-g,
  .cqd-cursor:global([data-state='cta']) .arrow-g,
  .cqd-cursor:global([data-state='grab']) .arrow-g,
  .cqd-cursor:global([data-state='grabbing']) .arrow-g,
  .cqd-cursor:global([data-state='n-resize']) .arrow-g,
  .cqd-cursor:global([data-state='s-resize']) .arrow-g,
  .cqd-cursor:global([data-state='e-resize']) .arrow-g,
  .cqd-cursor:global([data-state='w-resize']) .arrow-g,
  .cqd-cursor:global([data-state='ne-resize']) .arrow-g,
  .cqd-cursor:global([data-state='nw-resize']) .arrow-g,
  .cqd-cursor:global([data-state='se-resize']) .arrow-g,
  .cqd-cursor:global([data-state='sw-resize']) .arrow-g,
  .cqd-cursor:global([data-state='wait']) .arrow-g,
  .cqd-cursor:global([data-state='progress']) .arrow-g {
    opacity: 1;
  }

  .cqd-cursor:global([data-state='grab']) .arrow-g {
    --seek: 45deg;
  }

  .cqd-cursor:global([data-state='n-resize']) .arrow-g {
    --seek: 180deg;
  }

  .cqd-cursor:global([data-state='e-resize']) .arrow-g {
    --seek: -90deg;
  }

  .cqd-cursor:global([data-state='w-resize']) .arrow-g {
    --seek: 90deg;
  }

  .cqd-cursor:global([data-state='ne-resize']) .arrow-g {
    --seek: -135deg;
  }

  .cqd-cursor:global([data-state='nw-resize']) .arrow-g {
    --seek: 135deg;
  }

  .cqd-cursor:global([data-state='se-resize']) .arrow-g {
    --seek: -45deg;
  }

  .cqd-cursor:global([data-state='sw-resize']) .arrow-g {
    --seek: 45deg;
  }

  .cqd-cursor:global([data-state='wait']) .arrow-g,
  .cqd-cursor:global([data-state='progress']) .arrow-g {
    opacity: 0.34;
  }

  .cqd-cursor:global([data-state='text']) .ibeam,
  .cqd-cursor:global([data-state='vertical-text']) .ibeam {
    opacity: 1;
    transform: rotate(0deg) scale(0.58);
  }

  .cqd-cursor:global([data-state='vertical-text']) .ibeam {
    transform: rotate(90deg) scale(0.58);
  }

  .cqd-cursor:global([data-state='crosshair']) .cross {
    opacity: 1;
    transform: scale(0.9);
  }

  .cqd-cursor:global([data-state='crosshair']) .cross path {
    stroke-width: 1.2;
  }

  .cqd-cursor:global([data-state='cell']) .cell {
    opacity: 1;
    transform: scale(0.58);
  }

  .cqd-cursor:global([data-state='cell']) .cell path {
    stroke-width: 2.8;
  }

  .cqd-cursor:global([data-state='move']) .move,
  .cqd-cursor:global([data-state='all-scroll']) .scroll {
    opacity: 1;
    transform: scale(1.12);
  }

  .cqd-cursor:global([data-state='move']) .move path,
  .cqd-cursor:global([data-state='all-scroll']) .scroll path {
    stroke-width: 1.6;
  }

  .cqd-cursor:global([data-state='ew-resize']) .dbl,
  .cqd-cursor:global([data-state='ns-resize']) .dbl,
  .cqd-cursor:global([data-state='nwse-resize']) .dbl,
  .cqd-cursor:global([data-state='nesw-resize']) .dbl {
    opacity: 1;
    transform: scale(0.58);
  }

  .cqd-cursor:global([data-state='ns-resize']) .dbl {
    transform: rotate(90deg) scale(0.58);
  }

  .cqd-cursor:global([data-state='nwse-resize']) .dbl {
    transform: rotate(45deg) scale(0.58);
  }

  .cqd-cursor:global([data-state='nesw-resize']) .dbl {
    transform: rotate(-45deg) scale(0.58);
  }

  .cqd-cursor:global([data-state='col-resize']) .divider,
  .cqd-cursor:global([data-state='row-resize']) .divider {
    opacity: 1;
    transform: scale(0.58);
  }

  .cqd-cursor:global([data-state='row-resize']) .divider {
    transform: rotate(90deg) scale(0.58);
  }

  .cqd-cursor:global([data-state='help']) .help {
    opacity: 1;
    transform: scale(0.62);
  }

  .cqd-cursor:global([data-state='context-menu']) .menu {
    opacity: 1;
    transform: scale(0.58);
  }

  .cqd-cursor:global([data-state='zoom-in']) .zoomin,
  .cqd-cursor:global([data-state='zoom-out']) .zoomout {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .cqd-cursor *,
    .cqd-cursor :global(*) {
      transition: none !important;
    }

    .rotor {
      animation: none;
    }
  }
</style>
