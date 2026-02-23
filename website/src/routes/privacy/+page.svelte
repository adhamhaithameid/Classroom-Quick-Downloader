<script lang="ts">
  import { privacyContent as privacy } from '$lib/content/privacy';
  import AnimatedNumericText from '$lib/components/AnimatedNumericText.svelte';

  const sectionIcons = ['🔒', '📊', '🛡️', '🌍', '🔑', '📱', '⚙️', '📋', '✅', '💡'];

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
      privacy = await fetchUserPrivacy();
      state = 'ready';
    } catch (err) {
      state = 'error';
      error = err instanceof Error ? err.message : 'Failed to load user privacy content.';
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
      <h1>{privacy?.headline || 'Privacy at a glance'}</h1>
      <p>{privacy?.description || 'Simple language for users. Full privacy details are on GitHub.'}</p>
      <small>Last updated (UTC): {formatDate(privacy?.lastUpdatedAtUtc ?? null)}</small>
    </div>
    <div class="actions">
      <button type="button" class="refresh" on:click={() => load(true)} disabled={refreshing}>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
      <a href={privacy?.fullPrivacyUrl || 'https://github.com/adhamhaithameid/Classroom-Quick-Downloader/blob/main/PRIVACY.md'} target="_blank" rel="noopener noreferrer">
        Full privacy document on GitHub
      </a>
    </div>
  </header>

  {#if state === 'loading'}
    <div class="state-loading">Loading privacy details…</div>
  {:else if state === 'error'}
    <div class="state-error">
      <strong>Could not load privacy details.</strong>
      <p>{error}</p>
      <button type="button" class="refresh" on:click={() => load(true)} disabled={refreshing}>Retry</button>
    </div>
  {:else}
    <div class="section-list">
      {#each privacy?.sections ?? [] as section}
        <article class="section card">
          <h2>{section.title}</h2>
          <p>{section.summary}</p>
          {#if section.bullets.length > 0}
            <ul>
              {#each section.bullets as bullet}
                <li>{bullet}</li>
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
    font-size: clamp(30px, 5vw, 50px);
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
    min-width: 220px;
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

  .section-list {
    display: grid;
    gap: 10px;
  }

  .section {
    padding: 14px;
    border-radius: 16px;
  }

  .section h2 {
    margin: 0;
    font-size: 22px;
    letter-spacing: -0.02em;
  }

  .section ul {
    margin: 10px 0 0;
    padding-left: 18px;
    line-height: 1.6;
  }
</style>
