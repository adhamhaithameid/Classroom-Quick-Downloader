<script lang="ts">
  import { onMount } from 'svelte';
  import { feature } from 'topojson-client';
  import { geoNaturalEarth1, geoPath } from 'd3-geo';
  import { scaleLinear } from 'd3-scale';
  import iso3166 from 'iso-3166-1';
  import worldAtlas from 'world-atlas/countries-110m.json';
  import type { MapResponse } from '$lib/types/public';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';

  type WorldFeature = {
    id?: string | number;
    geometry: unknown;
    properties?: { name?: string };
  };

  const svgWidth = 960;
  const svgHeight = 510;

  export let mapData: MapResponse | null = null;
  export let ariaLabel = 'Country-level extension usage map';
  export let className = '';
  export let showLegend = true;
  export let showLegendLabels = true;
  export let tooltipAnimated = true;

  let countries: WorldFeature[] = [];
  let pathByCountryId = new Map<number, string>();
  let countByCountryId = new Map<number, number>();
  let colorScale = scaleLinear<string>().domain([0, 1]).range(['#d5efe0', '#137a47']);
  let hoveredCountry: { name: string; count: number; x: number; y: number; alignRight: boolean } | null = null;
  let nameByCountryId = new Map<number, string>();

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

    const collection = feature(topology as never, countriesObject as never) as { features?: WorldFeature[] };
    countries = Array.isArray(collection.features) ? collection.features : [];

    const projection = geoNaturalEarth1().fitSize([svgWidth, svgHeight], collection as never);
    const path = geoPath(projection);
    pathByCountryId = new Map<number, string>();

    for (const item of countries) {
      const id = Number(item.id);
      if (!Number.isFinite(id)) continue;
      pathByCountryId.set(id, path(item as never) ?? '');
    }
  }

  function syncMapCounts(source: MapResponse | null): void {
    const next = new Map<number, number>();
    let maxCount = 1;

    if (source) {
      for (const item of source.countries) {
        const id = toNumericCountryId(item.countryCode);
        const count = Math.max(0, item.count || 0);
        if (id == null || count <= 0) continue;
        next.set(id, count);
        maxCount = Math.max(maxCount, count);
      }
    }

    countByCountryId = next;
    colorScale = scaleLinear<string>().domain([0, maxCount]).range(['#d5efe0', '#137a47']);
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
    if (count < 1) {
      hoveredCountry = null;
      return;
    }

    const mapShell = (event.target as Element).closest('.heatmap-shell');
    if (!mapShell) return;
    const shellRect = mapShell.getBoundingClientRect();
    const mouseX = event.clientX - shellRect.left;
    const mouseY = event.clientY - shellRect.top;
    const tooltipWidth = 160;
    const offset = 16;
    const showLeft = mouseX + tooltipWidth + offset > shellRect.width;

    hoveredCountry = {
      name: Number.isFinite(id) ? numericIdToName(id) : 'Unknown',
      count,
      x: showLeft ? mouseX - offset : mouseX + offset,
      y: mouseY,
      alignRight: showLeft
    };
  }

  function clearHover(): void {
    hoveredCountry = null;
  }

  function downloadLabel(count: number): string {
    return count === 1 ? 'Download' : 'Downloads';
  }

  onMount(() => {
    buildWorldGeometry();
  });

  $: syncMapCounts(mapData);
</script>

<div class={`heatmap-shell ${className}`.trim()} role="presentation" on:mouseleave={clearHover}>
  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label={ariaLabel}>
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
      <span>
        <AnimatedNumber value={hoveredCountry.count} animated={tooltipAnimated} />
        {' '}
        {downloadLabel(hoveredCountry.count)}
      </span>
    </div>
  {/if}

  {#if showLegend}
    <div class="legend">
      <div class="legend-gradient" aria-hidden="true"></div>
      {#if showLegendLabels}
        <div class="legend-labels">
          <span>Lower usage</span>
          <span>Higher usage</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .heatmap-shell {
    position: relative;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: linear-gradient(180deg, #f5faf7, #ecf4ef);
    padding: 10px;
    overflow: hidden;
  }

  .heatmap-shell svg {
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

  .map-tooltip {
    position: absolute;
    transform: translateY(-50%);
    background: #102d1f;
    color: #f3fff9;
    border-radius: 10px;
    padding: 8px 10px;
    box-shadow: var(--shadow);
    display: grid;
    gap: 2px;
    pointer-events: none;
    min-width: 140px;
    z-index: 3;
  }

  .map-tooltip.align-right {
    transform: translate(-100%, -50%);
  }

  .map-tooltip strong {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .map-tooltip span {
    font-size: 11px;
    color: rgba(230, 255, 242, 0.9);
    font-weight: 600;
  }

  .legend {
    display: grid;
    gap: 6px;
    margin-top: 8px;
  }

  .legend-gradient {
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(90deg, #d5efe0, #137a47);
    border: 1px solid rgba(19, 122, 71, 0.2);
  }

  .legend-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--muted);
  }

  @media (max-width: 700px) {
    .heatmap-shell {
      padding: 6px;
    }
  }
</style>
