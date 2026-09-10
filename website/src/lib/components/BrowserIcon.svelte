<script lang="ts">
  // Shared Firefox/Edge glyph for the navbar install surfaces. `uid` must
  // be unique per usage site: each instance carries its own gradient defs,
  // and duplicate SVG ids would make every instance resolve the first one.
  export let browser: 'firefox' | 'edge';
  export let uid: string;
</script>

{#if browser === 'firefox'}
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="cqd-ff-grad-{uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffdf3c" />
        <stop offset=".55" stop-color="#ff9500" />
        <stop offset="1" stop-color="#e8590c" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#cqd-ff-grad-{uid})" />
    <path
      d="M12 5.4c-3.7 0-6.2 2.7-6.2 6.1 0 3.6 2.8 6.7 6.6 6.7 3.5 0 5.7-2.4 5.7-5 0-1.9-1.2-3.2-2.7-3.2-1 0-1.9.6-1.9 1.6 0 .7.5 1.2 1.1 1.2.4 0 .7-.2.7-.6 0-.2-.1-.3-.1-.5 0-.4.4-.7.9-.7.9 0 1.6.8 1.6 2 0 1.9-1.6 3.3-3.7 3.3-2.9 0-4.9-2.3-4.9-4.8 0-2.9 2.3-5.1 5.2-5.1.8 0 1.5.2 2.1.4C15.6 6.2 13.9 5.4 12 5.4Z"
      fill="#fff"
      fill-opacity=".92"
    />
  </svg>
{:else}
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="cqd-edge-grad-{uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#37d6c3" />
        <stop offset=".55" stop-color="#1a9bd7" />
        <stop offset="1" stop-color="#0f6ab4" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#cqd-edge-grad-{uid})" />
    <path
      d="M7.2 12.5c0-3 2.5-5.2 5.2-5.2 2.3 0 4 1.3 4.4 3.2-.7-.9-1.9-1.4-3.1-1.4-2.5 0-4.3 1.9-4.3 4.2 0 2.9 2.3 5.2 5.5 5.2-.9.5-2 .9-3.2.9-2.7 0-4.5-3-4.5-6.9Z"
      fill="#fff"
      fill-opacity=".92"
    />
  </svg>
{/if}
