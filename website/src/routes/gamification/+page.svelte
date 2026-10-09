<script lang="ts">
  import SeoMeta from '$lib/components/SeoMeta.svelte';
  import { SITE_URL } from '$lib/config';

  /* Mirrors MILESTONE_LADDER in extension/src/history/download-stats.ts (see
     docs/GAMIFICATION.md). Level N = the Nth rung reached. Keep in sync. */
  const LEVELS: readonly number[] = [
    1, 50, 100, 250, 500, 1000, 2500, 5000, 7500, 10000, 25000, 50000, 75000,
    100000, 250000, 500000, 750000, 1000000
  ];

  function formatFiles(count: number): string {
    return count.toLocaleString('en-US');
  }

  function filesNoun(count: number): string {
    return count === 1 ? 'file' : 'files';
  }

  const gamificationStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Levels and Milestones - Classroom Quick Downloader',
    description:
      'How Classroom Quick Downloader levels work: start at level 0, and every milestone you reach is the next level up to 18.',
    url: `${SITE_URL}/gamification`,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Classroom Quick Downloader',
      url: `${SITE_URL}/`
    }
  };
</script>

<SeoMeta
  title="Classroom Quick Downloader Levels and Milestones"
  description="How Classroom Quick Downloader levels work: start at level 0, reach level 1 with your first download, and climb to level 18 at one million files."
  path="/gamification"
  keywords="classroom quick downloader levels, download milestones, gamification, confetti celebration, download counter"
  structuredData={gamificationStructuredData}
/>

<article class="gam-page">
  <section class="gam-hero">
    <h1>Levels and Milestones</h1>
    <p>
      Classroom Quick Downloader turns your download count into a level. Start at level 0, save your
      first file to reach level 1, and climb one level for every milestone on the way to level 18.
    </p>
  </section>

  <section class="gam-card glass-panel" aria-labelledby="gam-table-heading">
    <h2 id="gam-table-heading">The 18 levels</h2>
    <p>
      Each level unlocks at a lifetime download count. The count never resets, so your level never
      drops — even if you take a break from a semester.
    </p>
    <div class="gam-table-wrap" role="region" aria-label="Levels table" tabindex="0">
      <table class="gam-table">
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Files downloaded</th>
            <th scope="col">Celebration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0</td>
            <td>—</td>
            <td>Your starting point</td>
          </tr>
          {#each LEVELS as files, index}
            <tr>
              <td>{index + 1}</td>
              <td>{formatFiles(files)}</td>
              <td>Confetti burst at {formatFiles(files)} {filesNoun(files)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="gam-note">
      Past level 18 the counter keeps counting and your card shows your total — the ladder tops out
      at level 18, the one-million-files legend rung.
    </p>
  </section>

  <section class="gam-card glass-panel" aria-labelledby="gam-celebration-heading">
    <h2 id="gam-celebration-heading">How celebrations work</h2>
    <ul>
      <li>
        When a download pushes you over a milestone, the extension popup marks that rung for a
        celebration.
      </li>
      <li>
        The next time you open the popup, you get a one-time confetti burst and a toast such as
        “Level 6 reached — 1,000 files!”
      </li>
      <li>
        Each milestone celebrates exactly once. If the popup was closed during the download, the
        toast still plays (without confetti) the next time you open it.
      </li>
      <li>
        If your system or the extension is set to reduce motion, the celebration skips the confetti
        and shows the toast only.
      </li>
    </ul>
  </section>

  <section class="gam-card glass-panel" aria-labelledby="gam-privacy-heading">
    <h2 id="gam-privacy-heading">Where your count lives</h2>
    <p>
      Your lifetime count and level stay on your device, in the extension's local storage. The
      celebration never sends your file names, your account, or your downloads anywhere.
    </p>
    <p>
      An anonymous aggregate counter (an install id plus the lifetime total) is built but switched
      off. If it is ever enabled, only that aggregate would leave your device — never per-file
      details. See the <a href="/privacy">privacy policy</a> for the full picture.
    </p>
  </section>
</article>

<style>
  .gam-page {
    max-width: 1040px;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
    color: #0f172a;
  }

  .gam-hero {
    border: 1px solid #dbe5ef;
    border-radius: 1rem;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    box-shadow: 0 15px 40px rgba(15, 23, 42, 0.06);
    padding: 2rem 1.5rem;
  }

  .gam-hero h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.5rem);
    line-height: 1.1;
    color: #020617;
  }

  .gam-hero p {
    margin: 0.9rem 0 0;
    color: #334155;
    line-height: 1.7;
    max-width: 72ch;
  }

  .gam-card {
    margin-top: 1rem;
    border-radius: 0.9rem;
    padding: 1.25rem 1.35rem 1.35rem;
  }

  .gam-card h2 {
    margin: 0;
    font-size: 1.15rem;
    color: var(--text);
  }

  .gam-card p {
    margin: 0.7rem 0 0;
    color: #334155;
    line-height: 1.7;
  }

  .gam-card ul {
    margin: 0.7rem 0 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.5rem;
    color: #334155;
    line-height: 1.6;
  }

  .gam-card a {
    color: var(--gc-green, #0f766e);
    font-weight: 600;
  }

  .gam-table-wrap {
    margin-top: 0.9rem;
    overflow-x: auto;
    border: 1px solid var(--border-subtle, #e2e8f0);
    border-radius: 0.68rem;
  }

  .gam-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
  }

  .gam-table th,
  .gam-table td {
    text-align: left;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border-subtle, #e2e8f0);
    color: #0f172a;
  }

  .gam-table thead th {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary, #475569);
    background: rgba(248, 250, 252, 0.85);
  }

  .gam-table tbody tr:last-child td {
    border-bottom: none;
  }

  .gam-note {
    font-size: 0.88rem;
    color: var(--text-secondary, #475569);
  }

  @media (prefers-reduced-transparency: reduce) {
    .gam-table thead th {
      background: #f8fafc;
    }
  }
</style>
