<script lang="ts">
  import { base } from '$app/paths';
  import '../app.css';

  const nav = [
    { href: '/', label: 'Overview' },
    { href: '/map', label: 'Global Map' },
    { href: '/changelog', label: 'Changelog' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/uninstall', label: 'Uninstall' }
  ];
</script>

<div class="site-shell">
  <header class="site-header">
    <div class="page-shell header-inner">
      <a class="brand" href="{base}/">
        <span class="brand-mark">CQD</span>
        <span>Classroom Quick Downloader</span>
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
    backdrop-filter: blur(12px);
    background: color-mix(in srgb, var(--bg), transparent 16%);
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
  }

  .brand-mark {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(140deg, var(--accent), var(--accent-2));
    color: #fff;
    font-weight: 900;
    letter-spacing: 0.02em;
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
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 6px 10px;
  }

  .site-nav a:hover {
    color: var(--text);
    border-color: var(--border);
    background: var(--surface);
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
