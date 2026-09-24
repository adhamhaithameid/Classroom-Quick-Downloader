<script lang="ts">
  // Browser brand mark rendered from the document-wide sprite
  // (BrowserIconSprite), so every instance shares one set of gradient
  // definitions instead of carrying its own copy.
  export let browser: 'firefox' | 'edge' | 'chrome';
</script>

<svg aria-hidden="true">
  <use href={`#cqd-logo-${browser}`} />
</svg>
