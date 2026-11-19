<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import SeoMeta from '#lib/components/SeoMeta.svelte';

  // QA F3 (2026-11-18): this route used to throw a 308 from +page.server.ts,
  // but adapter-static prerenders a thrown redirect into a 94-byte stub
  // (`<script>location.href…` + meta refresh) — blank for no-JS visitors on
  // any host without an edge worker. Production keeps its real 308 via the
  // Pages _worker.js edge redirect (EMAILS_PATH); this page covers static
  // hosting with a meta refresh, an instant JS redirect, and a visible link.
  onMount(() => {
    goto('/emails2', { replaceState: true });
  });
</script>

<SeoMeta
  title="Classroom Quick Downloader — Redirecting To Overview"
  description="Redirecting to the Classroom Quick Downloader overview."
  path="/"
  noindex={true}
/>

<svelte:head>
  <meta http-equiv="refresh" content="0;url=/emails2" />
</svelte:head>

<div style="min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--muted, #666); font-size: 15px;">
  <span>Redirecting…</span>
  <a href="/emails2">Continue to Classroom Quick Downloader</a>
</div>
