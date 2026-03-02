<script lang="ts">
  /**
   * AnimatedNumber — lightweight animated number text renderer.
   * Keeps numeric glyph spacing natural (no per-digit layout engine).
   */
  import { onMount } from 'svelte';
  import NumberFlow, { NumberFlowElement, continuous } from '@number-flow/svelte';

  export let value: number = 0;
  export let suffix: string = '';
  export let prefix: string = '';
  export let format: Intl.NumberFormatOptions = { useGrouping: true };
  export let animated = false;
  export let animateOnView = true;
  export let threshold = 0;
  export let rootMargin = '0px 0px -8% 0px';

  let hostEl: HTMLSpanElement | null = null;
  let hasAnimatedInView = false;
  let isInView = false;
  let priming = false;
  let displayValue = 0;
  const noHorizontalTransform: EffectTiming = { duration: 0 };
  const defaultSpinTiming: EffectTiming = NumberFlowElement.defaultProps.transformTiming;

  function kickstart(): void {
    priming = true;
    displayValue = 0;
    requestAnimationFrame(() => {
      displayValue = value;
      priming = false;
    });
  }

  onMount(() => {
    if (!animated) {
      hasAnimatedInView = true;
      isInView = true;
      displayValue = value;
      return;
    }
    if (!animateOnView) {
      hasAnimatedInView = true;
      isInView = true;
      kickstart();
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
