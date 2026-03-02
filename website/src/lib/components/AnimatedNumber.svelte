<script lang="ts">
  /**
   * AnimatedNumber — lightweight animated number text renderer.
   * Keeps numeric glyph spacing natural (no per-digit layout engine).
   */
  import { onMount } from 'svelte';

  export let value: number = 0;
  export let suffix: string = '';
  export let prefix: string = '';
  export let format: Intl.NumberFormatOptions = { useGrouping: true };
  export let animated = false;
  export let animateOnView = true;
  export let threshold = 0;
  export let rootMargin = '0px 0px -8% 0px';

  let hostEl: HTMLSpanElement | null = null;
  let displayValue = 0;
  let formattedValue = '0';
  let hasAnimatedInView = false;
  let rafId: number | null = null;

  function safeNumber(input: number): number {
    return Number.isFinite(input) ? input : 0;
  }

  function inferPrecision(input: number): number {
    const fromFormat = typeof format.maximumFractionDigits === 'number'
      ? format.maximumFractionDigits
      : typeof format.minimumFractionDigits === 'number'
        ? format.minimumFractionDigits
        : null;
    if (fromFormat !== null) return Math.max(0, Math.min(6, Math.round(fromFormat)));
    if (Number.isInteger(input)) return 0;
    const digits = String(input).split('.')[1]?.length ?? 0;
    return Math.max(0, Math.min(6, digits));
  }

  function normalizeForDisplay(input: number): number {
    const precision = inferPrecision(value);
    const safe = safeNumber(input);
    if (precision <= 0) return Math.round(safe);
    return Number(safe.toFixed(precision));
  }

  function stopAnimation(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function animateTo(next: number): void {
    const target = safeNumber(next);
    stopAnimation();

    const from = displayValue;
    const delta = target - from;
    if (Math.abs(delta) < 0.0001) {
      displayValue = target;
      return;
    }

    const durationMs = 760;
    const startTime = performance.now();

    const tick = (now: number): void => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      displayValue = from + delta * eased;
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
        displayValue = target;
      }
    };

    rafId = requestAnimationFrame(tick);
  }

  onMount(() => {
    const initial = safeNumber(value);

    if (!animated) {
      displayValue = initial;
      hasAnimatedInView = true;
      return;
    }

    if (!animateOnView) {
      hasAnimatedInView = true;
      displayValue = 0;
      animateTo(initial);
      return;
    }
    if (!hostEl || typeof IntersectionObserver === 'undefined') {
      hasAnimatedInView = true;
      kickstart();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!isInView) {
              isInView = true;
              hasAnimatedInView = true;
              kickstart();
            } else if (!priming) {
              displayValue = value;
            }
          } else {
            isInView = false;
          }
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(hostEl);
    return () => observer.disconnect();
  });

  $: if (!animated && displayValue !== value) {
    displayValue = value;
  }

  $: if (animated && hasAnimatedInView && !priming && displayValue !== value) {
    displayValue = value;
  }
</script>

<span bind:this={hostEl} class="animated-number">
  <NumberFlow
    value={displayValue}
    {format}
    {prefix}
    {suffix}
    {animated}
    transformTiming={noHorizontalTransform}
    spinTiming={animated ? defaultSpinTiming : undefined}
    plugins={[continuous]}
    willChange
  />
</span>

<style>
  .animated-number {
    display: inline-flex;
    align-items: baseline;
    font-variant-numeric: tabular-nums;
  }
</style>
