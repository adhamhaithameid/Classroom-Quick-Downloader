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

<div class="uninstall-page">
  <!-- Hero -->
  <header class="hero">
    <div class="hero-icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gc-green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </div>
    <h1>Before you go, help us improve</h1>
    <p>Your feedback shapes the next update. Takes <AnimatedNumber value={30} format={{ useGrouping: false }} animated /> seconds.</p>
  </header>

  <!-- Step 1: Reason -->
  <section class="step card">
    <h2><AnimatedNumber value={1} format={{ useGrouping: false }} animated />. Why are you uninstalling?</h2>
    <div class="option-grid">
      {#each reasonOptions as reason}
        <button
          type="button"
          class="option"
          class:selected={selectedReason === reason}
          on:click={() => { selectedReason = reason; }}
        >{reason}</button>
      {/each}
    </div>
  </section>

  <!-- Step 2: Quick selects -->
  <section class="step card two-col">
    <label class="field">
      <span>Likely to reinstall?</span>
      <select bind:value={confidenceToReinstall}>
        <option>Very likely</option>
        <option>Maybe</option>
        <option>Unlikely</option>
      </select>
    </label>
    <label class="field">
      <span>How urgent is this?</span>
      <select bind:value={urgency}>
        <option>Low</option>
        <option>Normal</option>
        <option>High</option>
      </select>
    </label>
  </section>

  <!-- Step 3: Features -->
  <section class="step card">
    <h2><AnimatedNumber value={2} format={{ useGrouping: false }} />. What would bring you back?</h2>
    <div class="option-grid compact">
      {#each featureChoices as feature}
        <button
          type="button"
          class="option small"
          class:selected={selectedFeatures.includes(feature)}
          on:click={() => toggleFeature(feature)}
        >{feature}</button>
      {/each}
    </div>
  </section>

  <!-- Step 4: Notes -->
  <section class="step card">
    <label class="notes-wrap">
      <span>Anything else? <em>(optional)</em></span>
      <textarea
        bind:value={notes}
        maxlength="1200"
        placeholder="What happened, when, and what should change?"
      ></textarea>
    </label>
  </section>

  <!-- Actions -->
  <div class="bottom-actions">
    <button class="submit-btn" type="button" disabled={submitState === 'sending'} on:click={submitFeedback}>
      {submitState === 'sending' ? 'Submitting…' : 'Submit feedback'}
    </button>
  </div>

  {#if submitMessage}
    <p class="result-msg {submitState === 'done' ? 'ok' : 'bad'}">{submitMessage}</p>
  {/if}

  <!-- Reinstall links -->
  <div class="reinstall-row">
    <span class="reinstall-label">Changed your mind?</span>
    <a href={STORE_LINKS.chrome} target="_blank" rel="noopener noreferrer">Reinstall on Chrome</a>
    <a href={STORE_LINKS.firefox} target="_blank" rel="noopener noreferrer">Reinstall on Firefox</a>
    <a href={STORE_LINKS.edge} target="_blank" rel="noopener noreferrer">Reinstall on Edge</a>
    <span class="reinstall-or">or</span>
    <a href={STORE_LINKS.github + '/issues'} target="_blank" rel="noopener noreferrer">Report a bug</a>
  </div>
</div>

<style>
  .uninstall-page {
    max-width: 680px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Hero ──────────────────────────── */
  .hero {
    text-align: center;
    padding: 40px 20px 24px;
    animation: riseIn 0.5s ease both;
  }

  .hero-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gc-green-bg);
    border-radius: 16px;
    border: 1px solid rgba(26, 139, 85, 0.12);
  }

  h1 {
    margin: 0;
    font-size: clamp(24px, 4vw, 36px);
    letter-spacing: -0.03em;
    font-weight: 800;
  }

  .hero p {
    margin: 8px 0 0;
    color: var(--text-secondary);
    font-size: 15px;
  }

  /* ── Steps ─────────────────────────── */
  .step {
    padding: 24px;
  }

  .step h2 {
    margin: 0 0 14px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  /* ── Option grid ───────────────────── */
  .option-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .option-grid.compact {
    gap: 8px;
  }

  .option {
    text-align: left;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: white;
    padding: 10px 18px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }

  .option:hover {
    border-color: var(--border-hover);
    color: var(--text);
  }

  .option.selected {
    border-color: var(--gc-green);
    background: var(--gc-green-bg);
    color: var(--gc-green-dark);
    font-weight: 600;
  }

  .option.small {
    padding: 8px 14px;
    font-size: 13px;
  }

  /* ── Two-col selects ───────────────── */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .field {
    display: grid;
    gap: 6px;
  }

  .field span {
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }

  .field select {
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: white;
    color: var(--text);
    padding: 10px 12px;
    cursor: pointer;
    font-size: 14px;
    transition: border-color 0.2s ease;
  }

  .field select:focus {
    outline: none;
    border-color: var(--gc-green);
    box-shadow: 0 0 0 3px rgba(26, 139, 85, 0.1);
  }

  /* ── Notes ──────────────────────────── */
  .notes-wrap {
    display: grid;
    gap: 8px;
  }

  .notes-wrap span {
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }

  .notes-wrap em {
    font-weight: 400;
    color: var(--muted);
  }

  .notes-wrap textarea {
    min-height: 100px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: white;
    padding: 12px;
    color: var(--text);
    resize: vertical;
    transition: border-color 0.2s ease;
    font-size: 14px;
    line-height: 1.6;
  }

  .notes-wrap textarea:focus {
    outline: none;
    border-color: var(--gc-green);
    box-shadow: 0 0 0 3px rgba(26, 139, 85, 0.1);
  }

  .notes-wrap textarea::placeholder {
    color: var(--muted);
  }

  /* ── Bottom ────────────────────────── */
  .bottom-actions {
    display: flex;
    justify-content: center;
    padding: 4px 0;
  }

  .submit-btn {
    background: var(--gc-green);
    color: white;
    border: none;
    border-radius: 999px;
    padding: 14px 36px;
    font-weight: 700;
    font-size: 15px;
    cursor: pointer;
    box-shadow: var(--shadow-green);
    transition: all 0.25s ease;
  }

  .submit-btn:hover {
    background: var(--gc-green-dark);
    transform: translateY(-2px);
    box-shadow: 0 6px 28px rgba(26, 139, 85, 0.2);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: wait;
    transform: none;
  }

  .result-msg {
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    font-weight: 600;
    font-size: 14px;
    text-align: center;
    animation: riseIn 0.3s ease both;
  }

  .result-msg.ok {
    background: #ecfdf5;
    color: #0f766e;
    border-color: #9ae6cf;
  }

  .result-msg.bad {
    background: #fff1f2;
    color: #be123c;
    border-color: #fecdd3;
  }

  /* ── Reinstall row ─────────────────── */
  .reinstall-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    flex-wrap: wrap;
    padding: 16px 0 4px;
    border-top: 1px solid var(--border);
    margin-top: 4px;
  }

  .reinstall-label {
    color: var(--muted);
    font-size: 13px;
    font-weight: 500;
  }

  .reinstall-row a {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    transition: all 0.2s ease;
    background: white;
  }

  .reinstall-row a:hover {
    border-color: var(--border-hover);
    color: var(--gc-green);
  }

  .reinstall-or {
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
    font-style: italic;
  }

  @media (max-width: 600px) {
    .uninstall-page {
      gap: 12px;
    }

    .hero {
      padding: 28px 16px 16px;
    }

    .step {
      padding: 18px;
    }

    .two-col {
      grid-template-columns: 1fr;
    }

    .option {
      white-space: normal;
    }
  }
</style>
