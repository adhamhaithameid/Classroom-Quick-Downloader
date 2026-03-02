<script lang="ts">
  import { privacyContent as privacy } from '$lib/content/privacy';

  const sectionIcons = ['🔒', '🚫', '💡', '⚡', '🗓️', '🧩', '⚖️', '👶', '🔑', '📬'];

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
</script>

<svelte:head>
  <title>Privacy — Classroom Quick Downloader</title>
  <meta name="description" content="Privacy policy summary for Classroom Quick Downloader. No tracking, no cookies, no personal data collection." />
</svelte:head>

<div class="privacy-page">
  <header class="privacy-header">
    <div class="header-left">
      <div class="icon-box">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <div>
        <h1>{privacy.headline}</h1>
        <p class="privacy-desc"><AnimatedNumericText text={privacy.description} animated /></p>
        <small class="privacy-updated">Last updated (UTC): <AnimatedNumericText text={formatDate(privacy.lastUpdatedAtUtc)} animated /></small>
      </div>
    </div>
    <div class="header-actions">
      <a class="action-btn" href={privacy.fullPrivacyUrl} target="_blank" rel="noopener noreferrer">
        Full privacy document →
      </a>
    </div>
  </header>

  <div class="section-grid">
    {#each privacy.sections as section, i}
      <article class="privacy-section" style="animation-delay: {i * 0.06}s">
        <div class="section-icon">{sectionIcons[i % sectionIcons.length]}</div>
        <h2>{section.title}</h2>
        <p class="section-summary"><AnimatedNumericText text={section.summary} animated /></p>
        {#if section.bullets.length > 0}
          <ul>
            {#each section.bullets as bullet}
              <li><AnimatedNumericText text={bullet} animated /></li>
            {/each}
          </ul>
        {/if}
      </article>
    {/each}
  </div>
</div>

<style>
  .privacy-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
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
