<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { BalloonParticle } from '$lib/celebration/balloons';

  export let visible = false;
  export let particles: readonly BalloonParticle[] = [];
  export let idPrefix = 'cqd-balloons';

  function gradientId(kind: string, id: number): string {
    return `${idPrefix}-${kind}-${id}`;
  }

  function stringPath(p: BalloonParticle): string {
    return `M25 48 C${23 - p.wobbleAmplitude * 0.11} ${52 + p.stringLength * 0.15} ${27 + p.wobbleAmplitude * 0.11} ${57 + p.stringLength * 0.5} 25 ${48 + p.stringLength}`;
  }
</script>

{#if visible && particles.length > 0}
  <div class="l2-balloon-fullscreen" transition:fade={{ duration: 240 }} aria-hidden="true">
    {#each particles as p (p.id)}
      {@const fillId = gradientId('fill', p.id)}
      {@const glowId = gradientId('glow', p.id)}
      {@const strId = gradientId('string', p.id)}
      <div
        class="l2-balloon-wrap"
        style="left:{p.x}px;top:{p.y}px;transform:translate3d(-50%,0,0) rotate({p.rotation}deg) scale({p.scale});opacity:{p.opacity};z-index:{Math.round(p.depth * 10)}"
      >
        <svg viewBox="0 0 50 72" class="l2-balloon-svg" style="width:{p.size}px;height:{p.size * 1.44}px">
          <defs>
            {#if p.simpleGradients}
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color={p.accentColor} stop-opacity="0.95" />
                <stop offset="100%" stop-color={p.shadowColor} stop-opacity="0.96" />
              </linearGradient>
            {:else}
              <radialGradient id={fillId} cx="34%" cy="26%" r="70%">
                <stop offset="0%" stop-color={p.accentColor} stop-opacity="0.96" />
                <stop offset="50%" stop-color={p.color} stop-opacity="0.98" />
                <stop offset="100%" stop-color={p.shadowColor} stop-opacity="0.98" />
              </radialGradient>
            {/if}
            <radialGradient id={glowId} cx="50%" cy="50%" r="55%">
              <stop offset="0%" stop-color={p.color} stop-opacity="0.2" />
              <stop offset="100%" stop-color={p.color} stop-opacity="0.02" />
            </radialGradient>
            <linearGradient id={strId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color={p.stringColor} stop-opacity="0.95" />
              <stop offset="100%" stop-color={p.stringColor} stop-opacity="0.45" />
            </linearGradient>
          </defs>

          <ellipse cx="25" cy="24" rx="22" ry="26" fill={`url(#${glowId})`} />
          <ellipse cx="25" cy="24" rx="18.5" ry="22.5" fill={`url(#${fillId})`} />
          <ellipse cx="25" cy="24" rx="18.5" ry="22.5" fill="none" stroke={p.shadowColor} stroke-width="0.7" opacity="0.38" />
          <ellipse cx="18.5" cy="15.5" rx="6.5" ry="9" fill="#ffffff" opacity="0.42" transform="rotate(-23 18.5 15.5)" />
          <ellipse cx="14.8" cy="22.5" rx="2.4" ry="3.8" fill="#ffffff" opacity="0.2" transform="rotate(-18 14.8 22.5)" />
          <path d="M21.5 45 C23.3 48.6 26.7 48.6 28.5 45 L25 51.2 Z" fill={p.shadowColor} opacity="0.85" />
          <circle cx="25" cy="47.2" r="1.15" fill={p.color} opacity="0.84" />
          <path
            d={stringPath(p)}
            fill="none"
            stroke={`url(#${strId})`}
            stroke-width="0.58"
            opacity="0.66"
            stroke-linecap="round"
          />
        </svg>
      </div>
    {/each}
  </div>
{/if}

<style>
  .l2-balloon-fullscreen {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    pointer-events: none;
    overflow: hidden;
    isolation: isolate;
  }

  .l2-balloon-wrap {
    position: absolute;
    will-change: transform, opacity;
    transform-origin: 50% 22%;
    contain: layout paint;
  }

  .l2-balloon-svg {
    filter: drop-shadow(0 9px 16px rgba(15, 23, 42, 0.15)) drop-shadow(0 3px 6px rgba(15, 23, 42, 0.08));
    transform-origin: 50% 14%;
  }

  @media (prefers-reduced-motion: reduce) {
    .l2-balloon-wrap,
    .l2-balloon-svg {
      animation: none !important;
    }
  }
</style>
