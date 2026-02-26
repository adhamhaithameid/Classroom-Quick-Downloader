<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';

  onMount(() => {
    goto(`${base}/overview`, { replaceState: true });
  });
</script>

<svelte:head>
  <title>Classroom Quick Downloader — The Free Extension That Supercharges Google Classroom</title>
  <meta name="description" content="Stop downloading files one by one. Classroom Quick Downloader adds batch downloads, smart file handling, and a faster workflow to Google Classroom." />
</svelte:head>

<div style="min-height: 60vh; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 15px;">
  Redirecting…
</div>
