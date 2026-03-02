<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { feature } from 'topojson-client';
  import { geoCentroid, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
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

  type HoveredCountry = {
    id: number;
    name: string;
    count: number;
    x: number;
    y: number;
    alignRight: boolean;
  };

  type FocusAnimation = {
    startRotation: number;
    startLatitude: number;
    targetRotation: number;
    targetLatitude: number;
    startedAt: number;
    durationMs: number;
  };

  const viewSize = 640;
  const BASE_SCALE = viewSize * 0.425;
  const DEFAULT_ROTATION = -24;
  const DEFAULT_LATITUDE = -14;

  const DRAG_SENSITIVITY = 0.24;
  const MIN_LATITUDE = -75;
  const MAX_LATITUDE = 75;
  const POLE_RESET_THRESHOLD = 62;
  const POLE_RESET_DELAY_MS = 1000;
  const DRAG_CLICK_THRESHOLD_PX = 4;

  const INERTIA_DECAY_PER_SECOND = 0.18;
  const INERTIA_STOP_VELOCITY = 2.8;
  const FOCUS_DURATION_MS = 440;

  const projection = geoOrthographic()
    .translate([viewSize / 2, viewSize / 2])
    .scale(BASE_SCALE)
    .clipAngle(90)
    .precision(0.5);
  const pathBuilder = geoPath(projection);

  export let mapData: MapResponse | null = null;
  export let ariaLabel = 'Country-level extension usage globe';
  export let className = '';
  export let rotationSpeed = 12;
  export let tooltipAnimated = true;
  export let idPrefix = 'cqd-globe';

  let countries: WorldFeature[] = [];
  let featureByCountryId = new Map<number, WorldFeature>();
  let pathByCountryId = new Map<number, string>();
  let countByCountryId = new Map<number, number>();
  let nameByCountryId = new Map<number, string>();
  let colorScale = scaleLinear<string>().domain([0, 1]).range(['#d6ece0', '#146d46']);

  let spherePath = '';
  let graticulePath = '';
  let rotation = DEFAULT_ROTATION;
  let latitude = DEFAULT_LATITUDE;
  let autoSpinDirection: 1 | -1 = 1;
  let poleResetTimer: ReturnType<typeof setTimeout> | null = null;

  let animationFrameId = 0;
  let lastAnimationTs = 0;
  let focusAnimation: FocusAnimation | null = null;
  let inertiaActive = false;
  let velocityLon = 0;
  let velocityLat = 0;

  let hoveredCountry: HoveredCountry | null = null;
  let selectedCountryId: number | null = null;

  let isDragging = false;
  let dragPointerId: number | null = null;
  let dragMoved = false;
  let suppressNextClick = false;
  let lastDragTs = 0;
  let lastDragX = 0;
  let lastDragY = 0;

  $: gradientId = `${idPrefix}-gradient`;
  $: shineId = `${idPrefix}-shine`;
  $: atmosphereId = `${idPrefix}-atmosphere`;
  $: clipPathId = `${idPrefix}-clip`;
  $: syncMapCounts(mapData);

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeAngle(value: number): number {
    const normalized = value % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function shortestAngleDelta(from: number, to: number): number {
    return ((to - from + 540) % 360) - 180;
  }

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
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

    const collection = feature(topology as never, countriesObject as never) as { features?: WorldFeature[] };
    countries = Array.isArray(collection.features) ? collection.features : [];

    const nextFeatures = new Map<number, WorldFeature>();
    for (const item of countries) {
      const id = Number(item.id);
      if (!Number.isFinite(id)) continue;
      nextFeatures.set(id, item);
    }
    featureByCountryId = nextFeatures;
    updateProjectedPaths();
  }

  function applyProjection(): void {
    projection.rotate([rotation, latitude, 0]).scale(BASE_SCALE);
    updateProjectedPaths();
  }

  function updateProjectedPaths(): void {
    spherePath = pathBuilder({ type: 'Sphere' } as never) ?? '';
    graticulePath = pathBuilder(geoGraticule10() as never) ?? '';

    const next = new Map<number, string>();
    for (const item of countries) {
      const id = Number(item.id);
      if (!Number.isFinite(id)) continue;
      next.set(id, pathBuilder(item as never) ?? '');
    }
    pathByCountryId = next;
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
    colorScale = scaleLinear<string>().domain([0, maxCount]).range(['#d6ece0', '#146d46']);

    if (selectedCountryId != null && (next.get(selectedCountryId) ?? 0) < 1) {
      selectedCountryId = null;
    }
  }

  function startFocusToCountry(id: number): void {
    const item = featureByCountryId.get(id);
    if (!item) return;

    const [lon, lat] = geoCentroid(item as never);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;

    const targetRotation = normalizeAngle(-lon);
    const targetLatitude = clamp(-lat, MIN_LATITUDE, MAX_LATITUDE);
    const directionDelta = shortestAngleDelta(rotation, targetRotation);

    if (Math.abs(directionDelta) > 0.2) {
      autoSpinDirection = directionDelta >= 0 ? 1 : -1;
    }

    focusAnimation = {
      startRotation: rotation,
      startLatitude: latitude,
      targetRotation,
      targetLatitude,
      startedAt: performance.now(),
      durationMs: FOCUS_DURATION_MS
    };

    inertiaActive = false;
    velocityLon = 0;
    velocityLat = 0;
  }

  function clearSelectedCountry(): void {
    selectedCountryId = null;
  }

  function clearPoleResetTimer(): void {
    if (poleResetTimer) {
      clearTimeout(poleResetTimer);
      poleResetTimer = null;
    }
  }

  function schedulePoleResetIfNeeded(): void {
    clearPoleResetTimer();
    if (Math.abs(latitude) < POLE_RESET_THRESHOLD) return;

    poleResetTimer = setTimeout(() => {
      if (isDragging) return;

      focusAnimation = {
        startRotation: rotation,
        startLatitude: latitude,
        targetRotation: normalizeAngle(DEFAULT_ROTATION),
        targetLatitude: DEFAULT_LATITUDE,
        startedAt: performance.now(),
        durationMs: FOCUS_DURATION_MS + 220
      };

      inertiaActive = false;
      velocityLon = 0;
      velocityLat = 0;
      poleResetTimer = null;
    }, POLE_RESET_DELAY_MS);
  }

  function startRotationLoop(): void {
    const animate = (timestamp: number) => {
      if (lastAnimationTs === 0) lastAnimationTs = timestamp;
      const elapsed = (timestamp - lastAnimationTs) / 1000;
      lastAnimationTs = timestamp;

      let changed = false;

      if (focusAnimation) {
        const progress = clamp((timestamp - focusAnimation.startedAt) / focusAnimation.durationMs, 0, 1);
        const eased = easeOutCubic(progress);

        rotation = normalizeAngle(
          focusAnimation.startRotation +
            shortestAngleDelta(focusAnimation.startRotation, focusAnimation.targetRotation) * eased
        );
        latitude =
          focusAnimation.startLatitude +
          (focusAnimation.targetLatitude - focusAnimation.startLatitude) * eased;
        changed = true;

        if (progress >= 1) {
          focusAnimation = null;
        }
      } else if (!isDragging && inertiaActive) {
        rotation = normalizeAngle(rotation + velocityLon * elapsed);
        latitude = clamp(latitude + velocityLat * elapsed, MIN_LATITUDE, MAX_LATITUDE);

        const decay = Math.pow(INERTIA_DECAY_PER_SECOND, elapsed);
        velocityLon *= decay;
        velocityLat *= decay;
        changed = true;

        if (Math.abs(velocityLon) < INERTIA_STOP_VELOCITY && Math.abs(velocityLat) < INERTIA_STOP_VELOCITY) {
          if (Math.abs(velocityLon) > 0.05) {
            autoSpinDirection = velocityLon >= 0 ? 1 : -1;
          }
          inertiaActive = false;
          velocityLon = 0;
          velocityLat = 0;
        }
      } else if (!isDragging) {
        rotation = normalizeAngle(rotation + autoSpinDirection * rotationSpeed * elapsed);
        changed = true;
      }

      if (changed) applyProjection();
      animationFrameId = scheduleAnimationFrame(animate);
    };

    applyProjection();
    animationFrameId = requestAnimationFrame(animate);
  }

  function stopRotationLoop(): void {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
    lastAnimationTs = 0;
  }

  function fillForCountry(rawId: string | number | undefined): string {
    const id = Number(rawId);
    if (!Number.isFinite(id)) return '#edf4ef';
    const count = countByCountryId.get(id);
    if (!count) return '#edf4ef';
    return colorScale(count);
  }

  function strokeForCountry(rawId: string | number | undefined): string {
    const id = Number(rawId);
    if (!Number.isFinite(id)) return '#cfe1d6';
    if (selectedCountryId === id) return '#0f5f3b';
    return countByCountryId.has(id) ? '#4a9e74' : '#cfe1d6';
  }

  function handleCountryHover(event: MouseEvent, item: WorldFeature): void {
    if (isDragging) return;

    const id = Number(item.id);
    const count = Number.isFinite(id) ? countByCountryId.get(id) ?? 0 : 0;
    if (count < 1) {
      hoveredCountry = null;
      return;
    }

    const shell = (event.currentTarget as Element).closest('.globe-shell');
    if (!shell) return;
    const shellRect = shell.getBoundingClientRect();
    const mouseX = event.clientX - shellRect.left;
    const mouseY = event.clientY - shellRect.top;
    const tooltipWidth = 170;
    const offset = 16;
    const showLeft = mouseX + tooltipWidth + offset > shellRect.width;

    hoveredCountry = {
      id,
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

  function handleCountryClick(event: MouseEvent, item: WorldFeature): void {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (isDragging) return;

    const id = Number(item.id);
    const count = Number.isFinite(id) ? countByCountryId.get(id) ?? 0 : 0;
    if (!Number.isFinite(id) || count < 1) return;

    hoveredCountry = null;

    if (selectedCountryId === id) {
      clearSelectedCountry();
      return;
    }

    selectedCountryId = id;
    startFocusToCountry(id);
  }

  function startDrag(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (dragPointerId != null && dragPointerId !== event.pointerId) return;

    clearPoleResetTimer();
    hoveredCountry = null;
    suppressNextClick = false;

    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture(event.pointerId);

    isDragging = true;
    dragPointerId = event.pointerId;
    dragMoved = false;
    lastDragTs = event.timeStamp || performance.now();
    lastDragX = event.clientX;
    lastDragY = event.clientY;
    inertiaActive = false;
    focusAnimation = null;
    velocityLon = 0;
    velocityLat = 0;
  }

  function dragGlobe(event: PointerEvent): void {
    if (!isDragging || dragPointerId !== event.pointerId) return;

    const dx = event.clientX - lastDragX;
    const dy = event.clientY - lastDragY;
    if (dx === 0 && dy === 0) return;
    lastDragX = event.clientX;
    lastDragY = event.clientY;

    if (Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD_PX) {
      dragMoved = true;
    }

    const deltaLon = dx * DRAG_SENSITIVITY;
    const deltaLat = -dy * DRAG_SENSITIVITY;

    rotation = normalizeAngle(rotation + deltaLon);
    latitude = clamp(latitude + deltaLat, MIN_LATITUDE, MAX_LATITUDE);
    applyProjection();

    if (Math.abs(dx) > 0.25) {
      autoSpinDirection = dx >= 0 ? 1 : -1;
    }

    const timestamp = event.timeStamp || performance.now();
    const elapsed = Math.max((timestamp - lastDragTs) / 1000, 1 / 240);
    lastDragTs = timestamp;

    const instantaneousLonVelocity = deltaLon / elapsed;
    const instantaneousLatVelocity = deltaLat / elapsed;
    velocityLon = velocityLon * 0.72 + instantaneousLonVelocity * 0.28;
    velocityLat = velocityLat * 0.72 + instantaneousLatVelocity * 0.28;
  }

  function endDrag(event: PointerEvent): void {
    if (dragPointerId !== event.pointerId) return;

    const target = event.currentTarget as HTMLElement | null;
    if (target && target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }

    if (dragPointerId != null) {
      suppressNextClick = dragMoved;
      if (Math.abs(velocityLon) > INERTIA_STOP_VELOCITY || Math.abs(velocityLat) > INERTIA_STOP_VELOCITY) {
        inertiaActive = true;
      } else {
        inertiaActive = false;
        velocityLon = 0;
        velocityLat = 0;
      }
    }

    isDragging = false;
    dragPointerId = null;
    schedulePoleResetIfNeeded();
  }

  function handleLostPointerCapture(event: PointerEvent): void {
    if (dragPointerId === event.pointerId) {
      isDragging = false;
      dragPointerId = null;
      dragMoved = false;
      schedulePoleResetIfNeeded();
    }
  }

  function handleKeyboard(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    let handled = true;

    switch (event.key) {
      case 'ArrowLeft':
        rotation = normalizeAngle(rotation - 9);
        autoSpinDirection = -1;
        focusAnimation = null;
        inertiaActive = false;
        break;
      case 'ArrowRight':
        rotation = normalizeAngle(rotation + 9);
        autoSpinDirection = 1;
        focusAnimation = null;
        inertiaActive = false;
        break;
      case 'ArrowUp':
        latitude = clamp(latitude + 6, MIN_LATITUDE, MAX_LATITUDE);
        focusAnimation = null;
        inertiaActive = false;
        break;
      case 'ArrowDown':
        latitude = clamp(latitude - 6, MIN_LATITUDE, MAX_LATITUDE);
        focusAnimation = null;
        inertiaActive = false;
        break;
      case 'Escape':
        clearSelectedCountry();
        hoveredCountry = null;
        break;
      default:
        handled = false;
    }

    if (!handled) return;
    event.preventDefault();

    if (event.key.startsWith('Arrow')) {
      applyProjection();
    }
  }

  function downloadLabel(count: number): string {
    return count === 1 ? 'Download' : 'Downloads';
  }

  onMount(() => {
    buildWorldGeometry();
    startRotationLoop();
  });

  onDestroy(() => {
    clearPoleResetTimer();
    stopRotationLoop();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<div
  class={`globe-shell ${className}`.trim()}
  class:dragging={isDragging}
  role="region"
  tabindex="0"
  aria-label={ariaLabel}
  on:mouseleave={clearHover}
  on:keydown={handleKeyboard}
  on:pointerdown={startDrag}
  on:pointermove={dragGlobe}
  on:pointerup={endDrag}
  on:pointercancel={endDrag}
  on:lostpointercapture={handleLostPointerCapture}
>
  <svg viewBox={`0 0 ${viewSize} ${viewSize}`} role="img" aria-label={ariaLabel}>
    <defs>
      <radialGradient id={gradientId} cx="34%" cy="30%" r="74%">
        <stop offset="0%" stop-color="#f8fcfa" />
        <stop offset="58%" stop-color="#d8e9df" />
        <stop offset="100%" stop-color="#bed6ca" />
      </radialGradient>
      <radialGradient id={atmosphereId} cx="50%" cy="50%" r="56%">
        <stop offset="72%" stop-color="rgba(21, 104, 68, 0)" />
        <stop offset="100%" stop-color="rgba(21, 104, 68, 0.25)" />
      </radialGradient>
      <radialGradient id={shineId} cx="28%" cy="24%" r="62%">
        <stop offset="0%" stop-color="rgba(255, 255, 255, 0.34)" />
        <stop offset="45%" stop-color="rgba(255, 255, 255, 0.05)" />
        <stop offset="100%" stop-color="rgba(255, 255, 255, 0)" />
      </radialGradient>
      <clipPath id={clipPathId}>
        <path d={spherePath} />
      </clipPath>
    </defs>

    <path class="sphere-atmosphere" d={spherePath} fill={`url(#${atmosphereId})`} />
    <path class="sphere-base" d={spherePath} fill={`url(#${gradientId})`} />
    <g clip-path={`url(#${clipPathId})`}>
      <path class="globe-graticule" d={graticulePath} />
      {#each countries as item}
        {@const countryId = Number(item.id)}
        {@const countryPath = pathByCountryId.get(countryId) ?? ''}
        {#if countryPath}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
          <path
            class="country-path"
            class:selected={selectedCountryId === countryId}
            role="img"
            aria-label={`${numericIdToName(countryId)}: ${countByCountryId.get(countryId) ?? 0} downloads`}
            d={countryPath}
            fill={fillForCountry(item.id)}
            stroke={strokeForCountry(item.id)}
            stroke-width="0.72"
            on:mouseenter={(event) => handleCountryHover(event, item)}
            on:mousemove={(event) => handleCountryHover(event, item)}
            on:mouseleave={clearHover}
            on:click={(event) => handleCountryClick(event, item)}
          />
        {/if}
      {/each}
    </g>
    <path class="sphere-shine" d={spherePath} fill={`url(#${shineId})`} />
    <path class="sphere-outline" d={spherePath} />
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
</div>

<style>
  .globe-shell {
    position: relative;
    border: 0;
    border-radius: 22px;
    background: transparent;
    box-shadow: none;
    padding: 0;
    overflow: hidden;
    cursor: grab;
    user-select: none;
    touch-action: pan-y;
    isolation: isolate;
    z-index: 2;
    outline: none;
  }

  .globe-shell:focus-visible {
    box-shadow: 0 0 0 2px rgba(26, 139, 85, 0.45);
  }

  .globe-shell.dragging {
    cursor: grabbing;
  }

  .globe-shell svg {
    width: 100%;
    height: auto;
    display: block;
    aspect-ratio: 1 / 1;
    position: relative;
    z-index: 1;
    transition: transform 0.18s ease;
  }

  .globe-shell.dragging svg {
    transform: scale(0.992);
  }

  .sphere-atmosphere {
    opacity: 0.95;
  }

  .sphere-base {
    filter: none;
  }

  .globe-graticule {
    fill: none;
    stroke: rgba(36, 89, 61, 0.17);
    stroke-width: 0.65;
    pointer-events: none;
  }

  .country-path {
    transition: opacity 0.15s ease, filter 0.15s ease, stroke-width 0.15s ease;
    cursor: pointer;
  }

  .country-path:hover {
    opacity: 0.92;
    filter: brightness(0.92) saturate(1.2);
    stroke-width: 1.16;
    stroke: #1b7f50;
  }

  .country-path.selected {
    stroke-width: 1.34;
    stroke: #0f5f3b;
    filter: brightness(0.9) saturate(1.22);
  }

  .sphere-shine {
    mix-blend-mode: screen;
    opacity: 0.6;
    pointer-events: none;
  }

  .sphere-outline {
    fill: none;
    stroke: rgba(17, 67, 43, 0.24);
    stroke-width: 1.2;
    pointer-events: none;
  }

  .map-tooltip {
    position: absolute;
    transform: translateY(-50%);
    background: #102d1f;
    color: #f3fff9;
    border-radius: 10px;
    padding: 8px 10px;
    box-shadow: 0 10px 24px rgba(15, 20, 25, 0.25);
    display: grid;
    gap: 2px;
    pointer-events: none;
    min-width: 145px;
    z-index: 4;
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

  @media (max-width: 700px) {
    .globe-shell {
      border-radius: 18px;
    }
  }
</style>
