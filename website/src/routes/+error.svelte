<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import SeoMeta from '$lib/components/SeoMeta.svelte';

  $: statusCode = $page.status;
  $: errorTitle = statusCode === 404 ? 'Page not found' : statusCode === 403 ? 'Access restricted' : 'Something went wrong';
  $: errorDescription = (() => {
    if (statusCode === 404) {
      return "The page you're looking for doesn't exist or has been moved.";
    }
    if (statusCode === 403) {
      return "You don't have permission to access this page right now.";
    }
    return $page.error?.message ?? 'An unexpected error occurred.';
  })();
  $: hintText =
    statusCode === 403
      ? 'If you think this is a mistake, refresh and try again later.'
      : 'Try checking the URL for typos, or use the navigation above.';
</script>

<SeoMeta
  title={`${$page.status} — Classroom Quick Downloader`}
  description="Error page for Classroom Quick Downloader."
  path="/404"
  noindex={true}
/>

<div class="err">
  <!-- Decorative orbs -->
  <div class="err-orbs" aria-hidden="true">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
  </div>
  <div class="err-grid-bg" aria-hidden="true"></div>

  <section class="err-hero">
    <div class="err-wrap">
      <div class="err-glitch-code" aria-hidden="true">{$page.status}</div>
      <h1 class="err-mega">{errorTitle}</h1>
      <p class="err-sub">{errorDescription}</p>

      <div class="err-actions">
        <a class="err-btn err-btn-primary" href="{base}/">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Go home
        </a>
        <a class="err-btn err-btn-secondary" href="{base}/faq">
          Browse FAQ
        </a>
      </div>

      <div class="err-hint">
        <span class="err-hint-icon">💡</span>
        {hintText}
      </div>
    </div>
  </section>
</div>

<style>
  /* ── Base ──────────────────────────── */
  .err {
    --green: #1a8b55;
    --green-light: #22c55e;
    --text: #1a1a2e;
    --text-secondary: #64748b;
    --muted: #94a3b8;
    --border-subtle: rgba(226, 232, 240, 0.35);
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    color: var(--text);
    overflow: clip;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 0 auto;
    justify-content: center;
    align-items: center;
  }

  .err-wrap { max-width: 680px; margin: 0 auto; padding: 0 24px; }

  /* ── Decorative ────────────────── */
  .err-orbs {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0;
  }
  .orb { position: absolute; border-radius: 50%; filter: blur(120px); }
  .orb-1 { width: 480px; height: 480px; background: #bbf7d0; top: -10%; right: -8%; opacity: 0.25; }
  .orb-2 { width: 400px; height: 400px; background: #fca5a5; top: 30%; left: -10%; opacity: 0.15; }
  .orb-3 { width: 360px; height: 360px; background: #e0e7ff; top: 60%; right: 10%; opacity: 0.18; }

  .err-grid-bg {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; z-index: 0; opacity: 0.03;
    background-image: linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* ── Hero ───────────────────────── */
  .err-hero {
    position: relative; z-index: 2;
    text-align: center;
    padding: 80px 24px 60px;
  }

  .err-glitch-code {
    font-size: clamp(100px, 18vw, 200px);
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.04em;
    background: linear-gradient(135deg, rgba(26,139,85,0.12), rgba(34,197,94,0.08));
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: -10px;
    user-select: none;
  }

  .err-mega {
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

  .err-sub {
    font-size: 17px; line-height: 1.7;
    color: var(--text); opacity: 0.65;
    max-width: 480px; margin: 0 auto 32px;
  }

  /* ── Actions ────────────────────── */
  .err-actions {
    display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
    margin-bottom: 40px;
  }

  .err-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 14px 28px; font-size: 15px; font-weight: 700;
    border-radius: 14px; text-decoration: none;
    transition: all 0.25s ease;
  }

  .err-btn-primary {
    background: linear-gradient(135deg, var(--green), var(--green-light));
    color: #fff;
    box-shadow: 0 4px 20px rgba(26,139,85,0.35), 0 0 40px rgba(26,139,85,0.15);
  }
  .err-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 28px rgba(26,139,85,0.45), 0 0 60px rgba(26,139,85,0.2);
  }

  .err-btn-secondary {
    background: rgba(255,255,255,0.55);
    color: var(--text);
    border: 1.5px solid var(--border-subtle);
  }
  .err-btn-secondary:hover {
    border-color: rgba(26,139,85,0.25);
    color: var(--green);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.05);
  }

  /* ── Hint ────────────────────────── */
  .err-hint {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 14px; color: var(--muted); font-weight: 500;
    padding: 10px 20px;
    border-radius: 999px;
    background: rgba(255,255,255,0.5);
    border: 1px solid var(--border-subtle);
  }

  .err-hint-icon { font-size: 16px; }

  /* ── Responsive ────────────────── */
  @media (max-width: 600px) {
    .err-hero { padding: 48px 16px 40px; }
    .err-actions { flex-direction: column; align-items: center; }
    .err-glitch-code { margin-bottom: -16px; }
  }
</style>
