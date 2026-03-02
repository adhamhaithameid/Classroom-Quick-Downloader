<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { submitUninstallFeedback } from '$lib/api/publicSite';
  import { STORE_LINKS } from '$lib/config';
  import { trackWebsiteEvent } from '$lib/analytics/websiteEvents';
  import { buildUninstallNotesPayload } from '$lib/uninstall/feedback';
  import { browserDisplayName, detectBrowserFromUserAgent, type BrowserKey } from '$lib/browser/detect';

  const reasons: { label: string; icon: string }[] = [
    { label: "Didn't work as expected", icon: '⚙️' },
    { label: 'Too many permissions', icon: '🔒' },
    { label: 'Slowed my browser', icon: '🐢' },
    { label: 'Found an alternative', icon: '🔄' },
    { label: 'Privacy concerns', icon: '🛡️' },
    { label: 'Temporary install', icon: '⏱️' },
    { label: 'Other', icon: '💬' }
  ];

  const featureOptions: { label: string; icon: string }[] = [
    { label: 'Download all button', icon: '📥' },
    { label: 'Single file download buttons', icon: '📄' },
    { label: 'Edited flag', icon: '✏️' },
    { label: 'Commented flag', icon: '💬' },
    { label: 'Both flag', icon: '🔀' },
    { label: 'Extension popup', icon: '🧩' }
  ];

  const confidenceOptions: { label: string; icon: string }[] = [
    { label: 'Very likely', icon: '💚' },
    { label: 'Maybe', icon: '🤔' },
    { label: 'Unlikely', icon: '😕' },
    { label: 'Never', icon: '👋' }
  ];

  let selectedReason = '';
  let selectedFeatures: string[] = [];
  let confidenceToReinstall = '';
  let notes = '';
  let queryBrowser: BrowserKey = 'chrome';
  let queryVersion = 'unknown';
  let querySource = 'website';
  let detectedBrowser: BrowserKey = 'chrome';

  let submitState: 'idle' | 'sending' | 'done' | 'error' = 'idle';
  let submitMessage = '';

  function normalizeBrowser(value: string): BrowserKey | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'chrome' || normalized === 'firefox' || normalized === 'edge') return normalized;
    return null;
  }

  function isDetectedBrowser(browser: BrowserKey): boolean {
    return detectedBrowser === browser;
  }

  /** Put the detected browser in the centre of the row */
  $: orderedBrowsers = (() => {
    const all: BrowserKey[] = ['chrome', 'firefox', 'edge'];
    const others = all.filter(b => b !== detectedBrowser);
    return others.length === 2 ? [others[0], detectedBrowser, others[1]] : all;
  })();

  function toggleFeature(value: string): void {
    if (selectedFeatures.includes(value)) {
      selectedFeatures = selectedFeatures.filter((item) => item !== value);
      return;
    }
    selectedFeatures = [...selectedFeatures, value];
  }

  function trackReinstallClick(browser: BrowserKey): void {
    trackWebsiteEvent({
      eventType: 'cta',
      action: 'install_click',
      placement: `uninstall_reinstall_${browser}`,
      pagePath: '/uninstall'
    });
  }

  async function submitFeedback(): Promise<void> {
    if (!selectedReason.trim()) {
      submitState = 'error';
      submitMessage = 'Please pick a reason above before submitting.';
      return;
    }

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
          confidenceToReinstall: confidenceToReinstall || 'not_provided',
          selectedFeatures,
          urgency: 'not_provided',
          notes
        })
      });
      submitState = 'done';
      submitMessage = response?.message || 'Thank you — your feedback helps us build better software.';
    } catch (error) {
      submitState = 'error';
      submitMessage =
        error instanceof Error && error.message ? error.message : 'Could not submit feedback. Please try again later.';
    }
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const browserFromQuery = normalizeBrowser(params.get('browser') || '');
    const browserFromUA = detectBrowserFromUserAgent(navigator.userAgent);
    detectedBrowser = browserFromQuery || browserFromUA;
    queryBrowser = detectedBrowser;
    queryVersion = params.get('version') || 'unknown';
    querySource = params.get('source') || 'website';
  });
</script>

<svelte:head>
  <title>Uninstall Feedback — Classroom Quick Downloader</title>
  <meta name="description" content="Help us improve Classroom Quick Downloader. Share why you uninstalled so we can make it better." />
</svelte:head>

<div class="un">
  <!-- Decorative background -->
  <div class="un-orbs" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
  </div>
  <div class="un-grid-bg" aria-hidden="true"></div>

  <!-- Hero -->
  <section class="un-hero un-appear" style="animation-delay: 0s">
    <div class="un-wrap">
      <span class="un-label">FEEDBACK CENTER</span>
      <h1 class="un-mega">We'd love to hear why.</h1>
      <p class="un-sub">
        Your feedback directly shapes what we build next.<br />
        Pick a reason below — everything else is optional.
      </p>
    </div>
  </section>

  <!-- Form -->
  <section class="un-form-section">
    <div class="un-wrap">
      <!-- Step 1: Reason -->
      <div class="un-step un-appear" style="animation-delay: 0.1s">
        <div class="un-step-badge" aria-hidden="true">1</div>
        <div class="un-card">
          <h2 class="un-card-title">What made you uninstall?</h2>
          <p class="un-card-hint">Pick the closest reason — it helps us prioritize fixes.</p>
          <div class="un-pills">
            {#each reasons as { label, icon }}
              <button
                type="button"
                class="un-pill"
                class:active={selectedReason === label}
                on:click={() => { selectedReason = label; }}
              >
                <span class="un-pill-icon">{icon}</span>
                {label}
                {#if selectedReason === label}
                  <svg class="un-pill-check" viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Step 2: Details -->
      <div class="un-step un-appear" style="animation-delay: 0.2s">
        <div class="un-step-badge" aria-hidden="true">2</div>
        <div class="un-card">
          <div class="un-card-title-row">
            <h2 class="un-card-title">Tell us more</h2>
            <span class="un-optional-tag">Optional</span>
          </div>

          <!-- Reinstall likelihood -->
          <div class="un-field-group">
            <span class="un-field-label">Would you reinstall?</span>
            <div class="un-inline-pills">
              {#each confidenceOptions as { label, icon }}
                <button
                  type="button"
                  class="un-mini-pill"
                  class:active={confidenceToReinstall === label}
                  on:click={() => { confidenceToReinstall = label; }}
                >
                  <span class="un-mini-icon">{icon}</span>
                  {label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Feature usage -->
          <div class="un-field-group">
            <span class="un-field-label">Which features did you use?</span>
            <div class="un-inline-pills">
              {#each featureOptions as { label, icon }}
                <button
                  type="button"
                  class="un-mini-pill"
                  class:active={selectedFeatures.includes(label)}
                  on:click={() => toggleFeature(label)}
                >
                  <span class="un-mini-icon">{icon}</span>
                  {label}
                  {#if selectedFeatures.includes(label)}
                    <svg class="un-mini-check" viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <!-- Notes -->
          <div class="un-field-group">
            <label class="un-field-label" for="un-notes">Anything else on your mind?</label>
            <textarea
              id="un-notes"
              bind:value={notes}
              maxlength="1200"
              placeholder="What happened, when, and what you wish was different…"
            ></textarea>
          </div>

          <!-- Submit -->
          <button
            class="un-submit"
            type="button"
            class="option small"
            class:selected={selectedFeatures.includes(feat)}
            on:click={() => toggleFeature(feat)}
          >{feat}</button>
        {/each}
      </div>
    </div>
  </section>

  <!-- Step 3: Notes -->
  <section class="step">
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
    <div class="result-msg" class:ok={submitState === 'done'} class:fail={submitState === 'error'}>
      {submitMessage}
    </div>
  {/if}

  <div class="reinstall-row">
    <a href={STORE_LINKS.chrome} target="_blank" rel="noopener noreferrer">Reinstall on Chrome</a>
    <span class="reinstall-or">or</span>
    <a href={STORE_LINKS.firefox} target="_blank" rel="noopener noreferrer">Reinstall on Firefox</a>
    <span class="reinstall-or">or</span>
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
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 36px 28px 28px;
    text-align: center;
    animation: riseIn 0.5s ease both;
  }

  .hero-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--gc-green-bg);
    border: 1px solid rgba(26, 139, 85, 0.12);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--gc-green);
    margin-bottom: 16px;
  }

  .hero h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .hero p {
    margin: 10px auto 0;
    color: var(--text-secondary);
    font-size: 15px;
    line-height: 1.7;
    max-width: 45ch;
  }

  /* ── Steps ─────────────────────────── */
  .step {
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 24px;
    animation: slideUp 0.5s ease both;
    opacity: 0;
  }

  .step:nth-child(2) { animation-delay: 0.06s; }
  .step:nth-child(3) { animation-delay: 0.12s; }
  .step:nth-child(4) { animation-delay: 0.18s; }

  .step h2 {
    margin: 0 0 14px;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.015em;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
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
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.6);
    padding: 10px 18px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(15, 20, 25, 0.03);
  }

  .option:hover {
    border-color: rgba(26, 139, 85, 0.2);
    color: var(--gc-green);
  }

  .option.selected {
    background: var(--gc-green-bg);
    border-color: rgba(26, 139, 85, 0.35);
    color: var(--gc-green);
    font-weight: 600;
  }

  .option.small {
    padding: 7px 14px;
    font-size: 13px;
  }

  /* ── Fields ─────────────────────────── */
  .field {
    display: grid;
    gap: 8px;
  }

  .field span {
    color: var(--text);
    font-size: 14px;
    font-weight: 700;
  }

  .field select {
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(6px);
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    -webkit-appearance: none;
    appearance: none;
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
    color: var(--text);
    font-size: 14px;
    font-weight: 700;
  }

  .notes-wrap em {
    font-weight: 400;
    color: var(--muted);
  }

  .notes-wrap textarea {
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: var(--radius-sm);
    padding: 12px;
    min-height: 100px;
    resize: vertical;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(6px);
    color: var(--text);
    font-size: 14px;
    line-height: 1.6;
    transition: all 0.2s ease;
  }

  .notes-wrap textarea:focus {
    outline: none;
    border-color: var(--gc-green);
    box-shadow: 0 0 0 3px rgba(26, 139, 85, 0.1);
  }

  .notes-wrap textarea::placeholder {
    color: var(--muted);
  }

  /* ── Submit ─────────────────────────── */
  .bottom-actions {
    display: flex;
    justify-content: flex-end;
  }

  .submit-btn {
    background: var(--gc-green);
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 12px 28px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s ease;
    box-shadow: var(--shadow-green);
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
    padding: 14px 18px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    font-weight: 600;
    font-size: 14px;
    text-align: center;
    animation: riseIn 0.3s ease both;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(6px);
  }

  .result-msg.ok {
    border-color: rgba(26, 139, 85, 0.3);
    color: var(--gc-green);
    background: rgba(26, 139, 85, 0.05);
  }

  .result-msg.fail {
    border-color: rgba(220, 38, 38, 0.3);
    color: #b91c1c;
    background: rgba(220, 38, 38, 0.04);
  }

  /* ── Reinstall ──────────────────────── */
  .reinstall-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 12px 0;
  }

  .reinstall-row a {
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: 999px;
    padding: 7px 14px;
    transition: all 0.2s ease;
    background: rgba(255, 255, 255, 0.6);
  }

  .reinstall-row a:hover {
    border-color: rgba(26, 139, 85, 0.25);
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
