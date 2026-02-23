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

<section class="card user-page">
  <header class="intro">
    <div>
      <h1>{changelog?.headline || "What's new"}</h1>
      <p>{changelog?.description || 'Simple updates focused on students and daily use.'}</p>
      <small>Last updated (UTC): {formatDate(changelog?.lastUpdatedAtUtc ?? null)}</small>
    </div>
    <div class="actions">
      <button type="button" class="refresh" on:click={() => load(true)} disabled={refreshing}>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
      <a href={changelog?.fullChangelogUrl || 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/CHANGELOG.md'} target="_blank" rel="noopener noreferrer">
        Full changelog on GitHub
      </a>
    </div>
  </header>

  {#if state === 'loading'}
    <div class="state-loading">Loading user changelog…</div>
  {:else if state === 'error'}
    <div class="state-error">
      <strong>Could not load changelog.</strong>
      <p>{error}</p>
      <button type="button" class="refresh" on:click={() => load(true)} disabled={refreshing}>Retry</button>
    </div>
  {:else}
    <div class="entry-list">
      {#each changelog?.entries ?? [] as entry}
        <article class="entry card">
          <div class="entry-head">
            <div>
              <h2>v{entry.version} — {entry.title}</h2>
              <small>{formatDate(entry.releasedAtUtc)}</small>
            </div>
          </div>
          <p>{entry.summary}</p>
          {#if entry.highlights.length > 0}
            <ul>
              {#each entry.highlights as point}
                <li>{point}</li>
              {/each}
            </ul>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .user-page {
    padding: 22px;
    display: grid;
    gap: 14px;
  }

  .intro {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  h1 {
    margin: 0;
    font-size: clamp(30px, 5vw, 52px);
    letter-spacing: -0.03em;
  }

  p {
    margin: 10px 0 0;
    color: var(--muted);
    line-height: 1.65;
  }

  small {
    display: block;
    margin-top: 10px;
    color: var(--muted);
  }

  .actions {
    display: grid;
    gap: 8px;
    min-width: 210px;
  }

  .actions a,
  .refresh {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 9px 12px;
    text-decoration: none;
    background: var(--surface-2);
    color: var(--text);
    font-weight: 700;
    text-align: center;
    cursor: pointer;
  }

  .refresh:disabled {
    opacity: 0.75;
    cursor: wait;
  }

  .entry-list {
    display: grid;
    gap: 10px;
  }

  .entry {
    padding: 14px;
    border-radius: 16px;
  }

  .entry-head h2 {
    margin: 0;
    font-size: 21px;
    letter-spacing: -0.01em;
  }

  .entry ul {
    margin: 10px 0 0;
    padding-left: 18px;
    color: var(--text);
    line-height: 1.6;
  }
</style>
