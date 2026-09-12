<div class="l2-page-orbs" aria-hidden="true">
  <span class="aurora-orb ao-1"></span>
  <span class="aurora-orb ao-2"></span>
  <span class="aurora-orb ao-3"></span>
  <span class="aurora-orb ao-4"></span>
  <span class="aurora-orb ao-5"></span>
  <span class="aurora-orb ao-6"></span>
</div>
<div class="l2-page-grid" aria-hidden="true"></div>

<style>
  /* ── Shared ambient background ───────────────────────────────────────
     ONE background for every route: blurred aurora orbs drifting over a
     slow hue cycle, plus the 60px engineering grid. Mounted once by
     +layout.svelte; pages must never re-implement these layers. Fixed
     positioning keeps the field constant while content scrolls; the body
     carries the opaque --bg canvas and this layer paints behind
     .site-shell (transparent) at z-index -1. */
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
    opacity: 0.03;
    background-image: linear-gradient(var(--text) 1px, transparent 1px),
      linear-gradient(90deg, var(--text) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  @keyframes aurora-drift {
    0% { transform: translate(0, 0) scale(1); }
    100% { transform: translate(64px, -52px) scale(1.08); }
  }

  @keyframes aurora-hue {
    0% { filter: hue-rotate(0deg); }
    100% { filter: hue-rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .l2-page-orbs,
    .aurora-orb {
      animation: none;
    }
  }
</style>
