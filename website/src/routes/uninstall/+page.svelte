<script lang="ts">
  import { onMount } from 'svelte';
  import { GOOGLE_FORM_URL, STORE_LINKS } from '$lib/config';

  const reasonOptions = [
    'I finished the semester',
    'It did not work on my account',
    'I found another workflow',
    'Download behavior felt confusing',
    'Temporary uninstall'
  ];

  let selectedReason = reasonOptions[0];
  let queryBrowser = 'unknown';
  let queryVersion = 'unknown';
  let querySource = 'website';

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    queryBrowser = params.get('browser') || 'unknown';
    queryVersion = params.get('version') || 'unknown';
    querySource = params.get('source') || 'website';
  });

  $: feedbackUrl = `${GOOGLE_FORM_URL}?usp=pp_url&entry.337956963=${encodeURIComponent(selectedReason)}&entry.728625586=${encodeURIComponent(queryBrowser)}&entry.988002618=${encodeURIComponent(queryVersion)}&entry.1708117250=${encodeURIComponent(querySource)}`;
</script>

<section class="card uninstall-page">
  <span class="tag">Issues #129 + #178</span>
  <h1>Help us understand why you uninstalled</h1>
  <p>
    This is the simple uninstall page for now. Your feedback helps prioritize fixes for future versions.
  </p>

  <div class="context">
    <div><span>Detected Browser</span><strong>{queryBrowser}</strong></div>
    <div><span>Extension Version</span><strong>{queryVersion}</strong></div>
    <div><span>Source</span><strong>{querySource}</strong></div>
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

  <div class="actions">
    <a class="primary" href={feedbackUrl} target="_blank" rel="noopener noreferrer">
      Submit feedback form
    </a>
    <a href={STORE_LINKS.chrome} target="_blank" rel="noopener noreferrer">Reinstall on Chrome</a>
    <a href={STORE_LINKS.firefox} target="_blank" rel="noopener noreferrer">Reinstall on Firefox</a>
    <a href={STORE_LINKS.edge} target="_blank" rel="noopener noreferrer">Reinstall on Edge</a>
    <a href={STORE_LINKS.github + '/issues'} target="_blank" rel="noopener noreferrer">Report a bug</a>
  </div>
</section>

<style>
  .uninstall-page {
    padding: 18px;
  }

  h1 {
    margin: 12px 0 8px;
    font-size: clamp(30px, 4vw, 42px);
    letter-spacing: -0.03em;
  }

  p {
    margin: 0;
    color: var(--muted);
    line-height: 1.6;
  }

  .context {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 8px;
  }

  .context div {
    border: 1px solid var(--border);
    border-radius: 12px;
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

  h2 {
    margin: 14px 0 8px;
    font-size: 18px;
  }

  .reason-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }

  .reason-grid button {
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    padding: 10px;
    color: var(--text);
    cursor: pointer;
  }

  .reason-grid button.selected {
    border-color: #6f8ddd;
    background: #edf2ff;
  }

  .actions {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
  }

  .actions a {
    text-decoration: none;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px 10px;
    background: var(--surface-2);
    color: var(--accent-2);
    font-weight: 700;
  }

  .actions a.primary {
    background: linear-gradient(140deg, var(--accent), var(--accent-2));
    color: white;
    border: 0;
  }
</style>
