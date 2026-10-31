<script lang="ts">
  import SeoMeta from '$lib/components/SeoMeta.svelte';
  import favicon from '$lib/assets/favicon.svg';

  type BrandColor = {
    name: string;
    hex: string;
    rgb: string;
    dark?: boolean;
  };

  type CopyBlock = {
    label: string;
    text: string;
  };

  const colors: BrandColor[] = [
    { name: 'CQD Green', hex: '#1a8b55', rgb: '26, 139, 85' },
    { name: 'Green Dark', hex: '#137a47', rgb: '19, 122, 71' },
    { name: 'Green Light', hex: '#57bb8a', rgb: '87, 187, 138' },
    { name: 'Badge Yellow', hex: '#fbbc04', rgb: '251, 188, 4' },
    { name: 'Ink', hex: '#1a1a2e', rgb: '26, 26, 46', dark: true },
    { name: 'White', hex: '#ffffff', rgb: '255, 255, 255' }
  ];

  const about: CopyBlock[] = [
    {
      label: 'One line',
      text: 'Classroom Quick Downloader downloads every Google Classroom attachment in one click.'
    },
    {
      label: 'Short',
      text: 'Classroom Quick Downloader (CQD) is a free browser extension for Chrome, Firefox, and Edge. Open an assignment or class, click Download All, and every attached file saves to your device in one queued run. No account, no file upload, nothing stored on a server.'
    }
  ];

  let copied = $state<string | null>(null);

  async function copy(value: string, key: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    copied = key;
    setTimeout(() => {
      if (copied === key) copied = null;
    }, 1600);
  }
</script>

<svelte:head>
  <title>Brand Kit — Classroom Quick Downloader</title>
  <meta
    name="description"
    content="Logos, colors, and copy for writing about Classroom Quick Downloader. Please do not stretch, recolor, or add effects to the logo."
  />
</svelte:head>

<SeoMeta title="Brand Kit — Classroom Quick Downloader" description="Logos, colors, and copy for writing about Classroom Quick Downloader." />

<div class="brand">
  <section class="hero">
    <h1>Brand kit.</h1>
    <p>
      Logos, colors, and descriptions for writing about Classroom Quick Downloader. Please do not
      stretch, recolor, or add effects to the logo.
    </p>
    <div class="hero-actions">
      <a class="btn" href="/favicon.svg" download>Logo (SVG)</a>
      <a class="btn ghost" href="/favicon-512x512.png" download>Logo (PNG 512)</a>
      <a class="btn ghost" href="/images/cqd-social-card.png" download>Social card</a>
    </div>
  </section>

  <section class="panel">
    <h2>Logos</h2>
    <p class="section-note">
      The mark is a yellow rounded card with a green panel and a white download arrow. Keep clear
      space equal to the arrow height on all sides.
    </p>
    <div class="logo-grid">
      <figure>
        <div class="tile light"><img src={favicon} alt="Classroom Quick Downloader logo" width="180" height="154" /></div>
        <figcaption>On light</figcaption>
      </figure>
      <figure>
        <div class="tile dark"><img src={favicon} alt="Classroom Quick Downloader logo on dark" width="180" height="154" /></div>
        <figcaption>On dark</figcaption>
      </figure>
    </div>
  </section>

  <section class="panel">
    <h2>Colors</h2>
    <p class="section-note">Click a card to copy the hex value.</p>
    <div class="color-grid">
      {#each colors as c (c.hex)}
        <button
          type="button"
          class="color-card"
          onclick={() => copy(c.hex, c.hex)}
          aria-label="{c.name} {c.hex} RGB {c.rgb}. Click to copy the hex value."
        >
          <span class="swatch" style="background: {c.hex}; border: 1px solid rgba(26, 26, 46, 0.12);"></span>
          <span class="color-meta">
            <strong>{c.name}</strong>
            {#if copied === c.hex}
              <span class="mono copied">Copied</span>
            {:else}
              <span class="mono">{c.hex}</span>
            {/if}
            <span class="mono dim">RGB {c.rgb}</span>
          </span>
        </button>
      {/each}
    </div>
  </section>

  <section class="panel">
    <h2>Typography</h2>
    <p>
      All text uses Plus Jakarta Sans. The name is always written
      &ldquo;Classroom Quick Downloader&rdquo; in full, or &ldquo;CQD&rdquo; after the first mention.
    </p>
    <p class="type-sample xl">Aa — Instant. Private. Transparent. Universal.</p>
    <p class="type-sample dim">Headlines use weight 800. Body text uses weight 400.</p>
  </section>

  <section class="panel">
    <h2>About Classroom Quick Downloader</h2>
    <p class="section-note">Copy this text when you write about the extension.</p>
    <div class="copy-blocks">
      {#each about as block (block.label)}
        <div class="copy-block">
          <div class="block-head">
            <span class="block-label">{block.label}</span>
            <button type="button" class="btn ghost small" onclick={() => copy(block.text, block.label)}>
              {copied === block.label ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p>{block.text}</p>
        </div>
      {/each}
    </div>
  </section>

  <section class="panel">
    <h2>Usage rules</h2>
    <ul>
      <li>Do not stretch, rotate, recolor, or add effects to the logo.</li>
      <li>Do not place the logo on a background below 3:1 contrast.</li>
      <li>Do not imply endorsement by or affiliation with Google or Google Classroom.</li>
      <li>Use the wordmark &ldquo;Classroom Quick Downloader&rdquo; on first mention.</li>
    </ul>
  </section>
</div>

<style>
  .brand {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px 96px;
  }

  .hero {
    text-align: center;
    padding: 96px 0 64px;
  }

  .hero h1 {
    font-size: clamp(2.5rem, 6vw, 4rem);
    font-weight: 800;
    margin: 0 0 16px;
  }

  .hero p {
    max-width: 560px;
    margin: 0 auto 32px;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .hero-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn {
    display: inline-block;
    background: var(--gc-green);
    color: #ffffff;
    font-weight: 600;
    padding: 12px 24px;
    border-radius: 12px;
    text-decoration: none;
    border: 1px solid var(--gc-green);
    cursor: pointer;
    font-size: 0.95rem;
  }

  .btn:hover {
    background: var(--gc-green-dark);
  }

  .btn.ghost {
    background: transparent;
    color: var(--gc-green);
  }

  .btn.ghost:hover {
    background: var(--gc-green-bg);
  }

  .btn.small {
    padding: 6px 14px;
    font-size: 0.85rem;
    border-radius: 8px;
  }

  .panel {
    border-top: 1px solid rgba(26, 26, 46, 0.08);
    padding: 48px 0;
  }

  .panel h2 {
    font-size: 1.6rem;
    font-weight: 800;
    margin: 0 0 12px;
  }

  .section-note {
    color: var(--text-secondary);
    margin: 0 0 28px;
  }

  .logo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 24px;
  }

  .logo-grid figure {
    margin: 0;
  }

  .tile {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    padding: 48px 0;
  }

  .tile.light {
    background: #ffffff;
    border: 1px solid var(--border);
  }

  .tile.dark {
    background: #1a1a2e;
  }

  figcaption {
    margin-top: 10px;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
  }

  .color-card {
    display: block;
    width: 100%;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    padding: 0;
    background: transparent;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }

  .swatch {
    display: block;
    height: 110px;
  }

  .color-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
  }

  .mono {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 0.85rem;
  }

  .copied {
    color: var(--gc-green);
    font-weight: 600;
  }

  .dim {
    color: var(--text-secondary);
  }

  .type-sample.xl {
    font-size: 1.8rem;
    font-weight: 800;
  }

  .copy-blocks {
    display: grid;
    gap: 24px;
  }

  .copy-block {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
  }

  .block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .block-label {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .copy-block p {
    margin: 0;
    line-height: 1.6;
  }

  .panel ul {
    margin: 0;
    padding-left: 20px;
    line-height: 2;
  }

  @media (max-width: 640px) {
    .hero {
      padding-top: 56px;
    }
  }
</style>
