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
    colorScale = scaleLinear<string>().domain([0, maxCount]).range(['#d5efe0', '#137a47']);
    topCountries = top.slice(0, 12);
  }

  function fillForCountry(rawId: string | number | undefined): string {
    const id = Number(rawId);
    if (!Number.isFinite(id)) return '#f0f5f2';
    const count = countByCountryId.get(id);
    if (!count) return '#f0f5f2';
    return colorScale(count);
  }

  function borderForCountry(rawId: string | number | undefined): string {
    const id = Number(rawId);
    if (!Number.isFinite(id)) return '#d6e4da';
    return countByCountryId.has(id) ? '#5daa82' : '#d6e4da';
  }

  function handleCountryHover(event: MouseEvent, item: WorldFeature): void {
    const id = Number(item.id);
    const count = Number.isFinite(id) ? countByCountryId.get(id) ?? 0 : 0;
    // Only show tooltip for countries with at least 1 download
    if (count < 1) {
      hoveredCountry = null;
      return;
    }
    const name = Number.isFinite(id) ? numericIdToName(id) : 'Unknown';
    const mapShell = (event.target as Element).closest('.map-shell');
    if (!mapShell) return;
    const shellRect = mapShell.getBoundingClientRect();
    const mouseX = event.clientX - shellRect.left;
    const mouseY = event.clientY - shellRect.top;
    const shellWidth = shellRect.width;
    // Position tooltip to the right of cursor, or left if too close to edge
    const tooltipWidth = 160;
    const offset = 16;
    const showLeft = mouseX + tooltipWidth + offset > shellWidth;
    hoveredCountry = {
      name,
      count,
      x: showLeft ? mouseX - offset : mouseX + offset,
      y: mouseY,
      alignRight: showLeft
    };
  }

  function clearHover(): void {
    hoveredCountry = null;
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
        <div class="metric-value"><AnimatedNumber value={mapData?.totals.downloads ?? 0} /></div>
      </article>
      <article class="metric">
        <div class="metric-label">Countries Represented</div>
        <div class="metric-value"><AnimatedNumber value={mapData?.totals.countries ?? 0} /></div>
      </article>
      <article class="metric">
        <div class="metric-label">Map Granularity</div>
        <div class="metric-value">Country</div>
      </article>
    </div>

    <div class="map-shell" role="presentation" on:mouseleave={clearHover}>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label="Country-level extension usage map">
        {#each countries as item}
          <path
            class="country-path"
            role="img"
            d={pathByCountryId.get(Number(item.id)) ?? ''}
            fill={fillForCountry(item.id)}
            stroke={borderForCountry(item.id)}
            stroke-width="0.7"
            on:mouseenter={(e) => handleCountryHover(e, item)}
            on:mousemove={(e) => handleCountryHover(e, item)}
            on:mouseleave={clearHover}
          />
        {/each}
      </svg>

      {#if hoveredCountry}
        <div
          class="map-tooltip"
          class:align-right={hoveredCountry.alignRight}
          style="left: {hoveredCountry.x}px; top: {hoveredCountry.y}px"
        >
          <strong>{hoveredCountry.name}</strong>
          <span><AnimatedNumber value={hoveredCountry.count} /> downloads</span>
        </div>
      {/if}
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
            {#each topCountries as item, ti}
              <li>
                <span class="country-name">{item.name}</span>
                <strong><AnimatedNumber value={item.count} /></strong>
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
