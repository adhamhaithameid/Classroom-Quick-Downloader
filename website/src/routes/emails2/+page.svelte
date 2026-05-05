<script lang="ts">
  import SeoMeta from '$lib/components/SeoMeta.svelte';

  const stats = [
    { value: '1K+', label: 'Installs' },
    { value: '95', label: 'Countries' },
    { value: '251K+', label: 'Clicks Saved' },
    { value: '181h+', label: 'Hours Saved' }
  ] as const;

  const features = [
    {
      icon: '⚡',
      title: 'Batch Download',
      text: 'One click downloads every file from the assignment — no loops, no waits.'
    },
    {
      icon: '🚩',
      title: 'Visual Flags',
      text: 'Instantly see which posts were edited or have new comments — never miss an update.'
    },
    {
      icon: '🔒',
      title: 'Privacy First',
      text: 'No third-party tracking, no cookies, no account. Your data stays yours.'
    },
    {
      icon: '🌐',
      title: 'Works Everywhere',
      text: 'Chrome, Firefox, Edge, Brave, Opera, Vivaldi, Arc — and every Chromium browser.'
    }
  ] as const;

  const steps = [
    {
      number: '1',
      title: 'Install',
      text: 'Add from Chrome Web Store, Firefox Add-ons, or Edge Add-ons.'
    },
    {
      number: '2',
      title: 'Open Classroom',
      text: 'Navigate to any class. CQD detects all downloadable files automatically.'
    },
    {
      number: '3',
      title: 'Download Everything',
      text: 'Click once. All files land on your device simultaneously.'
    }
  ] as const;

  const browsers = [
    {
      label: '🦊 Firefox',
      href: 'https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/',
      tone: 'green'
    },
    {
      label: '🌐 Chrome',
      href: 'https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid',
      tone: 'yellow'
    },
    {
      label: '🪟 Edge',
      href: 'https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn',
      tone: 'green'
    }
  ] as const;
</script>

<SeoMeta
  title="Email Preview 2 - Classroom Quick Downloader"
  description="Svelte-native email preview for Classroom Quick Downloader with consistent cross-device rendering."
  path="/emails2"
  keywords="classroom quick downloader email preview, svelte email page"
/>

<section class="emails2-page" aria-label="Classroom Quick Downloader email preview">
  <div class="email-shell">
    <div class="preheader" aria-hidden="true">One click. Every file. Stop wasting time on Google Classroom.</div>

    <article class="email-card">
      <section class="hero-block">
        <p class="hero-badge">Free Browser Extension</p>

        <img
          src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Logo/Classroom%20Quick%20Downloader%20-%20128.png"
          alt="Classroom Quick Downloader"
          width="72"
          height="72"
          class="hero-logo"
        />

        <h1 class="hero-title">
          Stop downloading<br />
          <em>one file at a time.</em>
        </h1>

        <p class="hero-subtitle">Your professor just posted 12 files. You're not clicking through each one.</p>

        <div class="hero-actions">
          <a
            class="btn btn-yellow"
            href="https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid"
            target="_blank"
            rel="noopener noreferrer"
          >
            Install for Chrome →
          </a>
          <a
            class="btn btn-green"
            href="https://classroom-quick-downloader.adhamhaithameid.is-a.dev/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit Website
          </a>
        </div>

        <p class="hero-note">Free forever · No account · No tracking</p>
      </section>

      <section class="section-block section-light">
        <p class="section-label">The Problem</p>
        <h2 class="section-title">Google Classroom makes<br />downloading a chore.</h2>

        <p class="section-copy">
          Click the file. Wait. Click download. Wait. Go back. Repeat — 12 more times. By then, you've spent 4 minutes
          just <em>getting</em> your materials, not actually studying them.
        </p>

        <div class="divider" aria-hidden="true"></div>

        <div class="compare-wrap" role="presentation">
          <article class="compare-shell compare-shell-bad">
            <div class="compare-card compare-card-bad">
              <p class="compare-label compare-label-bad">Without CQD</p>
              <img
                src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/problem%202.png"
                alt="Without extension"
                class="compare-image"
              />
              <p class="compare-text compare-text-bad">Click. Wait. Repeat.</p>
            </div>
          </article>

          <p class="compare-arrow" aria-hidden="true">→</p>

          <article class="compare-shell compare-shell-good">
            <div class="compare-card compare-card-good">
              <p class="compare-label compare-label-good">With CQD</p>
              <img
                src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/solution%202.png"
                alt="With extension"
                class="compare-image"
              />
              <p class="compare-text compare-text-good">One click. Done.</p>
            </div>
          </article>
        </div>
      </section>

      <section class="section-block section-stats">
        <div class="stats-grid">
          {#each stats as stat, index}
            <div class="stat-cell" class:stat-cell-divider={index < stats.length - 1}>
              <p class="stat-value">{stat.value}</p>
              <p class="stat-label-text">{stat.label}</p>
            </div>
          {/each}
        </div>
      </section>

      <section class="section-block section-light">
        <p class="section-label">What you get</p>
        <h2 class="section-title">Built different. By a student<br />who was tired of clicking.</h2>

        <div class="feature-stack">
          {#each features as feature}
            <article class="feature-card">
              <div class="feature-icon" aria-hidden="true">{feature.icon}</div>
              <div>
                <p class="feature-title">{feature.title}</p>
                <p class="feature-copy">{feature.text}</p>
              </div>
            </article>
          {/each}
        </div>
      </section>

      <section class="section-block section-dark">
        <p class="section-label section-label-dark">How it works</p>
        <h2 class="section-title section-title-dark">Three steps.<br />Under ten seconds.</h2>

        <div class="step-stack">
          {#each steps as step}
            <article class="step-row">
              <div class="step-badge" aria-hidden="true">{step.number}</div>
              <div>
                <p class="step-title">{step.title}</p>
                <p class="step-copy">{step.text}</p>
              </div>
            </article>
          {/each}
        </div>
      </section>

      <section class="section-block section-light">
        <p class="section-label">Never miss an update</p>
        <h2 class="section-title">Know when something<br />has changed.</h2>

        <p class="section-copy section-copy-tight">
          CQD adds subtle visual flags to your Classroom stream — so you can see at a glance which posts were edited or
          have new comments without opening each one.
        </p>

        <div class="flag-grid">
          <figure class="flag-item">
            <img
              src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/edits%20flag.png"
              alt="Edited post flag"
              class="flag-image"
            />
            <figcaption>Edited post indicator</figcaption>
          </figure>

          <figure class="flag-item">
            <img
              src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/comment%20flag.png"
              alt="Comment flag"
              class="flag-image"
            />
            <figcaption>New comment indicator</figcaption>
          </figure>
        </div>
      </section>

      <section class="section-block section-light section-buttons">
        <p class="section-label">The button itself</p>

        <img
          src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/dwonload%20buttons.png"
          alt="Download Buttons"
          class="buttons-image"
        />
      </section>

      <section class="section-block section-soft">
        <p class="install-title">Pick your browser — install takes 10 seconds</p>

        <div class="browser-grid">
          {#each browsers as browser}
            <a class="btn {browser.tone === 'yellow' ? 'btn-yellow' : 'btn-green'}" href={browser.href} target="_blank" rel="noopener noreferrer">
              {browser.label}
            </a>
          {/each}
        </div>

        <p class="browser-note">Also works on Brave, Opera, Vivaldi, Arc &amp; all Chromium browsers</p>
      </section>

      <section class="section-block section-dark section-dark-end">
        <h2 class="cta-title">Ready to save hours?</h2>
        <p class="cta-subtitle">Free, forever. No account required.</p>

        <a
          class="btn btn-yellow btn-cta"
          href="https://classroom-quick-downloader.adhamhaithameid.is-a.dev/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get Classroom Quick Downloader →
        </a>

        <p class="cta-meta">
          v1.5.5 · Not affiliated with Google or Google Classroom · Built by
          <span>Adham Haitham Eid</span>
        </p>
      </section>

      <div class="email-bottom-space" aria-hidden="true"></div>
    </article>
  </div>
</section>

<style>
  :global(:root) {
    color-scheme: only light;
  }

  :global(html),
  :global(body),
  :global(.site-shell) {
    overflow-x: clip;
    max-width: 100%;
  }

  .emails2-page {
    width: 100%;
    background: #f0f4f0;
    padding: 12px 0 16px;
    overflow-x: clip;
  }

  .email-shell {
    width: min(100%, 640px);
    margin: 0 auto;
    padding: 0 12px;
  }

  .preheader {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .email-card {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    border-radius: 16px;
    overflow: hidden;
    background: #ffffff;
  }

  .email-card * {
    min-width: 0;
    box-sizing: border-box;
  }

  .hero-block {
    background: #1b2e1c;
    color: #ffffff;
    text-align: center;
    padding: 20px 40px 40px;
  }

  .hero-badge {
    display: inline-block;
    margin: 0 0 24px;
    padding: 6px 16px;
    border-radius: 999px;
    background: #ffc107;
    color: #1b2e1c;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .hero-logo {
    display: block;
    margin: 0 auto 24px;
    border-radius: 16px;
  }

  .hero-title {
    margin: 0 0 12px;
    color: #ffffff;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 42px;
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: -1px;
  }

  .hero-title em {
    color: #ffc107;
    font-style: italic;
  }

  .hero-subtitle {
    margin: 0;
    color: #aaaaaa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 17px;
    line-height: 1.6;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin-top: 24px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 28px;
    border-radius: 8px;
    text-decoration: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 15px;
    line-height: 1;
    white-space: nowrap;
  }

  .btn-yellow {
    background: #ffc107;
    color: #1b2e1c;
    font-weight: 700;
  }

  .btn-green {
    background: #388e3c;
    color: #ffffff;
    font-weight: 600;
  }

  .hero-note {
    margin: 16px 0 0;
    color: #777777;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
  }

  .section-block {
    padding: 48px 40px;
  }

  .section-light {
    background: #ffffff;
  }

  .section-soft {
    background: #f8faf8;
    text-align: center;
    padding: 40px;
  }

  .section-dark {
    background: #1b2e1c;
  }

  .section-dark-end {
    text-align: center;
  }

  .section-label {
    margin: 0 0 6px;
    color: #388e3c;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
  }

  .section-label-dark {
    color: #ffc107;
  }

  .section-title {
    margin: 0 0 20px;
    color: #111111;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 28px;
    font-weight: 400;
    line-height: 1.2;
  }

  .section-title-dark {
    color: #ffffff;
    margin-bottom: 32px;
  }

  .section-copy {
    margin: 0;
    color: #555555;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 16px;
    line-height: 1.7;
  }

  .section-copy-tight {
    margin-bottom: 28px;
    font-size: 15px;
    line-height: 1.6;
  }

  .divider {
    height: 1px;
    margin: 32px 0;
    background: #e8eee8;
  }

  .compare-wrap {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
  }

  .compare-shell {
    border-radius: 12px;
    padding: 2px;
  }

  .compare-shell-bad {
    background: #ffdddd;
  }

  .compare-shell-good {
    background: #388e3c;
  }

  .compare-card {
    border-radius: 10px;
    padding: 20px;
    text-align: center;
  }

  .compare-card-bad {
    background: #fff5f5;
  }

  .compare-card-good {
    background: #f0f7f0;
  }

  .compare-label {
    margin: 0 0 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .compare-label-bad {
    color: #cc4444;
  }

  .compare-label-good {
    color: #388e3c;
  }

  .compare-image {
    display: block;
    width: 100%;
    max-width: 220px;
    margin: 0 auto;
    border-radius: 8px;
  }

  .compare-text {
    margin: 12px 0 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
  }

  .compare-text-bad {
    color: #999999;
  }

  .compare-text-good {
    color: #388e3c;
    font-weight: 600;
  }

  .compare-arrow {
    margin: 0;
    color: #388e3c;
    font-size: 20px;
  }

  .section-stats {
    background: #388e3c;
    padding-top: 32px;
    padding-bottom: 32px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .stat-cell {
    padding: 0 8px;
    text-align: center;
  }

  .stat-cell-divider {
    border-right: 1px solid rgba(255, 255, 255, 0.2);
  }

  .stat-value {
    margin: 0;
    color: #ffc107;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 26px;
    font-weight: 700;
  }

  .stat-label-text {
    margin: 4px 0 0;
    color: #dddddd;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
  }

  .feature-stack,
  .step-stack {
    display: grid;
    gap: 20px;
  }

  .feature-card,
  .step-row {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 16px;
  }

  .feature-card {
    padding: 20px;
    border-radius: 12px;
    background: #f8faf8;
  }

  .feature-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #388e3c;
    display: grid;
    place-items: center;
    font-size: 18px;
    line-height: 1;
  }

  .feature-title {
    margin: 0 0 4px;
    color: #111111;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 15px;
    font-weight: 700;
  }

  .feature-copy {
    margin: 0;
    color: #666666;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  .step-badge {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #ffc107;
    color: #1b2e1c;
    display: grid;
    place-items: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 700;
  }

  .step-title {
    margin: 0 0 2px;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 15px;
    font-weight: 700;
  }

  .step-copy {
    margin: 0;
    color: #aaaaaa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  .flag-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .flag-item {
    margin: 0;
    text-align: center;
  }

  .flag-image,
  .buttons-image {
    display: block;
    width: 100%;
    border: 1px solid #e8eee8;
    border-radius: 10px;
  }

  .flag-item figcaption {
    margin-top: 8px;
    color: #999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
  }

  .section-buttons {
    padding-top: 0;
  }

  .buttons-image {
    max-width: 520px;
    margin: 0 auto;
  }

  .install-title {
    margin: 0 0 20px;
    color: #666666;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
  }

  .browser-grid {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .browser-grid .btn {
    min-height: 44px;
    padding: 0 20px;
    font-size: 14px;
  }

  .browser-note {
    margin: 16px 0 0;
    color: #aaaaaa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
  }

  .cta-title {
    margin: 0 0 10px;
    color: #ffffff;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 30px;
    font-weight: 400;
  }

  .cta-subtitle {
    margin: 0 0 28px;
    color: #aaaaaa;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 15px;
  }

  .btn-cta {
    min-height: 52px;
    padding: 0 36px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .cta-meta {
    margin: 32px 0 0;
    color: #555555;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 11px;
  }

  .cta-meta span {
    color: #ffc107;
  }

  .email-bottom-space {
    height: 24px;
    background: #ffffff;
  }

  @media (max-width: 768px) {
    .section-block {
      padding: 32px 24px;
    }

    .hero-block {
      padding: 20px 24px 32px;
    }

    .hero-title {
      font-size: 32px;
    }

    .compare-wrap {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .compare-arrow {
      justify-self: center;
      transform: rotate(90deg);
    }

    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .stat-cell-divider {
      border-right: 0;
    }

    .feature-card,
    .step-row {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .flag-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 520px) {
    .hero-actions,
    .browser-grid {
      flex-direction: column;
      align-items: stretch;
    }

    .btn,
    .browser-grid .btn,
    .btn-cta {
      width: 100%;
    }
  }

  @media (max-width: 480px) {
    .emails2-page {
      padding: 4px 0 10px;
    }

    .email-shell {
      padding: 0 8px;
    }

    .hero-block,
    .section-block {
      padding-left: 16px;
      padding-right: 16px;
    }

    .hero-block {
      padding-top: 16px;
      padding-bottom: 24px;
    }

    .hero-logo {
      width: 56px;
      height: 56px;
      margin-bottom: 16px;
    }

    .hero-title {
      font-size: 28px;
    }

    .hero-subtitle {
      font-size: 14px;
    }

    .section-title {
      font-size: 22px;
    }

    .section-copy,
    .section-copy-tight {
      font-size: 13px;
    }

    .stat-value {
      font-size: 22px;
    }

    .stat-label-text {
      font-size: 11px;
    }

    .feature-icon {
      width: 32px;
      height: 32px;
      font-size: 16px;
    }

    .step-badge {
      width: 28px;
      height: 28px;
      font-size: 12px;
    }

    .email-bottom-space {
      height: 12px;
    }
  }
</style>
