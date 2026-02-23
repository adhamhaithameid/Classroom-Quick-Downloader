<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchUserChangelog } from '$lib/api/publicSite';
  import type { UserChangelogResponse } from '$lib/types/public';
  import AnimatedNumericText from '$lib/components/AnimatedNumericText.svelte';

  let state: 'loading' | 'ready' | 'error' = 'loading';
  let error = '';
  let changelog: UserChangelogResponse | null = null;
  let refreshing = false;

  function formatDate(value: number | null): string {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });
  }

  function formatDateShort(value: number | null): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  async function load(force = false): Promise<void> {
    if (force) refreshing = true;
    if (!force) state = 'loading';
    error = '';
    try {
      changelog = await fetchUserChangelog();
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

<div class="changelog-page">
  <header class="changelog-header">
    <div class="header-left">
      <div class="icon-box">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gc-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div>
        <h1>{changelog?.headline || "What's new"}</h1>
        <p class="header-desc">{changelog?.description || 'Simple updates focused on students and daily use.'}</p>
        <small class="header-meta">Last updated: <AnimatedNumericText text={formatDate(changelog?.lastUpdatedAtUtc ?? null)} animated /></small>
      </div>
    </div>
    <div class="header-actions">
      <button type="button" class="action-btn" on:click={() => load(true)} disabled={refreshing}>
        {refreshing ? 'Refreshing…' : '↻ Refresh'}
      </button>
      <a class="action-btn" href={changelog?.fullChangelogUrl || 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md'} target="_blank" rel="noopener noreferrer">
        Full changelog →
      </a>
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
        <div class="sidebar-card card">
          <h3 class="sidebar-label">On this page</h3>
          <nav class="sidebar-links">
            {#each changelog?.entries ?? [] as entry}
              <a href="#v{entry.version}">
                <span class="sv"><AnimatedNumericText text={`v${entry.version}`} animated /></span>
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
              {#if i < (changelog?.entries?.length ?? 1) - 1}
                <div class="line"></div>
              {/if}
            </div>
            <div class="entry-body">
              <span class="entry-date"><AnimatedNumericText text={formatDateShort(entry.releasedAtUtc)} animated /></span>
              <h2><AnimatedNumericText text={`v${entry.version}`} animated /> — {entry.title}</h2>
              <p class="entry-summary">{entry.summary}</p>
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
    gap: 28px;
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
    gap: 16px;
    align-items: flex-start;
  }

  .icon-box {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--gc-green-bg);
    border: 1px solid rgba(26, 139, 85, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  h1 {
    margin: 0;
    font-size: clamp(28px, 4.5vw, 44px);
    letter-spacing: -0.04em;
    font-weight: 800;
  }

  .header-desc {
    margin: 6px 0 0;
    color: var(--text-secondary);
    line-height: 1.6;
    font-size: 15px;
    max-width: 50ch;
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
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 9px 16px;
    text-decoration: none;
    background: white;
    color: var(--text-secondary);
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.25s ease;
    box-shadow: var(--shadow-sm);
  }

  .action-btn:hover {
    border-color: var(--border-hover);
    color: var(--gc-green);
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  /* ── Body Grid ───────────────────── */
  .changelog-body {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 32px;
    align-items: start;
  }

  /* ── Sidebar ─────────────────────── */
  .sidebar {
    position: sticky;
    top: 80px;
    animation: riseIn 0.5s ease both;
  }

  .sidebar-card {
    padding: 18px;
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
    background: var(--gc-green-bg);
    color: var(--gc-green);
  }

  .sv {
    font-weight: 600;
    font-size: 13px;
  }

  .sd {
    font-size: 11px;
    color: var(--muted);
  }

  /* ── Timeline ────────────────────── */
  .timeline {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .entry {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 20px;
    padding-bottom: 44px;
    animation: slideUp 0.5s ease both;
    opacity: 0;
  }

  .marker-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 6px;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--gc-green);
    box-shadow: 0 0 0 4px var(--gc-green-bg);
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

  .entry-summary {
    margin: 10px 0 0;
    color: var(--text-secondary);
    line-height: 1.75;
    font-size: 15px;
  }

  .entry-body ul {
    margin: 14px 0 0;
    padding-left: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
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
      gap: 4px;
      padding-bottom: 4px;
      scrollbar-width: none;
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
