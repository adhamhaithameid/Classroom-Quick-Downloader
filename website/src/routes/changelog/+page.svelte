<script lang="ts">
  import { onMount } from 'svelte';
  import { STORE_LINKS } from '$lib/config';

  let changelog: UserChangelogResponse | null = null;
  let state: 'loading' | 'ready' | 'error' = 'loading';
  let error = '';
  let refreshing = false;

  function formatDate(value: number | null): string {
    if (!value) return 'Unknown';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  function formatDateShort(value: number | null): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  async function load(force = false): Promise<void> {
    if (!force) state = 'loading';
    if (force) refreshing = true;
    error = '';
    try {
      changelog = await fetchUserChangelog({ force });
      state = 'ready';
    } catch (err) {
      state = 'error';
      error = err instanceof Error ? err.message : 'Failed to load user changelog.';
    } finally {
      refreshing = false;
    }
  }

  onMount(async () => {
    await load();
  });
</script>

<svelte:head>
  <title>Changelog — Classroom Quick Downloader</title>
  <meta name="description" content="See what's new in each version of Classroom Quick Downloader. Detailed release notes and improvements." />
</svelte:head>

<div class="changelog-page">
  <header class="changelog-header">
    <div class="header-left">
      <div class="icon-box">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
      <div>
        <h1>Changelog</h1>
        <p class="header-sub">What's new in every release of Classroom Quick Downloader.</p>
        {#if changelog}
          <small class="header-meta">{changelog.entries.length} releases documented</small>
        {/if}
      </div>
    </div>
    <div class="header-actions">
      <a class="action-btn" href={STORE_LINKS.github + '/blob/main/CHANGELOG.md'} target="_blank" rel="noopener noreferrer">
        Full changelog →
      </a>
      <button class="action-btn" type="button" on:click={() => load(true)} disabled={refreshing}>
        {refreshing ? 'Refreshing…' : '↻ Refresh'}
      </button>
    </div>
  </header>

  {#if state === 'loading'}
    <div class="state-loading">Loading changelog…</div>
  {:else if state === 'error'}
    <div class="state-error">
      <strong>Could not load changelog.</strong>
      <p>{error}</p>
      <button type="button" class="action-btn" on:click={() => load(true)} disabled={refreshing}>Retry</button>
    </div>
  {:else}
    <div class="changelog-body">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-card">
          <h3 class="sidebar-label">On this page</h3>
          <nav class="sidebar-links">
            {#each changelog?.entries ?? [] as entry}
              <a href="#v{entry.version}">
                <span class="sv"><AnimatedNumericText text={entry.version} animated /></span>
                <span class="sd"><AnimatedNumericText text={formatDateShort(entry.releasedAtUtc)} animated /></span>
              </a>
            {/each}
          </nav>
        </div>
      </aside>

      <!-- Timeline -->
      <div class="timeline">
        {#each changelog?.entries ?? [] as entry, i}
          <article class="entry" id="v{entry.version}" style="animation-delay: {i * 0.06}s">
            <div class="marker-col">
              <div class="dot"></div>
              {#if i < (changelog?.entries.length ?? 0) - 1}
                <div class="line"></div>
              {/if}
            </div>
            <div class="entry-body">
              <span class="entry-date">{formatDate(entry.releasedAtUtc)}</span>
              <h2><AnimatedNumericText text='v{entry.version}' animated /> — <AnimatedNumericText text={entry.title} animated /></h2>
              <p>{entry.summary}</p>
              {#if entry.highlights.length > 0}
                <ul>
                  {#each entry.highlights as point}
                    <li>{point}</li>
                  {/each}
                </ul>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .changelog-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* ── Header ──────────────────────── */
  .changelog-header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    align-items: flex-start;
    animation: riseIn 0.5s ease both;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .icon-box {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--gc-green-bg);
    border: 1px solid rgba(26, 139, 85, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--gc-green);
  }

  h1 {
    margin: 0;
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .header-sub {
    margin: 4px 0 0;
    color: var(--text-secondary);
    font-size: 15px;
  }

  .header-meta {
    display: block;
    margin-top: 4px;
    color: var(--muted);
    font-size: 12px;
  }

  .header-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 180px;
  }

  .action-btn {
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: 999px;
    padding: 9px 16px;
    text-decoration: none;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(6px);
    color: var(--text-secondary);
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.25s ease;
    box-shadow: var(--shadow-sm);
  }

  .action-btn:hover {
    border-color: rgba(26, 139, 85, 0.25);
    color: var(--gc-green);
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  /* ── Body ────────────────────────── */
  .changelog-body {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 32px;
    align-items: start;
  }

  /* ── Sidebar ─────────────────────── */
  .sidebar {
    position: sticky;
    top: 80px;
  }

  .sidebar-card {
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 16px;
  }

  .sidebar-label {
    margin: 0 0 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--gc-green);
  }

  .sidebar-links {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sidebar-links a {
    text-decoration: none;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: all 0.2s ease;
    color: var(--text-secondary);
  }

  .sidebar-links a:hover {
    background: rgba(26, 139, 85, 0.05);
    color: var(--gc-green);
  }

  .sv {
    font-weight: 700;
    font-size: 14px;
    color: var(--text);
  }

  .sidebar-links a:hover .sv {
    color: var(--gc-green);
  }

  .sd {
    font-size: 12px;
    color: var(--muted);
  }

  /* ── Timeline ────────────────────── */
  .timeline {
    display: flex;
    flex-direction: column;
  }

  .entry {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 20px;
    animation: slideUp 0.5s ease both;
    opacity: 0;
    padding-bottom: 32px;
  }

  .marker-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2.5px solid var(--gc-green);
    background: var(--gc-green-bg);
    flex-shrink: 0;
  }

  .line {
    width: 2px;
    flex: 1;
    background: linear-gradient(180deg, var(--gc-green-light), rgba(87, 187, 138, 0.15));
    margin-top: 8px;
    border-radius: 1px;
  }

  .entry-body {
    min-width: 0;
  }

  .entry-date {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    margin-bottom: 2px;
  }

  .entry-body h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
  }

  .entry-body p {
    margin: 10px 0 0;
    color: var(--text-secondary);
    line-height: 1.75;
    font-size: 14px;
  }

  .entry-body ul {
    margin: 12px 0 0;
    padding-left: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .entry-body li {
    position: relative;
    padding-left: 18px;
    color: var(--text-secondary);
    line-height: 1.65;
    font-size: 14px;
  }

  .entry-body li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 9px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--gc-green-light);
  }

  /* ── Responsive ──────────────────── */
  @media (max-width: 820px) {
    .changelog-body {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .sidebar {
      position: static;
    }

    .sidebar-links {
      flex-direction: row;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .sidebar-links::-webkit-scrollbar { display: none; }

    .sidebar-links a {
      white-space: nowrap;
      flex-shrink: 0;
    }

    .entry {
      grid-template-columns: 20px 1fr;
      gap: 14px;
      padding-bottom: 28px;
    }
  }
</style>
