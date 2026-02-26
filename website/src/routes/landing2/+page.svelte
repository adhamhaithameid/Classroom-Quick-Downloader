<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';

  onMount(() => {
    goto(`${base}/overview`, { replaceState: true });
  });
</script>

<svelte:head>
  <title>Classroom Quick Downloader — Overview</title>
</svelte:head>

<div style="min-height: 60vh; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 15px;">
  Redirecting…
</div>
