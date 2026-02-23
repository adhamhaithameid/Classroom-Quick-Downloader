<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchWebsiteSnapshot, ORACLE_SNAPSHOT_REFRESH_MS } from '$lib/api/publicSite';
  import type { MapResponse } from '$lib/types/public';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
  import CountryHeatmap from '$lib/components/CountryHeatmap.svelte';

  type TopCountry = {
    countryCode: string;
    count: number;
    name: string;
  };

  const displayNames =
    typeof Intl !== 'undefined' && 'DisplayNames' in Intl
      ? new Intl.DisplayNames(['en'], { type: 'region' })
      : null;

  let state: 'loading' | 'ready' | 'error' = 'loading';
  let error = '';
  let refreshing = false;
  let mapData: MapResponse | null = null;

  let topCountries: TopCountry[] = [];

  function toCountryName(code: string): string {
    const label = displayNames?.of(code.toUpperCase());
    return label || code.toUpperCase();
  }

  function syncMapCounts(): void {
    topCountries = [];
    if (!mapData) return;

    topCountries = mapData.countries.slice(0, 12).map((entry) => ({
      countryCode: entry.countryCode.toUpperCase(),
      count: entry.count,
      name: toCountryName(entry.countryCode)
    }));
  }

  async function loadMap(force = false): Promise<void> {
    if (!force) state = 'loading';
    if (force) refreshing = true;
    error = '';
    try {
      const snapshot = await fetchWebsiteSnapshot({ force });
      mapData = snapshot.map;
      syncMapCounts();
      state = 'ready';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load map data.';
      state = 'error';
    } finally {
      refreshing = false;
    }
  }

  onMount(async () => {
    await loadMap();
    const timer = window.setInterval(() => {
      void loadMap(true);
    }, ORACLE_SNAPSHOT_REFRESH_MS);
    return () => window.clearInterval(timer);
  });
</script>

<section class="card map-page">
  <div class="intro">
    <h1>Where Students Use CQD</h1>
    <p>This map shows country-level activity only. It is an approximate, privacy-safe view.</p>
  </div>
  <div class="intro-actions">
    <button type="button" class="refresh-btn" on:click={() => loadMap(true)} disabled={refreshing}>
      {refreshing ? 'Refreshing…' : '↻ Refresh map data'}
    </button>
  </div>

  {#if state === 'loading'}
    <div class="state-loading">Loading map data…</div>
  {:else if state === 'error'}
    <div class="state-error">
      <strong>Could not load map data.</strong>
      <p>{error}</p>
      <button type="button" class="refresh-btn" on:click={() => loadMap(true)} disabled={refreshing}>Retry</button>
    </div>
  {:else}
    <div class="summary-grid">
      <article class="metric">
        <div class="metric-label">Total Downloads Represented</div>
        <div class="metric-value"><AnimatedNumber value={mapData?.totals.downloads ?? 0} animated /></div>
      </article>
      <article class="metric">
        <div class="metric-label">Countries Represented</div>
        <div class="metric-value"><AnimatedNumber value={mapData?.totals.countries ?? 0} animated /></div>
      </article>
      <article class="metric">
        <div class="metric-label">Map Granularity</div>
        <div class="metric-value">Country</div>
      </article>
    </div>

    <CountryHeatmap {mapData} ariaLabel="Country-level extension usage map" />

    <div class="bottom-grid">
      <section class="card mini">
        <h2>Top Countries</h2>
        {#if topCountries.length === 0}
          <div class="state-empty">No country data available yet.</div>
        {:else}
          <ul>
            {#each topCountries as item}
              <li>
                <span class="country-name">{item.name}</span>
                <strong><AnimatedNumber value={item.count} animated /></strong>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="card mini">
        <h2>Privacy Note</h2>
        <p>{mapData?.privacyNote}</p>
        <p>
          VPNs, corporate gateways, and proxies can shift apparent country location. This page is informational, not
          identity tracking.
        </p>
      </section>
    </div>
  {/if}
</section>

<style>
  .map-page {
    padding: 24px;
    display: grid;
    gap: 16px;
  }

  .intro h1 {
    margin: 0 0 8px;
    font-size: clamp(28px, 4vw, 42px);
    letter-spacing: -0.03em;
    font-weight: 800;
  }

  .intro p {
    margin: 0;
    line-height: 1.65;
    color: var(--text-secondary);
    max-width: 60ch;
    font-size: 15px;
  }

  .intro-actions {
    display: flex;
    justify-content: flex-end;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  /* ── Map ───────────────────────────── */
  .map-shell {
    position: relative;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: linear-gradient(180deg, #f5faf7, #ecf4ef);
    padding: 10px;
    overflow: hidden;
  }

  .map-shell svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .country-path {
    transition: opacity 0.15s ease, filter 0.15s ease;
    cursor: pointer;
  }

  .country-path:hover {
    opacity: 0.85;
    filter: brightness(0.9) saturate(1.3);
    stroke-width: 1.5;
    stroke: var(--gc-green);
  }

  /* ── Tooltip ───────────────────────── */
  .map-tooltip {
    position: absolute;
    pointer-events: none;
    transform: translateY(-50%);
    background: white;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 14px;
    box-shadow: var(--shadow);
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 140px;
    animation: riseIn 0.15s ease both;
    white-space: nowrap;
  }

  .map-tooltip.align-right {
    transform: translate(-100%, -50%);
  }

  .map-tooltip strong {
    font-size: 14px;
    color: var(--text);
  }

  .map-tooltip span {
    font-size: 12px;
    color: var(--gc-green);
    font-weight: 600;
  }

  /* ── Legend ─────────────────────────── */
  .legend {
    display: grid;
    gap: 6px;
  }

  .legend-gradient {
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(90deg, #d5efe0 0%, #137a47 100%);
    border: 1px solid var(--border);
  }

  .legend-labels {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }

  /* ── Bottom ─────────────────────────── */
  .bottom-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .mini {
    padding: 20px;
  }

  .mini h2 {
    margin: 0 0 12px;
    font-size: 18px;
    letter-spacing: -0.02em;
    font-weight: 700;
  }

  .mini p {
    margin: 10px 0 0;
    line-height: 1.7;
    color: var(--text-secondary);
    font-size: 14px;
  }

  .mini ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  .mini li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    background: white;
    font-size: 14px;
    transition: all 0.25s ease;
    box-shadow: var(--shadow-sm);
  }

  .mini li:hover {
    border-color: var(--border-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow);
  }

  .country-name {
    color: var(--text);
    font-weight: 500;
  }

  .mini li strong {
    color: var(--gc-green);
    font-weight: 700;
  }

  .refresh-btn {
    border: 1px solid var(--border);
    border-radius: 999px;
    background: white;
    padding: 8px 16px;
    cursor: pointer;
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 13px;
    transition: all 0.25s ease;
    box-shadow: var(--shadow-sm);
  }

  .refresh-btn:hover {
    border-color: var(--border-hover);
    color: var(--gc-green);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }
</style>
