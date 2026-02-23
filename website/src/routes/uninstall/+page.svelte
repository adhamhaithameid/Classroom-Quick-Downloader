<script lang="ts">
  import { onMount } from 'svelte';
  import { submitUninstallFeedback } from '$lib/api/publicSite';
  import { STORE_LINKS } from '$lib/config';
  import { buildUninstallNotesPayload, detectBrowserFromUserAgent } from '$lib/uninstall/feedback';
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';

  const reasonOptions = [
    'I only needed it for a short period',
    'It did not work on my class account',
    'Downloads felt slower than expected',
    'I had too many failed downloads',
    'The UI felt confusing',
    'I switched to another workflow',
    'I am uninstalling temporarily'
  ];

  const featureChoices = [
    'Batch reliability',
    'Faster downloads',
    'Better progress feedback',
    'Cleaner cancel behavior',
    'More browser compatibility',
    'Simpler setup'
  ];

  let selectedReason = reasonOptions[0];
  let selectedFeatures: string[] = [];
  let confidenceToReinstall = 'Maybe';
  let urgency = 'Normal';
  let notes = '';

  let queryBrowser = 'unknown';
  let queryVersion = 'unknown';
  let querySource = 'website';

  let submitState: 'idle' | 'sending' | 'done' | 'error' = 'idle';
  let submitMessage = '';

  function toggleFeature(value: string): void {
    if (selectedFeatures.includes(value)) {
      selectedFeatures = selectedFeatures.filter((item) => item !== value);
      return;
    }
    selectedFeatures = [...selectedFeatures, value];
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
        notes: buildUninstallNotesPayload({
          reason: selectedReason,
          confidenceToReinstall,
          urgency,
          selectedFeatures,
          notes
        })
      });
      submitState = 'done';
      submitMessage = response.message || 'Feedback submitted.';
      notes = '';
      selectedFeatures = [];
    } catch (error) {
      submitState = 'error';
      submitMessage = error instanceof Error ? error.message : 'Failed to submit feedback.';
    }
  }

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    queryBrowser = params.get('browser') || detectBrowserFromUserAgent(navigator.userAgent);
    queryVersion = params.get('version') || 'unknown';
    querySource = params.get('source') || 'website';
  });
</script>

<section class="card uninstall-page">
  <header class="hero">
    <div>
      <h1>Before you uninstall, tell us what to fix</h1>
      <p>
        Your feedback helps us prioritize the next update and improve the extension for students. You can reinstall any
        time using the buttons below.
      </p>
    </div>
  </header>

  <section class="section">
    <h2>What is the main reason?</h2>
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
  </section>

  <section class="section dual">
    <label class="field">
      <span>How likely are you to reinstall if we improve this?</span>
      <select bind:value={confidenceToReinstall}>
        <option>Very likely</option>
        <option>Maybe</option>
        <option>Unlikely</option>
      </select>
    </label>

    <label class="field">
      <span>How urgent is this issue for you?</span>
      <select bind:value={urgency}>
        <option>Low</option>
        <option>Normal</option>
        <option>High</option>
      </select>
    </label>
  </section>

  <section class="section">
    <h2>Which improvements would make you reinstall?</h2>
    <div class="feature-grid">
      {#each featureChoices as feature}
        <button
          type="button"
          class:selected={selectedFeatures.includes(feature)}
          on:click={() => toggleFeature(feature)}
        >
          {feature}
        </button>
      {/each}
    </div>
  </section>

  <label class="notes-field" for="notes-input">
    <span>Extra details (optional)</span>
    <textarea
      id="notes-input"
      bind:value={notes}
      maxlength="1200"
      placeholder="What happened, when did it happen, and what should change?"
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
</section>

<style>
  .uninstall-page {
    padding: 22px;
    display: grid;
    gap: 14px;
  }

  .hero {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }

  h1 {
    margin: 0;
    font-size: clamp(30px, 4vw, 46px);
    letter-spacing: -0.03em;
  }

  h2 {
    margin: 0;
    font-size: 20px;
    letter-spacing: -0.01em;
  }

  p {
    margin: 10px 0 0;
    color: var(--muted);
    line-height: 1.65;
    max-width: 72ch;
  }

  .section {
    display: grid;
    gap: 8px;
  }

  .dual {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }

  .field {
    display: grid;
    gap: 6px;
  }

  .field span {
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  .field select {
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    padding: 10px;
  }

  .reason-grid,
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }

  .reason-grid button,
  .feature-grid button {
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    padding: 12px;
    color: var(--text);
    cursor: pointer;
    transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
  }

  .reason-grid button:hover,
  .feature-grid button:hover {
    transform: translateY(-1px);
    border-color: #9eb3df;
  }

  .reason-grid button.selected,
  .feature-grid button.selected {
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
    min-height: 130px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface);
    padding: 12px;
    color: var(--text);
    resize: vertical;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
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
</style>
