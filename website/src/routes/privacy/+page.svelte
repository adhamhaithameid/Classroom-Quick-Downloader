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
</script>

<div class="privacy-page">
  <header class="privacy-header">
    <div class="header-content">
      <div class="header-icon-row">
        <div class="shield-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--gc-green)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h1>{privacy.headline}</h1>
      </div>
      <p class="privacy-desc"><AnimatedNumericText text={privacy.description} /></p>
      <small class="privacy-updated">Last updated (UTC): <AnimatedNumericText text={formatDate(privacy.lastUpdatedAtUtc)} /></small>
    </div>
    <div class="actions">
      <a class="action-btn" href={privacy.fullPrivacyUrl} target="_blank" rel="noopener noreferrer">
        Full privacy document →
      </a>
    </div>
  </header>

  <div class="section-grid">
    {#each privacy.sections as section, i}
      <article class="privacy-section card" style="animation-delay: {i * 0.07}s">
        <div class="section-icon">{sectionIcons[i % sectionIcons.length]}</div>
        <h2>{section.title}</h2>
        <p class="section-summary"><AnimatedNumericText text={section.summary} /></p>
        {#if section.bullets.length > 0}
          <ul>
            {#each section.bullets as bullet}
              <li><AnimatedNumericText text={bullet} /></li>
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
    gap: 28px;
  }

  .privacy-header {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    align-items: flex-start;
    animation: riseIn 0.5s ease both;
  }

  .header-content {
    max-width: 640px;
  }

  .header-icon-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 4px;
  }

  .shield-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gc-green-bg);
    border-radius: 14px;
    border: 1px solid rgba(26, 139, 85, 0.12);
  }

  h1 {
    margin: 0;
    font-size: clamp(30px, 5vw, 46px);
    letter-spacing: -0.04em;
    font-weight: 800;
  }

  .privacy-desc {
    margin: 10px 0 0;
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

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 200px;
  }

  .action-btn {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 9px 16px;
    text-decoration: none;
    background: white;
    color: var(--text-secondary);
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.25s ease;
    box-shadow: var(--shadow-sm);
  }

  .action-btn:hover {
    border-color: var(--border-hover);
    color: var(--gc-green);
  }

  .section-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 16px;
  }

  .privacy-section {
    padding: 28px;
    animation: slideUp 0.5s ease both;
    opacity: 0;
    transition: all 0.3s ease;
  }

  .privacy-section:hover {
    transform: translateY(-3px);
    border-color: var(--border-hover);
    box-shadow: var(--shadow-lg);
  }

  .section-icon {
    font-size: 28px;
    margin-bottom: 10px;
  }

  .privacy-section h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
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

    .actions {
      width: 100%;
      min-width: 0;
      flex-direction: row;
    }

    .action-btn {
      width: 100%;
    }
  }
</style>
