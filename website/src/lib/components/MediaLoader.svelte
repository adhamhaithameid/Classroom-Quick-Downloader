<script lang="ts">
  import { onMount, tick } from 'svelte';

  /** Media type: 'image' or 'video' */
  export let type: 'image' | 'video' = 'image';
  /** Media source URL */
  export let src: string;
  /** Alt text for images */
  export let alt: string = '';
  /** CSS class to pass through to the media element */
  let className: string = '';
  export { className as class };
  /** Extra attributes for <video> */
  export let autoplay: boolean = false;
  export let loop: boolean = false;
  export let muted: boolean = false;
  export let playsinline: boolean = false;
  export let preload: '' | 'auto' | 'none' | 'metadata' = 'metadata';
  /** Accessible label for video */
  export let ariaLabel: string = '';
  /** Lazy load images */
  export let loading: 'lazy' | 'eager' = 'eager';
  /** Aspect ratio hint for the skeleton (e.g. '16/9') */
  export let aspectRatio: string = '';
  /** When true, skip skeleton and show content immediately */
  export let eager: boolean = false;

  type MediaState = 'loading' | 'loaded' | 'error';
  let state: MediaState = eager ? 'loaded' : 'loading';
  let imgEl: HTMLImageElement;
  let videoEl: HTMLVideoElement;
  let retryKey = 0;

  function handleLoad() {
    if (state !== 'loaded') state = 'loaded';
  }

  function handleError() {
    if (state !== 'loaded') state = 'error';
  }

  function retry() {
    state = 'loading';
    retryKey++;
    // After key change causes re-render, check again
    tick().then(checkAlreadyReady);
  }

  /** Check if the media element is already ready (cached / fast load) */
  function checkAlreadyReady() {
    if (state !== 'loading') return;
    if (type === 'image' && imgEl?.complete && imgEl?.naturalWidth > 0) {
      state = 'loaded';
    } else if (type === 'video' && videoEl?.readyState >= 2) {
      // readyState 2 = HAVE_CURRENT_DATA, enough to display first frame
      state = 'loaded';
    }
  }

  onMount(() => {
    checkAlreadyReady();
    // For videos, also poll briefly in case events were missed
    if (type === 'video') {
      const interval = setInterval(() => {
        if (videoEl?.readyState >= 2) {
          state = 'loaded';
          clearInterval(interval);
        }
      }, 100);
      // Stop polling after 30s — if still not loaded, events will handle it
      setTimeout(() => clearInterval(interval), 30000);
      return () => clearInterval(interval);
    }
  });
</script>

<div class="ml" class:ml-loaded={state === 'loaded'} style={aspectRatio ? `aspect-ratio: ${aspectRatio}` : ''}>
  <!-- Shimmer skeleton (absolutely positioned overlay, disappears when loaded) -->
  {#if state !== 'error'}
    <div class="ml-skeleton" class:ml-skeleton-out={state === 'loaded'} aria-hidden="true">
      <div class="ml-shimmer"></div>
      <div class="ml-skeleton-icon">
        {#if type === 'video'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Error state -->
  {#if state === 'error'}
    <div class="ml-error">
      <div class="ml-error-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="28" height="28">
          <path d="M1 1l5.2 5.2M17.8 17.8 23 23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      <p class="ml-error-text">Couldn't load this {type === 'video' ? 'video' : 'image'}</p>
      <p class="ml-error-hint">Check your connection and try again</p>
      <button class="ml-retry-btn" on:click={retry} type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        Retry
      </button>
    </div>
  {/if}

  <!-- Actual media element (always in DOM, hidden until loaded) -->
  {#if type === 'video'}
    {#key retryKey}
      <!-- svelte-ignore a11y-media-has-caption -->
      <video
        bind:this={videoEl}
        class="{className} ml-media"
        class:ml-visible={state === 'loaded'}
        {autoplay}
        {loop}
        {muted}
        {playsinline}
        {preload}
        aria-label={ariaLabel}
        on:loadeddata={handleLoad}
        on:canplay={handleLoad}
        on:canplaythrough={handleLoad}
        on:error={handleError}
      >
        <source src={src} type="video/mp4" />
      </video>
    {/key}
  {:else}
    {#key retryKey}
      <img
        bind:this={imgEl}
        class="{className} ml-media"
        class:ml-visible={state === 'loaded'}
        {src}
        {alt}
        loading={loading}
        decoding="async"
        on:load={handleLoad}
        on:error={handleError}
      />
    {/key}
  {/if}

  <!-- Slot for overlay content (expand buttons etc.) — only shown when loaded -->
  {#if state === 'loaded'}
    <slot />
  {/if}
</div>

<style>
  .ml {
    position: relative;
    overflow: hidden;
    min-height: 120px;
  }

  /* ── Skeleton ────────────────────── */
  .ml-skeleton {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f1f5f9 0%, #e8eef3 50%, #f1f5f9 100%);
    z-index: 2;
    opacity: 1;
    transition: opacity 0.4s ease;
    pointer-events: none;
  }

  .ml-skeleton-out {
    opacity: 0;
  }

  .ml-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(26, 139, 85, 0.04) 20%,
      rgba(26, 139, 85, 0.08) 50%,
      rgba(26, 139, 85, 0.04) 80%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: mlShimmer 1.8s ease-in-out infinite;
  }

  .ml-skeleton-icon {
    position: relative;
    z-index: 1;
    color: #94a3b8;
    opacity: 0.5;
    animation: mlPulse 2s ease-in-out infinite;
  }

  /* ── Error ────────────────────── */
  .ml-error {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    z-index: 2;
    padding: 24px;
  }

  .ml-error-icon {
    color: #94a3b8;
    margin-bottom: 4px;
  }

  .ml-error-text {
    margin: 0;
    font-family: var(--font-ui, 'Avenir Next'), sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #475569;
  }

  .ml-error-hint {
    margin: 0;
    font-family: var(--font-ui, 'Plus Jakarta Sans'), sans-serif;
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
  }

  .ml-retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 8px 18px;
    font-family: var(--font-ui, 'Plus Jakarta Sans'), sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: var(--green, #1a8b55);
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 12px rgba(26, 139, 85, 0.2);
  }

  .ml-retry-btn:hover {
    background: var(--green-light, #22c55e);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(26, 139, 85, 0.3);
  }

  /* ── Media reveal ───────────────── */
  .ml-media {
    display: block;
    width: 100%;
    height: auto;
    opacity: 0;
    transition: opacity 0.35s ease;
  }

  .ml-media.ml-visible {
    opacity: 1;
  }

  /* When loaded, collapse the container to fit content */
  .ml.ml-loaded {
    min-height: unset;
  }

  /* ── Animations ────────────────── */
  @keyframes mlShimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes mlPulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50%      { opacity: 0.7; transform: scale(1.08); }
  }
</style>
