<script lang="ts">
  import { onMount } from 'svelte';
  import { feature } from 'topojson-client';
  import { geoNaturalEarth1, geoPath } from 'd3-geo';
  import { scaleLinear } from 'd3-scale';
  import iso3166 from 'iso-3166-1';
  import worldAtlas from 'world-atlas/countries-110m.json';
  import { fetchMapData } from '$lib/api/publicSite';
  import type { MapResponse } from '$lib/types/public';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';

  type WorldFeature = {
    id?: string | number;
    geometry: unknown;
    properties?: { name?: string };
  };

  type TopCountry = {
    countryCode: string;
    count: number;
    name: string;
  };

  const svgWidth = 960;
  const svgHeight = 510;
  const displayNames =
    typeof Intl !== 'undefined' && 'DisplayNames' in Intl
      ? new Intl.DisplayNames(['en'], { type: 'region' })
      : null;

  let state: 'loading' | 'ready' | 'error' = 'loading';
  let error = '';
  let refreshing = false;
  let mapData: MapResponse | null = null;

  let countries: WorldFeature[] = [];
  let pathByCountryId = new Map<number, string>();
  let countByCountryId = new Map<number, number>();
  let maxCount = 1;
  let colorScale = scaleLinear<string>().domain([0, 1]).range(['#e0f2e9', '#137a47']);
  let topCountries: TopCountry[] = [];

  // Hover tooltip state
  let hoveredCountry: { name: string; count: number; x: number; y: number; alignRight: boolean } | null = null;

  // Lookup: numeric ID -> country name
  let nameByCountryId = new Map<number, string>();

  function toCountryName(code: string): string {
    const label = displayNames?.of(code.toUpperCase());
    return label || code.toUpperCase();
  }

  function toNumericCountryId(countryCode: string): number | null {
    const normalized = countryCode.trim().toUpperCase();
    if (!normalized) return null;
    const resolved = iso3166.whereAlpha2(normalized);
    if (!resolved?.numeric) return null;
    const numeric = Number(resolved.numeric);
    if (!Number.isFinite(numeric)) return null;
    return numeric;
  }

  function numericIdToName(numericId: number): string {
    const cached = nameByCountryId.get(numericId);
    if (cached) return cached;
    const resolved = iso3166.whereNumeric(String(numericId).padStart(3, '0'));
    if (resolved?.country) {
      nameByCountryId.set(numericId, resolved.country);
      return resolved.country;
    }
    return 'Unknown';
  }

  function buildWorldGeometry(): void {
    const topology = worldAtlas as Record<string, unknown>;
    const objects = topology.objects as Record<string, unknown>;
    const countriesObject = objects?.countries;
    if (!countriesObject) return;

    const collection = feature(topology as never, countriesObject as never) as {
      features?: WorldFeature[];
    };
    countries = Array.isArray(collection.features) ? collection.features : [];

    const projection = geoNaturalEarth1().fitSize([svgWidth, svgHeight], collection as never);
    const path = geoPath(projection);

    pathByCountryId = new Map<number, string>();
    for (const item of countries) {
      const id = Number(item.id);
      if (!Number.isFinite(id)) continue;
      const pathValue = path(item as never) ?? '';
      pathByCountryId.set(id, pathValue);
    }
  }

  function syncMapCounts(): void {
    countByCountryId = new Map<number, number>();
    topCountries = [];
    maxCount = 1;
    colorScale = scaleLinear<string>().domain([0, 1]).range(['#e0f2e9', '#137a47']);

    if (!mapData) return;

    const validCounts: number[] = [];
    const top: TopCountry[] = [];

    for (const entry of mapData.countries) {
      const id = toNumericCountryId(entry.countryCode);
      if (id == null) continue;
      const count = Math.max(0, entry.count || 0);
      if (count <= 0) continue;

      countByCountryId.set(id, count);
      validCounts.push(count);
      top.push({
        countryCode: entry.countryCode.toUpperCase(),
        count,
        name: toCountryName(entry.countryCode)
      });
    }

    maxCount = validCounts.length ? Math.max(...validCounts) : 1;
    colorScale = scaleLinear<string>().domain([0, maxCount]).range(['#dbe6fb', '#1648a1']);
    topCountries = top.slice(0, 12);
  }

  function fillForCountry(rawId: string | number | undefined): string {
    const id = Number(rawId);
    if (!Number.isFinite(id)) return '#edf2fb';
    const count = countByCountryId.get(id);
    if (!count) return '#edf2fb';
    return colorScale(count);
  }

  function borderForCountry(rawId: string | number | undefined): string {
    const id = Number(rawId);
    if (!Number.isFinite(id)) return '#d0d9ea';
    return countByCountryId.has(id) ? '#7d95bf' : '#d0d9ea';
  }

  function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value || 0);
  }

  async function loadMap(force = false): Promise<void> {
    if (!force) state = 'loading';
    if (force) refreshing = true;
    error = '';
    try {
      mapData = await fetchMapData();
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
    buildWorldGeometry();
    await loadMap();
  });
</script>

<section class="card map-page">
  <div class="intro">
    <h1>Where Students Use CQD</h1>
    <p>This map shows country-level activity only. It is an approximate, privacy-safe view.</p>
  </div>
  <div class="intro-actions">
    <button type="button" class="retry" on:click={() => loadMap(true)} disabled={refreshing}>
      {refreshing ? 'Refreshing…' : 'Refresh map data'}
    </button>
  </div>

  {#if state === 'loading'}
    <div class="state-loading">Loading map data…</div>
  {:else if state === 'error'}
    <div class="state-error">
      <strong>Could not load map data.</strong>
      <p>{error}</p>
      <button type="button" class="retry" on:click={() => loadMap(true)} disabled={refreshing}>Retry</button>
    </div>
  {:else}
    <div class="summary-grid">
      <article class="metric">
        <div class="metric-label">Total Downloads Represented</div>
        <div class="metric-value">{formatNumber(mapData?.totals.downloads ?? 0)}</div>
      </article>
      <article class="metric">
        <div class="metric-label">Countries Represented</div>
        <div class="metric-value">{formatNumber(mapData?.totals.countries ?? 0)}</div>
      </article>
      <article class="metric">
        <div class="metric-label">Map Granularity</div>
        <div class="metric-value">Country</div>
      </article>
    </div>

    <div class="map-shell">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label="Country-level extension usage map">
        {#each countries as item}
          <path
            d={pathByCountryId.get(Number(item.id)) ?? ''}
            fill={fillForCountry(item.id)}
            stroke={borderForCountry(item.id)}
            stroke-width="0.7"
          />
        {/each}
      </svg>
    </div>

    <div class="legend">
      <div class="legend-gradient" aria-hidden="true"></div>
      <div class="legend-labels">
        <span>Lower usage</span>
        <span>Higher usage</span>
      </div>
    </div>

    <div class="bottom-grid">
      <section class="card mini">
        <h2>Top Countries</h2>
        {#if topCountries.length === 0}
          <div class="state-empty">No country data available yet.</div>
        {:else}
          <ul>
            {#each topCountries as item}
              <li>
                <span>{item.name} ({item.countryCode})</span>
                <strong>{formatNumber(item.count)}</strong>
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
    padding: 18px;
    display: grid;
    gap: 14px;
  }

  .intro h1 {
    margin: 12px 0 8px;
    font-size: clamp(30px, 4vw, 44px);
    letter-spacing: -0.03em;
  }

  .intro p {
    margin: 0;
    line-height: 1.6;
    color: var(--muted);
    max-width: 70ch;
  }

  .intro-actions {
    display: flex;
    justify-content: flex-end;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 10px;
  }

  .map-shell {
    border: 1px solid var(--border);
    border-radius: 16px;
    background: linear-gradient(180deg, #f6f9ff, #edf3fb);
    padding: 8px;
  }

  .map-shell svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .legend {
    display: grid;
    gap: 8px;
  }

  .legend-gradient {
    height: 14px;
    border-radius: 999px;
    background: linear-gradient(90deg, #dbe7ff 0%, #1648a1 100%);
    border: 1px solid #c9d8f7;
  }

  .legend-labels {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
    font-size: 12px;
  }

  .bottom-grid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }

  .mini {
    padding: 14px;
  }

  .mini h2 {
    margin: 0 0 8px;
    font-size: 19px;
    letter-spacing: -0.02em;
  }

  .mini p {
    margin: 8px 0 0;
    line-height: 1.6;
    color: var(--muted);
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
    border-radius: 10px;
    padding: 8px 10px;
    background: var(--surface-2);
  }

  .retry {
    margin-top: 8px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    padding: 6px 10px;
    cursor: pointer;
  }

  .retry:disabled {
    opacity: 0.72;
    cursor: wait;
  }
</style>
