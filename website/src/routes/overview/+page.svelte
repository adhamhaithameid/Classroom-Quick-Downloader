<script lang="ts">
  import { onMount, type ComponentType } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { base } from '$app/paths';
  import { APP_VERSION, SITE_URL, STORE_LINKS } from '$lib/config';
  import SeoMeta from '$lib/components/SeoMeta.svelte';
  import { detectBrowserFromNavigator, type BrowserKey } from '$lib/browser/detect';
  import { refreshWebsiteSnapshotStore, websiteSnapshotStore } from '$lib/stores/websiteSnapshot';
  import type { MapResponse, OverviewResponse } from '$lib/types/public';
  import { trackWebsiteEvent } from '$lib/analytics/websiteEvents';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
  import MediaLoader from '$lib/components/MediaLoader.svelte';
  import AnimatedNumericText from '$lib/components/AnimatedNumericText.svelte';
  import {
    canStartCelebration,
    nextCooldownUntil
  } from '$lib/celebration/balloons';
  import {
    type PlacementSection,
    type ElementPlacement,
    defaultPlacements,
    clonePlacements,
    loadPublishedPlacements,
    loadDraftPlacements,
    saveDraftPlacements,
    publishPlacements,
    discardDraftPlacements,
    exportPlacementsJSON, importPlacementsJSON,
    genPlacementId, getBuiltinSvg,
    maxPlacementZIndex
  } from '$lib/svgCatalog/placements';
  import { categories as svgCategories, doodleItems, threeDElements } from '$lib/svgCatalog/index';
  import type { SvgItem } from '$lib/svgCatalog/index';

  /* ━━━ Feature toggle: set to false to hide the silly question ━━━ */
  const ENABLE_SILLY_QUESTION = true;
  const CELEBRATION_SESSION_KEY = 'cqd-balloon-celebration-session-v1';
  const CELEBRATION_COOLDOWN_MS = 1200;
  const CELEBRATION_OVERLAY_Z_INDEX = '2147483647';
  const CELEBRATION_BURST_COUNT = 4;
  const CELEBRATION_BURST_STAGGER_MS = 320;
  const PINNED_SUPERCHARGE_STAR_ID = 'dd-1772174598462-101';
  const PINNED_SUPERCHARGE_STAR_SAMPLE_ID = 'D-50';
  const MOBILE_PLACEMENT_BREAKPOINT = 900;
  const INITIAL_PLACEMENT_SECTION_VISIBILITY: Record<PlacementSection, boolean> = {
    hero: true,
    students: false,
    problem: false,
    features: false,
    steps: false,
    proof: false,
    map: false,
    cta: false,
    general: true
  };

  export let seoPath = '/';

  function buildCanonicalUrl(path: string): string {
    const normalizedPath = path === '/' ? '/' : path.replace(/\/+$/, '');
    return normalizedPath === '/' ? `${SITE_URL}/` : `${SITE_URL}${normalizedPath}`;
  }

  $: softwareApplicationStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Classroom Quick Downloader',
    applicationCategory: 'BrowserExtension',
    operatingSystem: 'Chrome, Firefox, Edge',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@type': 'Person', name: 'Adham Haitham Eid' },
    url: buildCanonicalUrl(seoPath),
    downloadUrl: [STORE_LINKS.chrome, STORE_LINKS.firefox, STORE_LINKS.edge]
  };

  type RenderPlacement = ElementPlacement & {
    renderX: number;
    renderY: number;
    renderSize: number;
    renderOpacity: number;
    renderRotate: number;
    renderAnimDuration: number;
    renderColor: string;
    renderZIndex: number;
    renderHidden: boolean;
  };

  /* ━━━ Edit Mode — inline element editor ━━━ */
  let editMode = false;
  let editIsolation = false;
  let publishedPlacements: ElementPlacement[] = [];
  let placements: ElementPlacement[] = [];
  let selectedElementId: string | null = null;
  let pickerOpen = false;
  let pickerSearch = '';
  let pickerTab: 'float' | 'doodle' | '3d' = 'float';
  let importJsonText = '';
  let showImportPanel = false;
  let importErrors: string[] = [];
  let importWarnings: string[] = [];
  let editorStatus = '';
  let editorStatusTone: 'ok' | 'warn' | 'error' = 'ok';
  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  let selectedPlacement: ElementPlacement | null = null;
  let pinnedSuperchargeStar: RenderPlacement | null = null;
  let visiblePlacements: RenderPlacement[] = [];
  let placementSectionVisible: Record<PlacementSection, boolean> = { ...INITIAL_PLACEMENT_SECTION_VISIBILITY };
  let placementCanvasHeight = 0;
  let placementCanvasLocked = false;
  let frozenPlacementCoords: Record<string, { leftPx: number; topPx: number }> = {};
  let isMobilePlacementsViewport = false;
  let pickerItems: SvgItem[] = [];
  let editDrag: { id: string; pointerId: number; startX: number; startY: number; origX: number; origY: number } | null = null;
  let pageEl: HTMLElement | null = null;

  let overview: OverviewResponse | null = null;
  let mapData: MapResponse | null = null;
  let RotatingGlobeComponent: ComponentType | null = null;
  let CountryHeatmapComponent: ComponentType | null = null;
  let downloadCount: number | null = null;
  let userCount: number | null = null;
  let countryCount: number | null = null;
  let metricsReady = false;
  let detectedBrowser: BrowserKey = 'chrome';
  let mapState: 'loading' | 'ready' | 'error' = 'loading';
  let mapError = '';
  let isDataDegraded = false;
  let mapExpanded = false;
  /* NEWSLETTER_CTA_DISABLED_ROLLBACK_START
  let newsletterEmail = '';
  let newsletterSubmitState: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
  let newsletterStatusMessage = '';
  NEWSLETTER_CTA_DISABLED_ROLLBACK_END */
  let mediaExpanded: string | null = null;
  const browserCtas: Array<'chrome' | 'firefox' | 'edge'> = ['chrome', 'firefox', 'edge'];
  let marqueeViewport: HTMLDivElement | null = null;
  const globeRotationDegreesPerSecond = 12;
  let scrollHeaviness = 1;

  /* Computed from downloadCount — used in marquee (raw) */
  $: hoursSaved = computeTimeSaved(downloadCount).hours;
  $: clicksSaved = computeTimeSaved(downloadCount).clicks;
  $: metricsReady = downloadCount !== null && userCount !== null && countryCount !== null;
  $: hasMeaningfulProof =
    (typeof downloadCount === 'number' && downloadCount > 0) ||
    (typeof userCount === 'number' && userCount > 0) ||
    (typeof countryCount === 'number' && countryCount > 0);

  /* Top 3 countries by download count */
  $: topCountries = (mapData?.countries ?? [])
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  /* Ordered browser CTAs — detected browser in the middle */
  $: orderedBrowserCtas = (() => {
    const others = browserCtas.filter(b => b !== detectedBrowser);
    return [others[0], detectedBrowser, others[1]] as Array<'chrome' | 'firefox' | 'edge'>;
  })();

  /* Country code → name */
  function countryName(code: string): string {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code;
    } catch { return code; }
  }

  /* Silly map interaction — one-time question */
  let mapInteractionState: 'idle' | 'yes' | 'no' = 'idle';
  let sillyAnswered = false;
  let celebrationActive = false;
  let celebrationObserver: MutationObserver | null = null;
  let balloonSessionPlayed = false;
  let balloonCooldownUntil = 0;
  let reducedMotionPreferred = false;
  let noTypedText = '';
  let noShowCta = false;
  let mapSectionEl: HTMLElement | null = null;
  let mapPromptVisible = false;
  let mapPromptTimer: ReturnType<typeof setTimeout> | null = null;
  let celebrationBurstTimers: number[] = [];
  let launchHyperBalloonsFn: (() => Promise<void>) | null = null;

  function readCelebrationSessionState(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem(CELEBRATION_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  }

  function writeCelebrationSessionState(): void {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(CELEBRATION_SESSION_KEY, '1');
    } catch {}
  }

  function shouldReduceMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function forceCelebrationLayerZIndex(): void {
    if (typeof document === 'undefined') return;
    document.querySelectorAll<HTMLElement>('balloons, text-balloons').forEach((layer) => {
      layer.style.zIndex = CELEBRATION_OVERLAY_Z_INDEX;
      layer.style.pointerEvents = 'none';
      layer.style.position = 'fixed';
      layer.style.inset = '0';
    });
  }

  function startCelebrationObserver(): void {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    celebrationObserver?.disconnect();
    celebrationObserver = new MutationObserver(() => {
      forceCelebrationLayerZIndex();
    });
    celebrationObserver.observe(document.documentElement, { childList: true, subtree: true });
    forceCelebrationLayerZIndex();
  }

  function stopCelebrationObserver(): void {
    celebrationObserver?.disconnect();
    celebrationObserver = null;
  }

  function clearCelebrationBurstTimers(): void {
    celebrationBurstTimers.forEach((id) => window.clearTimeout(id));
    celebrationBurstTimers = [];
  }

  async function getLaunchHyperBalloons(): Promise<() => Promise<void>> {
    if (launchHyperBalloonsFn) return launchHyperBalloonsFn;
    const module = await import('balloons-js');
    launchHyperBalloonsFn = module.balloons;
    return launchHyperBalloonsFn;
  }

  async function loadMapComponents(): Promise<void> {
    if (RotatingGlobeComponent && CountryHeatmapComponent) return;
    const [globeModule, heatmapModule] = await Promise.all([
      import('$lib/components/RotatingGlobe.svelte'),
      import('$lib/components/CountryHeatmap.svelte')
    ]);
    RotatingGlobeComponent = globeModule.default;
    CountryHeatmapComponent = heatmapModule.default;
  }

  async function launchDenseBalloonBursts(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    clearCelebrationBurstTimers();

    const burstTasks = Array.from({ length: CELEBRATION_BURST_COUNT }, (_, index) => {
      return new Promise<boolean>((resolve) => {
        const timer = window.setTimeout(async () => {
          try {
            const launchHyperBalloons = await getLaunchHyperBalloons();
            await launchHyperBalloons();
            forceCelebrationLayerZIndex();
            resolve(true);
          } catch {
            resolve(false);
          }
        }, index * CELEBRATION_BURST_STAGGER_MS);

        celebrationBurstTimers.push(timer);
      });
    });

    const results = await Promise.all(burstTasks);
    clearCelebrationBurstTimers();
    return results.some(Boolean);
  }

  async function triggerCelebration(): Promise<boolean> {
    if (typeof window === 'undefined' || reducedMotionPreferred) return false;
    const nowMs = Date.now();
    if (
      !canStartCelebration({
        nowMs,
        reducedMotion: reducedMotionPreferred,
        active: celebrationActive,
        sessionPlayed: balloonSessionPlayed,
        cooldownUntilMs: balloonCooldownUntil
      })
    ) {
      return false;
    }

    balloonCooldownUntil = nextCooldownUntil(nowMs, CELEBRATION_COOLDOWN_MS);
    celebrationActive = true;
    startCelebrationObserver();

    try {
      const launched = await launchDenseBalloonBursts();
      if (!launched) return false;
      balloonSessionPlayed = true;
      writeCelebrationSessionState();
      return true;
    } catch {
      return false;
    } finally {
      celebrationActive = false;
      stopCelebrationObserver();
    }
  }

  function initSillyState() {
    balloonSessionPlayed = readCelebrationSessionState();
    try {
      const saved = localStorage.getItem('cqd-silly-answer');
      if (saved === 'yes' || saved === 'no') {
        mapInteractionState = saved;
        sillyAnswered = true;
        if (saved === 'no') { noTypedText = 'What are you waiting for? 🚀'; noShowCta = true; }
      }
    } catch {}
  }

  function clearMapPromptTimer(): void {
    if (mapPromptTimer) {
      clearTimeout(mapPromptTimer);
      mapPromptTimer = null;
    }
  }

  function setupMapPromptDelay(): (() => void) | undefined {
    if (!ENABLE_SILLY_QUESTION || editMode || !mapSectionEl || typeof window === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (mapPromptVisible) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
          if (mapPromptTimer) return;
          mapPromptTimer = setTimeout(() => {
            mapPromptVisible = true;
            clearMapPromptTimer();
          }, 3000);
          return;
        }

        clearMapPromptTimer();
      },
      { threshold: [0, 0.45, 0.75] }
    );

    observer.observe(mapSectionEl);

    return () => {
      observer.disconnect();
      clearMapPromptTimer();
    };
  }

  function onMapYes() {
    if (sillyAnswered) return;
    trackWebsiteEvent({
      eventType: 'map',
      action: 'map_yes',
      placement: 'map_prompt_yes',
      pagePath: '/overview'
    });
    sillyAnswered = true;
    mapInteractionState = 'yes';
    void triggerCelebration();
    try { localStorage.setItem('cqd-silly-answer', 'yes'); } catch {}
  }

  function onMapNo() {
    if (sillyAnswered) return;
    trackWebsiteEvent({
      eventType: 'map',
      action: 'map_no',
      placement: 'map_prompt_no',
      pagePath: '/overview'
    });
    sillyAnswered = true;
    mapInteractionState = 'no';
    try { localStorage.setItem('cqd-silly-answer', 'no'); } catch {}
    // Dramatic typewriter with variable speed
    const msg = 'What are you waiting for?';
    noTypedText = '';
    noShowCta = false;
    let idx = 0;
    const type = () => {
      if (idx < msg.length) {
        noTypedText = msg.slice(0, idx + 1);
        idx++;
        const char = msg[idx - 1];
        const speed = char === ' ' ? 30 : char === '?' ? 200 : 40 + Math.random() * 30;
        setTimeout(type, speed);
      } else {
        // Dramatic pause, then emoji
        setTimeout(() => {
          noTypedText = msg + ' 🚀';
          setTimeout(() => { noShowCta = true; }, 400);
        }, 500);
      }
    };
    setTimeout(type, 300); // brief pause before typing starts
  }

  function formatNumber(v: number | null): string {
    if (v === null || !Number.isFinite(v)) return '—';
    return new Intl.NumberFormat('en-US').format(v);
  }

  function formatCompact(v: number | null): string {
    if (v === null || !Number.isFinite(v)) return '—';
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(v);
  }

  function browserLink(key: 'chrome' | 'firefox' | 'edge'): string {
    return overview?.links?.[key] || STORE_LINKS[key];
  }

  function browserDisplayName(key: string): string {
    const map: Record<string, string> = { chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge' };
    return map[key] || key;
  }

  function trackInstallClick(placement: string): void {
    trackWebsiteEvent({
      eventType: 'cta',
      action: 'install_click',
      placement,
      pagePath: '/overview'
    });
  }

  /* NEWSLETTER_CTA_DISABLED_ROLLBACK_START
  async function submitNewsletterEmail(): Promise<void> {
    const normalizedEmail = newsletterEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      newsletterSubmitState = 'error';
      newsletterStatusMessage = 'Please enter a valid email address.';
      return;
    }

    newsletterSubmitState = 'submitting';
    newsletterStatusMessage = '';
    try {
      const response = await submitNewsletterSubscription({
        email: normalizedEmail,
        source: 'overview_ready_to_save_hours'
      });
      newsletterSubmitState = response.ok ? 'success' : 'error';
      newsletterStatusMessage = response.ok ? response.message || 'Subscribed.' : 'Subscription failed.';
      if (response.ok) {
        newsletterEmail = '';
      }
    } catch (error) {
      newsletterSubmitState = 'error';
      newsletterStatusMessage = error instanceof Error ? error.message : 'Subscription failed. Please try again.';
    }
  }
  NEWSLETTER_CTA_DISABLED_ROLLBACK_END */

  function computeTimeSaved(downloads: number | null): { totalSeconds: number | null; hours: number | null; clicks: number | null } {
    if (downloads === null || !Number.isFinite(downloads)) {
      return { totalSeconds: null, hours: null, clicks: null };
    }
    const SECONDS_PER_DOWNLOAD = 13;
    const CLICKS_PER_DOWNLOAD = 5;
    const totalSeconds = downloads * SECONDS_PER_DOWNLOAD;
    const hours = Math.floor(totalSeconds / 3600);
    const clicks = downloads * CLICKS_PER_DOWNLOAD;
    return { totalSeconds, hours, clicks };
  }

  function computeUsersTotal(source: OverviewResponse): number {
    if (source.installs.usersTotal > 0) return source.installs.usersTotal;
    return source.installs.browsers.reduce((sum, item) => sum + (item.usersCount || 0), 0);
  }

  function initMarquee(): (() => void) | undefined {
    if (!marqueeViewport) return undefined;

    const viewport = marqueeViewport;
    const track = viewport.querySelector('.l2-marquee-track') as HTMLElement;
    if (!track) return undefined;

    const duplicateSets = 8;
    const autoSpeed = 45; // px/s
    let isDragging = false;
    let isCoasting = false;
    let autoDirection = 1; // 1 = content moves left (standard marquee), -1 = right
    let startX = 0;
    let dragOffset = 0;
    let lastX = 0;
    let velocity = 0;
    let rafId = 0;
    let lastTime = 0;
    let offset = 0; // current translateX offset (negative = content shifted left)

    const getSetWidth = () => {
      const sets = track.querySelectorAll('.l2-marquee-set');
      if (sets.length === 0) return 0;
      return (sets[0] as HTMLElement).offsetWidth;
    };

    const applyTransform = () => {
      track.style.transform = `translateX(${offset}px)`;
    };

    const setInitialOffset = () => {
      const setW = getSetWidth();
      if (setW > 0) offset = -(setW * 3);
      applyTransform();
      lastTime = 0;
    };

    const normalize = () => {
      const setW = getSetWidth();
      if (setW <= 0) return;
      // Keep offset in the middle band so the illusion of infinite scroll holds
      const minBound = -(setW * 6);
      const maxBound = -(setW);
      if (offset < minBound) offset += setW;
      if (offset > maxBound) offset -= setW;
    };

    /* Auto-scroll tick */
    const tick = (ts: number) => {
      if (!isDragging && !isCoasting) {
        const setW = getSetWidth();
        if (setW > 0) {
          if (lastTime === 0) lastTime = ts;
          const dt = (ts - lastTime) / 1000;
          lastTime = ts;
          offset -= autoSpeed * autoDirection * dt;
          normalize();
          applyTransform();
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    /* Pointer drag */
    const onDown = (e: PointerEvent) => {
      isDragging = true;
      isCoasting = false;
      startX = e.clientX;
      dragOffset = offset;
      lastX = e.clientX;
      velocity = 0;
      viewport.setPointerCapture(e.pointerId);
      viewport.style.cursor = 'grabbing';
    };

    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      velocity = e.clientX - lastX;
      lastX = e.clientX;
      offset = dragOffset + (e.clientX - startX);
      normalize();
      applyTransform();
    };

    const onUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      viewport.releasePointerCapture(e.pointerId);
      viewport.style.cursor = 'grab';

      /* Reverse auto-scroll direction based on drag direction */
      const netDrag = e.clientX - startX;
      if (Math.abs(netDrag) > 20) {
        autoDirection = netDrag > 0 ? -1 : 1; // dragged right → auto-scroll left, vice versa
      }

      /* Momentum coast, then resume auto */
      let v = velocity * 2;
      if (Math.abs(v) > 0.5) {
        isCoasting = true;
        const coast = () => {
          if (Math.abs(v) < 0.5) { isCoasting = false; lastTime = 0; return; }
          offset += v;
          normalize();
          applyTransform();
          v *= 0.92;
          requestAnimationFrame(coast);
        };
        requestAnimationFrame(coast);
      } else {
        lastTime = 0;
      }
    };

    setInitialOffset();
    rafId = requestAnimationFrame(tick);
    window.addEventListener('resize', setInitialOffset);
    viewport.addEventListener('pointerdown', onDown);
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onUp);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', setInitialOffset);
      viewport.removeEventListener('pointerdown', onDown);
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerup', onUp);
      viewport.removeEventListener('pointercancel', onUp);
    };
  }

  function initHeavierScroll(): (() => void) | undefined {
    if (typeof window === 'undefined') return undefined;
    if (!window.matchMedia('(pointer: fine)').matches) return undefined;
    if (Math.abs(scrollHeaviness - 1) < 0.001) return undefined;

    const lineHeightPx = 16;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as Element | null;
      if (!target) return;
      if (
        target.closest(
          '.l2-marquee-viewport, .l2-map-modal, textarea, input, select, [contenteditable="true"]'
        )
      ) {
        return;
      }

      const deltaY = event.deltaMode === 1 ? event.deltaY * lineHeightPx : event.deltaY;
      if (Math.abs(deltaY) < 1) return;

      event.preventDefault();
      window.scrollBy({ top: deltaY * scrollHeaviness, behavior: 'auto' });
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
    };
  }

  function toggleMapExpanded(): void {
    mapExpanded = !mapExpanded;
  }

  function closeMapExpanded(): void {
    mapExpanded = false;
  }

  const MEDIA_GROUPS: Record<string, string[]> = {
    video: ['problem-video', 'solution-video'],
    image: ['problem-flags', 'solution-flags'],
  };

  function getMediaGroup(id: string): string[] {
    for (const group of Object.values(MEDIA_GROUPS)) {
      if (group.includes(id)) return group;
    }
    return [];
  }

  function navigateMedia(direction: 'prev' | 'next'): void {
    if (!mediaExpanded) return;
    const group = getMediaGroup(mediaExpanded);
    const idx = group.indexOf(mediaExpanded);
    if (idx === -1) return;
    const next = direction === 'next' ? idx + 1 : idx - 1;
    if (next >= 0 && next < group.length) {
      mediaExpanded = group[next];
    }
  }

  function getMediaNav(id: string | null): { hasPrev: boolean; hasNext: boolean } {
    if (!id) return { hasPrev: false, hasNext: false };
    const group = getMediaGroup(id);
    const idx = group.indexOf(id);
    return { hasPrev: idx > 0, hasNext: idx < group.length - 1 };
  }

  function toggleMediaExpanded(id: string): void {
    mediaExpanded = mediaExpanded === id ? null : id;
    document.body.classList.toggle('l2-media-modal-open', !!mediaExpanded);
  }

  function closeMediaExpanded(): void {
    mediaExpanded = null;
    document.body.classList.remove('l2-media-modal-open');
  }

  function handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && mapExpanded) closeMapExpanded();
    if (event.key === 'Escape' && mediaExpanded) closeMediaExpanded();
    if (event.key === 'ArrowRight' && mediaExpanded) navigateMedia('next');
    if (event.key === 'ArrowLeft' && mediaExpanded) navigateMedia('prev');
  }

  function setupReveal(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.l2-reveal').forEach((el) => observer.observe(el));
  }

  function placementRenderOpacity(placement: RenderPlacement): number {
    if (editMode) return placement.renderOpacity;
    if (placementSectionVisible[placement.section]) return placement.renderOpacity;
    return 0;
  }

  function placementRevealShift(placement: RenderPlacement): number {
    if (editMode) return 0;
    if (placementSectionVisible[placement.section]) return 0;
    return 24;
  }

  function placementRenderLeftCss(placement: RenderPlacement): string {
    if (!editMode && placementCanvasLocked) {
      const frozen = frozenPlacementCoords[placement.id];
      if (frozen) return `${frozen.leftPx}px`;
    }
    return `${placement.renderX}%`;
  }

  function placementRenderTopCss(placement: RenderPlacement): string {
    if (!editMode && placementCanvasLocked) {
      const frozen = frozenPlacementCoords[placement.id];
      if (frozen) return `${frozen.topPx}px`;
    }
    return `${placement.renderY}%`;
  }

  function placementAnimationPlayState(placement: RenderPlacement): 'running' | 'paused' {
    if (placement.renderAnimDuration <= 0) return 'paused';
    if (editMode) return 'running';
    if (!placementSectionVisible[placement.section]) return 'paused';
    return 'running';
  }

  $: selectedPlacement = placements.find(p => p.id === selectedElementId) || null;
  $: pinnedSuperchargeStar = isMobilePlacementsViewport
    ? null
    : placements
        .map((placement) => resolvePlacementForViewport(placement))
        .find((placement) => isPinnedSuperchargeStarPlacement(placement) && !placement.renderHidden) || null;
  $: visiblePlacements = isMobilePlacementsViewport
    ? []
    : placements
        .map((placement) => resolvePlacementForViewport(placement))
        .filter((placement) => !placement.renderHidden && !isPinnedSuperchargeStarPlacement(placement))
        .slice()
        .sort((a, b) => a.renderZIndex - b.renderZIndex);
  $: pickerItems = editMode ? getPickerItems(pickerTab, pickerSearch) : [];
  $: if (!editMode && placementCanvasLocked) {
    const frozenCount = Object.keys(frozenPlacementCoords).length;
    const needsFreeze =
      frozenCount !== visiblePlacements.length ||
      visiblePlacements.some((placement) => !(placement.id in frozenPlacementCoords));
    if (needsFreeze) {
      freezePlacementCoordinates();
    }
  }

  onMount(() => {
    let stopMarquee: (() => void) | undefined;
    let stopHeavierScroll: (() => void) | undefined;
    let stopMapPromptDelay: (() => void) | undefined;
    let stopPlacementViewportWatcher: (() => void) | undefined;
    detectedBrowser = detectBrowserFromNavigator();
    reducedMotionPreferred = shouldReduceMotion();
    const searchParams = new URLSearchParams(window.location.search);
    const isEmbed = searchParams.has('embed');
    editMode = searchParams.has('edit');
    editIsolation = editMode && !searchParams.has('interactive');
    const placementViewportMedia = window.matchMedia(`(max-width: ${MOBILE_PLACEMENT_BREAKPOINT}px)`);
    const onPlacementViewportChange = () => {
      isMobilePlacementsViewport = placementViewportMedia.matches;
    };
    onPlacementViewportChange();
    if (typeof placementViewportMedia.addEventListener === 'function') {
      placementViewportMedia.addEventListener('change', onPlacementViewportChange);
      stopPlacementViewportWatcher = () => placementViewportMedia.removeEventListener('change', onPlacementViewportChange);
    } else if (typeof placementViewportMedia.addListener === 'function') {
      placementViewportMedia.addListener(onPlacementViewportChange);
      stopPlacementViewportWatcher = () => placementViewportMedia.removeListener(onPlacementViewportChange);
    }
    if (editMode && ENABLE_SILLY_QUESTION) {
      mapPromptVisible = true;
    }
    publishedPlacements = loadPublishedPlacements();
    placements = editMode
      ? loadDraftPlacements(publishedPlacements)
      : clonePlacements(publishedPlacements);
    initSillyState();
    const mapComponentsLoad = loadMapComponents().catch(() => undefined);
    void Promise.all([loadSiteData(), mapComponentsLoad]).then(() => {
      requestAnimationFrame(async () => {
        await waitForStableLayoutBeforePlacementLock();
        syncPlacementCanvasHeight(true);
        if (!editMode) {
          placementCanvasLocked = true;
          freezePlacementCoordinates();
        }
        if (isEmbed || editMode) {
          resetPlacementSectionVisibility(true);
          document.querySelectorAll('.l2-reveal').forEach((el) => el.classList.add('in-view'));
        } else {
          resetPlacementSectionVisibility(false);
          setupReveal();
        }
        stopMarquee = initMarquee();
        stopHeavierScroll = initHeavierScroll();
        stopMapPromptDelay = setupMapPromptDelay();
      });
    });

    return () => {
      celebrationActive = false;
      stopCelebrationObserver();
      clearCelebrationBurstTimers();
      if (typeof stopMarquee === 'function') stopMarquee();
      if (typeof stopHeavierScroll === 'function') stopHeavierScroll();
      if (typeof stopMapPromptDelay === 'function') stopMapPromptDelay();
      if (typeof stopPlacementViewportWatcher === 'function') stopPlacementViewportWatcher();
      if (statusTimer) clearTimeout(statusTimer);
      document.body.classList.remove('l2-map-modal-open');
    };
  });

  $: if (typeof document !== 'undefined') {
    document.body.classList.toggle('l2-map-modal-open', mapExpanded);
  }
  $: {
    const snapshot = $websiteSnapshotStore.snapshot;
    if (snapshot) {
      overview = snapshot.overview;
      mapData = snapshot.map;
      downloadCount = snapshot.overview.totals.downloads;
      userCount = computeUsersTotal(snapshot.overview);
      countryCount = snapshot.map.totals.countries;
    } else {
      overview = null;
      mapData = null;
      downloadCount = null;
      userCount = null;
      countryCount = null;
    }

    mapError = $websiteSnapshotStore.errorMessage || '';
    isDataDegraded = $websiteSnapshotStore.status === 'degraded';

    if ($websiteSnapshotStore.status === 'error' && !$websiteSnapshotStore.snapshot) {
      mapState = 'error';
    } else if (
      ($websiteSnapshotStore.status === 'idle' ||
        $websiteSnapshotStore.status === 'loading' ||
        $websiteSnapshotStore.status === 'refreshing') &&
      !$websiteSnapshotStore.snapshot
    ) {
      mapState = 'loading';
    } else {
      mapState = 'ready';
    }
  }
</script>

<svelte:window
  on:keydown={handleGlobalKeydown}
  on:pointermove={onEditPointerMove}
  on:pointerup={onEditPointerUp}
  on:pointercancel={onEditPointerUp}
/>

<SeoMeta
  title="Classroom Quick Downloader — Download All Google Classroom Files In One Click"
  description="Free browser extension to bulk download all attachments from Google Classroom assignments. One click. Chrome, Firefox, and Edge."
  path={seoPath}
  keywords="download all google classroom files, bulk download google classroom attachments, google classroom extension"
  structuredData={softwareApplicationStructuredData}
/>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
</svelte:head>

<div class="l2" class:edit-mode={editMode} class:edit-isolation={editMode && editIsolation} bind:this={pageEl}>
  <!-- ━━━━ Page-wide decorative layer ━━━━ -->
  <div class="l2-page-orbs" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="orb orb-4"></div>
    <div class="orb orb-5"></div>
    <div class="orb orb-6"></div>
    <div class="orb orb-7"></div>
    <div class="orb orb-8"></div>
    <div class="orb orb-9"></div>
    <div class="orb orb-10"></div>
    <div class="orb orb-11"></div>
    <div class="orb orb-12"></div>
  </div>
  <div class="l2-page-grid" aria-hidden="true"></div>
  <div class="l2-page-floats" aria-hidden="true">
    {#each visiblePlacements as p (p.id)}
      {@const resolved = resolveSvg(p)}
      <div
        class="l2-placement-el"
        class:edit-selected={editMode && selectedElementId === p.id}
        class:edit-mode={editMode}
        class:edit-locked={editMode && !!p.locked}
        role="button"
        tabindex={editMode ? 0 : -1}
        aria-disabled={!editMode}
        style="
          left: {placementRenderLeftCss(p)};
          top: {placementRenderTopCss(p)};
          width: {p.renderSize}px;
          height: {p.renderSize}px;
          opacity: {placementRenderOpacity(p)};
          color: {p.renderColor};
          --placement-rotate: {p.renderRotate}deg;
          --placement-shift: {placementRevealShift(p)}px;
          animation-duration: {p.renderAnimDuration}s;
          animation-play-state: {placementAnimationPlayState(p)};
          z-index: {10000 + p.renderZIndex};
        "
        on:pointerdown={(e) => { if (editMode) startEditDrag(e, p); }}
        on:click|stopPropagation={() => { if (editMode) { selectedElementId = p.id; } }}
        on:keydown={(e) => {
          if (!editMode) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectedElementId = p.id;
          }
        }}
      >
        <svg
          viewBox={resolved.viewBox}
          fill="none" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round"
          style="width:100%;height:100%;"
        >
          {@html resolved.svg}
        </svg>
        {#if editMode}
          <button class="el-delete-btn" on:pointerdown|stopPropagation on:click|stopPropagation={() => deleteElement(p.id)} title="Delete">✕</button>
          <span class="el-id-label">{p.id}</span>
        {/if}
      </div>
    {/each}
  </div>

  <!-- ━━━━ Hero ━━━━ -->
  <section id="top" class="l2-hero l2-snap">
    <div class="l2-wrap l2-hero-content">
      <h1 class="l2-mega">
        The free extension that<br/>
        <span class="l2-em l2-em-supercharge">supercharges{#if pinnedSuperchargeStar}{@const pinnedResolved = resolveSvg(pinnedSuperchargeStar)}{@const pinnedSize = Math.max(18, Math.min(54, pinnedSuperchargeStar.renderSize))}<span
            class="l2-supercharge-star"
            aria-hidden="true"
            style="
              width: {pinnedSize}px;
              height: {pinnedSize}px;
              opacity: {pinnedSuperchargeStar.renderOpacity};
              color: {pinnedSuperchargeStar.renderColor};
              transform: rotate({pinnedSuperchargeStar.renderRotate}deg);
            "
          ><svg
              viewBox={pinnedResolved.viewBox}
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              style="width:100%;height:100%;"
            >{@html pinnedResolved.svg}</svg></span>{/if}</span><br/>Google Classroom.
      </h1>

      <p class="l2-sub">
        Download all Google Classroom files in one click for every assignment.
      </p>
      <p class="l2-disclaimer">Not affiliated with Google or Google Classroom.</p>

      <div class="l2-hero-actions">
        {#each orderedBrowserCtas as b}
          <a
            class="l2-cta {b === detectedBrowser ? 'l2-cta-current' : 'l2-cta-other'}"
            href={browserLink(b)}
            target="_blank"
            rel="noopener noreferrer"
            on:click={() => trackInstallClick('hero_install')}
          >
            <img src="{base}/images/{b}.svg" alt="" class="l2-cta-icon" />
            {#if b === detectedBrowser}Install for {browserDisplayName(b)}{:else}{browserDisplayName(b)}{/if}
          </a>
        {/each}
      </div>

      <p class="l2-compat">Also works on Brave, Opera, Vivaldi, Arc & all Chromium browsers</p>
    </div>
  </section>

  <!-- ━━━━ Why Keep It ━━━━ -->
  <section class="l2-block l2-block-alt l2-students-section l2-snap">
    <div class="l2-wrap l2-reveal" data-placement-section="students" style="position:relative">
      <div class="l2-section-head l2-students-head">
        <span class="l2-label">WHY STUDENTS KEEP IT INSTALLED</span>
        <h2>It removes friction from real coursework.</h2>
        <p>Built for day-to-day classes, assignments, and revision sessions where speed matters.</p>
      </div>

      <!-- Connector: Title → vertical stem → horizontal rail → 3 dots → 3 drops → cards -->
      <div class="l2-connector-system" aria-hidden="true">
        <div class="l2-conn-stem"></div>
        <div class="l2-conn-rail">
          <span class="l2-conn-dot"></span>
          <span class="l2-conn-dot"></span>
          <span class="l2-conn-dot"></span>
        </div>
      </div>

      <div class="l2-student-grid" role="list">
        <article class="l2-student-card" role="listitem">
          <span class="l2-student-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 8v5l3 3" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          <h3>Less repetitive clicking</h3>
          <p>Download all materials from an assignment in one action instead of repeating the same file flow.</p>
        </article>
        <article class="l2-student-card" role="listitem">
          <span class="l2-student-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </span>
          <h3>Faster study prep</h3>
          <p>Get course files quickly so your time goes into understanding material, not managing downloads.</p>
        </article>
        <article class="l2-student-card" role="listitem">
          <span class="l2-student-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 6h11M9 12h11M9 18h11" />
              <path d="m3 6 1.5 1.5L6.5 5.5" />
              <path d="m3 12 1.5 1.5L6.5 11.5" />
              <path d="m3 18 1.5 1.5L6.5 17.5" />
            </svg>
          </span>
          <h3>Consistent workflow</h3>
          <p>Same simple behavior across classes, tabs, and supported browsers so there is no relearning cost.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- ━━━━ Scrolling Metrics Marquee ━━━━ -->
  <section class="l2-marquee l2-snap">
    {#if hasMeaningfulProof}
      <div class="l2-marquee-viewport" bind:this={marqueeViewport}>
        <div class="l2-marquee-track">
          {#each [0, 1, 2, 3, 4, 5, 6, 7] as _dup}
            <div class="l2-marquee-set" aria-hidden={_dup > 0 ? 'true' : undefined}>
              <div class="l2-mq-item"><span class="l2-mq-num">{formatNumber(downloadCount)}</span><span class="l2-mq-label">Files Downloaded</span></div>
              <span class="l2-mq-dot">•</span>
              <div class="l2-mq-item"><span class="l2-mq-num">{formatNumber(userCount)}</span><span class="l2-mq-label">Total Installs</span></div>
              <span class="l2-mq-dot">•</span>
              <div class="l2-mq-item"><span class="l2-mq-num">{formatNumber(countryCount)}</span><span class="l2-mq-label">Countries</span></div>
              <span class="l2-mq-dot">•</span>
              <div class="l2-mq-item"><span class="l2-mq-num">{formatCompact(hoursSaved)}</span><span class="l2-mq-label">Hours Saved</span></div>
              <span class="l2-mq-dot">•</span>
              <div class="l2-mq-item"><span class="l2-mq-num">{formatCompact(clicksSaved)}</span><span class="l2-mq-label">Clicks Saved</span></div>
              <span class="l2-mq-dot">•</span>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="l2-marquee-fallback">
        Trusted by students across Chrome, Firefox, and Edge. Real metrics appear automatically once live traffic snapshots are ready.
      </div>
    {/if}
  </section>

  <!-- ━━━━ Problem → Solution (Dual Feature) ━━━━ -->
  <section class="l2-block l2-block-alt l2-ps-section l2-snap">
    <div class="l2-wrap l2-reveal" data-placement-section="problem" style="position:relative">
      <div class="l2-section-head">
        <span class="l2-label">THE PROBLEM</span>
        <h2>Downloading files from Classroom shouldn't take this long.</h2>
        <p>Your professor uploads <AnimatedNumber value={30} format={{ useGrouping: false }} animated /> files for one assignment. You're stuck clicking each file one by one.</p>
      </div>

      <!-- Feature 1: Downloads (video) -->
      <div class="l2-ps-feature">
        <div class="l2-ps-feature-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>File Downloads</span>
        </div>
        <div class="l2-ps-pair">
          <div class="l2-ps-media-card l2-ps-problem">
            <div class="l2-ps-media-badge">Without Classroom Quick Downloader</div>
            <div class="l2-ps-media-wrap">
              <MediaLoader type="video" src="{base}/videos/problem.mp4" class="l2-ps-video" autoplay loop muted playsinline preload="metadata" ariaLabel="Tedious manual download process" aspectRatio="16/9">
                <button type="button" class="l2-ps-expand-btn" on:click={() => toggleMediaExpanded('problem-video')} aria-label="Expand video">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
                </button>
              </MediaLoader>
            </div>
          </div>
          <div class="l2-ps-flow-arrow" aria-hidden="true">
            <svg viewBox="0 0 64 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="4" y1="16" x2="44" y2="16" stroke="var(--gc-green)" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" opacity="0.5"/>
              <path d="M40 8l12 8-12 8" stroke="var(--gc-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </div>
          <div class="l2-ps-media-card l2-ps-solution">
            <div class="l2-ps-media-badge l2-ps-badge-green">With Classroom Quick Downloader</div>
            <div class="l2-ps-media-wrap">
              <MediaLoader type="video" src="{base}/videos/solution.mp4" class="l2-ps-video" autoplay loop muted playsinline preload="metadata" ariaLabel="Instant batch download with CQD" aspectRatio="16/9">
                <button type="button" class="l2-ps-expand-btn" on:click={() => toggleMediaExpanded('solution-video')} aria-label="Expand video">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
                </button>
              </MediaLoader>
            </div>
          </div>
        </div>
      </div>

      <!-- Divider between features -->
      <div class="l2-ps-divider" aria-hidden="true">
        <span class="l2-ps-divider-line"></span>
        <span class="l2-ps-divider-dot"></span>
        <span class="l2-ps-divider-line"></span>
      </div>

      <!-- Feature 2: Flags (images) -->
      <div class="l2-ps-feature">
        <div class="l2-ps-feature-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          <span>Post Flags</span>
        </div>
        <div class="l2-ps-pair">
          <div class="l2-ps-media-card l2-ps-problem">
            <div class="l2-ps-media-badge">Without Classroom Quick Downloader</div>
            <div class="l2-ps-media-wrap">
              <MediaLoader type="image" src="{base}/images/problem-flags.webp" class="l2-ps-img" alt="Classroom posts without edit/comment flags" loading="lazy">
                <button type="button" class="l2-ps-expand-btn" on:click={() => toggleMediaExpanded('problem-flags')} aria-label="Expand image">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
                </button>
              </MediaLoader>
            </div>
          </div>
          <div class="l2-ps-flow-arrow" aria-hidden="true">
            <svg viewBox="0 0 64 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="4" y1="16" x2="44" y2="16" stroke="var(--gc-green)" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" opacity="0.5"/>
              <path d="M40 8l12 8-12 8" stroke="var(--gc-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </div>
          <div class="l2-ps-media-card l2-ps-solution">
            <div class="l2-ps-media-badge l2-ps-badge-green">With Classroom Quick Downloader</div>
            <div class="l2-ps-media-wrap">
              <MediaLoader type="image" src="{base}/images/solution-flags.webp" class="l2-ps-img" alt="CQD flags showing edited and commented posts" loading="lazy">
                <button type="button" class="l2-ps-expand-btn" on:click={() => toggleMediaExpanded('solution-flags')} aria-label="Expand image">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
                </button>
              </MediaLoader>
            </div>
          </div>
        </div>
      </div>

      <!-- Solution summary -->
      <div class="l2-ps-solution-summary">
        <span class="l2-label">THE SOLUTION</span>
        <h3>One click. Every file. Clear flags. Done.</h3>
        <ul class="l2-check-list">
          <li><span class="l2-check">✓</span> Batch download all files instantly</li>
          <li><span class="l2-check">✓</span> Visual flags for edited &amp; commented posts</li>
          <li><span class="l2-check">✓</span> Works with Classwork &amp; Stream tabs</li>
          <li><span class="l2-check">✓</span> Supports Google Workspace accounts</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- Media expand modals -->
  {#if mediaExpanded}
    {@const nav = getMediaNav(mediaExpanded)}
    <div class="l2-media-modal-backdrop" transition:fade={{ duration: 180 }} on:click|self={closeMediaExpanded} role="presentation">

      <!-- Prev arrow (outside modal to avoid overflow: hidden clipping) -->
      {#if nav.hasPrev}
        <button type="button" class="l2-media-nav-btn l2-media-nav-prev" on:click|stopPropagation={() => navigateMedia('prev')} aria-label="Previous" title="Previous">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      {/if}

      <div class="l2-media-modal" transition:scale={{ duration: 220, start: 0.96 }} role="dialog" tabindex="-1" aria-modal="true" aria-label="Expanded media">
        <button type="button" class="l2-media-modal-close l2-ps-expand-btn l2-ps-expand-btn-modal" on:click={closeMediaExpanded} aria-label="Close" title="Collapse">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12" />
            <path d="M18 6 6 18" />
          </svg>
        </button>
        {#key mediaExpanded}
          <div class="l2-media-crossfade" in:fade={{ duration: 120 }} out:fade={{ duration: 100 }}>
            {#if mediaExpanded === 'problem-video'}
              <MediaLoader type="video" src="{base}/videos/problem.mp4" class="l2-media-modal-content" autoplay loop muted playsinline preload="auto" eager />
            {:else if mediaExpanded === 'solution-video'}
              <MediaLoader type="video" src="{base}/videos/solution.mp4" class="l2-media-modal-content" autoplay loop muted playsinline preload="auto" eager />
            {:else if mediaExpanded === 'problem-flags'}
              <MediaLoader type="image" src="{base}/images/problem-flags.webp" class="l2-media-modal-content" alt="Expanded view" eager />
            {:else if mediaExpanded === 'solution-flags'}
              <MediaLoader type="image" src="{base}/images/solution-flags.webp" class="l2-media-modal-content" alt="Expanded view" eager />
            {/if}
          </div>
        {/key}
      </div>

      <!-- Next arrow (outside modal to avoid overflow: hidden clipping) -->
      {#if nav.hasNext}
        <button type="button" class="l2-media-nav-btn l2-media-nav-next" on:click|stopPropagation={() => navigateMedia('next')} aria-label="Next" title="Next">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      {/if}
    </div>
  {/if}

  <!-- ━━━━ Features ━━━━ -->
  <section class="l2-block l2-block-alt l2-features-section l2-snap">
    <div class="l2-wrap l2-reveal" data-placement-section="features" style="position:relative">
      <div class="l2-section-head">
        <span class="l2-label">WHY CLASSROOM QUICK DOWNLOADER</span>
        <h2>Built different.</h2>
        <p>Everything you'd expect from a modern extension — and nothing you wouldn't.</p>
      </div>
      <div class="l2-feature-grid">
        <div class="l2-fcard"><div class="l2-fcard-icon">⚡</div><h3>Instant</h3><p>Install → open Classroom → download. Zero configuration, zero learning curve.</p></div>
        <div class="l2-fcard"><div class="l2-fcard-icon">🔒</div><h3>Private</h3><p>No third-party tracking, no cookies, and no user profiles. Only aggregate operational metrics.</p></div>
        <div class="l2-fcard"><div class="l2-fcard-icon">🔓</div><h3>Transparent</h3><p>Clear docs, public roadmap, and predictable release notes for every update.</p></div>
        <div class="l2-fcard"><div class="l2-fcard-icon">🌐</div><h3>Universal</h3><p>Chrome, Firefox, Edge, Brave, Opera, Vivaldi, Arc — it just works.</p></div>
        <div class="l2-fcard"><div class="l2-fcard-icon">🎓</div><h3>For Students</h3><p>Built by a student who was tired of clicking. Designed for real classroom workflows.</p></div>
        <div class="l2-fcard"><div class="l2-fcard-icon">🌍</div><h3><AnimatedNumber value={100} format={{ useGrouping: false }} suffix="+" animated /> Languages</h3><p>Available in English, Arabic, Spanish, French, German, and over <AnimatedNumber value={100} format={{ useGrouping: false }} animated /> more languages.</p></div>
      </div>
    </div>
  </section>

  <!-- ━━━━ How It Works ━━━━ -->
  <section class="l2-block l2-snap">
    <div class="l2-wrap l2-reveal" data-placement-section="steps" style="position:relative">
      <div class="l2-section-head">
        <span class="l2-label">HOW IT WORKS</span>
        <h2>Three steps. Ten seconds.</h2>
      </div>
      <div class="l2-steps">
        <div class="l2-step"><div class="l2-step-num">1</div><div class="l2-step-line"></div><h3>Install</h3><p>Add Classroom Quick Downloader from the Chrome Web Store, Firefox Add-ons, or Edge Add-ons.</p></div>
        <div class="l2-step"><div class="l2-step-num">2</div><div class="l2-step-line"></div><h3>Open Classroom</h3><p>Navigate to any class. Classroom Quick Downloader detects all downloadable materials automatically.</p></div>
        <div class="l2-step"><div class="l2-step-num">3</div><h3>Download</h3><p>Click once. All files download simultaneously to your device.</p></div>
      </div>
    </div>
  </section>

  <!-- ━━━━ Social Proof ━━━━ -->
  <section class="l2-block l2-block-alt l2-snap">
    <div class="l2-wrap l2-reveal" data-placement-section="proof" style="position:relative">
      <div class="l2-section-head">
        <span class="l2-label">TRUSTED WORLDWIDE</span>
        <h2>
          Used in
          {#if metricsReady}
            <AnimatedNumber value={countryCount ?? 0} suffix="+" animated />
          {:else}
            <span class="l2-metric-pending">—</span>
          {/if}
          countries.
        </h2>
        <p>Students, teachers, and universities around the world trust Classroom Quick Downloader.</p>
      </div>
      <div class="l2-proof-grid">
        <div class="l2-proof-card">
          <div class="l2-proof-num">
            {#if metricsReady}
              <AnimatedNumber value={downloadCount ?? 0} animated />
            {:else}
              <span class="l2-metric-pending">—</span>
            {/if}
          </div>
          <div class="l2-proof-label">Total Downloads</div>
        </div>
        <div class="l2-proof-card">
          <div class="l2-proof-num">
            {#if metricsReady}
              <AnimatedNumber value={userCount ?? 0} animated />
            {:else}
              <span class="l2-metric-pending">—</span>
            {/if}
          </div>
          <div class="l2-proof-label">Active Users</div>
        </div>
        <div class="l2-proof-card"><div class="l2-proof-num"><AnimatedNumber value={100} suffix="+" animated /></div><div class="l2-proof-label">Languages</div></div>
        <div class="l2-proof-card"><div class="l2-proof-num"><AnimatedNumericText text={APP_VERSION} animated /></div><div class="l2-proof-label">Latest Release</div></div>
      </div>
    </div>
  </section>

  <!-- ━━━━ Global Map ━━━━ -->
  <section id="global-map" class="l2-block l2-snap l2-map-section" bind:this={mapSectionEl}>
    <div class="l2-wrap l2-reveal l2-map-wrap" data-placement-section="map">
      <div class="l2-map-layout">
        {#if mapState === 'loading'}
          <div class="l2-map-state-card">
            <div class="state-loading">Loading live global map…</div>
          </div>
        {:else if mapState === 'error'}
          <div class="l2-map-state-card">
            <div class="state-error">
              <strong>Could not load global map.</strong>
              <p>{mapError}</p>
            </div>
          </div>
        {:else if !RotatingGlobeComponent}
          <div class="l2-map-state-card">
            <div class="state-loading">Preparing globe renderer…</div>
          </div>
        {:else}
          <div class="l2-map-shell">
            <div class="l2-map-frame">
              <button
                type="button"
                class="l2-ps-expand-btn l2-map-expand-btn"
                on:click={toggleMapExpanded}
                aria-pressed={mapExpanded}
                aria-label="Expand map to full screen popup"
                title="Expand map"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
                </svg>
              </button>
              <svelte:component
                this={RotatingGlobeComponent}
                mapData={mapData}
                className="l2-main-globe"
                tooltipAnimated={false}
                rotationSpeed={globeRotationDegreesPerSecond}
                idPrefix="landing2-globe"
              />
            </div>
          </div>
        {/if}

        <div class="l2-map-copy">
          <span class="l2-label">TRUSTED WORLDWIDE</span>
          <h2>See where Classroom Quick Downloader is used around the world.</h2>
          <p>Country-level usage rendered as a rotating globe based on live service metrics.</p>
          <div class="l2-map-top-countries">
            {#each topCountries as country, i}
              <div class="l2-top-country-card l2-rank-{i}" style="--rank-color:{i === 0 ? '#ca8a04' : i === 1 ? '#64748b' : '#92400e'};--rank-bg:{i === 0 ? 'rgba(234,179,8,0.08)' : i === 1 ? 'rgba(148,163,184,0.06)' : 'rgba(180,83,9,0.06)'};--rank-border:{i === 0 ? 'rgba(234,179,8,0.3)' : i === 1 ? 'rgba(148,163,184,0.25)' : 'rgba(180,83,9,0.25)'}">
                <div class="l2-top-rank">
                  <span class="l2-rank-medal">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                </div>
                <div class="l2-top-info">
                  <strong>{countryName(country.countryCode)}</strong>
                  <span class="l2-top-count"><AnimatedNumber value={country.count} animated /> downloads</span>
                </div>
              </div>
            {/each}
          </div>

          {#if ENABLE_SILLY_QUESTION && mapPromptVisible}
          <div
            class="l2-silly-entrance"
            in:fly={{ y: 20, duration: 600, easing: quintOut }}
          >
            <div class="l2-silly-divider"></div>
            <div class="l2-silly-inline">
              {#if mapInteractionState === 'idle'}
                <h3 class="l2-silly-q">Is your country downloading? 🌍</h3>
                <p class="l2-silly-sub">Join students from <strong>{metricsReady ? `${countryCount}+` : 'many'}</strong> countries already using CQD</p>
                <div class="l2-silly-btns">
                  <button type="button" class="l2-silly-btn l2-silly-yes" on:click={onMapYes} disabled={sillyAnswered}>Yes 🎉</button>
                  <button type="button" class="l2-silly-btn l2-silly-no" on:click={onMapNo} disabled={sillyAnswered}>Not yet 😢</button>
                </div>
              {:else if mapInteractionState === 'yes'}
                <div class="l2-silly-result l2-silly-yay" transition:scale={{ duration: 400, start: 0.3 }}>
                  <span class="l2-silly-yay-text">Yay! 🎊</span>
                  <p class="l2-silly-yay-sub">You're part of the global Classroom Quick Downloader family!</p>
                </div>
              {:else if mapInteractionState === 'no'}
                <div class="l2-silly-result l2-silly-waiting" transition:scale={{ duration: 400, start: 0.3 }}>
                  <p class="l2-silly-typed">{noTypedText}<span class="l2-typing-cursor">|</span></p>
                  {#if noShowCta}
                    <div class="l2-silly-cta-reveal" transition:scale={{ duration: 300, start: 0.7 }}>
                      <a
                        class="l2-cta l2-cta-current l2-silly-install"
                        href={browserLink(detectedBrowser)}
                        target="_blank"
                        rel="noopener noreferrer"
                        on:click={() => trackInstallClick('map_prompt_install')}
                      >
                        <img src="{base}/images/{detectedBrowser}.svg" alt="" class="l2-cta-icon" />
                        Install for {browserDisplayName(detectedBrowser)}
                      </a>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
          {/if}
        </div>
      </div>
    </div>
  </section>

  {#if mapExpanded}
    <div
      class="l2-map-modal-backdrop"
      transition:fade={{ duration: 180 }}
      on:click|self={closeMapExpanded}
      role="presentation"
    >
      <div
        class="l2-map-modal"
        transition:scale={{ duration: 220, start: 0.96 }}
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-label="Expanded global map"
      >
        <button
          type="button"
          class="l2-ps-expand-btn l2-ps-expand-btn-modal l2-map-modal-close"
          on:click={closeMapExpanded}
          aria-label="Collapse expanded map"
          title="Collapse"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12" />
            <path d="M18 6 6 18" />
          </svg>
        </button>
        {#if CountryHeatmapComponent}
          <svelte:component
            this={CountryHeatmapComponent}
            mapData={mapData}
            className="l2-main-flatmap-modal"
            tooltipAnimated={false}
            showLegend={false}
          />
        {:else}
          <div class="l2-map-state-card">
            <div class="state-loading">Preparing map renderer…</div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ━━━━ Final CTA ━━━━ -->
  <section class="l2-cta-section l2-snap">
    <div class="l2-wrap l2-cta-content l2-reveal" data-placement-section="cta" style="position:relative;overflow:visible">
      <h2>Ready to save hours?</h2>
      <p>Install Classroom Quick Downloader in under 10 seconds. Free, forever. No account required.</p>
      <!-- NEWSLETTER_CTA_DISABLED_ROLLBACK_START
      <p>Install Classroom Quick Downloader in under 10 seconds, and add your email for future updates. Free, forever. No account required.</p>
      <form class="l2-newsletter-form" on:submit|preventDefault={submitNewsletterEmail}>
        <input
          type="email"
          class="l2-newsletter-input"
          bind:value={newsletterEmail}
          placeholder="Enter your email for future updates"
          inputmode="email"
          autocomplete="email"
          required
        />
        <button
          type="submit"
          class="l2-newsletter-submit"
          disabled={newsletterSubmitState === 'submitting'}
        >
          {#if newsletterSubmitState === 'submitting'}Submitting…{:else}Notify me{/if}
        </button>
      </form>
      {#if newsletterStatusMessage}
        <p class="l2-newsletter-status l2-newsletter-status-{newsletterSubmitState}">
          {newsletterStatusMessage}
        </p>
      {/if}
      NEWSLETTER_CTA_DISABLED_ROLLBACK_END -->
      <div class="l2-hero-actions">
        {#each orderedBrowserCtas as b}
          <a
            class="l2-cta {b === detectedBrowser ? 'l2-cta-current' : 'l2-cta-other'}"
            href={browserLink(b)}
            target="_blank"
            rel="noopener noreferrer"
            on:click={() => trackInstallClick('final_install')}
          >
            <img src="{base}/images/{b}.svg" alt="" class="l2-cta-icon" />
            {#if b === detectedBrowser}Install for {browserDisplayName(b)}{:else}{browserDisplayName(b)}{/if}
          </a>
        {/each}
      </div>
    </div>
  </section>

  <!-- ━━━━ Edit Mode Toolbar & Picker ━━━━ -->
  {#if editMode}
    <div class="edit-toolbar" transition:fade={{ duration: 200 }}>
      <div class="edit-tb-left">
        <span class="edit-tb-title">✏️ Element Editor</span>
        <button class="edit-tb-btn edit-tb-add-float" on:click={() => addElement('float')}>+ Float</button>
        <button class="edit-tb-btn edit-tb-add-doodle" on:click={() => addElement('doodle')}>+ Doodle</button>
        <button class="edit-tb-btn edit-tb-add-3d" on:click={() => addElement('3d')}>+ 3D</button>
        <span class="edit-tb-count">{placements.length} element{placements.length !== 1 ? 's' : ''}</span>
        {#if editorStatus}
          <span class="edit-tb-status tone-{editorStatusTone}">{editorStatus}</span>
        {/if}
      </div>
      <div class="edit-tb-right">
        <button class="edit-tb-btn" on:click={toggleEditIsolation}>{editIsolation ? '🧊 Editing Locked' : '🌐 Page Interactive'}</button>
        <button class="edit-tb-btn" on:click={handleEditExport}>📋 Export</button>
        <button
          class="edit-tb-btn"
          on:click={() => {
            const next = !showImportPanel;
            showImportPanel = next;
            if (next) {
              importErrors = [];
              importWarnings = [];
            }
          }}
        >📥 Import</button>
        <button class="edit-tb-btn" on:click={handleEditDiscard}>↩️ Discard Draft</button>
        <button class="edit-tb-btn edit-tb-publish" on:click={handleEditPublish}>✅ Apply Draft</button>
        <button class="edit-tb-btn edit-tb-reset" on:click={handleEditResetDraft}>🔄 Reset Draft</button>
      </div>
    </div>

    {#if selectedPlacement}
      <div class="edit-inspector" transition:fade={{ duration: 120 }}>
        <div class="edit-inspector-top">
          <span class="edit-inspector-id">{selectedPlacement.id}</span>
          <span class="edit-inspector-type">{selectedPlacement.type}</span>
          <button class="edit-tb-btn edit-tb-swap" on:click={() => { pickerOpen = true; pickerSearch = ''; }}>🎨 Swap</button>
          <button class="edit-tb-btn" on:click={duplicateSelectedElement}>⧉ Duplicate</button>
          <button class="edit-tb-btn" on:click={toggleSelectedVisibility}>{selectedPlacement.hidden ? '👁️ Show' : '🙈 Hide'}</button>
          <button class="edit-tb-btn" on:click={toggleSelectedLock}>{selectedPlacement.locked ? '🔓 Unlock' : '🔒 Lock'}</button>
          <button class="edit-tb-btn edit-tb-reset" on:click={() => deleteElement(selectedPlacement.id)}>✕ Delete</button>
        </div>
        <div class="edit-inspector-grid">
          <label class="edit-tb-slider">
            X: {selectedPlacement.x.toFixed(1)}%
            <input
              type="range"
              min="-25"
              max="125"
              step="0.1"
              value={selectedPlacement.x}
              on:input={(e) => updatePlacement(selectedPlacement.id, { x: Number(e.currentTarget.value) })}
            />
          </label>
          <label class="edit-tb-slider">
            Y: {selectedPlacement.y.toFixed(1)}%
            <input
              type="range"
              min="-25"
              max="125"
              step="0.1"
              value={selectedPlacement.y}
              on:input={(e) => updatePlacement(selectedPlacement.id, { y: Number(e.currentTarget.value) })}
            />
          </label>
          <label class="edit-tb-slider">
            Size: {selectedPlacement.size}px
            <input
              type="range"
              min="16"
              max="640"
              value={selectedPlacement.size}
              on:input={(e) => updatePlacement(selectedPlacement.id, { size: Number(e.currentTarget.value) })}
            />
          </label>
          <label class="edit-tb-slider">
            Opacity: {(selectedPlacement.opacity * 100).toFixed(0)}%
            <input
              type="range"
              min="0"
              max="100"
              value={selectedPlacement.opacity * 100}
              on:input={(e) => updatePlacement(selectedPlacement.id, { opacity: Number(e.currentTarget.value) / 100 })}
            />
          </label>
          <label class="edit-tb-slider">
            Rotate: {selectedPlacement.rotate.toFixed(1)}°
            <input
              type="range"
              min="-360"
              max="360"
              step="0.1"
              value={selectedPlacement.rotate}
              on:input={(e) => updatePlacement(selectedPlacement.id, { rotate: Number(e.currentTarget.value) })}
            />
          </label>
          <label class="edit-tb-slider">
            Speed: {selectedPlacement.animDuration.toFixed(1)}s
            <input
              type="range"
              min="0"
              max="120"
              step="0.1"
              value={selectedPlacement.animDuration}
              on:input={(e) => updatePlacement(selectedPlacement.id, { animDuration: Number(e.currentTarget.value) })}
            />
          </label>
          <label class="edit-tb-slider">
            Layer: {selectedPlacement.zIndex ?? 0}
            <input
              type="range"
              min="0"
              max="500"
              value={selectedPlacement.zIndex ?? 0}
              on:input={(e) => updatePlacement(selectedPlacement.id, { zIndex: Number(e.currentTarget.value) })}
            />
          </label>
          <label class="edit-tb-slider edit-color-input">
            Color:
            <input
              type="color"
              value={selectedPlacement.color?.startsWith('#') ? selectedPlacement.color : '#1a8b55'}
              on:input={(e) => updatePlacement(selectedPlacement.id, { color: e.currentTarget.value })}
            />
            <button class="edit-tb-btn" on:click={() => updatePlacement(selectedPlacement.id, { color: 'var(--green)' })}>Theme</button>
          </label>
          <label class="edit-tb-slider">
            Section:
            <select
              value={selectedPlacement.section}
              on:change={(e) => updatePlacement(selectedPlacement.id, { section: e.currentTarget.value as ElementPlacement['section'] })}
            >
              <option value="hero">Hero</option>
              <option value="students">Students</option>
              <option value="problem">Problem</option>
              <option value="features">Features</option>
              <option value="steps">Steps</option>
              <option value="proof">Proof</option>
              <option value="map">Map</option>
              <option value="cta">CTA</option>
              <option value="general">General</option>
            </select>
          </label>
          <div class="edit-layer-controls">
            <button class="edit-tb-btn" on:click={() => bumpSelectedLayer('down')}>Layer -1</button>
            <button class="edit-tb-btn" on:click={() => bumpSelectedLayer('up')}>Layer +1</button>
          </div>
        </div>
      </div>
    {/if}

    {#if showImportPanel}
      <div class="edit-import-panel" transition:fade={{ duration: 150 }}>
        <h4>Import Placements JSON</h4>
        <textarea class="edit-import-textarea" bind:value={importJsonText} placeholder="Paste JSON here..."></textarea>
        {#if importWarnings.length > 0}
          <div class="edit-import-log warn">
            <strong>Warnings</strong>
            {#each importWarnings as warning}
              <div>{warning}</div>
            {/each}
          </div>
        {/if}
        {#if importErrors.length > 0}
          <div class="edit-import-log error">
            <strong>Errors</strong>
            {#each importErrors as error}
              <div>{error}</div>
            {/each}
          </div>
        {/if}
        <div class="edit-import-actions">
          <button class="edit-tb-btn edit-tb-publish" on:click={handleEditImport}>Apply To Draft</button>
          <button class="edit-tb-btn" on:click={() => showImportPanel = false}>Cancel</button>
        </div>
      </div>
    {/if}

    {#if pickerOpen}
      <div
        class="edit-picker-overlay"
        role="button"
        tabindex="0"
        aria-label="Close sample picker"
        on:click|self={() => pickerOpen = false}
        on:keydown={(e) => {
          if (e.currentTarget !== e.target) return;
          if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pickerOpen = false;
          }
        }}
        transition:fade={{ duration: 150 }}
      >
        <div class="edit-picker-panel">
          <div class="edit-picker-header">
            <h3>Pick a Sample</h3>
            <button class="edit-picker-close" on:click={() => pickerOpen = false}>✕</button>
          </div>
          <div class="edit-picker-tabs">
            <button class:active={pickerTab === 'float'} on:click={() => pickerTab = 'float'}>🎈 Floats</button>
            <button class:active={pickerTab === 'doodle'} on:click={() => pickerTab = 'doodle'}>✏️ Doodles</button>
            <button class:active={pickerTab === '3d'} on:click={() => pickerTab = '3d'}>🧊 3D</button>
          </div>
          <input class="edit-picker-search" type="text" placeholder="Search..." bind:value={pickerSearch} />
          <div class="edit-picker-grid">
            {#each pickerItems as item (item.id)}
              <button
                class="edit-picker-item"
                class:active={selectedPlacement?.sampleId === item.id}
                on:click={() => assignSample(item.id)}
                title={item.label}
              >
                <svg
                  viewBox={pickerTab === '3d' ? '0 0 120 110' : pickerTab === 'doodle' ? '0 0 60 60' : '0 0 64 64'}
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round"
                  style="width:36px;height:36px;color:var(--green);">
                  {@html item.svg}
                </svg>
                <span class="edit-picker-id">{item.id}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  {/if}

</div>

<style>
  :global(balloons),
  :global(text-balloons) {
    z-index: 2147483647 !important;
    pointer-events: none !important;
  }

  :global(balloons balloon),
  :global(text-balloons text-balloon) {
    pointer-events: none !important;
  }

  /* ── Base ──────────────────────────── */
  .l2 {
    --green: #1a8b55;
    --green-light: #22c55e;
    --green-bg: rgba(26, 139, 85, 0.06);
    --green-border: rgba(26, 139, 85, 0.12);
    --dark: #0f1419;
    --text: #1a1a2e;
    --text-secondary: #64748b;
    --muted: #94a3b8;
    --bg: #fafcfb;
    --card: rgba(255, 255, 255, 0.6);
    --card-solid: #ffffff;
    --border: rgba(226, 232, 240, 0.6);
    --border-subtle: rgba(226, 232, 240, 0.35);
    --radius: 16px;
    --wrap: 1280px;
    font-family: var(--font-ui), sans-serif;
    background: var(--bg);
    color: var(--text);
    overflow-x: hidden;
    position: relative;
  }

  .l2-wrap { max-width: var(--wrap); margin: 0 auto; padding: 0 24px; }

  .l2.edit-isolation {
    user-select: none;
    -webkit-user-select: none;
  }

  .l2.edit-isolation section,
  .l2.edit-isolation .l2-map-modal-backdrop,
  .l2.edit-isolation .l2-media-modal-backdrop {
    pointer-events: none !important;
  }

  .l2.edit-isolation .l2-page-floats {
    pointer-events: auto;
    z-index: 4000;
  }

  /* ── Hero ───────────────────────────── */
  .l2-hero {
    position: relative; z-index: 2;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    text-align: center;
    padding: 100px 24px 60px;
  }

  /* ── Page-wide decorative layers ──── */
  .l2-page-orbs {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0;
  }
  .orb {
    position: absolute; border-radius: 50%;
    filter: blur(120px);
  }
  /* Hero-region orbs */
  .orb-1 { width: 560px; height: 560px; background: #bbf7d0; top: 1%; right: -4%; opacity: 0.35; animation: orb-drift 18s ease-in-out infinite alternate; }
  .orb-2 { width: 480px; height: 480px; background: #a5f3fc; top: 8%; left: -4%; opacity: 0.28; animation: orb-drift 22s ease-in-out infinite alternate-reverse; }
  .orb-3 { width: 360px; height: 360px; background: #e0e7ff; top: 5%; left: 42%; opacity: 0.22; animation: orb-drift 15s ease-in-out infinite alternate; }
  /* Mid-page orbs */
  .orb-4 { width: 500px; height: 500px; background: #bbf7d0; top: 30%; left: -3%; opacity: 0.25; animation: orb-drift 20s ease-in-out infinite alternate; }
  .orb-5 { width: 440px; height: 440px; background: #a5f3fc; top: 45%; right: -2%; opacity: 0.22; animation: orb-drift 24s ease-in-out infinite alternate-reverse; }
  /* Lower-page orbs */
  .orb-6 { width: 520px; height: 520px; background: #bbf7d0; top: 65%; right: 5%; opacity: 0.28; animation: orb-drift 19s ease-in-out infinite alternate; }
  .orb-7 { width: 400px; height: 400px; background: #e0e7ff; top: 80%; left: 5%; opacity: 0.2; animation: orb-drift 26s ease-in-out infinite alternate-reverse; }
  /* Extra density orbs */
  .orb-8 { width: 380px; height: 380px; background: #bbf7d0; top: 20%; right: 15%; opacity: 0.2; animation: orb-drift 21s ease-in-out infinite alternate; }
  .orb-9 { width: 420px; height: 420px; background: #a5f3fc; top: 38%; left: 20%; opacity: 0.18; animation: orb-drift 25s ease-in-out infinite alternate-reverse; }
  .orb-10 { width: 460px; height: 460px; background: #e0e7ff; top: 55%; right: -2%; opacity: 0.2; animation: orb-drift 17s ease-in-out infinite alternate; }
  .orb-11 { width: 340px; height: 340px; background: #bbf7d0; top: 72%; left: 30%; opacity: 0.22; animation: orb-drift 23s ease-in-out infinite alternate-reverse; }
  .orb-12 { width: 480px; height: 480px; background: #a5f3fc; top: 90%; right: 8%; opacity: 0.18; animation: orb-drift 27s ease-in-out infinite alternate; }

  .l2-page-grid {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0;
    opacity: 0.03;
    background-image: linear-gradient(var(--text) 1px, transparent 1px),
                       linear-gradient(90deg, var(--text) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  .l2-hero-content { position: relative; z-index: 2; }

  .l2-mega {
    font-size: clamp(40px, 6vw, 72px); font-weight: 900;
    line-height: 1.05; letter-spacing: -0.03em;
    margin: 0 0 24px;
  }
  .l2-em {
    background: linear-gradient(135deg, var(--green), var(--green-light), #10b981);
    background-size: 200% 200%;
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    animation: gradient-shift 5s ease-in-out infinite;
  }
  .l2-em-supercharge {
    position: relative;
  }
  .l2-supercharge-star {
    position: absolute;
    left: calc(100% + clamp(2px, 0.25vw, 8px));
    top: 0.08em;
    pointer-events: none;
    z-index: 2;
    animation: none !important;
    transform-origin: center;
  }
  .l2-sub {
    font-size: 18px; line-height: 1.7; color: var(--text);
    opacity: 0.7;
    max-width: 640px; margin: 0 auto 40px;
  }
  .l2-disclaimer {
    margin: -20px 0 22px;
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
  }
  .l2-compat {
    font-size: 13px; color: var(--text-secondary); margin-top: 16px;
    font-weight: 500; letter-spacing: 0.01em;
  }

  .l2-students-section {
    padding-top: 24px;
  }

  .l2-students-head {
    margin-bottom: 28px;
  }

  .l2-students-head p {
    max-width: 680px;
  }

  /* ── Connector System: Title → Stem → Rail → Dots → Cards ── */
  .l2-connector-system {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 900px;
    margin: -4px auto 0;
    pointer-events: none;
  }

  .l2-conn-stem {
    width: 2px;
    height: 22px;
    background: linear-gradient(180deg, rgba(26, 139, 85, 0.15), rgba(26, 139, 85, 0.4));
    border-radius: 999px;
  }

  .l2-conn-rail {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    position: relative;
    padding: 0 calc(100% / 6 - 6px);
  }

  /* The horizontal line — clipped to only span between outermost dots */
  .l2-conn-rail::before {
    content: '';
    position: absolute;
    left: calc(100% / 6 - 6px);
    right: calc(100% / 6 - 6px);
    top: 50%;
    height: 2px;
    transform: translateY(-50%);
    background: linear-gradient(90deg, rgba(26, 139, 85, 0.14), rgba(26, 139, 85, 0.38) 50%, rgba(26, 139, 85, 0.14));
    border-radius: 999px;
  }

  .l2-conn-dot {
    position: relative;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2.5px solid rgba(26, 139, 85, 0.45);
    background: #f4fdf7;
    z-index: 1;
    flex-shrink: 0;
  }

  /* Vertical drop from dot to card */
  .l2-conn-dot::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 100%;
    width: 2px;
    height: 18px;
    transform: translateX(-50%);
    background: rgba(26, 139, 85, 0.34);
    border-radius: 999px;
  }

  .l2-student-grid {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    padding-top: 18px;
    max-width: 900px;
    margin: 0 auto;
  }

  .l2-student-card {
    position: relative;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid var(--border-subtle);
    border-radius: 18px;
    padding: 28px 24px;
    box-shadow: 0 8px 28px rgba(15, 20, 25, 0.06);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
  }

  .l2-student-card:hover {
    transform: translateY(-4px);
    border-color: var(--green-border);
    box-shadow: 0 16px 38px rgba(15, 20, 25, 0.1);
  }

  .l2-student-icon {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    border: 1px solid rgba(26, 139, 85, 0.26);
    background: var(--green-bg);
    color: var(--green);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }

  .l2-student-icon svg {
    width: 24px;
    height: 24px;
    stroke: var(--green);
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .l2-student-card h3 {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.015em;
    color: var(--text);
  }

  .l2-student-card p {
    margin: 0;
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  /* ── Floating SVGs (page-wide) ───── */
  .l2-page-floats {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; overflow: hidden; z-index: 4;
  }

  /* Config-driven placement elements */
  .l2-placement-el {
    position: absolute;
    color: var(--green);
    animation: float-a ease-in-out infinite;
    pointer-events: none;
    transition: box-shadow 0.2s, outline 0.2s, opacity 0.7s ease, margin-top 0.7s ease;
    margin-top: var(--placement-shift, 0px);
    will-change: opacity;
  }
  .l2-placement-el.edit-mode {
    pointer-events: auto;
    cursor: grab;
    border-radius: 8px;
  }
  .l2-placement-el.edit-locked { cursor: not-allowed; opacity: 0.75; }
  .l2-placement-el.edit-mode:hover {
    outline: 2px dashed rgba(26,139,85,0.5);
    outline-offset: 4px;
    box-shadow: 0 0 20px rgba(26,139,85,0.15);
  }
  .l2-placement-el.edit-selected {
    outline: 2px solid var(--green) !important;
    outline-offset: 4px;
    box-shadow: 0 0 30px rgba(26,139,85,0.25);
    cursor: grabbing;
  }
  .l2-placement-el.edit-selected.edit-locked { cursor: not-allowed; }
  .el-delete-btn {
    position: absolute; top: -8px; right: -8px;
    width: 20px; height: 20px; border-radius: 50%;
    background: #ef4444; color: #fff; border: none;
    font-size: 10px; font-weight: 700; cursor: pointer;
    display: none; align-items: center; justify-content: center;
    z-index: 10; line-height: 1;
  }
  .l2-placement-el.edit-mode:hover .el-delete-btn,
  .l2-placement-el.edit-selected .el-delete-btn { display: flex; }
  .el-id-label {
    position: absolute; bottom: -16px; left: 50%; transform: translateX(-50%);
    font-size: 8px; font-weight: 700; color: var(--green);
    background: rgba(255,255,255,0.9); padding: 1px 4px; border-radius: 3px;
    white-space: nowrap; pointer-events: none; display: none;
  }
  .l2-placement-el.edit-mode:hover .el-id-label,
  .l2-placement-el.edit-selected .el-id-label { display: block; }

  /* ── Edit Mode Toolbar ───────────── */
  .edit-toolbar {
    position: fixed; bottom: 0; left: 0; right: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 20px; gap: 8px;
    background: rgba(15,20,30,0.92); backdrop-filter: blur(12px);
    border-top: 1px solid rgba(255,255,255,0.1);
    z-index: 60000; color: #e2e8f0;
    font-family: var(--font-ui), sans-serif;
    flex-wrap: wrap;
  }
  .edit-tb-left, .edit-tb-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .edit-tb-title { font-weight: 700; font-size: 14px; margin-right: 8px; }
  .edit-tb-count { font-size: 11px; color: #94a3b8; }
  .edit-tb-btn {
    padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 600;
    border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06);
    color: #e2e8f0; cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }
  .edit-tb-btn:hover { background: rgba(255,255,255,0.12); }
  .edit-tb-add-float { border-color: rgba(34,197,94,0.3); color: #22c55e; }
  .edit-tb-add-doodle { border-color: rgba(59,130,246,0.3); color: #3b82f6; }
  .edit-tb-add-3d { border-color: rgba(167,139,250,0.3); color: #a78bfa; }
  .edit-tb-swap { border-color: rgba(251,191,36,0.3); color: #fbbf24; }
  .edit-tb-publish { border-color: rgba(34,197,94,0.4); color: #4ade80; }
  .edit-tb-reset { border-color: rgba(239,68,68,0.3); color: #ef4444; }
  .edit-tb-slider {
    display: flex; align-items: center; gap: 6px;
    font-size: 10px; color: #94a3b8;
  }
  .edit-tb-slider input[type="range"] { width: 80px; accent-color: var(--green); }
  .edit-tb-slider select {
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: #e2e8f0;
    font-size: 11px;
    padding: 0 6px;
  }
  .edit-tb-status {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.12);
  }
  .edit-tb-status.tone-ok { color: #4ade80; border-color: rgba(74,222,128,0.35); background: rgba(74,222,128,0.1); }
  .edit-tb-status.tone-warn { color: #fbbf24; border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.1); }
  .edit-tb-status.tone-error { color: #f87171; border-color: rgba(248,113,113,0.35); background: rgba(248,113,113,0.1); }

  .edit-inspector {
    position: fixed;
    bottom: 72px;
    left: 20px;
    right: 20px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(12, 16, 24, 0.92);
    backdrop-filter: blur(12px);
    z-index: 60000;
    color: #e2e8f0;
    font-family: var(--font-ui), sans-serif;
  }
  .edit-inspector-top {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
  }
  .edit-inspector-id {
    font-family: monospace;
    font-size: 12px;
    font-weight: 700;
    color: #bbf7d0;
  }
  .edit-inspector-type {
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: #94a3b8;
  }
  .edit-inspector-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px 14px;
    align-items: center;
  }
  .edit-color-input input[type='color'] {
    width: 28px;
    height: 22px;
    border: 0;
    padding: 0;
    border-radius: 5px;
    background: transparent;
    cursor: pointer;
  }
  .edit-layer-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  /* ── Import Panel ────────────────── */
  .edit-import-panel {
    position: fixed; bottom: 56px; right: 20px;
    width: min(520px, calc(100vw - 40px)); padding: 16px;
    background: rgba(15,20,30,0.96); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    z-index: 60001; color: #e2e8f0;
    font-family: var(--font-ui), sans-serif;
  }
  .edit-import-panel h4 { margin: 0 0 8px; font-size: 14px; font-weight: 700; }
  .edit-import-textarea {
    width: 100%; height: 120px; padding: 10px; border-radius: 8px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    color: #e2e8f0; font-size: 11px; font-family: monospace; resize: vertical;
    box-sizing: border-box; margin-bottom: 8px;
  }
  .edit-import-actions { display: flex; gap: 8px; }
  .edit-import-log {
    margin-bottom: 8px;
    border-radius: 8px;
    padding: 8px;
    font-size: 11px;
    line-height: 1.4;
    max-height: 120px;
    overflow: auto;
  }
  .edit-import-log.warn {
    background: rgba(251,191,36,0.09);
    border: 1px solid rgba(251,191,36,0.3);
    color: #fcd34d;
  }
  .edit-import-log.error {
    background: rgba(248,113,113,0.09);
    border: 1px solid rgba(248,113,113,0.3);
    color: #fda4af;
  }

  /* ── Catalog Picker Popup ─────────── */
  .edit-picker-overlay {
    position: fixed; inset: 0; z-index: 60002;
    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
  }
  .edit-picker-panel {
    width: 600px; max-width: 90vw; max-height: 80vh;
    background: rgba(15,20,30,0.98); backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
    padding: 20px; color: #e2e8f0; display: flex; flex-direction: column;
    font-family: var(--font-ui), sans-serif;
  }
  .edit-picker-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .edit-picker-header h3 { margin: 0; font-size: 18px; font-weight: 700; }
  .edit-picker-close {
    background: none; border: none; color: #94a3b8; font-size: 22px;
    cursor: pointer; padding: 4px 8px; border-radius: 6px;
  }
  .edit-picker-close:hover { background: rgba(255,255,255,0.08); }
  .edit-picker-tabs { display: flex; gap: 6px; margin-bottom: 10px; }
  .edit-picker-tabs button {
    padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
    color: #94a3b8; cursor: pointer; transition: all 0.15s;
  }
  .edit-picker-tabs button.active {
    background: var(--green); color: #fff; border-color: var(--green);
  }
  .edit-picker-search {
    width: 100%; padding: 8px 12px; border-radius: 8px; font-size: 13px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    color: #e2e8f0; margin-bottom: 10px; box-sizing: border-box;
  }
  .edit-picker-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 6px; overflow-y: auto; flex: 1; max-height: 50vh;
  }
  .edit-picker-item {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; padding: 8px; display: flex; flex-direction: column;
    align-items: center; gap: 4px; cursor: pointer; transition: all 0.15s;
  }
  .edit-picker-item:hover { border-color: rgba(26,139,85,0.4); background: rgba(255,255,255,0.08); }
  .edit-picker-item.active { border-color: var(--green); background: rgba(26,139,85,0.15); }
  .edit-picker-id { font-size: 8px; color: #94a3b8; font-family: monospace; font-weight: 600; }

  @keyframes float-a {
    0%, 100% { transform: translateY(0) rotate(var(--placement-rotate, 0deg)); }
    25% { transform: translateY(-20px) rotate(calc(var(--placement-rotate, 0deg) + 5deg)); }
    50% { transform: translateY(10px) rotate(calc(var(--placement-rotate, 0deg) - 3deg)); }
    75% { transform: translateY(-15px) rotate(calc(var(--placement-rotate, 0deg) + 4deg)); }
  }
  @keyframes float-b {
    0%, 100% { transform: translateY(0) rotate(var(--placement-rotate, 0deg)); }
    33% { transform: translateY(15px) rotate(calc(var(--placement-rotate, 0deg) - 4deg)); }
    66% { transform: translateY(-25px) rotate(calc(var(--placement-rotate, 0deg) + 6deg)); }
  }

  /* ── CTA Buttons ───────────────────── */
  .l2-hero-actions {
    display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
  }
  .l2-cta {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 14px 28px; font-size: 15px; font-weight: 700;
    border-radius: 14px; text-decoration: none;
    transition: all 0.25s ease;
  }
  .l2-cta-icon { width: 22px; height: 22px; }
  .l2-cta-current {
    background: linear-gradient(135deg, var(--green), var(--green-light));
    color: #fff;
    box-shadow: 0 4px 20px rgba(26, 139, 85, 0.35), 0 0 40px rgba(26, 139, 85, 0.15);
  }
  .l2-cta-current:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(26, 139, 85, 0.45), 0 0 60px rgba(26, 139, 85, 0.2); }
  .l2-cta-other {
    background: rgba(255, 255, 255, 0.55); color: var(--text);
    border: 1.5px solid var(--border-subtle);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  }
  .l2-cta-other:hover { border-color: var(--green-border); color: var(--green); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05); }

  /* ── Scrolling Marquee ─────────────── */
  .l2-marquee {
    overflow: hidden; padding: 24px 0;
    background: #ffffff;
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
    position: relative; z-index: 2;
  }

  .l2-marquee-viewport {
    overflow: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    touch-action: none;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  }

  .l2-marquee-viewport::-webkit-scrollbar {
    display: none;
  }

  .l2-marquee-viewport:active {
    cursor: grabbing;
  }

  .l2-marquee-track {
    display: flex;
    width: max-content;
  }
  .l2-marquee-set {
    display: flex; align-items: center; gap: 32px;
    padding: 0 32px;
    flex-shrink: 0;
  }
  .l2-mq-item { display: flex; align-items: baseline; gap: 8px; white-space: nowrap; }
  .l2-mq-num {
    font-size: 22px; font-weight: 800; color: var(--green);
  }
  .l2-mq-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
  .l2-mq-dot { color: var(--text-secondary); opacity: 0.72; font-size: 20px; }
  .l2-marquee-fallback {
    max-width: 960px;
    margin: 0 auto;
    padding: 10px 24px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }

  /* ── Content Blocks ────────────────── */
  .l2-block { padding: 80px 0; position: relative; z-index: 2; }
  .l2-block-alt { background: transparent; }
  .l2-label {
    font-size: 12px; font-weight: 700; color: var(--green);
    letter-spacing: 0.08em; text-transform: uppercase;
    display: block; margin-bottom: 12px;
  }
  .l2-check-list { list-style: none; padding: 0; margin: 16px 0 0; display: flex; flex-direction: column; gap: 10px; }
  .l2-check-list li { display: flex; align-items: center; gap: 10px; font-size: 15px; color: var(--text); }
  .l2-check { color: var(--green); font-weight: 700; font-size: 16px; }


  /* ── Problem / Solution pair layout ── */
  .l2-ps-section {
    --gc-green: #1a8b55;
  }

  .l2-ps-feature {
    margin-bottom: 40px;
  }

  .l2-ps-feature-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px 6px 12px;
    border-radius: 999px;
    background: rgba(26, 139, 85, 0.08);
    border: 1px solid rgba(26, 139, 85, 0.18);
    color: var(--gc-green);
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 20px;
  }

  .l2-ps-feature-label svg {
    width: 18px;
    height: 18px;
    stroke: var(--gc-green);
    flex-shrink: 0;
  }

  .l2-ps-pair {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 16px;
    align-items: center;
  }

  .l2-ps-media-card {
    position: relative;
    border-radius: 0;
    overflow: visible;
    border: 0;
    transition: box-shadow 0.3s;
  }

  .l2-ps-problem {
    box-shadow: none;
  }

  .l2-ps-solution {
    box-shadow: none;
  }

  .l2-ps-media-badge {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: rgba(220, 38, 38, 0.06);
    color: #dc2626;
    border: 1.5px solid rgba(220, 38, 38, 0.38);
    margin-bottom: 8px;
    position: relative;
    z-index: 1;
  }

  .l2-ps-badge-green {
    background: rgba(26, 139, 85, 0.06);
    color: var(--gc-green);
    border-color: rgba(26, 139, 85, 0.36);
  }

  .l2-ps-media-wrap {
    position: relative;
    background: rgba(255, 255, 255, 0.72);
    border-radius: 14px;
    overflow: hidden;
    border: 1.5px solid rgba(220, 38, 38, 0.24);
  }

  .l2-ps-problem .l2-ps-media-wrap {
    border-color: rgba(220, 38, 38, 0.38);
  }

  .l2-ps-solution .l2-ps-media-wrap {
    border-color: rgba(26, 139, 85, 0.36);
  }

  .l2-ps-video,
  .l2-ps-img {
    display: block;
    width: 100%;
    height: auto;
  }

  /* Expand button — solid white/green, appears on hover */
  .l2-ps-expand-btn {
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: scale(0.9);
    transition: opacity 0.2s, transform 0.2s, background 0.2s, border-color 0.2s;
    z-index: 3;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .l2-ps-expand-btn svg {
    width: 18px;
    height: 18px;
    stroke: #333;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.3s ease, stroke 0.2s ease;
  }

  .l2-ps-media-wrap:hover .l2-ps-expand-btn {
    opacity: 1;
    transform: scale(1);
  }

  .l2-ps-expand-btn:hover {
    background: var(--green);
    border-color: var(--green);
  }

  .l2-ps-expand-btn:hover svg {
    stroke: #fff;
    transform: rotate(45deg);
  }

  /* Arrow connecting Problem → Solution */
  .l2-ps-flow-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    flex-shrink: 0;
  }

  .l2-ps-flow-arrow svg {
    width: 56px;
    height: 28px;
  }

  /* Divider between feature rows */
  .l2-ps-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 8px 0 32px;
    padding: 0 10%;
  }

  .l2-ps-divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(26, 139, 85, 0.2), transparent);
  }

  .l2-ps-divider-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(26, 139, 85, 0.3);
    flex-shrink: 0;
  }

  /* Solution summary */
  .l2-ps-solution-summary {
    text-align: center;
    margin-top: 32px;
    padding: 32px;
    background: rgba(26, 139, 85, 0.04);
    border: 1px solid rgba(26, 139, 85, 0.15);
    border-radius: 18px;
  }

  .l2-ps-solution-summary h3 {
    font-size: clamp(22px, 2.5vw, 30px);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 8px 0 16px;
  }

  .l2-ps-solution-summary .l2-check-list {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    justify-content: center;
    list-style: none;
    padding: 0;
    margin: 0;
  }

  /* ── Media expand modal ── */
  .l2-media-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }

  .l2-media-modal {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    border-radius: 18px;
    overflow: hidden;
    background: #000;
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
    display: grid;
  }

  .l2-media-crossfade {
    grid-area: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
    min-width: 0;
    min-height: 0;
  }

  :global(.l2-media-modal-content) {
    display: block;
    max-width: 90vw;
    max-height: 90vh;
    width: auto;
    height: auto;
    border-radius: 16px;
    object-fit: contain;
  }

  /* ── Navigation arrows ──────────── */
  .l2-media-nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border-radius: 14px;
    border: 1px solid var(--border-subtle, rgba(26, 139, 85, 0.18));
    background: rgba(255, 255, 255, 0.92);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
                box-shadow 0.24s ease,
                background-color 0.2s ease,
                border-color 0.2s ease;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .l2-media-nav-prev { left: 20px; }
  .l2-media-nav-next { right: 20px; }

  .l2-media-nav-btn svg {
    width: 22px;
    height: 22px;
    stroke: #333;
    transition: stroke 0.2s ease;
  }

  .l2-media-nav-btn:hover {
    background: var(--gc-green, #1a8b55);
    border-color: var(--gc-green, #1a8b55);
    transform: translateY(-50%) scale(1.06);
    box-shadow: 0 8px 24px rgba(26, 139, 85, 0.25);
  }

  .l2-media-nav-btn:hover svg {
    stroke: #fff;
  }

  .l2-media-nav-btn:active {
    transform: translateY(-50%) scale(0.97);
  }

  /* Collapse button in modal — same style as expand button */
  .l2-ps-expand-btn-modal {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: auto;
    left: auto;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
    background: #fff;
    opacity: 1;
    transform: scale(1);
    z-index: 10;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.24s ease, background-color 0.2s ease, border-color 0.2s ease;
  }

  .l2-ps-expand-btn-modal svg {
    width: 20px;
    height: 20px;
    stroke: #333;
  }

  .l2-ps-expand-btn-modal:hover {
    background: var(--gc-green);
    border-color: var(--gc-green);
    transform: translateY(-1px) scale(1.03);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
  }

  .l2-ps-expand-btn-modal:hover svg {
    stroke: #fff;
    transform: none;
  }

  .l2-ps-expand-btn-modal:active {
    transform: scale(0.98);
  }

  /* 3D SVG in solution summary — positioned on the right, tilted */
  .l2-ps-solution-summary {
    position: relative;
    overflow: visible;
  }

  /* ── Top Countries in Map Section ── */
  .l2-map-top-countries {
    display: flex;
    flex-direction: row;
    gap: 12px;
    margin-top: 24px;
    flex-wrap: wrap;
  }

  .l2-top-country-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    background: var(--rank-bg);
    border: 1.5px solid var(--rank-border);
    border-radius: 16px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    flex: 1;
    min-width: 160px;
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    position: relative;
    overflow: hidden;
  }

  .l2-top-country-card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      118deg,
      transparent 30%,
      rgba(255, 255, 255, 0.38) 50%,
      transparent 70%
    );
    transform: translateX(-130%);
    opacity: 0;
    pointer-events: none;
  }

  .l2-top-country-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  }

  .l2-top-country-card:hover::after,
  .l2-top-country-card:focus-within::after {
    opacity: 1;
    animation: top-country-glint 1.2s ease-out 1;
  }

  @keyframes top-country-glint {
    from { transform: translateX(-130%); }
    to { transform: translateX(130%); }
  }

  .l2-top-rank {
    flex-shrink: 0;
  }

  .l2-rank-medal {
    font-size: 32px;
    line-height: 1;
    display: block;
  }

  .l2-top-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .l2-top-info strong {
    font-size: 16px;
    font-weight: 700;
    color: var(--rank-color);
  }

  .l2-top-count {
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  /* ── Silly Map Section ── */
  .l2-silly-divider {
    width: 48px;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--green), transparent);
    margin: 28px auto 0;
    border-radius: 2px;
    opacity: 0.3;
  }

  .l2-silly-entrance {
    overflow: hidden;
  }

  .l2-silly-inline {
    text-align: center;
    position: relative;
    margin-top: 24px;
    padding: 28px 24px;
    background: rgba(255,255,255,0.5);
    border: 1px solid rgba(26, 139, 85, 0.08);
    border-radius: 20px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .l2-silly-q {
    font-size: clamp(20px, 2.5vw, 28px);
    font-weight: 800;
    margin-bottom: 6px;
  }

  .l2-silly-sub {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 20px;
  }

  .l2-silly-btns {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .l2-silly-btn {
    padding: 12px 32px;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 700;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
    position: relative;
    overflow: hidden;
  }

  .l2-silly-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  .l2-silly-yes {
    background: rgba(26, 139, 85, 0.08);
    color: var(--green);
    border-color: rgba(26, 139, 85, 0.2);
  }

  .l2-silly-yes:hover:not(:disabled) {
    background: var(--green);
    color: #fff;
    border-color: var(--green);
    transform: scale(1.08) translateY(-2px);
    box-shadow: 0 8px 25px rgba(26,139,85,0.3);
  }

  .l2-silly-no {
    background: rgba(100, 116, 139, 0.06);
    color: var(--text-secondary);
    border-color: rgba(100, 116, 139, 0.15);
  }

  .l2-silly-no:hover:not(:disabled) {
    background: rgba(100, 116, 139, 0.12);
    border-color: rgba(100, 116, 139, 0.3);
    transform: scale(1.08) translateY(-2px);
    box-shadow: 0 8px 25px rgba(100,116,139,0.15);
  }

  .l2-silly-result {
    margin-top: 12px;
  }

  .l2-silly-yay-text {
    font-size: clamp(36px, 5vw, 56px);
    font-weight: 900;
    display: block;
    margin-bottom: 4px;
    background: linear-gradient(135deg, #22c55e, #eab308, #ef4444, #8b5cf6);
    background-size: 300% 300%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: yay-gradient 3s ease infinite;
  }

  @keyframes yay-gradient {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  .l2-silly-yay-sub {
    font-size: 16px;
    color: var(--text-secondary);
    margin-bottom: 16px;
  }

  /* Typewriter 'no' animation */
  .l2-silly-typed {
    font-size: clamp(22px, 3vw, 32px);
    font-weight: 800;
    color: var(--text);
    margin-bottom: 20px;
    min-height: 1.4em;
    animation: silly-shake 0.4s ease-out;
  }

  @keyframes silly-shake {
    0% { transform: translateX(0); }
    15% { transform: translateX(-8px) rotate(-1deg); }
    30% { transform: translateX(6px) rotate(0.5deg); }
    45% { transform: translateX(-4px) rotate(-0.3deg); }
    60% { transform: translateX(3px); }
    75% { transform: translateX(-1px); }
    100% { transform: translateX(0); }
  }

  .l2-typing-cursor {
    animation: cursor-blink 0.6s step-end infinite;
    font-weight: 200;
    color: var(--green);
    margin-left: 1px;
  }

  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .l2-silly-cta-reveal {
    margin-top: 16px;
    animation: cta-appear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes cta-appear {
    0% { opacity: 0; transform: translateY(16px) scale(0.9); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  .l2-silly-cta-reveal .l2-cta {
    animation: cta-glow 2s ease-in-out infinite;
  }

  @keyframes cta-glow {
    0%, 100% { box-shadow: 0 4px 16px rgba(26, 139, 85, 0.25); }
    50% { box-shadow: 0 4px 28px rgba(26, 139, 85, 0.5), 0 0 40px rgba(26, 139, 85, 0.15); }
  }

  .l2-silly-install {
    display: inline-flex;
  }

  :global(body.l2-media-modal-open) {
    overflow: hidden;
  }

  /* ── Section heads ─────────────────── */
  .l2-section-head { text-align: center; margin-bottom: 48px; }
  .l2-section-head h2 {
    font-size: clamp(28px, 3.5vw, 42px); font-weight: 800;
    letter-spacing: -0.02em; margin: 0 0 12px;
  }
  .l2-section-head p { font-size: 16px; color: var(--text-secondary); max-width: 560px; margin: 0 auto; }
  .l2-degraded-pill {
    border: 1px solid rgba(217, 119, 6, 0.32);
    background: rgba(217, 119, 6, 0.1);
    color: #92400e;
    border-radius: 999px;
    padding: 7px 12px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* ── Feature grid ──────────────────── */
  .l2-feature-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
  }
  .l2-fcard {
    background: rgba(255, 255, 255, 0.65); border: 1px solid var(--border-subtle);
    border-radius: var(--radius); padding: 28px 24px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  }
  .l2-fcard:hover { border-color: var(--green-border); transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08); }
  .l2-fcard-icon { font-size: 36px; margin-bottom: 14px; }
  .l2-fcard h3 { font-size: 17px; font-weight: 700; margin: 0 0 8px; }
  .l2-fcard p { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin: 0; }

  /* ── Steps ──────────────────────────── */
  .l2-steps { display: flex; gap: 0; justify-content: center; }
  .l2-step {
    flex: 1; max-width: 280px; text-align: center;
    position: relative; padding: 0 20px;
  }
  .l2-step-num {
    width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(135deg, var(--green), var(--green-light));
    color: #fff; font-weight: 800; font-size: 20px;
    display: inline-flex; align-items: center; justify-content: center;
    margin-bottom: 16px; position: relative; z-index: 1;
  }
  .l2-step-line {
    position: absolute; top: 24px; left: calc(50% + 30px); right: calc(-50% + 30px);
    height: 2px;
    background: linear-gradient(90deg, var(--green-border), var(--border), var(--green-border));
    opacity: 0.7;
  }
  .l2-step h3 { font-size: 16px; font-weight: 700; margin: 0 0 8px; }
  .l2-step p { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin: 0; }

  /* ── Social Proof ──────────────────── */
  .l2-proof-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .l2-proof-card {
    background: rgba(255, 255, 255, 0.65); border: 1px solid var(--border-subtle);
    border-radius: var(--radius); padding: 28px; text-align: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  }
  .l2-proof-card:hover { border-color: var(--green-border); transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0, 0, 0, 0.05); }
  .l2-proof-num { font-size: 28px; font-weight: 800; color: var(--green); margin-bottom: 6px; }
  .l2-metric-pending { color: #64748b; font-size: 1em; font-weight: 700; letter-spacing: 0.02em; }
  .l2-proof-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }

  /* ── Map spotlight ────────────────── */
  .l2-map-section {
    background: transparent;
    border: 0;
  }

  .l2-map-wrap.l2-wrap {
    max-width: 1240px;
  }

  .l2-map-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
    gap: 34px;
    align-items: center;
  }
  .l2-map-degraded-note {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    border: 1px solid rgba(217, 119, 6, 0.28);
    background: rgba(217, 119, 6, 0.09);
    color: #78350f;
    border-radius: 12px;
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.55;
  }
  .l2-map-degraded-note strong {
    font-size: 12px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .l2-map-copy {
    max-width: 560px;
    transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .l2-map-copy h2 {
    margin: 0 0 10px;
    font-size: clamp(30px, 3.2vw, 44px);
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  .l2-map-copy p {
    margin: 0;
    font-size: 16px;
    line-height: 1.75;
    color: var(--text-secondary);
  }


  .l2-map-shell {
    display: flex;
    justify-content: flex-start;
    width: 100%;
  }

  .l2-map-state-card {
    width: min(100%, 760px);
    border-radius: 18px;
    border: 1px solid rgba(15, 20, 25, 0.1);
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 10px 26px rgba(15, 20, 25, 0.08);
    padding: 30px;
  }

  .l2.edit-mode .l2-map-state-card {
    aspect-ratio: 1 / 1;
    display: grid;
    align-content: center;
  }

  .l2-map-frame {
    position: relative;
    width: min(100%, 760px);
    background: transparent;
    overflow: visible;
    isolation: isolate;
  }

  /* Map expand button — positioning override (inherits styles from l2-ps-expand-btn) */
  .l2-map-expand-btn {
    top: 14px;
    left: 14px;
    bottom: auto;
    right: auto;
    pointer-events: none;
    z-index: 4;
  }

  .l2-map-frame:hover .l2-map-expand-btn,
  .l2-map-frame:focus-within .l2-map-expand-btn {
    opacity: 1;
    pointer-events: auto;
    transform: scale(1);
  }

  :global(.l2-main-globe) {
    width: 100%;
    max-width: none;
    margin: 0 auto;
    border-radius: 22px;
  }

  :global(.l2-main-globe.globe-shell) {
    background: transparent;
    border: 0;
    padding: 0;
    box-shadow: none;
  }

  :global(.l2-main-globe.globe-shell svg) {
    aspect-ratio: 1 / 1;
  }

  .l2-map-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(3, 9, 14, 0.72);
    backdrop-filter: blur(3px);
    z-index: 220;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px;
  }

  .l2-map-modal {
    position: relative;
    width: min(96vw, 1720px);
    max-height: calc(100vh - 28px);
    overflow: auto;
    border-radius: 18px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    background: #fff;
    padding: 10px;
    box-shadow: 0 32px 72px rgba(0, 0, 0, 0.34);
  }

  .l2-map-modal-close {
    top: 14px;
    right: 14px;
  }

  :global(.l2-main-flatmap-modal.heatmap-shell) {
    width: 100%;
    border-radius: 0;
    border: 0;
    background: transparent;
    padding: 0;
    box-shadow: none;
  }

  :global(body.l2-map-modal-open) {
    overflow: hidden;
  }

  /* ── Final CTA ─────────────────────── */
  .l2-cta-section {
    position: relative;
    z-index: 2;
    isolation: isolate;
    padding: 80px 0;
    text-align: center;
    background: transparent;
  }
  .l2-cta-content {
    position: relative;
    z-index: 2;
    width: 100%;
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border-subtle);
    border-radius: 24px;
    padding: clamp(28px, 5vw, 64px) clamp(20px, 5vw, 48px);
    overflow: visible;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.04);
  }
  .l2-cta-content::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08));
    pointer-events: none;
    z-index: 0;
  }
  .l2-cta-content > * {
    position: relative;
    z-index: 1;
  }
  .l2-cta-content h2 {
    font-size: clamp(32px, 4vw, 48px); font-weight: 900;
    letter-spacing: -0.03em; margin: 0 0 16px;
  }
  .l2-cta-content p { font-size: 18px; color: var(--text-secondary); margin: 0 0 20px; }

  .l2-newsletter-form {
    width: min(580px, 100%);
    margin: 0 auto 22px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .l2-newsletter-input {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.86);
    color: var(--text-primary);
    padding: 12px 14px;
    font-size: 15px;
    line-height: 1.2;
  }
  .l2-newsletter-input::placeholder {
    color: var(--text-muted);
  }
  .l2-newsletter-input:focus {
    outline: none;
    border-color: var(--green-border);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.14);
  }
  .l2-newsletter-submit {
    border: 1px solid var(--green-border);
    background: linear-gradient(180deg, var(--green), #127043);
    color: #fff;
    border-radius: 12px;
    padding: 11px 16px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  }
  .l2-newsletter-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(18, 112, 67, 0.35);
  }
  .l2-newsletter-submit:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .l2-newsletter-status {
    margin: 0 0 26px;
    font-size: 14px;
    font-weight: 600;
  }
  .l2-newsletter-status-success {
    color: #127043;
  }
  .l2-newsletter-status-error {
    color: #b91c1c;
  }
  .l2-newsletter-status-submitting {
    color: var(--text-muted);
  }
  .l2-newsletter-status-idle {
    color: var(--text-muted);
  }

  /* ── Reveal Animations ─────────────── */
  .l2-reveal {
    opacity: 0; transform: translateY(32px);
    transition: opacity 0.7s ease, transform 0.7s ease;
  }
  :global(.l2-reveal.in-view) { opacity: 1; transform: translateY(0); }

  /* ── Keyframes ──────────────────────── */
  @keyframes orb-drift {
    0% { transform: translate(0, 0); }
    100% { transform: translate(30px, -40px); }
  }
  @keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  /* ── Responsive ────────────────────── */
  @media (max-width: 900px) {
    .l2-feature-grid { grid-template-columns: repeat(2, 1fr); }
    .l2-proof-grid { grid-template-columns: repeat(2, 1fr); }
    .l2-steps { flex-direction: column; align-items: center; }
    .l2-step-line { display: none; }
    .l2-student-grid { grid-template-columns: 1fr; }
    .l2-connector-system { display: none; }
    .l2-ps-pair { grid-template-columns: 1fr; gap: 20px; }
    .l2-ps-flow-arrow { transform: rotate(90deg); justify-self: center; }
    .l2-ps-expand-btn { opacity: 1; transform: scale(1); }
    .l2-media-modal-backdrop { padding: 8px; }
    .l2-media-nav-prev { left: 8px; }
    .l2-media-nav-next { right: 8px; }
    .l2-media-nav-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.9);
    }
    .l2-map-layout { grid-template-columns: 1fr; gap: 20px; }
    .l2-map-degraded-note { font-size: 11px; }
    .l2-map-copy { max-width: none; }
    .l2-map-shell { justify-content: center; }
    .l2-map-frame { width: 100%; }
    .l2-map-state-card { width: 100%; border-radius: 18px; padding: 18px 14px; }
    .l2-map-expand-btn {
      top: 10px;
      left: 10px;
      width: 34px;
      height: 34px;
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    .l2-map-modal-backdrop {
      padding: 8px;
    }
    .l2-map-modal {
      width: 100%;
      max-height: calc(100vh - 16px);
      border-radius: 14px;
      padding: 8px;
    }
    .l2-cta-content {
      border-radius: 20px;
      padding: 30px 20px;
    }
    .l2-cta-content p {
      margin-bottom: 26px;
      font-size: 16px;
    }
    .l2-newsletter-form {
      flex-direction: column;
      align-items: stretch;
      margin-bottom: 18px;
    }
    .l2-newsletter-submit {
      width: 100%;
      justify-content: center;
    }
    .l2-degraded-pill { white-space: normal; text-align: center; }
    .l2-ps-expand-btn-modal {
      width: 34px;
      height: 34px;
      top: 10px;
      right: 10px;
    }
    .edit-toolbar {
      padding: 8px 10px;
    }
    .edit-inspector {
      left: 10px;
      right: 10px;
      bottom: 64px;
      padding: 10px;
    }
    .edit-inspector-grid {
      grid-template-columns: 1fr;
    }
    .edit-import-panel {
      right: 10px;
      bottom: 52px;
      width: calc(100vw - 20px);
    }
    :global(.l2-main-flatmap-modal.heatmap-shell) {
      padding: 6px;
    }
  }
  @media (max-width: 600px) {
    .l2-feature-grid { grid-template-columns: 1fr; }
    .l2-hero-actions { flex-direction: column; align-items: center; }

  }
</style>
