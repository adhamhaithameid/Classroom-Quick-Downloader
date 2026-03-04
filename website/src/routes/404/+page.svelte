<script lang="ts">
  import { base } from '$app/paths';
  import SeoMeta from '$lib/components/SeoMeta.svelte';
</script>

<SeoMeta
  title="404 — Classroom Quick Downloader"
  description="The page you're looking for doesn't exist. Head back to the overview or explore our FAQ."
  path="/404"
  noindex={true}
/>

<div class="nf">
  <!-- Decorative orbs -->
  <div class="nf-orbs" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
  </div>
  <div class="nf-grid-bg" aria-hidden="true"></div>

  <section class="nf-hero">
    <div class="nf-wrap">
      <div class="nf-glitch-code" aria-hidden="true">404</div>
      <h1 class="nf-mega">Page not found</h1>
      <p class="nf-sub">The page you're looking for doesn't exist or has been moved.</p>

      <div class="nf-actions">
        <a class="nf-btn nf-btn-primary" href="{base}/overview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Go home
        </a>
        <a class="nf-btn nf-btn-secondary" href="{base}/faq">
          Browse FAQ
        </a>
      </div>
    </div>
  </section>

  <!-- Quick Links -->
  <section class="nf-links-section">
    <div class="nf-wrap">
      <div class="nf-links-grid">
        <a class="nf-link-card" href="{base}/overview">
          <span class="nf-link-icon">🏠</span>
          <div>
            <strong>Overview</strong>
            <p>Learn what Classroom Quick Downloader does and how it works.</p>
          </div>
        </a>
        <a class="nf-link-card" href="{base}/faq">
          <span class="nf-link-icon">❓</span>
          <div>
            <strong>FAQ</strong>
            <p>Find answers to commonly asked questions about the extension.</p>
          </div>
        </a>
        <a class="nf-link-card" href="{base}/changelog">
          <span class="nf-link-icon">📋</span>
          <div>
            <strong>Changelog</strong>
            <p>See what's new in the latest releases and version history.</p>
          </div>
        </a>
      </div>
    </div>
  </section>
</div>

<style>
  /* ── Base ──────────────────────────── */
  .nf {
    --green: #1a8b55;
    --green-light: #22c55e;
    --text: #1a1a2e;
    --text-secondary: #64748b;
    --muted: #94a3b8;
    --border-subtle: rgba(226, 232, 240, 0.35);
    font-family: var(--font-ui), sans-serif;
    color: var(--text);
    overflow: clip;
    position: relative;
    width: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 0 auto;
    justify-content: center;
    align-items: center;
  }

  .nf-wrap { max-width: 680px; margin: 0 auto; padding: 0 24px; width: 100%; }

  /* ── Decorative ────────────────── */
  .nf-orbs {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0;
  }
  .orb { position: absolute; border-radius: 50%; filter: blur(120px); }
  .orb-1 { width: 480px; height: 480px; background: #bbf7d0; top: -10%; right: -8%; opacity: 0.25; }
  .orb-2 { width: 400px; height: 400px; background: #fca5a5; top: 30%; left: -10%; opacity: 0.15; }
  .orb-3 { width: 360px; height: 360px; background: #e0e7ff; top: 60%; right: 10%; opacity: 0.18; }

  .nf-grid-bg {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0; opacity: 0.03;
    background-image: linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* ── Hero ───────────────────────── */
  .nf-hero {
    position: relative; z-index: 2;
    text-align: center;
    padding: 80px 24px 40px;
  }

  .nf-glitch-code {
    font-size: clamp(100px, 18vw, 200px);
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.04em;
    background: linear-gradient(135deg, rgba(26,139,85,0.12), rgba(34,197,94,0.08));
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: -10px;
    user-select: none;
    animation: nf-float 6s ease-in-out infinite;
  }

  @keyframes nf-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .nf-mega {
    font-size: clamp(28px, 4vw, 48px);
    font-weight: 900;
    line-height: 1.15;
    letter-spacing: -0.03em;
    margin: 0 0 16px;
    padding-bottom: 0.1em;
    background: linear-gradient(135deg, var(--green), var(--green-light), #10b981);
    background-size: 200% 200%;
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }

  .nf-sub {
    font-size: 17px; line-height: 1.7;
    color: var(--text); opacity: 0.65;
    max-width: 480px; margin: 0 auto 32px;
  }

  /* ── Actions ────────────────────── */
  .nf-actions {
    display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
    margin-bottom: 40px;
  }

  .nf-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 14px 28px; font-size: 15px; font-weight: 700;
    border-radius: 14px; text-decoration: none;
    transition: all 0.25s ease;
  }

  .nf-btn-primary {
    background: var(--green);
    color: #fff;
    box-shadow: 0 4px 20px rgba(26,139,85,0.25);
  }
  .nf-btn-primary:hover {
    background: var(--green-light);
    transform: translateY(-2px);
    box-shadow: 0 6px 28px rgba(26,139,85,0.35);
  }

  .nf-btn-secondary {
    background: rgba(255,255,255,0.55);
    color: var(--text);
    border: 1.5px solid var(--border-subtle);
  }
  .nf-btn-secondary:hover {
    border-color: rgba(26,139,85,0.25);
    color: var(--green);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.05);
  }

  /* ── Quick Links ─────────────────── */
  .nf-links-section {
    position: relative; z-index: 2;
    padding: 0 24px 60px;
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
  }

  .nf-links-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .nf-link-card {
    display: flex; align-items: flex-start; gap: 14px;
    background: rgba(255,255,255,0.6);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 22px 20px;
    text-decoration: none;
    color: var(--text);
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    animation: nf-rise 0.5s ease both;
  }

  .nf-link-card:nth-child(1) { animation-delay: 0.05s; }
  .nf-link-card:nth-child(2) { animation-delay: 0.1s; }
  .nf-link-card:nth-child(3) { animation-delay: 0.15s; }

  .nf-link-card:hover {
    transform: translateY(-4px);
    border-color: rgba(26,139,85,0.2);
    box-shadow: 0 16px 40px rgba(0,0,0,0.08);
  }

  .nf-link-icon {
    font-size: 28px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .nf-link-card strong {
    display: block;
    font-size: 15px; font-weight: 800;
    letter-spacing: -0.01em;
    margin-bottom: 4px;
  }

  .nf-link-card p {
    margin: 0;
    font-size: 13px; line-height: 1.6;
    color: var(--text-secondary);
  }

  @keyframes nf-rise {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Responsive ────────────────── */
  @media (max-width: 900px) {
    .nf-links-grid {
      grid-template-columns: 1fr;
      max-width: 480px;
      margin: 0 auto;
    }
  }

  @media (max-width: 600px) {
    .nf-hero { padding: 48px 16px 32px; }
    .nf-actions { flex-direction: column; align-items: center; }
    .nf-glitch-code { margin-bottom: -16px; }
    .nf-links-section { padding: 0 16px 40px; }
    .nf-link-card { padding: 18px 16px; }
  }
</style>
