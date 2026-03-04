<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import SeoMeta from '$lib/components/SeoMeta.svelte';

  onMount(() => {
    goto(`${base}/overview`, { replaceState: true });
  });
</script>

<SeoMeta
  title="Classroom Quick Downloader — Redirecting To Overview"
  description="Redirecting to the Classroom Quick Downloader overview."
  path="/overview"
  noindex={true}
/>

<div style="min-height: 60vh; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 15px;">
  Redirecting…
</div>
