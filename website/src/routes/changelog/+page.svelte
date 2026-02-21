<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchChangelog } from '$lib/api/changelog';
  import { STORE_LINKS } from '$lib/config';
  import type { ChangelogResponse } from '$lib/types/public';

  let state: 'loading' | 'ready' | 'error' = 'loading';
  let error = '';
  let changelog: ChangelogResponse | null = null;

  function formatDate(value: string): string {
    const when = new Date(value);
    if (Number.isNaN(when.getTime())) return value;
    return when.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

  async function loadChangelog(): Promise<void> {
    state = 'loading';
    error = '';
    try {
      changelog = await fetchChangelog();
      state = 'ready';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load changelog.';
      state = 'error';
    }
  }

  onMount(async () => {
    await loadChangelog();
  });
</script>

<section class="changelog-page">
  <header class="card hero">
    <span class="tag">Public Changelog</span>
    <h1>Release Notes</h1>
    <p>
      Detailed release timeline inspired by Arc-style update notes. This page is the canonical changelog target for
      the extension.
    </p>
  </header>

  {#if state === 'loading'}
    <div class="state-loading">Loading release notes…</div>
  {:else if state === 'error'}
    <div class="state-error">
      <strong>Could not load release notes.</strong>
      <p>{error}</p>
      <div class="fallback-links">
        <button type="button" class="retry" on:click={loadChangelog}>Retry</button>
        <a href={STORE_LINKS.github + '/blob/main/CHANGELOG.md'} target="_blank" rel="noopener noreferrer">
          View `CHANGELOG.md`
        </a>
      </div>
    </div>
  {:else if !(changelog?.entries?.length)}
    <div class="state-empty">
      Changelog feed is empty right now.
      <a href={STORE_LINKS.github + '/blob/main/CHANGELOG.md'} target="_blank" rel="noopener noreferrer">
        Open repository changelog
      </a>
    </div>
  {:else}
    <div class="timeline">
      {#each changelog.entries as entry, index}
        <article class="entry card {entry.isImportant ? 'important' : ''}">
          <div class="entry-marker">
            <span class="dot" aria-hidden="true"></span>
            {#if index < changelog.entries.length - 1}
              <span class="line" aria-hidden="true"></span>
            {/if}
          </div>

          <div class="entry-body">
            <div class="entry-head">
              <div class="version-row">
                <h2>v{entry.version}</h2>
                {#if index === 0}
                  <span class="pill">Latest</span>
                {/if}
                {#if entry.isImportant}
                  <span class="pill hot">Important</span>
                {/if}
              </div>
              <time datetime={entry.date}>{formatDate(entry.date)}</time>
            </div>

            <ul>
              {#each entry.changes as change}
                <li>{change}</li>
              {/each}
            </ul>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .changelog-page {
    display: grid;
    gap: 14px;
  }

  .hero {
    padding: 20px;
  }

  .hero h1 {
    margin: 12px 0 8px;
    font-size: clamp(30px, 4vw, 46px);
    letter-spacing: -0.03em;
  }

  .hero p {
    margin: 0;
    line-height: 1.65;
    color: var(--muted);
    max-width: 70ch;
  }

  .timeline {
    display: grid;
    gap: 10px;
  }

  .entry {
    padding: 12px;
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 10px;
  }

  .entry-marker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: linear-gradient(140deg, var(--accent), var(--accent-2));
  }

  .line {
    flex: 1;
    width: 2px;
    background: #d2dced;
    min-height: 22px;
  }

  .entry-body {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-2);
    padding: 12px;
  }

  .entry.important .entry-body {
    border-color: #f0b6c7;
    background: #fff5f8;
  }

  .entry-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
    border-bottom: 1px dashed #d3dced;
    padding-bottom: 10px;
  }

  .entry-head time {
    color: var(--muted);
    font-size: 13px;
  }

  .version-row {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }

  .version-row h2 {
    margin: 0;
    font-size: 20px;
    letter-spacing: -0.02em;
  }

  .pill {
    border-radius: 999px;
    border: 1px solid #c6d5ff;
    color: #1f3f9f;
    background: #e8efff;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
  }

  .pill.hot {
    border-color: #f5bccb;
    color: #9e2042;
    background: #ffe9f0;
  }

  ul {
    margin: 10px 0 0;
    padding-left: 18px;
    display: grid;
    gap: 6px;
  }

  li {
    color: #22344f;
    line-height: 1.55;
  }

  .fallback-links {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .retry {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    padding: 6px 10px;
    cursor: pointer;
  }

  .fallback-links a,
  .state-empty a {
    text-decoration: none;
    color: var(--accent-2);
    font-weight: 700;
  }
</style>
