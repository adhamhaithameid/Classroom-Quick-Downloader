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

  .prv-wrap { max-width: var(--wrap); margin: 0 auto; padding: 0 24px; }

  /* ── Decorative Layers ──────────── */
  .prv-orbs {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0;
  }
  .orb {
    position: absolute; border-radius: 50%; filter: blur(120px);
  }
  .orb-1 { width: 480px; height: 480px; background: #bbf7d0; top: -5%; right: -4%; opacity: 0.3; }
  .orb-2 { width: 400px; height: 400px; background: #a5f3fc; top: 10%; left: -6%; opacity: 0.22; }
  .orb-3 { width: 360px; height: 360px; background: #e0e7ff; top: 35%; right: 10%; opacity: 0.2; }
  .orb-4 { width: 420px; height: 420px; background: #bbf7d0; top: 55%; left: 5%; opacity: 0.22; }
  .orb-5 { width: 380px; height: 380px; background: #a5f3fc; top: 75%; right: -2%; opacity: 0.18; }
  .orb-6 { width: 340px; height: 340px; background: #e0e7ff; top: 90%; left: 20%; opacity: 0.15; }

  .prv-grid-bg {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0;
    opacity: 0.03;
    background-image: linear-gradient(var(--text) 1px, transparent 1px),
                       linear-gradient(90deg, var(--text) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* ── Hero ───────────────────────── */
  .prv-hero {
    position: relative; z-index: 2;
    text-align: center;
    padding: 36px 24px 40px;
  }

  .prv-mega {
    font-size: clamp(36px, 5vw, 60px);
    font-weight: 900;
    line-height: 1.15;
    letter-spacing: -0.03em;
    margin: 0 0 20px;
    padding-bottom: 0.1em;
    background: linear-gradient(135deg, var(--green), var(--green-light), #10b981);
    background-size: 200% 200%;
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }

  .prv-sub {
    font-size: 17px; line-height: 1.7; color: var(--text);
    opacity: 0.7;
    max-width: 640px; margin: 0 auto 20px;
  }



  .prv-label {
    font-size: 12px; font-weight: 700; color: var(--green);
    letter-spacing: 0.08em; text-transform: uppercase;
    display: block; margin-bottom: 12px;
  }

  /* ── Highlight Banner ──────────── */
  .prv-banner-section {
    position: relative; z-index: 2;
    padding: 0 0 48px;
  }

  .prv-banner {
    background: rgba(255,255,255,0.6);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-subtle);
    border-radius: 20px;
    padding: 32px 40px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.04);
  }

  .prv-banner-items {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 32px;
    flex-wrap: wrap;
  }

  .prv-banner-item {
    display: flex; align-items: center; gap: 14px;
    flex: 1; min-width: 200px;
  }

  .prv-banner-icon {
    font-size: 32px; flex-shrink: 0;
  }

  .prv-banner-item strong {
    display: block;
    font-size: 16px; font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--text);
  }

  .prv-banner-item p {
    margin: 2px 0 0;
    font-size: 13px; color: var(--text-secondary);
    line-height: 1.5;
  }

  .prv-banner-sep {
    width: 1px; height: 48px;
    background: linear-gradient(180deg, transparent, rgba(26,139,85,0.2), transparent);
    flex-shrink: 0;
  }

  /* ── Section Head ──────────────── */
  .prv-section-head {
    text-align: center; margin-bottom: 48px;
  }

  .prv-section-head h2 {
    font-size: clamp(28px, 3.5vw, 42px); font-weight: 800;
    letter-spacing: -0.02em; margin: 0 0 12px;
  }

  .prv-section-head p {
    font-size: 16px; color: var(--text-secondary);
    max-width: 560px; margin: 0 auto;
  }

  /* ── Card Grid ─────────────────── */
  .prv-sections-section {
    position: relative; z-index: 2;
    padding: 40px 0 60px;
  }

  .prv-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 20px;
  }

  .prv-card {
    background: rgba(255, 255, 255, 0.65);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    padding: 28px 24px;
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .prv-card:hover {
    transform: translateY(-4px);
    border-color: var(--green-border);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
  }

  .prv-card-icon {
    font-size: 32px; margin-bottom: 14px;
  }

  .prv-card h3 {
    margin: 0 0 10px;
    font-size: 19px; font-weight: 800;
    letter-spacing: -0.02em;
  }

  .prv-card-summary {
    margin: 0 0 14px;
    font-size: 14px; line-height: 1.75;
    color: var(--text-secondary);
  }

  .prv-bullets {
    margin: 0; padding: 0; list-style: none;
    display: flex; flex-direction: column; gap: 8px;
  }

  .prv-bullets li {
    position: relative;
    padding-left: 20px;
    font-size: 14px; line-height: 1.65;
    color: var(--text-secondary);
  }

  .prv-bullets li::before {
    content: '';
    position: absolute; left: 0; top: 9px;
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--green-light);
  }

  /* ── CTA Section ───────────────── */
  .prv-cta-section {
    position: relative; z-index: 2;
    padding: 20px 0 16px;
  }

  .prv-cta-card {
    text-align: center;
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border-subtle);
    border-radius: 24px;
    padding: 56px 48px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.04);
  }

  .prv-cta-card h2 {
    font-size: clamp(28px, 3.5vw, 40px); font-weight: 900;
    letter-spacing: -0.03em; margin: 0 0 12px;
  }

  .prv-cta-card p {
    font-size: 16px; color: var(--text-secondary);
    max-width: 520px; margin: 0 auto 28px; line-height: 1.7;
  }

  .prv-cta-btn {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 14px 28px; font-size: 15px; font-weight: 700;
    border-radius: 14px; text-decoration: none;
    background: linear-gradient(135deg, var(--green), var(--green-light));
    color: #fff;
    box-shadow: 0 4px 20px rgba(26, 139, 85, 0.35), 0 0 40px rgba(26, 139, 85, 0.15);
    transition: all 0.25s ease;
  }

  .prv-cta-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 28px rgba(26, 139, 85, 0.45), 0 0 60px rgba(26, 139, 85, 0.2);
  }

  .prv-reveal {
    opacity: 1;
    transform: none;
  }

  .prv-banner,
  .prv-card,
  .prv-cta-card {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  /* ── Responsive ────────────────── */
  @media (max-width: 900px) {
    .prv-card-grid {
      grid-template-columns: 1fr;
    }

    .prv-card {
      padding: 22px 18px;
      border-radius: 14px;
    }

    .prv-bullets {
      gap: 10px;
    }

    .prv-banner {
      padding: 24px 20px;
    }

    .prv-banner-items {
      flex-direction: column;
      gap: 20px;
    }

    .prv-banner-sep {
      width: 48px; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(26,139,85,0.2), transparent);
    }

    .prv-cta-card {
      padding: 40px 24px;
    }
  }

  @media (max-width: 600px) {
    .prv-hero {
      padding: 40px 16px 32px;
    }

    .prv-card h3 {
      font-size: 18px;
    }

    .prv-card-summary,
    .prv-bullets li {
      font-size: 14px;
      line-height: 1.7;
    }
  }
</style>
