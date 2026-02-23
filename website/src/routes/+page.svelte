<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import logo from '$lib/assets/cqd-logo.svg';
  import { fetchMapData, fetchOverview } from '$lib/api/publicSite';
  import { STORE_LINKS } from '$lib/config';
  import type { OverviewResponse } from '$lib/types/public';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
  import AnimatedNumericText from '$lib/components/AnimatedNumericText.svelte';

  let state: 'loading' | 'ready' | 'error' = 'loading';
  let error = '';
  let refreshing = false;
  let overview: OverviewResponse | null = null;
  let topCountries: Array<{ countryCode: string; count: number; name: string }> = [];
  let countryCount = 0;

  const displayNames =
    typeof Intl !== 'undefined' && 'DisplayNames' in Intl
      ? new Intl.DisplayNames(['en'], { type: 'region' })
      : null;

  function toCountryName(code: string): string {
    try {
      const label = displayNames?.of(code.toUpperCase());
      return label || code.toUpperCase();
    } catch {
      return code.toUpperCase();
    }
  }

  function detectBrowserKey(): 'chrome' | 'firefox' | 'edge' {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('edg/')) return 'edge';
    return 'chrome';
  }

  let preferredBrowser: 'chrome' | 'firefox' | 'edge' = 'chrome';

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

  async function loadOverview(force = false): Promise<void> {
    if (!force) state = 'loading';
    if (force) refreshing = true;
    error = '';
    try {
      const [overviewResult, mapResult] = await Promise.allSettled([fetchOverview(), fetchMapData()]);

      if (overviewResult.status !== 'fulfilled') {
        throw overviewResult.reason;
      }
      overview = overviewResult.value;

      if (mapResult.status === 'fulfilled') {
        countryCount = mapResult.value.totals.countries || 0;
        topCountries = mapResult.value.countries.slice(0, 5).map(c => ({
          countryCode: c.countryCode,
          count: c.count,
          name: toCountryName(c.countryCode)
        }));
      } else {
        topCountries = [];
        countryCount = 0;
      }
      state = 'ready';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load public metrics.';
      state = 'error';
    } finally {
      refreshing = false;
    }
  }

  function setupScrollReveal(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  }

  onMount(async () => {
    preferredBrowser = detectBrowserKey();
    await loadOverview();
    requestAnimationFrame(() => setupScrollReveal());
  });
</script>

<svelte:head>
  <title>Classroom Quick Downloader — Batch Download Google Classroom Files</title>
  <meta name="description" content="Stop downloading files one by one. Classroom Quick Downloader adds batch downloads, smart file handling, and a faster workflow to Google Classroom." />
</svelte:head>

<!-- ─── Hero ────────────────────────────────────── -->
<section class="hero">
  <div class="hero-bg">
    <div class="orb o1"></div>
    <div class="orb o2"></div>
  </div>

  <div class="hero-inner">
    <div class="hero-left">
      <span class="hero-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/></svg>
        Built for Google Classroom &nbsp;•&nbsp; <strong><AnimatedNumericText text="v1.3.6" /></strong>
      </span>

      <h1>Download your<br/>Classroom files —<br/><span class="accent">effortlessly.</span></h1>

      <p class="hero-sub">
        Stop downloading files one by one. CQD enhances Google Classroom with
        <strong>batch downloads</strong>, <strong>smart file handling</strong>, and a faster workflow
        for students and teachers.
      </p>

      <div class="hero-ctas">
        <a class="btn primary" href={browserLink(preferredBrowser)} target="_blank" rel="noopener noreferrer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v10M4 7l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Install for {preferredBrowser[0].toUpperCase() + preferredBrowser.slice(1)}
        </a>
        <a class="btn outline" href="{base}/changelog">What's new</a>
        <a class="btn outline star-btn" href={STORE_LINKS.github} target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Star on GitHub
        </a>
      </div>

      <div class="pills">
        <span class="pill">📥 Batch downloads</span>
        <span class="pill">⚡ Faster workflow</span>
        <span class="pill">🎓 Student focused</span>
        <span class="pill">🔒 Privacy first</span>
      </div>
    </div>

    <div class="hero-right">
      <div class="stat-card">
        <div class="stat-bar"></div>
        <div class="stat-eyebrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Total Downloads
        </div>
        <strong class="stat-number"><AnimatedNumber value={overview?.totals.downloads ?? 0} /></strong>
        <small class="stat-note">
          {#if (overview?.totals.downloads ?? 0) === 0}
            Status monitor is warming up.
          {:else if overview?.status.systemLive}
            System live since {formatDate(overview.status.liveSinceUtc)} (UTC)
          {:else}
            Status monitor is warming up.
          {/if}
        </small>
        <button class="refresh-mini" type="button" on:click={() => loadOverview(true)} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
    </div>
  </div>
</section>

<!-- ─── Data Content ───────────────────────────── -->
{#if state === 'loading'}
  <div class="state-loading">Loading live project metrics…</div>
{:else if state === 'error'}
  <div class="state-error">
    <strong>Could not load live metrics.</strong>
    <p>{error}</p>
    <button type="button" class="btn outline" on:click={() => loadOverview()}>Retry</button>
  </div>
{:else}

  <!-- Live Stats Row -->
  <section class="stats-row reveal">
    <div class="stat-item">
      <span class="stat-icon">📥</span>
      <div>
        <strong class="stat-val"><AnimatedNumber value={overview?.totals.downloads ?? 0} /></strong>
        <span class="stat-label-text">Total Downloads</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-icon">🌍</span>
      <div>
        <strong class="stat-val"><AnimatedNumber value={countryCount} /></strong>
        <span class="stat-label-text">Countries</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-icon">🛡️</span>
      <div>
        <strong class="stat-val">Open Source</strong>
        <span class="stat-label-text">Fully Transparent</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-icon">🌐</span>
      <div>
        <strong class="stat-val">All Browsers</strong>
        <span class="stat-label-text">Chrome, Firefox, Edge & more</span>
      </div>
    </div>
  </section>

  <!-- Install Section -->
  <section class="section-wide reveal">
    <div class="section-title-row">
      <h2>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gc-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Install CQD
      </h2>
      <span class="section-sub">Works on all Chromium-based browsers (Chrome, Brave, Opera, Vivaldi, Arc…), Firefox, and Edge</span>
    </div>

    <div class="browser-row">
      {#each overview?.installs.browsers ?? [] as browser, i}
        <a
          class="browser-card {browser.key === preferredBrowser ? 'preferred' : ''}"
          href={browserLink(browser.key as 'chrome' | 'firefox' | 'edge')}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div class="browser-head">
            <img
              src="{base}/images/{browser.key}.svg"
              alt="{browser.name}"
              class="browser-logo"
              loading="lazy"
            />
            <div>
              <strong>{browser.name}</strong>
              {#if browser.key === preferredBrowser}
                <span class="tag">Your Browser</span>
              {/if}
            </div>
          </div>
          <div class="browser-stats">
            <span class="browser-count"><AnimatedNumber value={browser.usersCount ?? 0} /></span>
            <span class="browser-unit">active installs</span>
          </div>
          <span class="install-cta">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1v10M4 7l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Install for {browser.name} →
          </span>
        </a>
      {/each}
    </div>

    <!-- <div class="store-buttons">
      <a class="store-btn" href={browserLink('chrome')} target="_blank" rel="noopener noreferrer">
        <img src="{base}/images/chrome.svg" alt="" class="store-btn-icon" />
        Chrome Web Store
      </a>
      <a class="store-btn" href={browserLink('firefox')} target="_blank" rel="noopener noreferrer">
        <img src="{base}/images/firefox.svg" alt="" class="store-btn-icon" />
        Firefox Add-ons
      </a>
      <a class="store-btn" href={browserLink('edge')} target="_blank" rel="noopener noreferrer">
        <img src="{base}/images/edge.svg" alt="" class="store-btn-icon" />
        Edge Add-ons
      </a>
    </div> -->

    <p class="compat-note">Also compatible with Brave, Opera, Vivaldi, Arc, and any other Chromium-based browser via the Chrome Web Store.</p>
  </section>

  <!-- How It Works -->
  <section class="section-wide reveal">
    <div class="section-title-row">
      <h2>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gc-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        How It Works
      </h2>
      <span class="section-sub">Three steps to faster classroom downloads</span>
    </div>

    <div class="steps-row">
      <div class="step-card">
        <div class="step-num"><AnimatedNumber value={1} format={{ useGrouping: false }} /></div>
        <div>
          <h3>Install the Extension</h3>
          <p>Add CQD to your browser from the Chrome Web Store, Firefox Add-ons, or Edge Add-ons. Takes less than <AnimatedNumber value={10} format={{ useGrouping: false }} /> seconds.</p>
        </div>
      </div>
      <div class="step-card">
        <div class="step-num"><AnimatedNumber value={2} format={{ useGrouping: false }} /></div>
        <div>
          <h3>Open Google Classroom</h3>
          <p>Navigate to any class. CQD automatically detects downloadable materials and assignments.</p>
        </div>
      </div>
      <div class="step-card">
        <div class="step-num"><AnimatedNumber value={3} format={{ useGrouping: false }} /></div>
        <div>
          <h3>Download Everything</h3>
          <p>Click once to batch-download all files. No more clicking each file individually.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Global Reach -->
  <section class="section-wide reveal">
    <div class="section-title-row">
      <h2>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gc-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/><path d="M3.6 9h16.8"/><path d="M3.6 15h16.8"/><path d="M12 3a17 17 0 0 1 0 18"/><path d="M12 3a17 17 0 0 0 0 18"/></svg>
        Global Reach
      </h2>
      <span class="section-sub">Students and teachers using CQD in <AnimatedNumber value={countryCount} /> countries</span>
    </div>

    {#if topCountries.length > 0}
      <div class="country-row">
        {#each topCountries as country, ci}
          <div class="country-chip">
            <span class="country-name">{country.name}</span>
            <strong><AnimatedNumber value={country.count} /></strong>
          </div>
        {/each}
      </div>
      <a class="see-all-link" href="{base}/map">View interactive global map →</a>
    {:else}
      <div class="state-empty">Country data temporarily unavailable.</div>
    {/if}
  </section>

  <!-- Trust Signals -->
  <section class="trust-row reveal">
    <div class="trust-card">
      <span class="trust-icon">🔓</span>
      <h3>Open Source</h3>
      <p>Every line of code is public on GitHub. Fork it, audit it, contribute to it.</p>
    </div>
    <div class="trust-card">
      <span class="trust-icon">🔒</span>
      <h3>Privacy First</h3>
      <p>No tracking, no analytics cookies, no personal data collection. Your files stay yours.</p>
    </div>
    <div class="trust-card">
      <span class="trust-icon">🎓</span>
      <h3>Built by a Student, for Students</h3>
      <p>Created by a student who was tired of clicking download one file at a time.</p>
    </div>
    <div class="trust-card">
      <span class="trust-icon">🛠️</span>
      <h3>Actively Maintained</h3>
      <p>Regular updates, bug fixes, and new features. Check the changelog for the latest.</p>
    </div>
  </section>



  <!-- Quick Links -->
  <section class="links-row reveal">
    <a href="{base}/privacy" class="link-card">
      <span class="lc-icon">🔒</span>
      <span>Privacy policy</span>
    </a>
    <a href="{base}/map" class="link-card">
      <span class="lc-icon">🌍</span>
      <span>Global map</span>
    </a>
    <a href="{base}/faq" class="link-card">
      <span class="lc-icon">❓</span>
      <span>FAQ</span>
    </a>
    <a href="{base}/uninstall" class="link-card">
      <span class="lc-icon">💬</span>
      <span>Send feedback</span>
    </a>
    <a href="{base}/changelog" class="link-card">
      <span class="lc-icon">📋</span>
      <span>Changelog</span>
    </a>
  </section>
{/if}

<style>
  /* ─── Scroll Reveal ────────────────── */
  .reveal {
    opacity: 0;
    transform: translateY(32px);
    transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }

  :global(.reveal.visible) {
    opacity: 1;
    transform: translateY(0);
  }

  /* ─── Hero ─────────────────────────── */
  .hero {
    position: relative;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: linear-gradient(145deg, #f0f9f3 0%, #e8f5e9 40%, #eef6f0 70%, #fafcfa 100%);
    padding: 64px 52px;
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    animation: floatOrb 16s ease-in-out infinite;
  }

  .o1 {
    width: 450px;
    height: 450px;
    background: rgba(26, 139, 85, 0.08);
    top: -200px;
    right: -80px;
  }

  .o2 {
    width: 300px;
    height: 300px;
    background: rgba(87, 187, 138, 0.07);
    bottom: -130px;
    left: -70px;
    animation-delay: -6s;
  }

  .hero-inner {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 48px;
    align-items: center;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--gc-green-bg);
    border: 1px solid rgba(26, 139, 85, 0.18);
    border-radius: 999px;
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--gc-green);
    margin-bottom: 24px;
    animation: riseIn 0.5s ease both;
  }

  .hero-badge strong {
    font-weight: 700;
  }

  h1 {
    margin: 0;
    font-size: clamp(36px, 5vw, 60px);
    letter-spacing: -0.045em;
    line-height: 1.05;
    font-weight: 800;
    color: var(--text);
    animation: riseIn 0.6s ease both 0.1s;
    opacity: 0;
  }

  .accent {
    color: var(--gc-green);
  }

  .hero-sub {
    margin: 20px 0 0;
    color: var(--text-secondary);
    max-width: 50ch;
    line-height: 1.8;
    font-size: 17px;
    animation: riseIn 0.6s ease both 0.2s;
    opacity: 0;
  }

  .hero-sub strong {
    color: var(--text);
    font-weight: 600;
  }

  /* ─── CTAs ─────────────────────────── */
  .hero-ctas {
    margin-top: 28px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    animation: riseIn 0.6s ease both 0.3s;
    opacity: 0;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    border-radius: 999px;
    padding: 12px 22px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.25s ease;
    border: 1px solid var(--border);
    color: var(--text);
    background: white;
    box-shadow: var(--shadow-sm);
  }

  .btn:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }

  .btn.primary {
    background: var(--gc-green);
    color: #fff;
    border: none;
    box-shadow: var(--shadow-green);
  }

  .btn.primary:hover {
    background: var(--gc-green-dark);
    box-shadow: 0 6px 28px rgba(26, 139, 85, 0.2);
  }

  .btn.outline {
    border-color: rgba(26, 139, 85, 0.3);
    color: var(--gc-green);
  }

  .btn.outline:hover {
    background: var(--gc-green-bg);
  }

  .star-btn svg {
    color: #f5a623;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: wait;
    transform: none;
  }

  /* ─── Pills ────────────────────────── */
  .pills {
    margin-top: 28px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    animation: riseIn 0.6s ease both 0.4s;
    opacity: 0;
  }

  .pill {
    background: white;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 7px 16px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    box-shadow: var(--shadow-sm);
  }

  /* ─── Stat Card ────────────────────── */
  .hero-right {
    animation: riseIn 0.7s ease both 0.3s;
    opacity: 0;
  }

  .stat-card {
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: white;
    padding: 32px 28px;
    position: relative;
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  .stat-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--gc-green-dark), var(--gc-green), var(--gc-green-light));
    border-radius: 4px 4px 0 0;
  }

  .stat-eyebrow {
    margin: 0;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stat-number {
    display: block;
    margin-top: 14px;
    font-size: clamp(44px, 5vw, 60px);
    line-height: 0.9;
    letter-spacing: -0.04em;
    font-weight: 800;
    color: var(--gc-green);
  }

  .stat-note {
    display: block;
    margin-top: 14px;
    color: var(--muted);
    line-height: 1.5;
    font-size: 13px;
  }

  .refresh-mini {
    margin-top: 16px;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 6px 14px;
    background: white;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s ease;
  }

  .refresh-mini:hover {
    border-color: var(--border-hover);
    color: var(--gc-green);
  }

  .refresh-mini:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  /* ─── Stats Row ────────────────────── */
  .stats-row {
    margin-top: 28px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .stat-item {
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    padding: 20px;
    display: flex;
    gap: 14px;
    align-items: center;
    transition: all 0.25s ease;
  }

  .stat-item:hover {
    border-color: var(--border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }

  .stat-icon {
    font-size: 28px;
    flex-shrink: 0;
  }

  .stat-val {
    display: block;
    font-size: 20px;
    font-weight: 800;
    color: var(--gc-green);
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .stat-label-text {
    display: block;
    font-size: 12px;
    color: var(--muted);
    font-weight: 500;
    margin-top: 2px;
  }

  /* ─── Sections ─────────────────────── */
  .section-wide {
    margin-top: 28px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: var(--shadow);
    padding: 32px;
  }

  .section-title-row {
    margin-bottom: 16px;
  }

  .section-title-row h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-sub {
    display: block;
    color: var(--muted);
    font-size: 13px;
    margin-top: 4px;
    padding-left: 30px;
  }

  /* ─── Browser Install Cards ────────── */
  .browser-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }

  .browser-card {
    text-decoration: none;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    padding: 22px;
    background: white;
    color: var(--text);
    transition: all 0.3s ease;
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .browser-card:hover {
    transform: translateY(-3px);
    border-color: var(--border-hover);
    box-shadow: var(--shadow);
  }

  .browser-card.preferred {
    border-color: rgba(26, 139, 85, 0.35);
    background: var(--gc-green-bg);
  }

  .browser-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .browser-logo {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .browser-head strong {
    font-size: 16px;
    font-weight: 700;
  }

  .tag {
    display: inline-block;
    background: var(--gc-green);
    color: #fff;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 700;
    margin-left: 6px;
    vertical-align: middle;
  }

  .browser-stats {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .browser-count {
    font-size: 28px;
    font-weight: 800;
    color: var(--gc-green);
    letter-spacing: -0.02em;
  }

  .browser-unit {
    font-size: 13px;
    color: var(--muted);
    font-weight: 500;
  }

  .install-cta {
    font-size: 13px;
    font-weight: 700;
    color: var(--gc-green);
    display: flex;
    align-items: center;
    gap: 6px;
    transition: letter-spacing 0.2s ease;
  }

  .browser-card:hover .install-cta {
    letter-spacing: 0.03em;
  }

  .compat-note {
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--muted);
    font-style: italic;
  }

  /* ─── How It Works ─────────────────── */
  .steps-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }

  .step-card {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: white;
    transition: all 0.25s ease;
    box-shadow: var(--shadow-sm);
  }

  .step-card:hover {
    border-color: var(--border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }

  .step-num {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--gc-green);
    color: white;
    font-weight: 800;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .step-card h3 {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 700;
  }

  .step-card p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.6;
  }

  /* ─── Country Row ──────────────────── */
  .country-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }

  .country-chip {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    background: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.25s ease;
    box-shadow: var(--shadow-sm);
  }

  .country-chip:hover {
    border-color: var(--border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }

  .country-name {
    font-weight: 500;
    font-size: 14px;
  }

  .country-chip strong {
    color: var(--gc-green);
    font-weight: 700;
    font-size: 14px;
  }

  .see-all-link {
    display: inline-block;
    margin-top: 14px;
    color: var(--gc-green);
    font-weight: 600;
    font-size: 13px;
    text-decoration: none;
    transition: letter-spacing 0.2s ease;
  }

  .see-all-link:hover {
    letter-spacing: 0.02em;
  }

  /* ─── Trust Row ────────────────────── */
  .trust-row {
    margin-top: 28px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
  }

  .trust-card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 24px;
    box-shadow: var(--shadow-sm);
    transition: all 0.25s ease;
  }

  .trust-card:hover {
    border-color: var(--border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }

  .trust-icon {
    font-size: 28px;
    display: block;
    margin-bottom: 10px;
  }

  .trust-card h3 {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 700;
  }

  .trust-card p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.65;
  }

  /* ─── Quick Links ──────────────────── */
  .links-row {
    margin-top: 28px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 12px;
  }

  .link-card {
    text-decoration: none;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 18px 20px;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: var(--shadow-sm);
  }

  .link-card:hover {
    transform: translateY(-3px);
    border-color: var(--border-hover);
    color: var(--gc-green);
    box-shadow: var(--shadow);
  }

  .lc-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  @media (max-width: 900px) {
    .hero {
      padding: 40px 24px;
    }
    .hero-inner {
      grid-template-columns: 1fr;
      gap: 32px;
    }
    .stats-row {
      grid-template-columns: repeat(2, 1fr);
    }
    .steps-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 500px) {
    .stats-row {
      grid-template-columns: 1fr;
    }
  }
</style>
