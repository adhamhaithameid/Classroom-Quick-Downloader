<script lang="ts">
  import { base } from '$app/paths';
  import logo from '$lib/assets/cqd-logo.svg';
  import '../app.css';

  const nav = [
    { href: '/', label: 'Home' },
    { href: '/map', label: 'Global Map' },
    { href: '/changelog', label: "What's New" },
    { href: '/privacy', label: 'Privacy' },
    { href: '/uninstall', label: 'Feedback' }
  ];
</script>

<div class="site-shell">
  <header class="site-header">
    <div class="page-shell header-inner">
      <a class="brand" href="{base}/">
        <img src={logo} alt="Classroom Quick Downloader logo" class="brand-logo" />
        <span class="brand-text">
          <strong>Classroom Quick Downloader</strong>
          <small>Made for students, teachers, and faster workflows</small>
        </span>
      </a>
      <nav class="site-nav" aria-label="Primary">
        {#each nav as item}
          <a href="{base}{item.href}">{item.label}</a>
        {/each}
      </nav>
    </div>
  </header>

  <main class="page-shell site-main">
    <slot />
  </main>
</div>

<style>
  .site-shell {
    min-height: 100vh;
    padding-bottom: 24px;
  }

  .site-header {
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(14px);
    background: rgba(238, 245, 255, 0.76);
    border-bottom: 1px solid var(--border);
  }

  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
  }

  .brand {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    font-weight: 700;
    animation: riseIn 0.5s ease both;
  }

  .brand-logo {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    box-shadow: 0 10px 20px rgba(17, 62, 163, 0.22);
    background: white;
    padding: 4px;
  }

  .brand-text {
    display: grid;
    gap: 2px;
  }

  .brand-text strong {
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .brand-text small {
    color: var(--muted);
    font-weight: 600;
    font-size: 11px;
  }

  .site-nav {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .site-nav a {
    color: var(--muted);
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 11px;
    background: rgba(255, 255, 255, 0.67);
    transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
  }

  .site-nav a:hover {
    color: var(--text);
    border-color: #96addd;
    background: var(--surface);
    transform: translateY(-1px);
  }

  .site-main {
    padding-top: 20px;
  }

  @media (max-width: 780px) {
    .header-inner {
      flex-direction: column;
      align-items: flex-start;
    }

    .site-nav {
      width: 100%;
    }
  }
</style>
