<script lang="ts">
  import { privacyContent as privacy } from '$lib/content/privacy';

  const sectionIcons = ['🔒', '🚫', '💡', '⚡', '🗓️', '🧩', '⚖️', '👶', '🔑', '📬'];

  function formatDate(value: number | null): string {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }

</script>

<svelte:head>
  <title>Privacy — Classroom Quick Downloader</title>
  <meta name="description" content="Privacy policy summary for Classroom Quick Downloader. No tracking, no cookies, no personal data collection." />
</svelte:head>

<div class="prv">
  <!-- Decorative orbs -->
  <div class="prv-orbs" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="orb orb-4"></div>
    <div class="orb orb-5"></div>
    <div class="orb orb-6"></div>
  </div>
  <div class="prv-grid-bg" aria-hidden="true"></div>

  <!-- Hero -->
  <section class="prv-hero">
    <div class="prv-wrap">
      <span class="prv-label">PRIVACY POLICY</span>
      <h1 class="prv-mega">{privacy.headline}</h1>
      <p class="prv-sub">{privacy.description}</p>
    </div>
  </section>

  <!-- Highlight Banner -->
  <section class="prv-banner-section">
    <div class="prv-wrap">
      <div class="prv-banner prv-reveal">
        <div class="prv-banner-items">
          <div class="prv-banner-item">
            <span class="prv-banner-icon">🍪</span>
            <div>
              <strong>Zero cookies</strong>
              <p>No tracking cookies or session identifiers</p>
            </div>
          </div>
          <span class="prv-banner-sep" aria-hidden="true"></span>
          <div class="prv-banner-item">
            <span class="prv-banner-icon">📊</span>
            <div>
              <strong>Zero tracking</strong>
              <p>No analytics libraries or tracking pixels</p>
            </div>
          </div>
          <span class="prv-banner-sep" aria-hidden="true"></span>
          <div class="prv-banner-item">
            <span class="prv-banner-icon">👤</span>
            <div>
              <strong>Zero personal data</strong>
              <p>No names, emails, or identifiable information</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Privacy Sections Grid -->
  <section class="prv-sections-section">
    <div class="prv-wrap">
      <div class="prv-section-head prv-reveal">
        <span class="prv-label">IN DETAIL</span>
        <h2>Everything you need to know about your data.</h2>
        <p>Each card below explains a specific aspect of how we handle privacy. Click through for complete transparency.</p>
      </div>

      <div class="prv-card-grid">
        {#each privacy.sections as section, i}
          <article class="prv-card prv-reveal" style="animation-delay: {i * 0.06}s">
            <div class="prv-card-icon">{sectionIcons[i % sectionIcons.length]}</div>
            <h3>{section.title}</h3>
            <p class="prv-card-summary">{section.summary}</p>
            {#if section.bullets.length > 0}
              <ul class="prv-bullets">
                {#each section.bullets as bullet}
                  <li>{bullet}</li>
                {/each}
              </ul>
            {/if}
          </article>
        {/each}
      </div>
    </div>
  </section>

  <!-- Full Policy CTA -->
  <section class="prv-cta-section">
    <div class="prv-wrap">
      <div class="prv-cta-card prv-reveal">
        <h2>Want the complete details?</h2>
        <p>Read the full, unabridged privacy policy document on GitHub for complete legal language and technical specifics.</p>
        <a class="prv-cta-btn" href={privacy.fullPrivacyUrl} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Read full privacy policy
        </a>
      </div>
    </div>
  </section>
</div>

<style>
  /* ── Base ──────────────────────────── */
  .prv {
    --green: #1a8b55;
    --green-light: #22c55e;
    --green-bg: rgba(26, 139, 85, 0.06);
    --green-border: rgba(26, 139, 85, 0.12);
    --text: #1a1a2e;
    --text-secondary: #64748b;
    --muted: #94a3b8;
    --border-subtle: rgba(226, 232, 240, 0.35);
    --radius: 16px;
    --wrap: 1280px;
    font-family: var(--font-ui), sans-serif;
    color: var(--text);
    overflow: clip;
    position: relative;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 0 auto;
    padding-bottom: 0;
  }

  /* ── Header ──────────────────────── */
  .privacy-header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    align-items: flex-start;
    animation: riseIn 0.5s ease both;
  }

  .header-left {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    max-width: 700px;
  }

  .icon-box {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--gc-green-bg);
    border: 1px solid rgba(26, 139, 85, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--gc-green);
    margin-top: 2px;
  }

  h1 {
    margin: 0;
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .privacy-desc {
    margin: 6px 0 0;
    color: var(--text-secondary);
    line-height: 1.75;
    font-size: 15px;
  }

  .privacy-updated {
    display: block;
    margin-top: 6px;
    color: var(--muted);
    font-size: 12px;
  }

  .header-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 200px;
  }

  .action-btn {
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: 999px;
    padding: 9px 16px;
    text-decoration: none;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(6px);
    color: var(--text-secondary);
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.25s ease;
    box-shadow: var(--shadow-sm);
  }

  .action-btn:hover {
    border-color: rgba(26, 139, 85, 0.25);
    color: var(--gc-green);
  }

  /* ── Section Grid ────────────────── */
  .section-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 16px;
  }

  .privacy-section {
    border: 1px solid var(--border-subtle, rgba(226, 232, 240, 0.35));
    border-radius: var(--radius);
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 28px;
    animation: slideUp 0.5s ease both;
    opacity: 0;
    transition: all 0.3s ease;
  }

  .privacy-section:hover {
    transform: translateY(-3px);
    border-color: rgba(26, 139, 85, 0.2);
    box-shadow: var(--shadow-lg);
  }

  .section-icon {
    font-size: 28px;
    margin-bottom: 10px;
  }

  .privacy-section h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .section-summary {
    margin: 10px 0 0;
    color: var(--text-secondary);
    line-height: 1.75;
    font-size: 14px;
  }

  .privacy-section ul {
    margin: 14px 0 0;
    padding-left: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .privacy-section li {
    position: relative;
    padding-left: 18px;
    color: var(--text-secondary);
    line-height: 1.65;
    font-size: 14px;
  }

  .privacy-section li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 9px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--gc-green-light);
  }

  @media (max-width: 780px) {
    .section-grid {
      grid-template-columns: 1fr;
    }

    .privacy-section {
      padding: 20px;
    }

    .header-actions {
      width: 100%;
      min-width: 0;
      flex-direction: row;
    }

    .action-btn {
      width: 100%;
    }
  }
</style>
