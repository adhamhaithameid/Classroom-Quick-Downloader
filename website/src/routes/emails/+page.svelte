<script lang="ts">
  import { onMount } from 'svelte';
  import './styles.css';

  interface Stats {
    installs: number;
    countries: number;
    clicksSaved: number;
    hoursSaved: number;
  }

  let stats: Stats = {
    installs: 0,
    countries: 0,
    clicksSaved: 0,
    hoursSaved: 0
  };

  let hasAnimated = false;

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            hasAnimated = true;
            animateStats();
          }
        });
      },
      { threshold: 0.5 }
    );

    const statsSection = document.querySelector('.stats-section');
    if (statsSection) observer.observe(statsSection);

    return () => {
      observer.disconnect();
    };
  });

  function animateStats() {
    const duration = 2000;
    const start = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      stats.installs = Math.floor(1000 * easeOut);
      stats.countries = Math.floor(95 * easeOut);
      stats.clicksSaved = Math.floor(251000 * easeOut);
      stats.hoursSaved = Math.floor(181 * easeOut);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  function formatNumber(num: number): string {
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toString();
  }

  function trackClick(url: string, label: string) {
    console.log(`[Email] Clicked: ${label} → ${url}`);
  }
</script>

<svelte:head>
  <title>Classroom Quick Downloader - Stop Downloading One File at a Time</title>
  <meta name="description" content="One click. Every file. Stop wasting time on Google Classroom. Free browser extension for Chrome, Firefox, and Edge." />
  <meta name="og:title" content="Classroom Quick Downloader" />
  <meta name="og:description" content="One click. Every file. Stop wasting time on Google Classroom." />
  <meta name="og:type" content="website" />
</svelte:head>

<div class="email-container">
  <!-- HERO SECTION -->
  <section class="hero">
    <div class="badge">Free Browser Extension</div>
    <a href="https://classroom-quick-downloader.adhamhaithameid.is-a.dev/" class="logo-link" on:click={() => trackClick('logo', 'Logo Redirect')}>
      <img 
        src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Logo/Classroom%20Quick%20Downloader%20-%20128.png"
        alt="Classroom Quick Downloader Logo"
        class="logo"
        width="72"
        height="72"
      />
    </a>
    <h1 class="hero-title">
      Stop downloading<br />
      <em>one file at a time.</em>
    </h1>
    <p class="hero-subtitle">Your professor just posted 12 files. You're not clicking through each one.</p>
    <div class="hero-buttons">
      <a href="https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid" class="btn btn-primary" on:click={() => trackClick('chrome', 'Install Chrome')}>
        Install for Chrome →
      </a>
      <a href="https://classroom-quick-downloader.adhamhaithameid.is-a.dev/" class="btn btn-secondary" on:click={() => trackClick('website', 'Visit Website')}>
        Visit Website
      </a>
    </div>
    <p class="hero-note">Free forever · No account · No tracking</p>
  </section>

  <!-- THE PROBLEM SECTION -->
  <section class="section-problem">
    <div class="content-wrapper">
      <div class="section-label">The Problem</div>
      <h2 class="section-title">Google Classroom makes<br />downloading a chore.</h2>
      <p class="section-text">
        Click the file. Wait. Click download. Wait. Go back. Repeat — 12 more times. By then, you've spent 4 minutes just <em>getting</em> your materials, not actually studying them.
      </p>

      <div class="comparison">
        <div class="comparison-card comparison-card-bad">
          <div>
            <p class="comparison-label bad">Without CQD</p>
            <img 
              src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/problem%202.png"
              alt="Without extension"
              class="comparison-img"
            />
            <p class="comparison-text">Click. Wait. Repeat.</p>
          </div>
        </div>
        <span class="comparison-arrow">→</span>
        <div class="comparison-card comparison-card-good">
          <div>
            <p class="comparison-label good">With CQD</p>
            <img 
              src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/solution%202.png"
              alt="With extension"
              class="comparison-img"
            />
            <p class="comparison-text good">One click. Done.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- STATS SECTION -->
  <section class="section-stats stats-section">
    <div class="content-wrapper">
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-number">{formatNumber(stats.installs)}+</div>
          <div class="stat-label">Installs</div>
        </div>
        <div class="stat">
          <div class="stat-number">{stats.countries}</div>
          <div class="stat-label">Countries</div>
        </div>
        <div class="stat">
          <div class="stat-number">{formatNumber(stats.clicksSaved)}+</div>
          <div class="stat-label">Clicks Saved</div>
        </div>
        <div class="stat">
          <div class="stat-number">{stats.hoursSaved}h+</div>
          <div class="stat-label">Hours Saved</div>
        </div>
      </div>
    </div>
  </section>

  <!-- FEATURES SECTION -->
  <section class="section-features">
    <div class="content-wrapper">
      <div class="section-label">What you get</div>
      <h2 class="section-title">Built different. By a student<br />who was tired of clicking.</h2>
      <div class="features-list">
        <div class="feature">
          <div class="feature-icon">⚡</div>
          <div>
            <h3 class="feature-title">Batch Download</h3>
            <p class="feature-text">One click downloads every file from the assignment — no loops, no waits.</p>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">🚩</div>
          <div>
            <h3 class="feature-title">Visual Flags</h3>
            <p class="feature-text">Instantly see which posts were edited or have new comments — never miss an update.</p>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">🔒</div>
          <div>
            <h3 class="feature-title">Privacy First</h3>
            <p class="feature-text">No third-party tracking, no cookies, no account. Your data stays yours.</p>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">🌐</div>
          <div>
            <h3 class="feature-title">Works Everywhere</h3>
            <p class="feature-text">Chrome, Firefox, Edge, Brave, Opera, Vivaldi, Arc — and every Chromium browser.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- HOW IT WORKS SECTION -->
  <section class="section-how">
    <div class="content-wrapper">
      <div class="section-label">How it works</div>
      <h2 class="section-title light">Three steps.<br />Under ten seconds.</h2>
      <div class="steps-list">
        <div class="step">
          <div class="step-number">1</div>
          <div>
            <h3 class="step-title">Install</h3>
            <p class="step-text">Add from Chrome Web Store, Firefox Add-ons, or Edge Add-ons.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div>
            <h3 class="step-title">Open Classroom</h3>
            <p class="step-text">Navigate to any class. CQD detects all downloadable files automatically.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div>
            <h3 class="step-title">Download Everything</h3>
            <p class="step-text">Click once. All files land on your device simultaneously.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- FLAGS SECTION -->
  <section class="section-flags">
    <div class="content-wrapper">
      <div class="section-label">Never miss an update</div>
      <h2 class="section-title">Know when something<br />has changed.</h2>
      <p class="section-text">
        CQD adds subtle visual flags to your Classroom stream — so you can see at a glance which posts were edited or have new comments without opening each one.
      </p>

      <div class="flags-grid">
        <div class="flag-card">
          <img 
            src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/edits%20flag.png"
            alt="Edited post flag"
            class="flag-img"
          />
          <p class="flag-label">Edited post indicator</p>
        </div>
        <div class="flag-card">
          <img 
            src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/comment%20flag.png"
            alt="Comment flag"
            class="flag-img"
          />
          <p class="flag-label">New comment indicator</p>
        </div>
      </div>

      <div class="buttons-section">
        <div class="section-label">The button itself</div>
        <img 
          src="https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/docs/Design/Advertisement/dwonload%20buttons.png"
          alt="Download Buttons"
          class="buttons-img"
        />
      </div>
    </div>
  </section>

  <!-- INSTALL SECTION -->
  <section class="section-install">
    <div class="content-wrapper">
      <p class="install-title">Pick your browser — install takes 10 seconds</p>
      <div class="browser-buttons">
        <a href="https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/" class="btn btn-firefox" on:click={() => trackClick('firefox', 'Firefox')}>
          🦊 Firefox
        </a>
        <a href="https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid" class="btn btn-chrome" on:click={() => trackClick('chrome', 'Chrome')}>
          🌐 Chrome
        </a>
        <a href="https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn" class="btn btn-edge" on:click={() => trackClick('edge', 'Edge')}>
          🪟 Edge
        </a>
      </div>
      <p class="browser-note">Also works on Brave, Opera, Vivaldi, Arc & all Chromium browsers</p>
    </div>
  </section>

  <!-- INSTALL SECTION - FINAL CALL TO ACTION -->
  <section class="section-install">
    <div class="content-wrapper">
      <p class="install-title">Pick your browser — install takes 10 seconds</p>
      <div class="browser-buttons">
        <a href="https://addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader/" class="btn btn-firefox" on:click={() => trackClick('firefox', 'Firefox')}>
          🦊 Firefox
        </a>
        <a href="https://chromewebstore.google.com/detail/classroom-quick-downloade/oemoongiefmpmomjikcjmkkkhffcbdid" class="btn btn-chrome" on:click={() => trackClick('chrome', 'Chrome')}>
          🌐 Chrome
        </a>
        <a href="https://microsoftedge.microsoft.com/addons/detail/classroom-quick-downloade/ecojbijjkcjdolpeoiemnccgmaeomcmn" class="btn btn-edge" on:click={() => trackClick('edge', 'Edge')}>
          🪟 Edge
        </a>
      </div>
      <p class="browser-note">Also works on Brave, Opera, Vivaldi, Arc & all Chromium browsers</p>
    </div>
  </section>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: Georgia, 'Times New Roman', serif;
    background-color: #f0f4f0;
  }

  :global(.email-container) {
    max-width: 600px;
    margin: 0 auto;
    background: #ffffff;
  }
</style>
