<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import logo from '$lib/assets/cqd-logo.svg';
  import { fetchMapData, fetchOverview } from '$lib/api/publicSite';
  import { STORE_LINKS } from '$lib/config';
  import type { OverviewResponse } from '$lib/types/public';

  let state: 'loading' | 'ready' | 'error' = 'loading';
  let error = '';
  let overview: OverviewResponse | null = null;
  let topCountries: Array<{ countryCode: string; count: number }> = [];

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
      const [overviewResult, mapResult] = await Promise.allSettled([fetchOverview(), fetchMapData()]);

      if (overviewResult.status !== 'fulfilled') {
        throw overviewResult.reason;
      }
      overview = overviewResult.value;

      if (mapResult.status === 'fulfilled') {
        topCountries = mapResult.value.countries.slice(0, 3);
      } else {
        topCountries = [];
      }
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
    <div class="hero-logo-row">
      <img src={logo} alt="Classroom Quick Downloader logo" />
      <div>
        <p class="eyebrow">Public Product Website</p>
        <h1>Download Classroom files in one smooth flow.</h1>
      </div>
    </div>

    <p class="hero-description">
      Classroom Quick Downloader removes repetitive clicks and keeps performance transparent with live public metrics.
    </p>

    <div class="hero-actions">
      <a class="cta primary" href={browserLink(preferredBrowser)} target="_blank" rel="noopener noreferrer">
        Install for {preferredBrowser[0].toUpperCase() + preferredBrowser.slice(1)}
      </a>
      <a class="cta" href="{base}/changelog">Read `CHANGELOG.md`</a>
      <a class="cta ghost" href="{base}/privacy">Review privacy policy</a>
    </div>
  </div>

  <div class="hero-metric">
    <p>Total Downloads</p>
    <strong>{formatNumber(overview?.totals.downloads ?? 0)}</strong>
    <small>
      {#if overview?.status.systemLive}
        System live since {formatDate(overview.status.liveSinceUtc)} (UTC)
      {:else}
        Status monitor is warming up.
      {/if}
    </small>
    <div class="pulse" aria-hidden="true"></div>
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
      <h2>Install & Version Data</h2>
      <span>Live values from Oracle public APIs</span>
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
      <h2>Global Reach Snapshot</h2>
      <span>Country-level aggregate usage</span>
    </div>

    {#if topCountries.length > 0}
      <ul class="top-countries">
        {#each topCountries as country}
          <li>
            <span>{country.countryCode}</span>
            <strong>{formatNumber(country.count)}</strong>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="state-empty">Country snapshot is temporarily unavailable.</div>
    {/if}

    <div class="trust-links">
      <a href="{base}/privacy">Read privacy policy</a>
      <a href="{base}/map">Open global map</a>
      <a href="{base}/uninstall">Send uninstall feedback</a>
      <a href="{base}/changelog">Read full changelog</a>
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
    padding: 24px;
    position: relative;
    overflow: hidden;
  }

  .hero::after {
    content: '';
    position: absolute;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(40, 98, 255, 0.2), transparent 65%);
    right: -110px;
    top: -120px;
  }

  .hero-logo-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 14px;
    align-items: center;
  }

  .hero-logo-row img {
    width: 74px;
    height: 74px;
    border-radius: 16px;
    background: white;
    box-shadow: 0 16px 30px rgba(20, 61, 160, 0.22);
    padding: 8px;
  }

  .eyebrow {
    margin: 0;
    color: #3b5aa5;
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .hero-copy h1 {
    margin: 8px 0 0;
    font-size: clamp(34px, 5vw, 56px);
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .hero-description {
    margin: 16px 0 0;
    color: var(--muted);
    max-width: 62ch;
    line-height: 1.75;
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
    padding: 11px 14px;
    font-weight: 700;
    color: var(--text);
    background: var(--surface);
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .cta:hover {
    transform: translateY(-1px);
    border-color: #96addd;
  }

  .cta.primary {
    background: linear-gradient(140deg, var(--accent), var(--accent-2));
    border: 0;
    color: #fff;
  }

  .cta.ghost {
    background: rgba(255, 255, 255, 0.62);
  }

  .hero-metric {
    border-radius: 18px;
    background: linear-gradient(180deg, #132f6c, #1f52b4);
    color: #f6f9ff;
    padding: 18px;
    position: relative;
    overflow: hidden;
  }

  .hero-metric p {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.82;
  }

  .hero-metric strong {
    display: block;
    margin-top: 8px;
    font-size: clamp(38px, 5vw, 56px);
    line-height: 0.94;
    letter-spacing: -0.03em;
  }

  .hero-metric small {
    display: block;
    margin-top: 12px;
    color: #dce7ff;
    line-height: 1.5;
  }

  .pulse {
    position: absolute;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    right: -45px;
    bottom: -65px;
    border: 1px solid rgba(204, 224, 255, 0.3);
    animation: pulse 4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.08);
      opacity: 0.34;
    }
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
    padding: 18px;
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
    font-size: 26px;
    letter-spacing: -0.03em;
  }

  .section-head span {
    color: var(--muted);
    font-size: 13px;
  }

  .store-grid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 10px;
  }

  .store-card {
    text-decoration: none;
    border-radius: 16px;
    border: 1px solid var(--border);
    padding: 13px;
    background: var(--surface-2);
    color: var(--text);
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .store-card:hover {
    transform: translateY(-2px);
    border-color: #9cb3df;
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

  .top-countries {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 8px;
  }

  .top-countries li {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px;
    background: var(--surface-2);
    display: flex;
    justify-content: space-between;
  }

  .trust-links {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }

  .trust-links a {
    text-decoration: none;
    color: var(--accent-2);
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-2);
    padding: 10px;
    font-weight: 600;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .trust-links a:hover {
    transform: translateY(-1px);
    border-color: #97addb;
  }

  @media (max-width: 900px) {
    .hero {
      grid-template-columns: 1fr;
    }
  }
</style>
