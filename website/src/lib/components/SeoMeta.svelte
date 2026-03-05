<script lang="ts">
  import { SITE_URL } from '$lib/config';

  export let title: string;
  export let description: string;
  export let path = '/';
  export let noindex = false;
  export let keywords = '';
  export let type: 'website' | 'article' = 'website';
  export let structuredData: Record<string, unknown> | Array<Record<string, unknown>> | null = null;

  function normalizePath(value: string): string {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '/') return '/';
    const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withSlash.replace(/\/+$/, '');
  }

  function buildCanonical(urlBase: string, urlPath: string): string {
    const normalizedBase = urlBase.replace(/\/+$/, '');
    const normalizedPath = normalizePath(urlPath);
    return normalizedPath === '/' ? `${normalizedBase}/` : `${normalizedBase}${normalizedPath}`;
  }

  $: canonical = buildCanonical(SITE_URL, path);
  $: robots = noindex ? 'noindex, nofollow' : 'index, follow';
  $: jsonLdItems = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : [];
  $: jsonLdScriptHtml = jsonLdItems.map((item) => {
    const payload = JSON.stringify(item)
      .replace(/</g, '\\u003c')
      .replace(/-->/g, '--\\u003e')
      .replace(/<\/script/gi, '<\\/script');
    return `<script type="application/ld+json">${payload}</scr` + `ipt>`;
  });
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  {#if keywords}
    <meta name="keywords" content={keywords} />
  {/if}
  <meta name="robots" content={robots} />
  <link rel="canonical" href={canonical} />

  <meta property="og:type" content={type} />
  <meta property="og:site_name" content="Classroom Quick Downloader" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />

  {#each jsonLdScriptHtml as scriptHtml}
    {@html scriptHtml}
  {/each}
</svelte:head>
