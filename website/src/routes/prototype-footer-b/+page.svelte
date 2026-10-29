<script lang="ts">
  // w403 variant B — native CSS sticky curtain. Same real SiteFooter, same
  // layout shell; the footer sticks to the viewport bottom with pure CSS
  // and the opaque sheet scrolls over it. Zero JS scroll work.
  import { PROTOTYPE_STATIC_PATH } from '$lib/footer/prototype-variant';
</script>

<svelte:head>
  <title>Footer prototype B — native sticky curtain</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="proto">
  <div class="l2-page-grid proto-inner">
    <p class="proto-chip">Prototype B of 2 · bead w403</p>
    <h1>Footer as a native sticky curtain</h1>
    <p class="proto-lede">
      The footer is pinned behind the page with <code>position: sticky; bottom: 0</code>.
      Scrolling toward the end uncovers it exactly like the shipped reveal —
      but with no JavaScript on the scroll path: no per-frame transforms, no
      scroll listener, no detent engine.
    </p>
    <ul class="proto-facts">
      <li>The sheet keeps its rounded, floating look (the shipped reveal's visual signature).</li>
      <li>Scroll performance is the browser's native compositor work only.</li>
      <li>Overlays that portal to body no longer get trapped: main is no longer a fixed-position containing block while scrolling.</li>
    </ul>
    <p class="proto-nav">
      Compare with <a href={PROTOTYPE_STATIC_PATH}>variant A — static section</a>.
    </p>
    <div class="proto-filler" aria-hidden="true">
      {#each Array(8) as _, i (i)}
        <div class="proto-block">
          <h2>Scroll filler {i + 1}</h2>
          <p>
            Content block so the page scrolls like a real route. Watch the
            curtain uncover the footer near the page end.
          </p>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .proto {
    padding: 96px 0 64px;
  }
  .proto-inner {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 24px;
  }
  .proto-chip {
    display: inline-block;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #1a8b55;
    background: rgba(26, 139, 85, 0.08);
    border-radius: 999px;
    padding: 4px 12px;
  }
  h1 {
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    margin: 16px 0 8px;
  }
  .proto-lede {
    font-size: 1.05rem;
    color: var(--text-muted, #4a5a50);
  }
  .proto-facts {
    margin: 20px 0;
    padding-left: 20px;
  }
  .proto-facts li {
    margin-bottom: 8px;
  }
  .proto-nav a {
    color: #1a8b55;
    font-weight: 600;
  }
  .proto-filler {
    margin-top: 40px;
    display: grid;
    gap: 18px;
  }
  .proto-block {
    border: 1px solid rgba(26, 139, 85, 0.16);
    border-radius: 14px;
    padding: 22px 26px;
    background: rgba(255, 255, 255, 0.6);
  }
  .proto-block h2 {
    font-size: 1.1rem;
    margin: 0 0 6px;
  }
  .proto-block p {
    margin: 0;
    color: var(--text-muted, #4a5a50);
  }
</style>
