<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { STORE_LINKS } from '$lib/config';
  import { fetchChangelog } from '$lib/api/changelog';
  import { WEBSITE_MANUAL_CHANGELOG } from '$lib/content/changelog.manual.generated';
  import SeoMeta from '$lib/components/SeoMeta.svelte';

  type ChangelogMdEntry = {
    version: string;
    title: string;
    summary: string;
    highlights: string[];
    added: string[];
    changed: string[];
    fixed: string[];
  };

  let changelogEntries: ChangelogMdEntry[] = [];
  let state: 'loading' | 'ready' | 'error' = 'loading';
  let error = '';
  let refreshing = false;
  let degraded = false;
  let lastLoadedAtUtc: number | null = null;
  let activeVersion = '';
  /** Tracks whether the current data came from manual source. */
  let dataSource: 'manual' | null = null;

  function semverCompareDesc(a: string, b: string): number {
    const aParts = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const bParts = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const maxLength = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < maxLength; i += 1) {
      const diff = (bParts[i] ?? 0) - (aParts[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  function manualEntriesToMdEntries(
    entries: Array<{
      version: string;
      title?: string;
      summary?: string;
      highlights?: string[];
      added?: string[];
      changed?: string[];
      fixed?: string[];
    }>
  ): ChangelogMdEntry[] {
    return entries
      .map((entry) => {
        const version = (entry.version || '').replace(/^v/i, '').trim();
        if (!version) return null;
        let summary = (entry.summary || '').trim();
        const title = (entry.title || '').trim();
        const highlights = Array.isArray(entry.highlights)
          ? entry.highlights.filter((item) => typeof item === 'string' && item.trim())
          : [];
        const added = Array.isArray(entry.added)
          ? entry.added.filter((item) => typeof item === 'string' && item.trim())
          : [];
        const changed = Array.isArray(entry.changed)
          ? entry.changed.filter((item) => typeof item === 'string' && item.trim())
          : [];
        const fixed = Array.isArray(entry.fixed)
          ? entry.fixed.filter((item) => typeof item === 'string' && item.trim())
          : [];
        if (!summary && highlights.length > 0) summary = highlights[0];

        return {
          version,
          title,
          summary: summary || 'No summary available.',
          highlights,
          added,
          changed,
          fixed
        };
      })
      .filter((entry): entry is ChangelogMdEntry => entry !== null);
  }

  const seededEntries = manualEntriesToMdEntries(
    (WEBSITE_MANUAL_CHANGELOG.entries || []).map((entry) => ({
      version: entry.version,
      title: entry.title,
      summary: entry.summary,
      highlights: entry.highlights ? [...entry.highlights] : [],
      added: entry.added ? [...entry.added] : [],
      changed: entry.changed ? [...entry.changed] : [],
      fixed: entry.fixed ? [...entry.fixed] : []
    }))
  ).sort((a, b) => semverCompareDesc(a.version, b.version));

  if (seededEntries.length > 0) {
    changelogEntries = seededEntries;
    state = 'ready';
    dataSource = 'manual';
    lastLoadedAtUtc = Number(WEBSITE_MANUAL_CHANGELOG.generatedAt) || null;
    activeVersion = seededEntries[0]?.version || '';
  }

  async function load(force = false): Promise<void> {
    if (!force) state = 'loading';
    if (force) refreshing = true;
    error = '';
    try {
      const manualData = await fetchChangelog();
      if (!manualData.ok) {
        throw new Error('Manual changelog source returned an invalid response.');
      }
      const converted = manualEntriesToMdEntries(
        manualData.entries.map((entry) => ({
          version: entry.version,
          title: '',
          summary: entry.summary,
          highlights: entry.changes,
          added: entry.added,
          changed: entry.changed,
          fixed: entry.fixed,
        }))
      );
      converted.sort((a, b) => semverCompareDesc(a.version, b.version));
      changelogEntries = converted;
      state = 'ready';
      degraded = false;
      dataSource = 'manual';
      lastLoadedAtUtc = Date.now();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load changelog.';
      if (changelogEntries.length > 0) {
        degraded = true;
        state = 'ready';
      } else {
        state = 'error';
      }
    } finally {
      refreshing = false;
    }
  }

  function formatUtcTime(value: number | null): string {
    if (!value) return 'Unknown';
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC'
    }) + ' UTC';
  }

  let scrollSpyRaf = 0;
  let scrollSpyBound: (() => void) | null = null;

  function updateActiveFromScroll() {
    const entryEls = document.querySelectorAll('.cl-entry[id]');
    if (entryEls.length === 0) return;
    const threshold = window.innerHeight * 0.35;
    let best = '';
    let bestDist = Infinity;
    entryEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // Entry is "active" when its top is above the 35% viewport line
      // and its bottom is still visible (not fully scrolled past).
      if (rect.top <= threshold && rect.bottom > 0) {
        const dist = Math.abs(rect.top - 60);
        if (dist < bestDist) {
          bestDist = dist;
          best = el.id;
        }
      }
    });
    if (best) {
      activeVersion = best.replace(/^v/i, '');
    }
  }

  function onScroll() {
    if (scrollSpyRaf) cancelAnimationFrame(scrollSpyRaf);
    scrollSpyRaf = requestAnimationFrame(updateActiveFromScroll);
  }

  function attachScrollSpy() {
    if (scrollSpyBound) return;
    scrollSpyBound = onScroll;
    window.addEventListener('scroll', scrollSpyBound, { passive: true });
    updateActiveFromScroll();
  }

  function detachScrollSpy() {
    if (scrollSpyBound) {
      window.removeEventListener('scroll', scrollSpyBound);
      scrollSpyBound = null;
    }
    if (scrollSpyRaf) {
      cancelAnimationFrame(scrollSpyRaf);
      scrollSpyRaf = 0;
    }
  }

  afterUpdate(() => {
    if (state === 'ready' && changelogEntries.length > 0) {
      requestAnimationFrame(() => attachScrollSpy());
    }
  });

  onMount(() => {
    void load();
    return () => detachScrollSpy();
  });
</script>

<SeoMeta
  title="Changelog — Classroom Quick Downloader"
  description="See what's new in each version of Classroom Quick Downloader. Detailed release notes and improvements."
  path="/changelog"
/>

<div class="cl">
  <!-- Decorative orbs -->
  <div class="cl-orbs" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="orb orb-4"></div>
    <div class="orb orb-5"></div>
  </div>
  <div class="cl-grid-bg" aria-hidden="true"></div>

  <!-- Hero -->
  <section class="cl-hero">
    <div class="cl-wrap">
      <span class="cl-label">RELEASE HISTORY</span>
      <h1 class="cl-mega">Changelog</h1>
      <p class="cl-sub">What's new in every release of Classroom Quick Downloader.</p>

      <div class="cl-hero-actions">
        <a class="cl-action-pill" href={STORE_LINKS.github + '/blob/main/user-friendly-changelog.md'} target="_blank" rel="noopener noreferrer">
          Open changelog on GitHub →
        </a>
      </div>
    </div>
  </section>

  <!-- Body -->
  <section class="cl-body-section">
    <div class="cl-wrap">
      {#if state === 'loading'}
        <div class="cl-state-card cl-reveal">
          <div class="cl-state-inner">
            <span class="cl-state-icon">⏳</span>
            <p>Loading changelog from the servers…</p>
          </div>
        </div>
      {:else if state === 'error'}
        <div class="cl-state-card cl-state-error cl-reveal">
          <div class="cl-state-inner">
            <span class="cl-state-icon">⚠️</span>
            <strong>Could not load changelog.</strong>
            <p>{error}</p>
            <button type="button" class="cl-action-pill" on:click={() => load(true)} disabled={refreshing}>Retry</button>
          </div>
        </div>
      {:else}
        {#if degraded}
          <div class="cl-state-card cl-state-warn cl-reveal">
            <div class="cl-state-inner">
              <span class="cl-state-icon">⚠️</span>
              <strong>Showing cached changelog data.</strong>
              <p>{error}</p>
            </div>
          </div>
        {/if}
        <div class="cl-layout">
          <!-- Sidebar -->
          <aside class="cl-sidebar">
            <div class="cl-sidebar-card cl-reveal">
              <h3 class="cl-sidebar-label">Versions</h3>
              <nav class="cl-sidebar-links">
                {#each changelogEntries as entry}
                  <a
                    href="#v{entry.version}"
                    class="cl-sidebar-link"
                    class:active={activeVersion === entry.version}
                    aria-label={'Version ' + entry.version}
                  >
                    <span class="cl-sv">{entry.version}</span>
                  </a>
                {/each}
              </nav>
            </div>
          </aside>

          <!-- Timeline -->
          <div class="cl-timeline">
            {#each changelogEntries as entry, i}
              <article class="cl-entry cl-reveal" id="v{entry.version}" style="transition-delay: {i * 0.05}s">
                <div class="cl-marker-col">
                  <div class="cl-dot" class:active={activeVersion === entry.version} class:latest={i === 0}></div>
                  {#if i < changelogEntries.length - 1}
                    <div class="cl-line"></div>
                  {/if}
                </div>
                <div class="cl-entry-card">
                  <div class="cl-entry-header">
                    <h2>v{entry.version}{#if i === 0}<span class="cl-latest-tag">Latest</span>{/if}</h2>
                  </div>
                  {#if entry.title}
                    <p class="cl-entry-summary"><strong>{entry.title}</strong></p>
                  {/if}
                  <p class="cl-entry-summary"><strong>Summary:</strong> {entry.summary}</p>

                  {#if entry.added.length > 0}
                    <h3 class="cl-section-title">Added</h3>
                    <ul class="cl-highlights">
                      {#each entry.added as point}
                        <li>{point}</li>
                      {/each}
                    </ul>
                  {/if}

                  {#if entry.changed.length > 0}
                    <h3 class="cl-section-title">Changed</h3>
                    <ul class="cl-highlights">
                      {#each entry.changed as point}
                        <li>{point}</li>
                      {/each}
                    </ul>
                  {/if}

                  {#if entry.fixed.length > 0}
                    <h3 class="cl-section-title">Fixed</h3>
                    <ul class="cl-highlights">
                      {#each entry.fixed as point}
                        <li>{point}</li>
                      {/each}
                    </ul>
                  {/if}

                  {#if entry.added.length === 0 && entry.changed.length === 0 && entry.fixed.length === 0 && entry.highlights.length > 0}
                    <h3 class="cl-section-title">Highlights</h3>
                    <ul class="cl-highlights">
                      {#each entry.highlights as point}
                        <li>{point}</li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              </article>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>

<style>
  /* ── Base ──────────────────────────── */
  .cl {
    --green: #1a8b55;
    --green-light: #22c55e;
    --green-bg: rgba(26, 139, 85, 0.06);
    --green-border: rgba(26, 139, 85, 0.12);
    --text: #1a1a2e;
    --text-secondary: #64748b;
    --muted: #94a3b8;
    --border-subtle: rgba(226, 232, 240, 0.35);
    --radius: 16px;
    --radius-sm: 12px;
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

  .cl-wrap { max-width: var(--wrap); margin: 0 auto; padding: 0 24px; }

  /* ── Decorative ────────────────── */
  .cl-orbs { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
  .orb { position: absolute; border-radius: 50%; filter: blur(120px); }
  .orb-1 { width: 460px; height: 460px; background: #bbf7d0; top: -5%; right: -3%; opacity: 0.28; }
  .orb-2 { width: 380px; height: 380px; background: #a5f3fc; top: 15%; left: -5%; opacity: 0.2; }
  .orb-3 { width: 340px; height: 340px; background: #e0e7ff; top: 40%; right: 10%; opacity: 0.18; }
  .orb-4 { width: 400px; height: 400px; background: #bbf7d0; top: 65%; left: 5%; opacity: 0.2; }
  .orb-5 { width: 360px; height: 360px; background: #a5f3fc; top: 85%; right: 3%; opacity: 0.16; }

  .cl-grid-bg {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0; opacity: 0.03;
    background-image: linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* ── Hero ───────────────────────── */
  .cl-hero {
    position: relative; z-index: 2;
    text-align: center;
    padding: 36px 24px 40px;
  }

  .cl-mega {
    font-size: clamp(36px, 5vw, 60px);
    font-weight: 900; line-height: 1.15;
    letter-spacing: -0.03em; margin: 0 0 16px;
    padding-bottom: 0.1em;
    background: linear-gradient(135deg, var(--green), var(--green-light), #10b981);
    background-size: 200% 200%;
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }

  .cl-sub {
    font-size: 17px; line-height: 1.7; color: var(--text); opacity: 0.7;
    max-width: 520px; margin: 0 auto 20px;
  }

  .cl-label {
    font-size: 12px; font-weight: 700; color: var(--green);
    letter-spacing: 0.08em; text-transform: uppercase;
    display: block; margin-bottom: 12px;
  }

  .cl-hero-actions {
    display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;
  }

  .cl-action-pill {
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid var(--border-subtle);
    border-radius: 999px; padding: 9px 18px;
    text-decoration: none;
    background: rgba(255,255,255,0.6);
    backdrop-filter: blur(6px);
    color: var(--text-secondary);
    font-weight: 600; font-size: 13px;
    cursor: pointer; transition: all 0.25s ease;
    box-shadow: 0 1px 3px rgba(15,20,25,0.04);
  }
  .cl-action-pill:hover {
    border-color: rgba(26,139,85,0.25);
    color: var(--green);
  }
  .cl-action-pill:disabled { opacity: 0.6; cursor: wait; }

  /* ── Body ──────────────────────── */
  .cl-body-section {
    position: relative; z-index: 2;
    padding: 16px 0 16px;
  }

  .cl-state-card {
    background: rgba(255,255,255,0.6);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--border-subtle);
    border-radius: 20px;
    padding: 48px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  }

  .cl-state-error {
    border-color: rgba(239,68,68,0.2);
  }
  .cl-state-warn {
    border-color: rgba(217,119,6,0.28);
    background: rgba(255,244,214,0.55);
    margin-bottom: 18px;
  }

  .cl-state-inner {
    max-width: 400px; margin: 0 auto;
  }

  .cl-state-icon { font-size: 36px; display: block; margin-bottom: 12px; }
  .cl-state-inner p { color: var(--text-secondary); font-size: 15px; margin: 8px 0 16px; }
  .cl-state-inner strong { font-size: 17px; }

  /* ── Layout ─────────────────────── */
  .cl-layout {
    display: grid;
    grid-template-columns: 210px 1fr;
    gap: 32px;
    align-items: start;
  }

  /* ── Sidebar ────────────────────── */
  .cl-sidebar {
    position: sticky; top: 90px;
  }

  .cl-sidebar-card {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    background: rgba(255,255,255,0.6);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    padding: 18px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  }

  .cl-sidebar-label {
    margin: 0 0 14px; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--green);
  }

  .cl-sidebar-links {
    display: flex; flex-direction: column; gap: 2px;
  }

  .cl-sidebar-link {
    text-decoration: none;
    padding: 8px 12px; border-radius: var(--radius-sm);
    display: flex; flex-direction: column;
    transition: all 0.2s ease;
    color: var(--text-secondary);
  }
  .cl-sidebar-link:hover,
  .cl-sidebar-link.active {
    background: var(--green-bg);
    color: var(--green);
  }
  .cl-sidebar-link:hover .cl-sv,
  .cl-sidebar-link.active .cl-sv { color: var(--green); }
  .cl-sv { font-weight: 700; font-size: 14px; color: var(--text); transition: color 0.2s ease; }

  /* ── Timeline ───────────────────── */
  .cl-timeline {
    display: flex; flex-direction: column;
  }

  .cl-entry {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 20px;
    padding-bottom: 24px;
  }

  .cl-marker-col {
    display: flex; flex-direction: column;
    align-items: center; flex-shrink: 0;
  }

  .cl-dot {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2.5px solid var(--green);
    background: var(--green-bg);
    flex-shrink: 0;
    box-shadow: 0 0 0 4px rgba(26,139,85,0.06);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .cl-dot.active {
    width: 18px; height: 18px;
    background: var(--green);
    border-color: var(--green);
    box-shadow: 0 0 0 5px rgba(26,139,85,0.15), 0 0 12px rgba(34,197,94,0.3);
  }

  .cl-dot.latest {
    background: var(--green);
    border-color: var(--green);
    animation: cl-dot-pulse 2s ease-in-out infinite;
  }

  @keyframes cl-dot-pulse {
    0%, 100% { box-shadow: 0 0 0 4px rgba(26,139,85,0.12), 0 0 8px rgba(34,197,94,0.2); }
    50% { box-shadow: 0 0 0 7px rgba(26,139,85,0.2), 0 0 18px rgba(34,197,94,0.35); }
  }

  .cl-line {
    width: 2px; flex: 1;
    background: linear-gradient(180deg, var(--green-light), rgba(87,187,138,0.15));
    margin-top: 8px; border-radius: 1px;
  }

  .cl-entry-card {
    background: rgba(255,255,255,0.65);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    padding: 24px;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .cl-entry-card:hover {
    transform: translateY(-2px);
    border-color: var(--green-border);
    box-shadow: 0 8px 28px rgba(0,0,0,0.06);
  }

  .cl-entry-header { margin-bottom: 10px; }

  .cl-entry-card h2 {
    margin: 0; font-size: 20px; font-weight: 800;
    letter-spacing: -0.02em; color: var(--text);
    display: flex; align-items: center; gap: 10px;
  }

  .cl-latest-tag {
    display: inline-flex; align-items: center;
    font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em;
    color: #fff;
    background: linear-gradient(135deg, var(--green), var(--green-light));
    padding: 3px 10px; border-radius: 999px;
    line-height: 1.4;
  }

  .cl-section-title {
    margin: 14px 0 8px;
    font-size: 12px;
    font-weight: 800;
    color: var(--green);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .cl-entry-summary {
    margin: 0 0 12px; color: var(--text-secondary);
    line-height: 1.75; font-size: 14px;
  }

  .cl-highlights {
    margin: 0; padding: 0; list-style: none;
    display: flex; flex-direction: column; gap: 6px;
  }

  .cl-highlights li {
    position: relative; padding-left: 20px;
    color: var(--text-secondary);
    line-height: 1.65; font-size: 14px;
  }

  .cl-highlights li::before {
    content: '';
    position: absolute; left: 0; top: 9px;
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--green-light);
  }

  .cl-reveal {
    opacity: 1;
    transform: none;
  }

  .cl-action-pill,
  .cl-state-card,
  .cl-sidebar-card,
  .cl-entry-card {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  /* ── Responsive ────────────────── */
  @media (max-width: 900px) {
    .cl-layout {
      grid-template-columns: 1fr;
      gap: 20px;
    }

    .cl-sidebar { position: static; }

    .cl-sidebar-card {
      padding: 12px;
      border-radius: 14px;
    }

    .cl-sidebar-links {
      flex-direction: row;
      flex-wrap: nowrap;
      gap: 8px;
      overflow-x: auto; -webkit-overflow-scrolling: touch;
      scrollbar-width: none; -ms-overflow-style: none;
      padding-bottom: 2px;
    }
    .cl-sidebar-links::-webkit-scrollbar { display: none; }
    .cl-sidebar-link {
      white-space: nowrap;
      flex-shrink: 0;
      min-width: 114px;
      border: 1px solid var(--border-subtle);
      background: rgba(255, 255, 255, 0.76);
      border-radius: 12px;
      padding: 10px 12px;
    }
    .cl-sidebar-link:hover,
    .cl-sidebar-link.active {
      border-color: rgba(26, 139, 85, 0.22);
    }

    .cl-entry {
      grid-template-columns: 20px 1fr;
      gap: 14px; padding-bottom: 20px;
    }

    .cl-entry-card { padding: 20px; }
  }

  @media (max-width: 600px) {
    .cl-hero { padding: 40px 16px 32px; }
    .cl-hero-actions { flex-direction: column; align-items: center; }
    .cl-state-card { padding: 32px 20px; }
    .cl-sidebar-link {
      min-width: 102px;
      padding: 9px 10px;
    }
    .cl-sv { font-size: 13px; }
  }
</style>
