<script lang="ts">
  import type { WebsiteTrendsSeries } from '$lib/types/public';

  export let trends: WebsiteTrendsSeries | null = null;
  /** Success rate in percent (0–100), or null when unknown. */
  export let successRate: number | null = null;

  const WIDTH = 100;
  const HEIGHT = 30;

  $: points = buildPoints(trends);
  $: delta = trends?.weekOverWeekPercent ?? null;

  function buildPoints(series: WebsiteTrendsSeries | null): string {
    if (!series || series.daily.length < 2) return '';
    const values = series.daily.map((day) => Math.max(0, day.downloads));
    const max = Math.max(...values);
    if (max <= 0) return '';
    const step = WIDTH / (values.length - 1);
    return values
      .map((value, index) => {
        const x = index * step;
        const y = HEIGHT - (value / max) * (HEIGHT - 2) - 1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  function formatDelta(delta: number | null): string {
    if (delta === null) return '';
    return `${delta >= 0 ? '+' : ''}${delta}%`;
  }
</script>

{#if trends && points}
  <div class="trend-strip glass-panel glass-hover">
    <div class="trend-spark" aria-hidden="true">
      <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none">
        <polyline {points} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="trend-meta">
      <span class="trend-title">Downloads · last {trends.daily.length} days</span>
      {#if delta !== null}
        <span class="trend-delta" class:trend-up={delta >= 0} class:trend-down={delta < 0}>
          {formatDelta(delta)} vs previous week
        </span>
      {/if}
    </div>
    {#if successRate !== null}
      <span class="success-badge">{successRate.toFixed(1)}% success rate</span>
    {/if}
  </div>
{/if}

<style>
  .trend-strip {
    display: flex;
    align-items: center;
    gap: 18px;
    max-width: 780px;
    margin: 0 auto 34px;
    padding: 16px 22px;
    border-radius: 16px;
    color: var(--green, #1a8b55);
  }

  .trend-spark {
    flex: 1 1 60%;
    min-width: 0;
  }

  .trend-spark svg {
    display: block;
    width: 100%;
    height: 40px;
    overflow: visible;
  }

  .trend-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 0 0 auto;
    text-align: right;
  }

  .trend-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-secondary, #64748b);
  }

  .trend-delta {
    font-size: 14px;
    font-weight: 700;
  }

  .trend-up { color: var(--green, #1a8b55); }
  .trend-down { color: #c2410c; }

  .success-badge {
    flex: 0 0 auto;
    font-size: 13px;
    font-weight: 700;
    padding: 7px 14px;
    border-radius: 999px;
    background: rgba(26, 139, 85, 0.1);
    color: var(--green, #1a8b55);
  }

  @media (max-width: 640px) {
    .trend-strip {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      margin: 0 auto 26px;
    }

    .trend-meta { text-align: left; }
  }

  @media (prefers-reduced-motion: reduce) {
    .trend-strip { transition: none; }
  }
</style>
