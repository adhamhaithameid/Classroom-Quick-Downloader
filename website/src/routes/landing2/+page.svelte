<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { base } from '$app/paths';
  import { STORE_LINKS } from '$lib/config';
  import { fetchWebsiteSnapshot, ORACLE_SNAPSHOT_REFRESH_MS } from '$lib/api/publicSite';
  import type { MapResponse, OverviewResponse } from '$lib/types/public';
  import logo from '$lib/assets/cqd-logo.svg';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
  import AnimatedNumericText from '$lib/components/AnimatedNumericText.svelte';
  import CountryHeatmap from '$lib/components/CountryHeatmap.svelte';

  let overview: OverviewResponse | null = null;
  let mapData: MapResponse | null = null;
  let downloadCount = 0;
  let userCount = 0;
  let countryCount = 0;
  let scrollY = 0;
  let detectedBrowser: 'chrome' | 'firefox' | 'edge' = 'chrome';
  let mapState: 'loading' | 'ready' | 'error' = 'loading';
  let mapError = '';
  let mapExpanded = false;
  const currentYear = new Date().getFullYear();

  /* Computed from downloadCount — used in marquee (raw) */
  $: hoursSaved = computeTimeSaved(downloadCount).hours;
  $: clicksSaved = computeTimeSaved(downloadCount).clicks;

  function formatNumber(v: number): string {
    return new Intl.NumberFormat('en-US').format(v || 0);
  }

  function formatCompact(v: number): string {
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(v);
  }

  function browserLink(key: 'chrome' | 'firefox' | 'edge'): string {
    return overview?.links?.[key] || STORE_LINKS[key];
  }

  function detectBrowser(): 'chrome' | 'firefox' | 'edge' {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('edg/') || ua.includes('edge')) return 'edge';
    if (ua.includes('firefox')) return 'firefox';
    return 'chrome';
  }

  function browserDisplayName(key: string): string {
    const map: Record<string, string> = { chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge' };
    return map[key] || key;
  }

  function computeTimeSaved(downloads: number) {
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

  function toggleMapExpanded(): void {
    mapExpanded = !mapExpanded;
  }

  function closeMapExpanded(): void {
    mapExpanded = false;
  }

  function handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && mapExpanded) closeMapExpanded();
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

  /* ── Infinite marquee via JS scrollLeft ── */
  let marqueeEl: HTMLElement;

  function initMarquee(): void {
    if (!marqueeEl) return;
    const el = marqueeEl;

    // 8 duplicate sets → each set is 1/8 of total scrollWidth
    const setWidth = () => el.scrollWidth / 8;

    // Start at set 3 → 3 full sets of buffer to the left
    el.scrollLeft = setWidth() * 3;

    const speed = 0.5; // px per frame
    let rafId: number;

    function tick() {
      el.scrollLeft += speed;
      const sw = setWidth();
      // Wrap right: if past set 6, jump back by one set width
      if (el.scrollLeft >= sw * 6) {
        el.scrollLeft -= sw;
      }
      // Wrap left: if user scrolled into set 1 or below, jump forward
      if (el.scrollLeft <= sw) {
        el.scrollLeft += sw;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }

  async function loadSiteData(force = false): Promise<void> {
    mapState = force ? mapState : 'loading';
    mapError = '';
    try {
      const snapshot = await fetchWebsiteSnapshot({ force });
      overview = snapshot.overview;
      mapData = snapshot.map;
      downloadCount = snapshot.overview.totals.downloads || 0;
      userCount = computeUsersTotal(snapshot.overview);
      countryCount = snapshot.map.totals.countries || 0;
      mapState = 'ready';
    } catch (error) {
      mapError = error instanceof Error ? error.message : 'Failed to load map data.';
      mapState = 'error';
    }
  }

  onMount(async () => {
    detectedBrowser = detectBrowser();
    await loadSiteData();
    requestAnimationFrame(() => setupReveal());
    const stopMarquee = initMarquee();
    const timer = window.setInterval(() => {
      void loadSiteData(true);
    }, ORACLE_SNAPSHOT_REFRESH_MS);
    return () => {
      if (typeof stopMarquee === 'function') stopMarquee();
      window.clearInterval(timer);
      document.body.classList.remove('l2-map-modal-open');
    };
  });

  $: if (typeof document !== 'undefined') {
    document.body.classList.toggle('l2-map-modal-open', mapExpanded);
  }
</script>

<svelte:window bind:scrollY on:keydown={handleGlobalKeydown} />

<svelte:head>
  <title>Classroom Quick Downloader — The Free Extension That Supercharges Google Classroom</title>
  <meta name="description" content="Download all your Google Classroom files with one click. Free, open-source, and privacy-first." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
</svelte:head>

<div class="l2">
  <!-- ━━━━ Navbar ━━━━ -->
  <nav class="l2-nav">
    <div class="l2-wrap l2-nav-inner">
      <a href="{base}/" class="l2-nav-brand">
        <img src={logo} alt="Classroom Quick Downloader" class="l2-nav-logo" />
        <span>Classroom Quick Downloader</span>
      </a>
      <div class="l2-nav-links">
        <a href="{base}/">Home</a>
        <a href="{base}/faq">FAQ</a>
        <a href="{base}/privacy">Privacy</a>
        <a href="{base}/changelog">Changelog</a>
        <a href="{base}/map">Map</a>
        <a href={STORE_LINKS.github} target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
      <a class="l2-nav-cta" href={browserLink(detectedBrowser)} target="_blank" rel="noopener noreferrer">
        Install for {browserDisplayName(detectedBrowser)}
      </a>
    </div>
  </nav>

  <!-- ━━━━ Hero ━━━━ -->
  <section class="l2-hero l2-snap">
    <div class="l2-hero-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>
    <div class="l2-hero-grid"></div>

    <!-- Floating school SVGs -->
    <div class="l2-float-svgs" aria-hidden="true">
      <svg class="l2-float-svg fs-1" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 56V16l8-8h24l8 8v40H12z"/><path d="M20 8v12h24V8"/><line x1="22" y1="28" x2="42" y2="28"/><line x1="22" y1="36" x2="42" y2="36"/><line x1="22" y1="44" x2="34" y2="44"/></svg>
      <svg class="l2-float-svg fs-2" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 54l6-40h4l6 40"/><circle cx="16" cy="10" r="3"/><path d="M38 54l6-40h4l6 40"/><circle cx="44" cy="10" r="3"/></svg>
      <svg class="l2-float-svg fs-3" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="6" width="48" height="52" rx="4"/><line x1="8" y1="16" x2="56" y2="16"/><line x1="20" y1="6" x2="20" y2="16"/><line x1="16" y1="26" x2="48" y2="26"/><line x1="16" y1="34" x2="48" y2="34"/><line x1="16" y1="42" x2="36" y2="42"/></svg>
      <svg class="l2-float-svg fs-4" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M32 4L4 20l28 16 28-16L32 4z"/><path d="M4 20v20l28 16 28-16V20"/><path d="M32 36v20"/></svg>
      <svg class="l2-float-svg fs-5" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 56l4-44 6-4 4 4 4-4 6 4 4-4 6 4 4-4 6 4 4 44H8z"/><line x1="16" y1="20" x2="48" y2="20"/><line x1="16" y1="28" x2="48" y2="28"/><line x1="16" y1="36" x2="36" y2="36"/></svg>
    </div>

    <div class="l2-wrap l2-hero-content">
      <span class="l2-pill">
        <span class="l2-pill-dot"></span>
        Open Source  •  Privacy First  •  Free Forever
      </span>

      <h1 class="l2-mega">
        The free extension that<br/>
        <span class="l2-em">supercharges</span><br/>Google Classroom.
      </h1>

      <p class="l2-sub">
        Stop downloading files one by one. Classroom Quick Downloader adds batch downloads to Google Classroom — for every browser.
      </p>

      <div class="l2-hero-actions">
        {#each ['chrome', 'firefox', 'edge'] as b}
          <a
            class="l2-cta {b === detectedBrowser ? 'l2-cta-current' : 'l2-cta-other'}"
            href={browserLink(b)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="{base}/images/{b}.svg" alt="" class="l2-cta-icon" />
            {#if b === detectedBrowser}Install for {browserDisplayName(b)}{:else}{browserDisplayName(b)}{/if}
          </a>
        {/each}
      </div>

      <p class="l2-compat">Also works on Brave, Opera, Vivaldi, Arc & all Chromium browsers</p>
    </div>
  </section>

  <!-- ━━━━ Scrolling Metrics Marquee ━━━━ -->
  <section class="l2-marquee l2-snap" bind:this={marqueeEl}>
    <div class="l2-marquee-track">
      {#each [0, 1, 2, 3, 4, 5, 6, 7] as _dup}
        <div class="l2-marquee-set" aria-hidden={_dup > 0 ? 'true' : undefined}>
          <div class="l2-mq-item"><span class="l2-mq-num">{formatNumber(downloadCount)}</span><span class="l2-mq-label">Files Downloaded</span></div>
          <span class="l2-mq-dot">•</span>
          <div class="l2-mq-item"><span class="l2-mq-num">{formatNumber(userCount)}</span><span class="l2-mq-label">Active Users</span></div>
          <span class="l2-mq-dot">•</span>
          <div class="l2-mq-item"><span class="l2-mq-num">{countryCount}+</span><span class="l2-mq-label">Countries</span></div>
          <span class="l2-mq-dot">•</span>
          <div class="l2-mq-item"><span class="l2-mq-num">100+</span><span class="l2-mq-label">Languages</span></div>
          <span class="l2-mq-dot">•</span>
          <div class="l2-mq-item"><span class="l2-mq-num">{formatCompact(hoursSaved)}</span><span class="l2-mq-label">Hours Saved</span></div>
          <span class="l2-mq-dot">•</span>
          <div class="l2-mq-item"><span class="l2-mq-num">{formatCompact(clicksSaved)}</span><span class="l2-mq-label">Clicks Saved</span></div>
          <span class="l2-mq-dot">•</span>
          <div class="l2-mq-item"><span class="l2-mq-num">3</span><span class="l2-mq-label">Browser Stores</span></div>
          <span class="l2-mq-dot">•</span>
          <div class="l2-mq-item"><span class="l2-mq-num">100%</span><span class="l2-mq-label">Open Source</span></div>
          <span class="l2-mq-dot">•</span>
        </div>
      {/each}
    </div>
  </section>

  <!-- ━━━━ Problem (Text Left, Visual Right) ━━━━ -->
  <section class="l2-block l2-block-alt l2-snap">
    <div class="l2-wrap l2-grid l2-reveal">
      <div class="l2-text-col">
        <span class="l2-label">THE PROBLEM</span>
        <h2>Downloading files from Classroom shouldn't take this long.</h2>
        <p>Your professor uploads <AnimatedNumber value={30} format={{ useGrouping: false }} /> files for one assignment. You're stuck clicking each file, waiting for the dialog, choosing the folder — <strong>one by one</strong>. That's <AnimatedNumber value={10} format={{ useGrouping: false }} />&nbsp;minutes of your life you'll never get back.</p>
        <p>Google Classroom was built for education, not file management. Classroom Quick Downloader fills the gap.</p>
      </div>
      <div class="l2-visual-col">
        <div class="l2-problem-visual">
          <div class="l2-problem-browser">
            <div class="l2-browser-bar">
              <span class="l2-browser-dot red"></span>
              <span class="l2-browser-dot yellow"></span>
              <span class="l2-browser-dot green"></span>
              <span class="l2-browser-url">classroom.google.com</span>
            </div>
            <div class="l2-browser-body">
              <div class="l2-file-row"><span class="l2-file-icon">📄</span><span>Lecture_Notes.pdf</span><span class="l2-file-btn l2-file-btn-manual">⋯ → Download</span></div>
              <div class="l2-file-row"><span class="l2-file-icon">📄</span><span>Assignment_Final.docx</span><span class="l2-file-btn l2-file-btn-manual">⋯ → Download</span></div>
              <div class="l2-file-row"><span class="l2-file-icon">📄</span><span>Lab_Report.xlsx</span><span class="l2-file-btn l2-file-btn-manual">⋯ → Download</span></div>
              <div class="l2-file-row"><span class="l2-file-icon">📄</span><span>Reading_Chapter.pdf</span><span class="l2-file-btn l2-file-btn-manual">⋯ → Download</span></div>
              <div class="l2-file-row l2-file-row-fade"><span class="l2-file-icon">📄</span><span>Slides_Week.pptx</span><span class="l2-file-btn l2-file-btn-manual">⋯ → Download</span></div>
            </div>
            <div class="l2-problem-badge">⏱ ~<AnimatedNumber value={14.5} format={{ useGrouping: false, minimumFractionDigits: 1, maximumFractionDigits: 1 }} /> seconds per file</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ━━━━ Solution (Visual Left, Text Right) ━━━━ -->
  <section class="l2-block l2-snap">
    <div class="l2-wrap l2-grid l2-grid-reverse l2-reveal">
      <div class="l2-text-col">
        <span class="l2-label">THE SOLUTION</span>
        <h2>One click. Every file. Done.</h2>
        <p>Classroom Quick Downloader adds a download button to every attachment and a "Download All" button to every assignment. Click once — all files download simultaneously.</p>
        <ul class="l2-check-list">
          <li><span class="l2-check">✓</span> Batch download all files instantly</li>
          <li><span class="l2-check">✓</span> Individual file download buttons</li>
          <li><span class="l2-check">✓</span> Works with Classwork &amp; Stream tabs</li>
          <li><span class="l2-check">✓</span> Supports Google Workspace accounts</li>
        </ul>
      </div>
      <div class="l2-visual-col">
        <div class="l2-problem-visual">
          <div class="l2-problem-browser">
            <div class="l2-browser-bar">
              <span class="l2-browser-dot red"></span>
              <span class="l2-browser-dot yellow"></span>
              <span class="l2-browser-dot green"></span>
              <span class="l2-browser-url">classroom.google.com</span>
            </div>
            <div class="l2-browser-body">
              <div class="l2-file-row"><span class="l2-file-icon">📄</span><span>Lecture_Notes.pdf</span><span class="l2-file-btn l2-file-btn-cqd">⬇ Download</span></div>
              <div class="l2-file-row"><span class="l2-file-icon">📄</span><span>Assignment_Final.docx</span><span class="l2-file-btn l2-file-btn-cqd">⬇ Download</span></div>
              <div class="l2-file-row"><span class="l2-file-icon">📄</span><span>Lab_Report.xlsx</span><span class="l2-file-btn l2-file-btn-cqd">⬇ Download</span></div>
              <div class="l2-file-row"><span class="l2-file-icon">📄</span><span>Reading_Chapter.pdf</span><span class="l2-file-btn l2-file-btn-cqd">⬇ Download</span></div>
              <div class="l2-file-row"><span class="l2-file-icon">📄</span><span>Slides_Week.pptx</span><span class="l2-file-btn l2-file-btn-cqd">⬇ Download</span></div>
            </div>
            <div class="l2-solution-badge">✨ Download All — <AnimatedNumber value={1} format={{ useGrouping: false }} /> click</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ━━━━ Features ━━━━ -->
  <section class="l2-block l2-block-alt l2-features-section l2-snap">
    <div class="l2-wrap l2-reveal">
      <div class="l2-section-head">
        <span class="l2-label">WHY CLASSROOM QUICK DOWNLOADER</span>
        <h2>Built different.</h2>
        <p>Everything you'd expect from a modern extension — and nothing you wouldn't.</p>
      </div>
      <div class="l2-feature-grid">
        <div class="l2-fcard"><div class="l2-fcard-icon">⚡</div><h3>Instant</h3><p>Install → open Classroom → download. Zero configuration, zero learning curve.</p></div>
        <div class="l2-fcard"><div class="l2-fcard-icon">🔒</div><h3>Private</h3><p>No tracking cookies. No analytics. No personal data. Your files stay yours.</p></div>
        <div class="l2-fcard"><div class="l2-fcard-icon">🔓</div><h3>Open Source</h3><p>Every line is public on GitHub. Audit it, fork it, contribute to it.</p></div>
        <div class="l2-fcard"><div class="l2-fcard-icon">🌐</div><h3>Universal</h3><p>Chrome, Firefox, Edge, Brave, Opera, Vivaldi, Arc — it just works.</p></div>
        <div class="l2-fcard"><div class="l2-fcard-icon">🎓</div><h3>For Students</h3><p>Built by a student who was tired of clicking. Designed for real classroom workflows.</p></div>
        <div class="l2-fcard"><div class="l2-fcard-icon">🌍</div><h3><AnimatedNumber value={100} format={{ useGrouping: false }} suffix="+" /> Languages</h3><p>Available in English, Arabic, Spanish, French, German, and over <AnimatedNumber value={100} format={{ useGrouping: false }} /> more languages.</p></div>
      </div>
    </div>
  </section>

  <!-- ━━━━ How It Works ━━━━ -->
  <section class="l2-block l2-snap">
    <div class="l2-wrap l2-reveal">
      <div class="l2-section-head">
        <span class="l2-label">HOW IT WORKS</span>
        <h2>Three steps. Ten seconds.</h2>
      </div>
      <div class="l2-steps">
        <div class="l2-step"><div class="l2-step-num"><AnimatedNumber value={1} format={{ useGrouping: false }} /></div><div class="l2-step-line"></div><h3>Install</h3><p>Add Classroom Quick Downloader from the Chrome Web Store, Firefox Add-ons, or Edge Add-ons.</p></div>
        <div class="l2-step"><div class="l2-step-num"><AnimatedNumber value={2} format={{ useGrouping: false }} /></div><div class="l2-step-line"></div><h3>Open Classroom</h3><p>Navigate to any class. Classroom Quick Downloader detects all downloadable materials automatically.</p></div>
        <div class="l2-step"><div class="l2-step-num"><AnimatedNumber value={3} format={{ useGrouping: false }} /></div><h3>Download</h3><p>Click once. All files download simultaneously to your device.</p></div>
      </div>
    </div>
  </section>

  <!-- ━━━━ Social Proof ━━━━ -->
  <section class="l2-block l2-block-alt l2-snap">
    <div class="l2-wrap l2-reveal">
      <div class="l2-section-head">
        <span class="l2-label">TRUSTED WORLDWIDE</span>
        <h2>Used in <AnimatedNumber value={countryCount} suffix="+" /> countries.</h2>
        <p>Students, teachers, and universities around the world trust Classroom Quick Downloader.</p>
      </div>
      <div class="l2-proof-grid">
        <div class="l2-proof-card"><div class="l2-proof-num"><AnimatedNumber value={downloadCount} /></div><div class="l2-proof-label">Total Downloads</div></div>
        <div class="l2-proof-card"><div class="l2-proof-num"><AnimatedNumber value={userCount} /></div><div class="l2-proof-label">Active Users</div></div>
        <div class="l2-proof-card"><div class="l2-proof-num"><AnimatedNumber value={countryCount} suffix="+" /></div><div class="l2-proof-label">Countries</div></div>
        <div class="l2-proof-card"><div class="l2-proof-num"><AnimatedNumericText text="v1.3.7" /></div><div class="l2-proof-label">Latest Release</div></div>
      </div>
    </div>
  </section>

  <!-- ━━━━ Final CTA ━━━━ -->
  <section class="l2-cta-section l2-snap">
    <div class="l2-cta-bg">
      <div class="orb orb-cta-1"></div>
      <div class="orb orb-cta-2"></div>
    </div>
    <!-- Floating school SVGs for CTA -->
    <div class="l2-float-svgs l2-float-svgs-cta" aria-hidden="true">
      <svg class="l2-float-svg fs-6" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M32 4L4 20l28 16 28-16L32 4z"/><path d="M4 20v20l28 16 28-16V20"/></svg>
      <svg class="l2-float-svg fs-7" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="6" width="48" height="52" rx="4"/><line x1="8" y1="16" x2="56" y2="16"/><line x1="16" y1="26" x2="48" y2="26"/><line x1="16" y1="34" x2="48" y2="34"/></svg>
    </div>
    <div class="l2-wrap l2-cta-content l2-reveal">
      <h2>Ready to save hours?</h2>
      <p>Install Classroom Quick Downloader in <AnimatedNumber value={10} format={{ useGrouping: false }} /> seconds. Free, forever. No account required.</p>
      <div class="l2-hero-actions">
        {#each ['chrome', 'firefox', 'edge'] as b}
          <a
            class="l2-cta {b === detectedBrowser ? 'l2-cta-current' : 'l2-cta-other'}"
            href={browserLink(b)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="{base}/images/{b}.svg" alt="" class="l2-cta-icon" />
            {#if b === detectedBrowser}Install for {browserDisplayName(b)}{:else}{browserDisplayName(b)}{/if}
          </a>
        {/each}
      </div>
    </div>
  </section>

  <!-- ━━━━ Footer ━━━━ -->
  <footer class="l2-footer">
    <div class="l2-wrap l2-footer-inner">
      <a href="{base}/" class="l2-footer-brand">
        <img src={logo} alt="Classroom Quick Downloader" class="l2-footer-logo" />
        <strong>Classroom Quick Downloader</strong>
      </a>
      <div class="l2-footer-links">
        <a href="{base}/"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Home</a>
        <a href="{base}/faq"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>FAQ</a>
        <a href="{base}/privacy"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Privacy</a>
        <a href="{base}/changelog"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Changelog</a>
        <a href="{base}/map"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Map</a>
        <a href={STORE_LINKS.github} target="_blank" rel="noopener noreferrer"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>GitHub</a>
      </div>
      <div class="l2-footer-right">
        <a href="https://github.com/adhamhaithameid" target="_blank" rel="noopener noreferrer" class="l2-footer-credit-link">
          <img src="https://github.com/adhamhaithameid.png?size=22" alt="" class="l2-footer-avatar" />
          Built by <strong>Adham Haitham</strong>
        </a>
        <span class="l2-footer-sep">•</span>
        <span class="l2-footer-copy">© <AnimatedNumber value={currentYear} format={{ useGrouping: false }} /> Classroom Quick Downloader</span>
      </div>
    </div>
  </footer>
</div>

<style>
  /* ── Base ──────────────────────────── */
  .l2 {
    --green: #1a8b55;
    --green-light: #22c55e;
    --green-bg: rgba(26, 139, 85, 0.08);
    --green-border: rgba(26, 139, 85, 0.15);
    --dark: #0f1419;
    --text: #1a1a2e;
    --text-secondary: #64748b;
    --muted: #94a3b8;
    --bg: #f8fafb;
    --card: #ffffff;
    --border: #e2e8f0;
    --radius: 16px;
    --wrap: 1280px;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    overflow-x: hidden;
    scroll-snap-type: y proximity;
  }

  .l2-wrap { max-width: var(--wrap); margin: 0 auto; padding: 0 24px; }
  .l2-snap { scroll-snap-align: start; }

  /* ── Navbar ────────────────────────── */
  .l2-nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(248, 250, 251, 0.85);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    padding: 12px 0;
  }
  .l2-nav-inner { display: flex; align-items: center; gap: 24px; }
  .l2-nav-brand {
    display: flex; align-items: center; gap: 8px;
    text-decoration: none; color: var(--text);
    font-weight: 800; font-size: 14px; white-space: nowrap;
  }
  .l2-nav-logo { width: auto; height: 26px; border-radius: 6px; object-fit: contain; }
  .l2-nav-links {
    display: flex; gap: 4px; flex: 1;
  }
  .l2-nav-links a {
    color: var(--text-secondary); text-decoration: none;
    font-size: 13px; font-weight: 500; padding: 6px 10px;
    border-radius: 8px; transition: all 0.2s ease;
  }
  .l2-nav-links a:hover { color: var(--green); background: var(--green-bg); }
  .l2-nav-cta {
    background: var(--green); color: #fff;
    font-size: 13px; font-weight: 600; padding: 8px 18px;
    border-radius: 999px; text-decoration: none;
    transition: all 0.2s ease; white-space: nowrap;
    box-shadow: 0 2px 8px rgba(26, 139, 85, 0.25);
  }
  .l2-nav-cta:hover { background: #15764a; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(26, 139, 85, 0.3); }

  /* ── Hero ───────────────────────────── */
  .l2-hero {
    position: relative;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    text-align: center; overflow: hidden;
    padding: 100px 24px 60px;
  }
  .l2-hero-orbs { position: absolute; inset: 0; pointer-events: none; }
  .orb {
    position: absolute; border-radius: 50%;
    filter: blur(80px); opacity: 0.4;
  }
  .orb-1 { width: 500px; height: 500px; background: #bbf7d0; top: -15%; right: -10%; animation: orb-drift 18s ease-in-out infinite alternate; }
  .orb-2 { width: 400px; height: 400px; background: #a5f3fc; bottom: -10%; left: -8%; animation: orb-drift 22s ease-in-out infinite alternate-reverse; }
  .orb-3 { width: 300px; height: 300px; background: #e0e7ff; top: 40%; left: 50%; animation: orb-drift 15s ease-in-out infinite alternate; }

  .l2-hero-grid {
    position: absolute; inset: 0; pointer-events: none; opacity: 0.025;
    background-image: linear-gradient(var(--text) 1px, transparent 1px),
                       linear-gradient(90deg, var(--text) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  .l2-hero-content { position: relative; z-index: 2; }

  .l2-pill {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--green-bg); border: 1px solid var(--green-border);
    border-radius: 999px; padding: 8px 20px;
    font-size: 13px; font-weight: 600; color: var(--green);
    margin-bottom: 32px;
  }
  .l2-pill-dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--green);
    animation: pulse-dot 2s ease-in-out infinite;
  }

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
  .l2-sub {
    font-size: 18px; line-height: 1.7; color: var(--text-secondary);
    max-width: 640px; margin: 0 auto 40px;
  }
  .l2-compat {
    font-size: 12px; color: var(--muted); margin-top: 16px;
  }

  /* ── Floating SVGs ─────────────────── */
  .l2-float-svgs {
    position: absolute; inset: 0; pointer-events: none; overflow: hidden;
  }
  .l2-float-svg {
    position: absolute; color: var(--green); opacity: 0.06;
  }
  .fs-1 { width: 120px; top: 8%; left: 5%; animation: float-a 25s ease-in-out infinite; }
  .fs-2 { width: 90px; top: 15%; right: 8%; animation: float-b 20s ease-in-out infinite; }
  .fs-3 { width: 140px; bottom: 20%; left: 10%; animation: float-a 30s ease-in-out infinite reverse; }
  .fs-4 { width: 100px; top: 50%; right: 15%; animation: float-b 22s ease-in-out infinite; }
  .fs-5 { width: 80px; bottom: 10%; right: 5%; animation: float-a 18s ease-in-out infinite; }
  .fs-6 { width: 110px; top: 15%; left: 5%; animation: float-b 24s ease-in-out infinite; }
  .fs-7 { width: 100px; bottom: 20%; right: 8%; animation: float-a 28s ease-in-out infinite; }

  @keyframes float-a {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-20px) rotate(5deg); }
    50% { transform: translateY(10px) rotate(-3deg); }
    75% { transform: translateY(-15px) rotate(4deg); }
  }
  @keyframes float-b {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    33% { transform: translateY(15px) rotate(-4deg); }
    66% { transform: translateY(-25px) rotate(6deg); }
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
    background: var(--card); color: var(--text);
    border: 1.5px solid var(--border);
  }
  .l2-cta-other:hover { border-color: var(--green); color: var(--green); transform: translateY(-2px); }

  /* ── Scrolling Marquee ─────────────── */
  .l2-marquee {
    overflow-x: scroll; overflow-y: hidden; padding: 24px 0;
    border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
    background: var(--card);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .l2-marquee::-webkit-scrollbar { display: none; }
  .l2-marquee-track {
    display: flex; width: max-content;
  }
  .l2-marquee-set {
    display: flex; align-items: center; gap: 32px;
    padding: 0 32px;
    flex-shrink: 0;
  }
  .l2-mq-item { display: flex; align-items: baseline; gap: 8px; white-space: nowrap; }
  .l2-mq-num {
    font-size: 22px; font-weight: 800; color: var(--green);
    font-variant-numeric: tabular-nums;
  }
  .l2-mq-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
  .l2-mq-dot { color: var(--border); font-size: 20px; }

  /* ── Content Blocks ────────────────── */
  .l2-block { padding: 100px 0; }
  .l2-block-alt { background: var(--card); }
  .l2-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 60px;
    align-items: center;
  }
  .l2-grid-reverse { direction: rtl; }
  .l2-grid-reverse > * { direction: ltr; }
  .l2-label {
    font-size: 12px; font-weight: 700; color: var(--green);
    letter-spacing: 0.08em; text-transform: uppercase;
    display: block; margin-bottom: 12px;
  }
  .l2-text-col h2 {
    font-size: clamp(28px, 3vw, 38px); font-weight: 800;
    line-height: 1.2; letter-spacing: -0.02em; margin: 0 0 16px;
  }
  .l2-text-col p { font-size: 16px; line-height: 1.7; color: var(--text-secondary); margin: 0 0 12px; }
  .l2-check-list { list-style: none; padding: 0; margin: 16px 0 0; display: flex; flex-direction: column; gap: 10px; }
  .l2-check-list li { display: flex; align-items: center; gap: 10px; font-size: 15px; color: var(--text); }
  .l2-check { color: var(--green); font-weight: 700; font-size: 16px; }

  /* ── Problem / Solution Browser Visual ── */
  .l2-visual-col { min-height: 240px; display: flex; align-items: center; justify-content: center; }
  .l2-problem-visual { width: 100%; max-width: 420px; margin: 0 auto; }
  .l2-problem-browser {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
  }
  .l2-browser-bar {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 14px; background: #f1f5f9; border-bottom: 1px solid var(--border);
  }
  .l2-browser-dot { width: 10px; height: 10px; border-radius: 50%; }
  .l2-browser-dot.red { background: #ef4444; }
  .l2-browser-dot.yellow { background: #eab308; }
  .l2-browser-dot.green { background: #22c55e; }
  .l2-browser-url {
    margin-left: 10px; font-size: 11px; color: var(--muted);
    background: var(--card); border-radius: 6px; padding: 3px 10px;
    border: 1px solid var(--border); flex: 1;
  }
  .l2-browser-body { padding: 8px 0; }
  .l2-file-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px; font-size: 13px; color: var(--text);
    border-bottom: 1px solid #f1f5f9; transition: background 0.15s;
  }
  .l2-file-row:last-child { border-bottom: none; }
  .l2-file-row-fade { opacity: 0.5; }
  .l2-file-icon { font-size: 16px; flex-shrink: 0; }
  .l2-file-row span:nth-child(2) { flex: 1; font-weight: 500; }
  .l2-file-btn {
    font-size: 11px; font-weight: 600; padding: 4px 10px;
    border-radius: 6px; white-space: nowrap;
  }
  .l2-file-btn-manual {
    background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
  }
  .l2-file-btn-cqd {
    background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border);
  }
  .l2-problem-badge {
    text-align: center; padding: 8px; font-size: 12px; font-weight: 700;
    color: #dc2626; background: #fef2f2; border-top: 1px solid #fecaca;
  }
  .l2-solution-badge {
    text-align: center; padding: 8px; font-size: 12px; font-weight: 700;
    color: var(--green); background: #ecfdf5; border-top: 1px solid var(--green-border);
  }

  /* ── Section heads ─────────────────── */
  .l2-section-head { text-align: center; margin-bottom: 48px; }
  .l2-section-head h2 {
    font-size: clamp(28px, 3.5vw, 42px); font-weight: 800;
    letter-spacing: -0.02em; margin: 0 0 12px;
  }
  .l2-section-head p { font-size: 16px; color: var(--text-secondary); max-width: 560px; margin: 0 auto; }

  /* ── Feature grid ──────────────────── */
  .l2-feature-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
  }
  .l2-fcard {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 28px 24px;
    transition: all 0.25s ease;
  }
  .l2-fcard:hover { border-color: var(--green-border); transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
  .l2-fcard-icon { font-size: 28px; margin-bottom: 14px; }
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
    height: 2px; background: var(--border);
  }
  .l2-step h3 { font-size: 16px; font-weight: 700; margin: 0 0 8px; }
  .l2-step p { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin: 0; }

  /* ── Social Proof ──────────────────── */
  .l2-proof-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .l2-proof-card {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 28px; text-align: center;
    transition: all 0.25s ease;
  }
  .l2-proof-card:hover { border-color: var(--green-border); transform: translateY(-2px); }
  .l2-proof-num { font-size: 28px; font-weight: 800; color: var(--green); margin-bottom: 6px; }
  .l2-proof-label { font-size: 13px; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }

  /* ── Final CTA ─────────────────────── */
  .l2-cta-section {
    position: relative; padding: 100px 0; text-align: center; overflow: hidden;
    background: linear-gradient(180deg, var(--bg) 0%, #ecfdf5 100%);
  }
  .l2-cta-bg { position: absolute; inset: 0; pointer-events: none; }
  .orb-cta-1 { width: 400px; height: 400px; background: #bbf7d0; top: -20%; left: 30%; animation: orb-drift 20s ease-in-out infinite alternate; }
  .orb-cta-2 { width: 300px; height: 300px; background: #a5f3fc; bottom: -15%; right: 20%; animation: orb-drift 16s ease-in-out infinite alternate-reverse; }
  .l2-cta-content { position: relative; z-index: 2; }
  .l2-cta-content h2 {
    font-size: clamp(32px, 4vw, 48px); font-weight: 900;
    letter-spacing: -0.03em; margin: 0 0 16px;
  }
  .l2-cta-content p { font-size: 18px; color: var(--text-secondary); margin: 0 0 36px; }

  /* ── Footer ────────────────────────── */
  .l2-footer {
    background: var(--card); border-top: 1px solid var(--border); padding: 18px 0;
  }
  .l2-footer-inner { display: flex; align-items: center; gap: 20px; flex-wrap: nowrap; white-space: nowrap; max-width: 100%; padding: 0 32px; margin: 0 auto; }
  .l2-footer-brand {
    display: flex; align-items: center; gap: 8px;
    text-decoration: none; color: var(--text); font-size: 13px; flex-shrink: 0;
  }
  .l2-footer-logo { width: auto; height: 20px; border-radius: 5px; object-fit: contain; }
  .l2-footer-brand strong { font-weight: 800; }
  .l2-footer-links {
    display: flex; gap: 4px; flex: 1;
  }
  .l2-footer-links a {
    display: inline-flex; align-items: center; gap: 5px;
    color: var(--text-secondary); text-decoration: none;
    font-size: 12px; font-weight: 500; padding: 4px 8px;
    border-radius: 6px; transition: all 0.2s ease;
  }
  .l2-footer-links a:hover { color: var(--green); background: var(--green-bg); }
  .l2-footer-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .l2-footer-credit-link {
    display: inline-flex; align-items: center; gap: 6px;
    text-decoration: none; color: var(--text-secondary); font-size: 12px;
    transition: color 0.2s ease;
  }
  .l2-footer-credit-link:hover { color: var(--green); }
  .l2-footer-credit-link strong { color: var(--text); font-weight: 600; }
  .l2-footer-avatar { width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--border); }
  .l2-footer-sep { color: var(--border); font-size: 10px; }
  .l2-footer-copy { color: var(--muted); font-size: 11px; }

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
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }
  @keyframes pulse-ring {
    0%, 100% { transform: scale(1); opacity: 0.4; }
    50% { transform: scale(1.1); opacity: 0.15; }
  }
  @keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  /* ── Responsive ────────────────────── */
  @media (max-width: 900px) {
    .l2-grid { grid-template-columns: 1fr; gap: 40px; }
    .l2-grid-reverse { direction: ltr; }
    .l2-feature-grid { grid-template-columns: repeat(2, 1fr); }
    .l2-proof-grid { grid-template-columns: repeat(2, 1fr); }
    .l2-steps { flex-direction: column; align-items: center; }
    .l2-step-line { display: none; }
    .l2-nav-links { display: none; }
  }
  @media (max-width: 600px) {
    .l2-feature-grid { grid-template-columns: 1fr; }
    .l2-hero-actions { flex-direction: column; align-items: center; }
  }
</style>
