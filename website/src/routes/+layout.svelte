<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import logo from '$lib/assets/cqd-logo.svg';
  import { STORE_LINKS } from '$lib/config';
  import { browserDisplayName, detectBrowserFromNavigator, type BrowserKey } from '$lib/browser/detect';
  import { flushWebsiteEvents, initWebsiteEventsClient, trackWebsiteEvent } from '$lib/analytics/websiteEvents';
  import { initializeWebsiteSnapshotStore, websiteSnapshotStore } from '$lib/stores/websiteSnapshot';
  import LoadingScreen from '$lib/components/LoadingScreen.svelte';
  import '../app.css';

  const baseNav = [
    { href: '/overview', label: 'Overview' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/faq', label: 'FAQ' },
    { href: '/changelog', label: 'Changelog' },
    { href: '/uninstall?source=navbar', label: 'Uninstall' },
    { href: '/404', label: '404' }
    // Samples and Overview2 are intentionally disabled for now.
    // { href: '/samples', label: 'Samples' },
    // { href: '/overview2', label: 'Overview2' }
  ];
  let nav = [...baseNav];

  let detectedBrowser: BrowserKey = 'chrome';
  let mobileNavOpen = false;
  const currentYear = new Date().getFullYear();
  let route = '/';
  let isOverviewStyleRoute = false;
  let hideChrome = false;
  let snapshotLinks: { chrome: string; firefox: string; edge: string; github: string } | null = null;
  $: snapshotLinks = $websiteSnapshotStore.snapshot?.overview.links ?? null;

  function browserLink(key: BrowserKey): string {
    return snapshotLinks?.[key] || STORE_LINKS[key];
  }

  function normalizePath(path: string): string {
    const [pathWithoutHash] = path.split('#');
    const [pathOnly] = pathWithoutHash.split('?');
    return pathOnly.replace(/\/$/, '') || '/';
  }

  function isActive(navHref: string, currentPath: string): boolean {
    const normalizedCurrent = normalizePath(currentPath);
    const normalizedNav = normalizePath(navHref);
    return normalizedCurrent === normalizedNav;
  }

  function toggleMobileMenu(): void {
    mobileNavOpen = !mobileNavOpen;
  }

  function closeMobileMenu(): void {
    mobileNavOpen = false;
  }

  function trackInstallClick(placement: string): void {
    trackWebsiteEvent({
      eventType: 'cta',
      action: 'install_click',
      placement,
      pagePath: $page.url.pathname
    });
  }

  function trackDownloadClick(placement: string): void {
    trackWebsiteEvent({
      eventType: 'cta',
      action: 'download_click',
      placement,
      pagePath: $page.url.pathname
    });
  }

  function handleSiteLinkClick(event: MouseEvent, href: string): void {
    closeMobileMenu();

    const [hrefPath, hash] = href.split('#');
    if (!hash) return;

    const currentPath = normalizePath($page.url.pathname);
    const targetPath = normalizePath(hrefPath || currentPath);
    if (targetPath !== currentPath) return;

    const target = document.getElementById(hash);
    if (!target) return;

    event.preventDefault();
    const headerOffset = 88;
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    history.replaceState(
      history.state,
      '',
      `${base}${targetPath === '/' ? '' : targetPath}#${hash}`
    );
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (mobileNavOpen) {
      closeMobileMenu();
    }
  }

  $: route = $page.url.pathname.replace(/\/$/, '') || '/';
  $: isOverviewStyleRoute =
    route === '/overview' ||
    route === '/landing2' ||
    route === '/404' ||
    route === '/uninstall' ||
    route === '/privacy' ||
    route === '/faq' ||
    route === '/changelog';
  $: if ($page.url.pathname) {
    mobileNavOpen = false;
  }

  onMount(() => {
    detectedBrowser = detectBrowserFromNavigator();
    hideChrome = new URLSearchParams(window.location.search).has('embed');
    const disposeWebsiteEvents = initWebsiteEventsClient();
    const disposeSnapshotStore = initializeWebsiteSnapshotStore();
    window.addEventListener('keydown', handleWindowKeydown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeydown);
      void flushWebsiteEvents({ beaconPreferred: true });
      disposeWebsiteEvents();
      disposeSnapshotStore();
    };
  });
</script>

<LoadingScreen />

<div class="site-shell" class:o2-fullscreen={hideChrome}>
  {#if !hideChrome}
  <header class="l2-nav-shell">
    <div class="l2-nav-inner l2-nav-fullwidth">
      <a href="{base}/overview" class="l2-nav-brand">
        <img src={logo} alt="Classroom Quick Downloader" class="l2-nav-logo" />
        <span class="l2-nav-brand-text">Classroom Quick Downloader</span>
      </a>

      <nav class="l2-nav-links l2-nav-links-desktop" aria-label="Primary">
        {#each nav as item}
          <a
            href="{base}{item.href}"
            class:active={isActive(item.href, $page.url.pathname)}
            aria-current={isActive(item.href, $page.url.pathname) ? 'page' : undefined}
            on:click={(event) => handleSiteLinkClick(event, item.href)}
          >
            {item.label}
          </a>
        {/each}
        <a href={snapshotLinks?.github || STORE_LINKS.github} target="_blank" rel="noopener noreferrer">GitHub</a>
      </nav>

      <div class="l2-nav-actions">
        <a
          class="l2-nav-cta l2-nav-cta-desktop"
          href={browserLink(detectedBrowser)}
          target="_blank"
          rel="noopener noreferrer"
          on:click={() => trackInstallClick('nav_install')}
        >
          Install for {browserDisplayName(detectedBrowser)}
        </a>
        <button
          type="button"
          class="l2-nav-menu-btn"
          on:click={toggleMobileMenu}
          aria-expanded={mobileNavOpen}
          aria-controls="site-mobile-nav"
          aria-label={mobileNavOpen ? 'Close site navigation' : 'Open site navigation'}
        >
          {#if mobileNavOpen}
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          {/if}
        </button>
      </div>
    </div>
    {#if mobileNavOpen}
      <div class="l2-nav-mobile-panel" id="site-mobile-nav">
        <nav class="l2-nav-mobile-links" aria-label="Mobile Primary">
          {#each nav as item}
            <a
              href="{base}{item.href}"
              class:active={isActive(item.href, $page.url.pathname)}
              aria-current={isActive(item.href, $page.url.pathname) ? 'page' : undefined}
              on:click={(event) => handleSiteLinkClick(event, item.href)}
            >
              {item.label}
            </a>
          {/each}
          <a href={snapshotLinks?.github || STORE_LINKS.github} target="_blank" rel="noopener noreferrer" on:click={closeMobileMenu}>
            GitHub
          </a>
        </nav>
        <a
          class="l2-nav-cta l2-nav-cta-mobile"
          href={browserLink(detectedBrowser)}
          target="_blank"
          rel="noopener noreferrer"
          on:click={() => {
            closeMobileMenu();
            trackInstallClick('nav_mobile_install');
          }}
        >
          Install for {browserDisplayName(detectedBrowser)}
        </a>
      </div>
    {/if}
  </header>
  {/if}

  <main
    class:site-main={!isOverviewStyleRoute && !hideChrome}
    class:site-main-overview-style={isOverviewStyleRoute && !hideChrome}
    class:l2-wrap={!isOverviewStyleRoute && !hideChrome}
  >
    <div class="site-route-shell">
      <slot />
    </div>
  </main>

  {#if !hideChrome}
  <footer class="l2-footer">
    <div class="l2-wrap l2-footer-inner">
      <div class="l2-footer-left">
        <a href="https://github.com/adhamhaithameid" target="_blank" rel="noopener noreferrer" class="l2-footer-credit-link">
          <img src="https://github.com/adhamhaithameid.png?size=22" alt="Adham Haitham" class="l2-footer-avatar" />
          Built by <strong>Adham Haitham</strong>
        </a>
        <span class="l2-footer-sep">•</span>
        <span class="l2-footer-copy">© {currentYear} Classroom Quick Downloader</span>
      </div>
      <div class="l2-footer-links l2-footer-links-primary">
        <a
          href={browserLink(detectedBrowser)}
          target="_blank"
          rel="noopener noreferrer"
          on:click={() => trackDownloadClick('footer_download')}
        >
          Download
        </a>
        <a href="{base}/privacy">Privacy</a>
        <a href="{base}/faq">FAQ</a>
        <a href="{base}/changelog">Changelog</a>
        <a href={snapshotLinks?.github || STORE_LINKS.github} target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="mailto:adhamhaithameid@gmail.com">Contact</a>
      </div>
    </div>
  </footer>
  {/if}
</div>

<style>
  main {
    flex: 1;
    min-height: 0;
  }

  .site-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--text);
  }

  .site-main {
    flex: 1;
    padding-top: 32px;
    padding-bottom: 56px;
  }

  .site-route-shell {
    min-height: 100%;
    will-change: opacity;
  }

  .l2-wrap {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .l2-nav-shell {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(248, 250, 251, 0.85);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    padding: 12px 0;
    transition: transform 0.24s ease, opacity 0.24s ease;
  }

  :global(body.l2-media-modal-open) .l2-nav-shell,
  :global(body.l2-map-modal-open) .l2-nav-shell {
    opacity: 0;
    transform: translateY(-100%);
    pointer-events: none;
  }

  .l2-nav-fullwidth {
    max-width: 100%;
    padding: 0 24px;
  }

  .l2-nav-inner {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .l2-nav-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .l2-nav-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--text);
    font-weight: 800;
    font-size: 14px;
    white-space: nowrap;
  }

  .l2-nav-brand-text {
    opacity: 0;
    max-width: 0;
    overflow: hidden;
    transition: opacity 0.25s, max-width 0.3s;
  }

  .l2-nav-brand:hover .l2-nav-brand-text {
    opacity: 1;
    max-width: 300px;
  }

  .l2-nav-logo {
    width: auto;
    height: 36px;
    border-radius: 8px;
    object-fit: contain;
  }

  .l2-nav-links {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .l2-nav-links a {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: 8px;
    transition: color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
  }

  .l2-nav-links a:hover {
    color: var(--gc-green);
    background: var(--gc-green-bg);
    transform: translateY(-1px);
  }

  .l2-nav-links a.active {
    color: var(--gc-green);
    background: var(--gc-green-bg);
    font-weight: 700;
  }

  .l2-nav-menu-btn {
    display: none;
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #fff;
    color: var(--text-secondary);
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
  }

  .l2-nav-menu-btn:hover {
    border-color: var(--border-hover);
    color: var(--gc-green);
  }

  .l2-nav-menu-btn svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .l2-nav-mobile-panel {
    display: none;
    background: rgba(248, 250, 251, 0.98);
    box-shadow: 0 10px 24px rgba(15, 20, 25, 0.08);
    border-radius: 0 0 14px 14px;
  }

  .l2-nav-mobile-links {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  }

  .l2-nav-mobile-links a {
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #fff;
    padding: 10px 12px;
    text-decoration: none;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 600;
  }

  .l2-nav-mobile-links a.active {
    color: var(--gc-green);
    border-color: rgba(26, 139, 85, 0.35);
    background: var(--gc-green-bg);
  }

  .l2-nav-cta-mobile {
    display: block;
    width: 100%;
    text-align: center;
  }

  .l2-nav-cta {
    background: var(--gc-green);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 18px;
    border-radius: 999px;
    text-decoration: none;
    transition: all 0.2s ease;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(26, 139, 85, 0.25);
  }

  .l2-nav-cta:hover {
    background: var(--gc-green-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26, 139, 85, 0.3);
  }

  .l2-footer {
    background: #fff;
    border-top: 1px solid var(--border);
    padding: 18px 0;
  }

  .l2-footer-inner {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: nowrap;
    white-space: nowrap;
    max-width: 100%;
  }

  .l2-footer-links {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .l2-footer-links-primary {
    justify-content: flex-end;
  }

  .l2-footer-links a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 6px;
    transition: color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
  }

  .l2-footer-links a:hover {
    color: var(--gc-green);
    background: var(--gc-green-bg);
    transform: translateY(-1px);
  }

  .l2-footer-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .l2-footer-credit-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    color: var(--text-secondary);
    font-size: 12px;
    transition: color 0.2s ease;
  }

  .l2-footer-credit-link:hover {
    color: var(--gc-green);
  }

  .l2-footer-credit-link strong {
    color: var(--text);
    font-weight: 600;
  }

  .l2-footer-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid var(--border);
  }

  .l2-footer-sep {
    color: var(--border);
    font-size: 10px;
  }

  .l2-footer-copy {
    color: var(--muted);
    font-size: 11px;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 860px) {
    .site-main {
      padding-top: 22px;
      padding-bottom: 34px;
    }

    .l2-wrap {
      padding: 0 16px;
    }

    .l2-nav-brand-text {
      display: none;
    }

    .l2-nav-links-desktop,
    .l2-nav-cta-desktop {
      display: none;
    }

    .l2-nav-menu-btn {
      display: inline-flex;
    }

    .l2-nav-mobile-panel {
      display: block;
      padding-top: 10px;
      padding-bottom: 10px;
      border-top: 1px solid var(--border);
      animation: slideDown 0.2s ease;
    }

    .l2-footer-inner {
      flex-wrap: wrap;
      white-space: normal;
      justify-content: center;
      text-align: center;
    }

    .l2-footer-links {
      width: 100%;
      justify-content: center;
      flex-wrap: wrap;
    }

    .l2-footer-left {
      width: 100%;
      justify-content: center;
      flex-wrap: wrap;
    }
  }
</style>
