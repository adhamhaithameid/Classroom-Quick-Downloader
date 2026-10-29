<script lang="ts">
  // w403 variant A — the footer as a normal static section. The real
  // SiteFooter renders in the real layout shell; this page only supplies
  // scrollable comparison content and the cross-link to variant B.
  import { PROTOTYPE_CURTAIN_PATH } from '$lib/footer/prototype-variant';
</script>

<svelte:head>
  <title>Footer prototype A — static section</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="proto">
  <div class="l2-page-grid proto-inner">
    <p class="proto-chip">Prototype A of 2 · bead w403</p>
    <h1>Footer as a normal static section</h1>
    <p class="proto-lede">
      The reveal machinery is off on this route. The footer below is a plain
      in-flow section: you scroll to the end of the page and it is simply
      there. No sheet lift, no runway, no per-frame style writes.
    </p>
    <ul class="proto-facts">
      <li>Zero scroll-time JavaScript for the footer (the shipped variant writes transform styles per frame).</li>
      <li>No fixed-position containing block, so the portal-trap class of overlay bugs cannot occur.</li>
      <li>The magnetic pre-footer detent is off; scrolling to the footer is native.</li>
    </ul>
    <p class="proto-nav">
      Compare with <a href={PROTOTYPE_CURTAIN_PATH}>variant B — native sticky curtain</a>.
      Both routes render the identical footer component.
    </p>
    <div class="proto-filler" aria-hidden="true">
      {#each Array(8) as _, i (i)}
        <div class="proto-block">
          <h2>Scroll filler {i + 1}</h2>
          <p>
            Content block so the page scrolls like a real route. The point of
            comparison is how the footer behaves as you approach and pass the
            page end.
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
