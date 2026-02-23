<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import logo from '$lib/assets/cqd-logo.svg';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
  import AnimatedNumericText from '$lib/components/AnimatedNumericText.svelte';
  import { STORE_LINKS } from '$lib/config';
  import '../app.css';

  const nav = [
    { href: '/', label: 'Home' },
    { href: '/faq', label: 'FAQ' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/changelog', label: 'Changelog' },
    { href: '/map', label: 'Map' }
  ];

  let detectedBrowser: 'chrome' | 'firefox' | 'edge' = 'chrome';
  const currentYear = new Date().getFullYear();

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

  function browserLink(key: 'chrome' | 'firefox' | 'edge'): string {
    return STORE_LINKS[key];
  }

  function isActive(navHref: string, currentPath: string): boolean {
    const normalizedCurrent = currentPath.replace(/\/$/, '') || '/';
    const normalizedNav = navHref.replace(/\/$/, '') || '/';
    return normalizedCurrent === normalizedNav;
  }

  $: isLanding2 = $page.url.pathname.replace(/\/$/, '') === '/landing2';

  onMount(() => {
    detectedBrowser = detectBrowser();
  });
</script>

<div class="site-shell">
  {#if !isLanding2}
    <header class="l2-nav-shell">
      <div class="l2-wrap l2-nav-inner">
        <a href="{base}/" class="l2-nav-brand">
          <img src={logo} alt="Classroom Quick Downloader" class="l2-nav-logo" />
          <span>Classroom Quick Downloader</span>
        </a>

        <nav class="l2-nav-links" aria-label="Primary">
          {#each nav as item}
            <a
              href="{base}{item.href}"
              class:active={isActive(item.href, $page.url.pathname)}
              aria-current={isActive(item.href, $page.url.pathname) ? 'page' : undefined}
            >
              {item.label}
            </a>
          {/each}
          <a href={STORE_LINKS.github} target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>

        <a class="l2-nav-cta" href={browserLink(detectedBrowser)} target="_blank" rel="noopener noreferrer">
          Install for {browserDisplayName(detectedBrowser)}
        </a>
      </div>
    </header>
  {/if}

  <main class:site-main={!isLanding2} class:l2-wrap={!isLanding2}>
    <slot />
  </main>

  {#if !isLanding2}
    <footer class="l2-footer">
      <div class="l2-wrap l2-footer-inner">
        <a href="{base}/" class="l2-footer-brand">
          <img src={logo} alt="Classroom Quick Downloader" class="l2-footer-logo" />
          <strong>Classroom Quick Downloader</strong>
        </a>
        <div class="l2-footer-links">
          <a href="{base}/">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </a>
          <a href="{base}/faq">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            FAQ
          </a>
          <a href="{base}/privacy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Privacy
          </a>
          <a href="{base}/changelog">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Changelog
          </a>
          <a href="{base}/map">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Map
          </a>
          <a href={STORE_LINKS.github} target="_blank" rel="noopener noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
        <div class="l2-footer-right">
          <a href="https://github.com/adhamhaithameid" target="_blank" rel="noopener noreferrer" class="l2-footer-credit-link">
            <img src="https://github.com/adhamhaithameid.png?size=22" alt="Adham Haitham" class="l2-footer-avatar" />
            Built by <strong>Adham Haitham</strong>
          </a>
          <span class="l2-footer-sep">•</span>
          <span class="l2-footer-version"><a href="{base}/changelog"><AnimatedNumericText text="v1.3.7" animated /></a></span>
          <span class="l2-footer-sep">•</span>
          <span class="l2-footer-copy">© <AnimatedNumber value={currentYear} format={{ useGrouping: false }} /> Classroom Quick Downloader</span>
        </div>
      </div>
    </footer>
  {/if}
</div>

<style>
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
  }

  .l2-nav-inner {
    display: flex;
    align-items: center;
    gap: 24px;
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

  .l2-nav-logo {
    width: auto;
    height: 26px;
    border-radius: 6px;
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
    transition: all 0.2s ease;
  }

  .l2-nav-links a:hover {
    color: var(--gc-green);
    background: var(--gc-green-bg);
  }

  .l2-nav-links a.active {
    color: var(--gc-green);
    background: var(--gc-green-bg);
    font-weight: 700;
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

  .l2-footer-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--text);
    font-size: 13px;
    flex-shrink: 0;
  }

  .l2-footer-logo {
    width: auto;
    height: 20px;
    border-radius: 5px;
    object-fit: contain;
  }

  .l2-footer-brand strong {
    font-weight: 800;
  }

  .l2-footer-links {
    display: flex;
    gap: 4px;
    flex: 1;
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
    transition: all 0.2s ease;
  }

  .l2-footer-links a:hover {
    color: var(--gc-green);
    background: var(--gc-green-bg);
  }

  .l2-footer-right {
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

  .credit-link:hover {
    color: var(--gc-green);
  }

  .credit-link strong {
    color: var(--text);
    font-weight: 600;
  }

  .credit-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid var(--border);
  }

  .footer-sep {
    color: var(--border);
    font-size: 10px;
  }

  .footer-version a {
    color: var(--gc-green);
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
    background: var(--gc-green-bg);
    border: 1px solid rgba(26, 139, 85, 0.12);
    border-radius: 999px;
    padding: 2px 8px;
    transition: all 0.2s ease;
  }

  .footer-version a:hover {
    border-color: rgba(26, 139, 85, 0.25);
  }

  .footer-copy {
    color: var(--muted);
    font-size: 11px;
  }

  @media (max-width: 780px) {
    .header-inner {
      flex-direction: column;
      align-items: flex-start;
      padding: 10px 0;
    }

    .site-nav {
      width: 100%;
      overflow-x: auto;
      flex-wrap: nowrap;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-bottom: 4px;
    }

    .site-nav::-webkit-scrollbar {
      display: none;
    }

    .site-nav a {
      white-space: nowrap;
      flex-shrink: 0;
    }

    .footer-inner {
      flex-direction: column;
      text-align: center;
    }

    .footer-links {
      flex-wrap: wrap;
      justify-content: center;
    }

    .footer-brand {
      justify-content: center;
    }

    .footer-right {
      flex-wrap: wrap;
      justify-content: center;
    }
  }
</style>
