<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import logo from '$lib/assets/cqd-logo.svg';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
  import AnimatedNumericText from '$lib/components/AnimatedNumericText.svelte';
  import '../app.css';

  const nav = [
    { href: '/', label: 'Home' },
    { href: '/map', label: 'Global Map' },
    { href: '/changelog', label: "What's New" },
    { href: '/faq', label: 'FAQ' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/landing2', label: 'Landing 2' },
    { href: '/uninstall', label: 'Feedback' }
  ];

  function isActive(navHref: string, currentPath: string): boolean {
    const normalizedCurrent = currentPath.replace(/\/$/, '') || '/';
    const normalizedNav = navHref.replace(/\/$/, '') || '/';
    return normalizedCurrent === normalizedNav;
  }

  $: isLanding2 = $page.url.pathname.replace(/\/$/, '') === '/landing2';
  const currentYear = new Date().getFullYear();
</script>

<div class="site-shell" class:l2-shell={isLanding2}>
  {#if !isLanding2}
  <header class="site-header">
    <div class="page-shell header-inner">
      <a class="brand" href="{base}/">
        <img src={logo} alt="Classroom Quick Downloader logo" class="brand-logo" />
        <span class="brand-text">
          <strong>Classroom Quick Downloader</strong>
          <small>Enhancing Google Classroom for students & teachers</small>
        </span>
      </a>
      <nav class="site-nav" aria-label="Primary">
        {#each nav as item}
          <a
            href="{base}{item.href}"
            class:active={isActive(item.href, $page.url.pathname)}
            aria-current={isActive(item.href, $page.url.pathname) ? 'page' : undefined}
          ><AnimatedNumericText text={item.label} /></a>
        {/each}
      </nav>
    </div>
  </header>
  {/if}

  <main class:page-shell={!isLanding2} class:site-main={!isLanding2}>
    <slot />
  </main>

  {#if !isLanding2}
  <footer class="site-footer">
    <div class="page-shell footer-inner">
      <a href="{base}/" class="footer-brand">
        <img src={logo} alt="" class="footer-logo" />
        <strong>CQD</strong>
      </a>

      <div class="footer-links">
        <a href="{base}/">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Home
        </a>
        <a href="{base}/faq">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          FAQ
        </a>
        <a href="{base}/privacy">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Privacy
        </a>
        <a href="{base}/changelog">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Changelog
        </a>
        <a href="{base}/map">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          Map
        </a>
        <a href="https://github.com/adhamhaithameid/Classroom-Quick-Downloader" target="_blank" rel="noopener noreferrer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          GitHub
        </a>
      </div>

      <div class="footer-right">
        <a href="https://github.com/adhamhaithameid" target="_blank" rel="noopener noreferrer" class="credit-link">
          <img src="https://github.com/adhamhaithameid.png?size=22" alt="Adham Haitham" class="credit-avatar" />
          Built by <strong>Adham Haitham</strong>
        </a>
        <span class="footer-sep">•</span>
        <span class="footer-version"><a href="{base}/changelog"><AnimatedNumericText text="v1.3.7" /></a></span>
        <span class="footer-sep">•</span>
        <span class="footer-copy">© <AnimatedNumber value={currentYear} format={{ useGrouping: false }} /> CQD</span>
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
  }

  /* ── Header ──────────────────────── */
  .site-header {
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    background: rgba(250, 252, 250, 0.82);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 8px rgba(26, 46, 35, 0.04);
  }

  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
  }

  .brand {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    color: var(--text);
    font-weight: 700;
    animation: riseIn 0.5s ease both;
    transition: opacity 0.2s ease;
  }

  .brand:hover {
    opacity: 0.8;
  }

  .brand-logo {
    width: auto;
    height: 34px;
    border-radius: 8px;
    object-fit: contain;
  }

  .brand-text {
    display: grid;
    gap: 1px;
  }

  .brand-text strong {
    line-height: 1;
    letter-spacing: -0.02em;
    font-size: 14px;
  }

  .brand-text small {
    color: var(--muted);
    font-weight: 500;
    font-size: 10.5px;
  }

  .site-nav {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .site-nav a {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 12.5px;
    font-weight: 600;
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 7px 14px;
    background: transparent;
    transition: all 0.25s ease;
  }

  .site-nav a:hover {
    color: var(--gc-green);
    background: var(--gc-green-bg);
    border-color: rgba(26, 139, 85, 0.12);
  }

  /* Active page indicator */
  .site-nav a.active {
    color: #fff;
    background: var(--gc-green);
    border-color: var(--gc-green);
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(26, 139, 85, 0.18);
  }

  /* ── Main ─────────────────────────── */
  .site-main {
    padding-top: 32px;
    padding-bottom: 48px;
    flex: 1;
  }

  /* ── Footer ──────────────────────── */
  .site-footer {
    border-top: 1px solid var(--border);
    background: var(--bg-deep);
    padding: 18px 0;
  }

  .footer-inner {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--text);
  }

  .footer-logo {
    width: auto;
    height: 22px;
    border-radius: 6px;
    opacity: 0.7;
    object-fit: contain;
  }

  .footer-brand strong {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .footer-links {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .footer-links a {
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

  .footer-links a:hover {
    color: var(--gc-green);
    background: var(--gc-green-bg);
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .credit-link {
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
