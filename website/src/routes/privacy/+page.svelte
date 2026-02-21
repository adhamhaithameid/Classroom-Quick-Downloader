<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });
  }
</script>

<section class="card markdown-page">
  <header class="intro">
    <h1>Privacy Policy</h1>
    <p>
      This page is rendered directly from <code>PRIVACY.md</code>. Any update to that file is reflected on the next
      site build/deploy.
    </p>
    <small>Last updated (UTC): {formatDate(data.doc.updatedAtIso)}</small>
  </header>

  <article class="markdown-body">
    {@html data.doc.html}
  </article>
</section>

<style>
  .markdown-page {
    padding: 22px;
    display: grid;
    gap: 14px;
  }

  .intro h1 {
    margin: 0;
    font-size: clamp(30px, 5vw, 50px);
    letter-spacing: -0.03em;
  }

  .intro p {
    margin: 10px 0 0;
    color: var(--muted);
    line-height: 1.65;
  }

  .intro small {
    margin-top: 8px;
    color: var(--muted);
    display: block;
  }

  :global(.markdown-body) {
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface-2);
    padding: 16px;
    line-height: 1.7;
  }

  :global(.markdown-body h1),
  :global(.markdown-body h2),
  :global(.markdown-body h3) {
    letter-spacing: -0.02em;
  }

  :global(.markdown-body code) {
    background: #e8eefb;
    border: 1px solid #ccd8f2;
    border-radius: 6px;
    padding: 1px 6px;
  }

  :global(.markdown-body pre) {
    overflow-x: auto;
    padding: 12px;
    border-radius: 12px;
    background: #0f1f3f;
    color: #f4f8ff;
  }
</style>
