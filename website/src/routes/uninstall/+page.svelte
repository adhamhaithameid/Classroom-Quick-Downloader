<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchUninstallStats, submitUninstallFeedback } from '$lib/api/publicSite';
  import { STORE_LINKS } from '$lib/config';

  const reasonOptions = [
    'I finished the semester',
    'It did not work on my account',
    'I found another workflow',
    'Download behavior felt confusing',
    'Temporary uninstall'
  ];

  let selectedReason = reasonOptions[0];
  let notes = '';
  let queryBrowser = 'unknown';
  let queryVersion = 'unknown';
  let querySource = 'website';

  let submitState: 'idle' | 'sending' | 'done' | 'error' = 'idle';
  let submitMessage = '';

  let statsState: 'loading' | 'ready' | 'error' = 'loading';
  let totalSubmissions = 0;
  let lastSubmittedAtUtc: number | null = null;
  let topReasons: Array<{ reason: string; count: number }> = [];

  function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value || 0);
  }

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

  async function loadStats(): Promise<void> {
    statsState = 'loading';
    try {
      const data = await fetchUninstallStats();
      totalSubmissions = data.stats.totalSubmissions;
      lastSubmittedAtUtc = data.stats.lastSubmittedAtUtc;
      topReasons = data.stats.topReasons.slice(0, 4);
      statsState = 'ready';
    } catch {
      statsState = 'error';
    }
  }

  async function submitFeedback(): Promise<void> {
    submitState = 'sending';
    submitMessage = '';
    try {
      const response = await submitUninstallFeedback({
        reason: selectedReason,
        browser: queryBrowser,
        version: queryVersion,
        source: querySource,
        notes: notes.trim()
      });
      submitState = 'done';
      submitMessage = response.message || 'Feedback submitted.';
      notes = '';
      await loadStats();
    } catch (error) {
      submitState = 'error';
      submitMessage = error instanceof Error ? error.message : 'Failed to submit feedback.';
    }
  }

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    queryBrowser = params.get('browser') || 'unknown';
    queryVersion = params.get('version') || 'unknown';
    querySource = params.get('source') || 'website';
    await loadStats();
  });
</script>

<section class="card uninstall-page">
  <h1>Help us improve before you go</h1>
  <p>
    Feedback from this page goes directly to the Oracle service and helps prioritize fixes for the extension.
  </p>

  <div class="context">
    <div><span>Detected Browser</span><strong>{queryBrowser}</strong></div>
    <div><span>Extension Version</span><strong>{queryVersion}</strong></div>
    <div><span>Source</span><strong>{querySource}</strong></div>
  </div>

  <div class="stats-grid">
    <article class="metric">
      <div class="metric-label">Feedback Submissions</div>
      <div class="metric-value">{formatNumber(totalSubmissions)}</div>
    </article>
    <article class="metric">
      <div class="metric-label">Last Submission (UTC)</div>
      <div class="metric-value metric-small">{formatDate(lastSubmittedAtUtc)}</div>
    </article>
  </div>

  <h2>Pick the closest reason</h2>
  <div class="reason-grid">
    {#each reasonOptions as reason}
      <button
        type="button"
        class:selected={selectedReason === reason}
        on:click={() => {
          selectedReason = reason;
        }}
      >
        {reason}
      </button>
    {/each}
  </div>

  <label class="notes-field" for="notes-input">
    <span>Optional details</span>
    <textarea
      id="notes-input"
      bind:value={notes}
      maxlength="1000"
      placeholder="Share anything that would have made you keep the extension."
    ></textarea>
  </label>

  <div class="actions">
    <button class="primary" type="button" disabled={submitState === 'sending'} on:click={submitFeedback}>
      {submitState === 'sending' ? 'Submitting…' : 'Submit feedback'}
    </button>
    <a href={STORE_LINKS.chrome} target="_blank" rel="noopener noreferrer">Reinstall on Chrome</a>
    <a href={STORE_LINKS.firefox} target="_blank" rel="noopener noreferrer">Reinstall on Firefox</a>
    <a href={STORE_LINKS.edge} target="_blank" rel="noopener noreferrer">Reinstall on Edge</a>
    <a href={STORE_LINKS.github + '/issues'} target="_blank" rel="noopener noreferrer">Report a bug</a>
  </div>

  {#if submitMessage}
    <p class="submit-message {submitState === 'done' ? 'ok' : 'bad'}">{submitMessage}</p>
  {/if}

  {#if statsState === 'ready' && topReasons.length > 0}
    <section class="top-reasons">
      <h3>Most common reasons</h3>
      <ul>
        {#each topReasons as item}
          <li>
            <span>{item.reason}</span>
            <strong>{formatNumber(item.count)}</strong>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</section>

<style>
  .uninstall-page {
    padding: 22px;
    display: grid;
    gap: 14px;
  }

  h1 {
    margin: 0;
    font-size: clamp(30px, 4vw, 46px);
    letter-spacing: -0.03em;
  }

  p {
    margin: 0;
    color: var(--muted);
    line-height: 1.65;
  }

  .context {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 8px;
  }

  .context div {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 10px;
    background: var(--surface-2);
    display: grid;
    gap: 4px;
  }

  .context span {
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 10px;
  }

  .metric-small {
    font-size: 14px;
    letter-spacing: 0;
    line-height: 1.5;
  }

  h2,
  h3 {
    margin: 0;
    letter-spacing: -0.01em;
  }

  .reason-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }

  .reason-grid button {
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    padding: 12px;
    color: var(--text);
    cursor: pointer;
    transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
  }

  .reason-grid button:hover {
    transform: translateY(-1px);
    border-color: #9eb3df;
  }

  .reason-grid button.selected {
    border-color: #6f8ddd;
    background: #edf2ff;
  }

  .notes-field {
    display: grid;
    gap: 6px;
  }

  .notes-field span {
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  .notes-field textarea {
    min-height: 110px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface);
    padding: 12px;
    color: var(--text);
    resize: vertical;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
  }

  .actions a,
  .actions button {
    text-decoration: none;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 11px;
    background: var(--surface-2);
    color: var(--accent-2);
    font-weight: 700;
    text-align: center;
    cursor: pointer;
  }

  .actions .primary {
    background: linear-gradient(140deg, var(--accent), var(--accent-2));
    color: white;
    border: 0;
  }

  .actions .primary:disabled {
    opacity: 0.75;
    cursor: wait;
  }

  .submit-message {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    font-weight: 700;
  }

  .submit-message.ok {
    background: #ecfdf5;
    color: #0f766e;
    border-color: #9ae6cf;
  }

  .submit-message.bad {
    background: #fff1f2;
    color: #be123c;
    border-color: #fecdd3;
  }

  .top-reasons ul {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  .top-reasons li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-2);
    padding: 8px 10px;
  }
</style>
