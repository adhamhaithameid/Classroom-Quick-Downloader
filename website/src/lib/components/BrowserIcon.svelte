<script lang="ts">
  // Firefox/Edge brand mark rendered from the document-wide sprite
  // (BrowserIconSprite), so every instance shares one set of gradient
  // definitions instead of carrying its own copy.
  export let browser: 'firefox' | 'edge';
</script>

<svg aria-hidden="true">
  <use href={browser === 'firefox' ? '#cqd-logo-firefox' : '#cqd-logo-edge'} />
</svg>
