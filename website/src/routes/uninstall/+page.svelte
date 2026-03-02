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
            disabled={submitState === 'sending'}
            on:click={submitFeedback}
          >
            {#if submitState === 'sending'}
              <svg class="un-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"/></svg>
              Sending…
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
              Submit feedback
            {/if}
          </button>
        </div>
      </div>

      <!-- Result Message -->
      {#if submitMessage}
        <div class="un-toast" class:ok={submitState === 'done'} class:fail={submitState === 'error'}>
          <span class="un-toast-icon">{submitState === 'done' ? '✅' : '⚠️'}</span>
          <span>{submitMessage}</span>
        </div>
      {/if}
    </div>
  </section>

  <!-- Reinstall CTA -->
  <section class="un-cta-section un-appear" style="animation-delay: 0.3s">
    <div class="un-wrap">
      <div class="un-cta-card">
        <h2 class="un-cta-heading">Come back anytime</h2>
        <p class="un-cta-text">Changed your mind? Reinstall instantly from your browser's store.</p>
        <div class="un-reinstall-row">
          {#each orderedBrowsers as browser}
            {@const isDetected = isDetectedBrowser(browser)}
            <a
              href={STORE_LINKS[browser]}
              target="_blank"
              rel="noopener noreferrer"
              class="un-reinstall-btn"
              class:detected={isDetected}
              on:click={() => trackReinstallClick(browser)}
            >
              <img src="{base}/images/{browser}.svg" alt="" class="un-browser-icon" />
              {#if isDetected}Reinstall for {browserDisplayName(browser)}{:else}{browserDisplayName(browser)}{/if}
            </a>
          {/each}
        </div>
        <div class="un-cta-divider"></div>
        <a class="un-bug-link" href={STORE_LINKS.github + '/issues'} target="_blank" rel="noopener noreferrer">
          🐛 Report a bug instead
        </a>
      </div>
    </div>
  </section>
</div>

<style>
  /* ── Design tokens ───────────────── */
  .un {
    --green: #1a8b55;
    --green-light: #22c55e;
    --green-bg: rgba(26, 139, 85, 0.06);
    --green-border: rgba(26, 139, 85, 0.15);
    --text: #1a1a2e;
    --text-secondary: #64748b;
    --muted: #94a3b8;
    --surface: rgba(255, 255, 255, 0.65);
    --border-subtle: rgba(226, 232, 240, 0.4);
    --radius: 20px;
    --radius-sm: 14px;
    --wrap: 780px;

    font-family: var(--font-ui), sans-serif;
    color: var(--text);
    overflow: clip;
    position: relative;
    width: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 0 auto;
    padding-bottom: 0;
  }

  .un-wrap {
    max-width: var(--wrap);
    margin: 0 auto;
    padding: 0 24px;
    width: 100%;
  }

  /* ── Entrance animation ──────────── */
  .un-appear {
    animation: un-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* ── Decorative ────────────────── */
  .un-orbs {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0;
  }

  .orb { position: absolute; border-radius: 50%; filter: blur(130px); }
  .orb-1 { width: 520px; height: 520px; background: #bbf7d0; top: -6%; right: -8%; opacity: 0.22; }
  .orb-2 { width: 420px; height: 420px; background: #e0e7ff; top: 35%; left: -10%; opacity: 0.18; }
  .orb-3 { width: 380px; height: 380px; background: #a5f3fc; top: 75%; right: -4%; opacity: 0.14; }

  .un-grid-bg {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0; opacity: 0.025;
    background-image:
      linear-gradient(var(--text) 1px, transparent 1px),
      linear-gradient(90deg, var(--text) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* ── Hero ───────────────────────── */
  .un-hero {
    position: relative; z-index: 2;
    text-align: center;
    padding: 44px 24px 32px;
  }

  .un-label {
    font-size: 11px; font-weight: 700; color: var(--green);
    letter-spacing: 0.1em; text-transform: uppercase;
    display: block; margin-bottom: 14px;
  }

  .un-mega {
    font-size: clamp(32px, 5.5vw, 52px);
    font-weight: 900;
    line-height: 1.12;
    letter-spacing: -0.035em;
    margin: 0 0 18px;
    background: linear-gradient(135deg, var(--green), var(--green-light), #10b981);
    background-size: 200% 200%;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .un-sub {
    font-size: 16px; line-height: 1.75; color: var(--text-secondary);
    max-width: 480px; margin: 0 auto;
  }

  /* ── Form Section ──────────────── */
  .un-form-section {
    position: relative; z-index: 2;
    padding: 8px 0 24px;
  }

  /* ── Step container ──────────────── */
  .un-step {
    position: relative;
    margin-bottom: 14px;
  }

  .un-step-badge {
    width: 30px; height: 30px;
    background: var(--green);
    color: #fff;
    font-size: 14px;
    font-weight: 800;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 14px;
    box-shadow: 0 3px 12px rgba(26, 139, 85, 0.3);
  }

  /* ── Card ──────────────────────── */
  .un-card {
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    padding: 36px 32px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
  }

  .un-card-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .un-card-title {
    margin: 0 0 6px;
    font-size: 21px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .un-card-title-row .un-card-title {
    margin-bottom: 0;
  }

  .un-optional-tag {
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: rgba(148, 163, 184, 0.1);
    border-radius: 6px;
    padding: 3px 8px;
  }

  .un-card-hint {
    margin: 0 0 22px;
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  /* ── Reason pills ─────────────── */
  .un-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .un-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1.5px solid var(--border-subtle);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.8);
    padding: 11px 20px;
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
