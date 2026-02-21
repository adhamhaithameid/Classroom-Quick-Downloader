<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { fetchOverview } from '$lib/api/publicSite';
  import { STORE_LINKS } from '$lib/config';
  import type { OverviewResponse } from '$lib/types/public';

  let state: 'loading' | 'ready' | 'error' = 'loading';
  let error = '';
  let overview: OverviewResponse | null = null;

  function detectBrowserKey(): 'chrome' | 'firefox' | 'edge' {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('edg/')) return 'edge';
    return 'chrome';
  }

  let preferredBrowser: 'chrome' | 'firefox' | 'edge' = 'chrome';

  function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value || 0);
  }

  function formatDate(value: number | null): string {
    if (!value) return 'Unknown';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  function browserLink(key: 'chrome' | 'firefox' | 'edge'): string {
    const dynamic = overview?.links?.[key];
    return dynamic || STORE_LINKS[key];
  }

  async function loadOverview(): Promise<void> {
    state = 'loading';
    error = '';
    try {
      overview = await fetchOverview();
      state = 'ready';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load public metrics.';
      state = 'error';
    }
  }

  onMount(async () => {
    preferredBrowser = detectBrowserKey();
    await loadOverview();
  });
</script>

<section class="hero card">
  <div class="hero-copy">
    <span class="tag">Issue #133 + #100</span>
    <h1>Download your Google Classroom files faster.</h1>
    <p>
      Classroom Quick Downloader is built for students: fewer clicks, faster file access, and a transparent
      status page for reliability.
    </p>
    <div class="hero-actions">
      <a class="cta primary" href={browserLink(preferredBrowser)} target="_blank" rel="noopener noreferrer">
        Install for {preferredBrowser[0].toUpperCase() + preferredBrowser.slice(1)}
      </a>
      <a class="cta" href="{base}/changelog">Read release notes</a>
    </div>
  </div>

  <div class="hero-metric">
    <p>Total Downloads</p>
    <strong>{formatNumber(overview?.totals.downloads ?? 0)}</strong>
    <small>
      {#if overview?.status.systemLive}
        System Live since {formatDate(overview.status.liveSinceUtc)} (UTC)
      {:else}
        System status is currently warming up.
      {/if}
    </small>
  </div>
</section>

{#if state === 'loading'}
  <div class="state-loading">Loading live project metrics…</div>
{:else if state === 'error'}
  <div class="state-error">
    <strong>Could not load live metrics.</strong>
    <p>{error}</p>
    <button type="button" class="retry" on:click={loadOverview}>Retry</button>
  </div>
{:else}
  <section class="metric-grid section-gap">
    <article class="metric">
      <div class="metric-label">Successful Downloads</div>
      <div class="metric-value">{formatNumber(overview?.totals.success ?? 0)}</div>
    </article>
    <article class="metric">
      <div class="metric-label">Failed Downloads</div>
      <div class="metric-value">{formatNumber(overview?.totals.fail ?? 0)}</div>
    </article>
    <article class="metric">
      <div class="metric-label">Store Installs (Combined)</div>
      <div class="metric-value">{formatNumber(overview?.installs.usersTotal ?? 0)}</div>
    </article>
    <article class="metric">
      <div class="metric-label">Worker Health</div>
      <div class="metric-value metric-state {overview?.status.workerHealth}">
        {overview?.status.workerHealth.toUpperCase()}
      </div>
    </article>
  </section>

  <section class="card section-gap availability">
    <div class="section-head">
      <h2>Availability</h2>
      <span>Live store versions from Oracle public API</span>
    </div>

    <div class="store-grid">
      {#each overview?.installs.browsers ?? [] as browser}
        <a
          class="store-card {browser.key === preferredBrowser ? 'preferred' : ''}"
          href={browserLink(browser.key as 'chrome' | 'firefox' | 'edge')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div class="store-head">
            <h3>{browser.name}</h3>
            {#if browser.key === preferredBrowser}
              <span class="badge">Detected Browser</span>
            {/if}
          </div>
          <p><strong>{formatNumber(browser.usersCount)}</strong> users</p>
          <p>Version: <code>{browser.version || 'N/A'}</code></p>
          <p>Rating: <code>{browser.rating || 'N/A'}</code> ({formatNumber(browser.ratingCount)} reviews)</p>
        </a>
      {/each}
    </div>
  </section>

  <section class="card section-gap trust">
    <div class="section-head">
      <h2>Trust & Transparency</h2>
      <span>Public pages mapped to issues #100, #132, #135, #129, #178</span>
    </div>

    <div class="trust-links">
      <a href="{base}/privacy">Privacy policy (public summary)</a>
      <a href="{base}/map">Global country heatmap</a>
      <a href="{base}/uninstall">Uninstall feedback page</a>
      <a href="{base}/changelog">Arc-style release notes</a>
    </div>
  </section>
{/if}

<style>
  .section-gap {
    margin-top: 14px;
  }

  .hero {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 16px;
    padding: 22px;
  }

  .hero-copy h1 {
    margin: 12px 0 10px;
    font-size: clamp(30px, 5vw, 45px);
    letter-spacing: -0.03em;
    line-height: 1.03;
  }

  .hero-copy p {
    color: var(--muted);
    max-width: 60ch;
    line-height: 1.6;
    margin: 0;
  }

  .hero-actions {
    margin-top: 18px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .cta {
    text-decoration: none;
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 10px 14px;
    font-weight: 700;
    color: var(--text);
    background: var(--surface);
  }

  .cta.primary {
    background: linear-gradient(140deg, var(--accent), var(--accent-2));
    border: 0;
    color: #fff;
  }

  .hero-metric {
    border-radius: 16px;
    background: linear-gradient(170deg, #1b2f59, #274794);
    color: #f6f9ff;
    padding: 18px;
  }

  .hero-metric p {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.82;
  }

  .hero-metric strong {
    display: block;
    margin-top: 8px;
    font-size: clamp(34px, 4vw, 48px);
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .hero-metric small {
    display: block;
    margin-top: 10px;
    color: #dce7ff;
  }

  .retry {
    margin-top: 8px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    padding: 6px 10px;
    cursor: pointer;
  }

  .metric-state {
    font-size: 16px;
  }

  .metric-state.up {
    color: var(--good);
  }

  .metric-state.degraded {
    color: var(--warn);
  }

  .metric-state.down {
    color: var(--danger);
  }

  .availability,
  .trust {
    padding: 16px;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: baseline;
    flex-wrap: wrap;
  }

  .section-head h2 {
    margin: 0;
    font-size: 24px;
    letter-spacing: -0.02em;
  }

  .section-head span {
    color: var(--muted);
    font-size: 13px;
  }

  .store-grid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }

  .store-card {
    text-decoration: none;
    border-radius: 14px;
    border: 1px solid var(--border);
    padding: 12px;
    background: var(--surface-2);
    color: var(--text);
  }

  .store-card:hover {
    border-color: #afbfdd;
  }

  .store-card.preferred {
    border-color: #7f9ce8;
    background: #eef3ff;
  }

  .store-head {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    align-items: center;
  }

  .store-head h3 {
    margin: 0;
    font-size: 17px;
  }

  .badge {
    background: #1e3ea5;
    color: #fff;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 700;
  }

  .store-card p {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 14px;
  }

  .trust-links {
    margin-top: 10px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }

  .trust-links a {
    text-decoration: none;
    color: var(--accent-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-2);
    padding: 10px;
    font-weight: 600;
  }

  @media (max-width: 900px) {
    .hero {
      grid-template-columns: 1fr;
    }
  }
</style>
