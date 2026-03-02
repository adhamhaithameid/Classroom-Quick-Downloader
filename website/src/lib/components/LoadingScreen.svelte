<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import logo from '$lib/assets/cqd-logo.svg';

  let visible = false;
  let fadeOut = false;
  let showTimeout: ReturnType<typeof setTimeout> | null = null;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;

  onMount(async () => {
    const { navigating } = await import('$app/stores');
    unsubscribe = navigating.subscribe((nav) => {
      if (nav) {
        fadeOut = false;
        if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
        showTimeout = setTimeout(() => { visible = true; }, 150);
      } else {
        if (showTimeout) { clearTimeout(showTimeout); showTimeout = null; }
        if (visible) {
          fadeOut = true;
          hideTimeout = setTimeout(() => { visible = false; fadeOut = false; }, 320);
        }
      }
    });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
    if (showTimeout) clearTimeout(showTimeout);
    if (hideTimeout) clearTimeout(hideTimeout);
  });
</script>

{#if visible}
  <div class="ld" class:ld-out={fadeOut} aria-live="polite" aria-label="Loading page">
    <div class="ld-backdrop"></div>
    <div class="ld-center">
      <div class="ld-logo-ring">
        <img src={logo} alt="CQD" class="ld-logo" />
        <svg class="ld-spinner" viewBox="0 0 56 56" fill="none">
          <circle cx="28" cy="28" r="26" stroke="rgba(26,139,85,0.12)" stroke-width="3" />
          <circle cx="28" cy="28" r="26" stroke="url(#ld-grad)" stroke-width="3" stroke-linecap="round" stroke-dasharray="120 200" class="ld-arc" />
          <defs>
            <linearGradient id="ld-grad" x1="0" y1="0" x2="56" y2="56">
              <stop offset="0%" stop-color="#1a8b55" />
              <stop offset="100%" stop-color="#22c55e" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <p class="ld-text">Loading</p>
    </div>
  </div>
{/if}

<style>
  .ld {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: ldIn 0.2s ease-out;
  }

  .ld-out {
    animation: ldOut 0.3s ease-in forwards;
  }

  .ld-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(248, 250, 252, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .ld-center {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .ld-logo-ring {
    position: relative;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ld-logo {
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }

  .ld-spinner {
    position: absolute;
    inset: 0;
    width: 56px;
    height: 56px;
    animation: ldSpin 1s linear infinite;
  }

  .ld-arc {
    transform-origin: center;
  }

  .ld-text {
    margin: 0;
    font-family: var(--font-ui), sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    letter-spacing: 0.02em;
  }

  @keyframes ldIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes ldOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  @keyframes ldSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
