<script lang="ts">
  import { STORE_LINKS } from '$lib/config';
</script>

<section class="card privacy-page">
  <span class="tag">Issue #132</span>
  <h1>Privacy at a Glance</h1>
  <p>
    Classroom Quick Downloader is designed around privacy-safe telemetry. This page summarizes what is collected,
    what is never collected, and why.
  </p>

  <div class="privacy-grid">
    <article>
      <h2>Collected (Anonymous)</h2>
      <ul>
        <li>Download status totals (success / fail / cancelled)</li>
        <li>File-type category counters</li>
        <li>Browser / OS aggregate usage</li>
        <li>Country-level aggregate usage</li>
      </ul>
    </article>

    <article>
      <h2>Never Collected</h2>
      <ul>
        <li>File contents</li>
        <li>Email, name, or classroom identity</li>
        <li>Passwords or authentication tokens</li>
        <li><strong>Raw IP addresses</strong> stored in backend analytics records</li>
      </ul>
    </article>
  </div>

  <section class="privacy-note">
    <h3>Why telemetry exists</h3>
    <p>
      Aggregated telemetry helps prioritize reliability and bug fixes across the extension, Cloudflare worker,
      and Oracle backend. It is used for service quality, not personal profiling.
    </p>
  </section>

  <footer>
    <a href={STORE_LINKS.github} target="_blank" rel="noopener noreferrer">Read full repository privacy policy</a>
  </footer>
</section>

<style>
  .privacy-page {
    padding: 18px;
  }

  h1 {
    margin: 12px 0 8px;
    font-size: clamp(30px, 4vw, 42px);
    letter-spacing: -0.03em;
  }

  p {
    color: var(--muted);
    line-height: 1.65;
    margin: 0;
  }

  .privacy-grid {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 10px;
  }

  article {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-2);
    padding: 12px;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 18px;
  }

  ul {
    margin: 0;
    padding-left: 18px;
    color: var(--text);
    line-height: 1.5;
  }

  .privacy-note {
    margin-top: 12px;
    border: 1px dashed var(--border);
    border-radius: 14px;
    padding: 12px;
  }

  .privacy-note h3 {
    margin: 0 0 6px;
    font-size: 16px;
  }

  footer {
    margin-top: 12px;
  }

  footer a {
    text-decoration: none;
    color: var(--accent-2);
    font-weight: 700;
  }
</style>
