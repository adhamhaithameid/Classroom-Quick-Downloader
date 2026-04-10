<script lang="ts">
  import { SITE_URL, STORE_LINKS } from '$lib/config';
  import { DEFAULT_LANGUAGE, SITE_LOCALE, SITE_NAME, SOCIAL_IMAGE } from '$lib/seo/site';

  export let title: string;
  export let description: string;
  export let path = '/';
  export let noindex = false;
  export let keywords = '';
  export let type: 'website' | 'article' = 'website';
  export let structuredData: Record<string, unknown> | Array<Record<string, unknown>> | null = null;
  export let includeSiteIdentityStructuredData = true;
  export let imagePath = SOCIAL_IMAGE.path;
  export let imageAlt = SOCIAL_IMAGE.alt;
  export let imageWidth = SOCIAL_IMAGE.width;
  export let imageHeight = SOCIAL_IMAGE.height;
  export let language = DEFAULT_LANGUAGE;
  export let locale = SITE_LOCALE;
  export let siteName = SITE_NAME;

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

  function buildAbsoluteAssetUrl(urlBase: string, assetPath: string): string {
    const trimmed = assetPath.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed;
    return buildCanonical(urlBase, trimmed);
  }

  function detectImageMimeType(assetUrl: string): string {
    const normalized = assetUrl.toLowerCase();
    if (normalized.endsWith('.png')) return 'image/png';
    if (normalized.endsWith('.webp')) return 'image/webp';
    if (normalized.endsWith('.svg')) return 'image/svg+xml';
    if (normalized.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }

  function structuredDataKey(item: Record<string, unknown>): string | null {
    const type = typeof item['@type'] === 'string' ? item['@type'] : '';
    const id = typeof item['@id'] === 'string' ? item['@id'] : '';
    if (!type || !id) return null;
    return `${type}::${id}`;
  }

  function dedupeStructuredData(items: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const deduped: Array<Record<string, unknown>> = [];
    const seenKeys = new Set<string>();

    for (const item of items) {
      const key = structuredDataKey(item);
      if (key) {
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
      }
      deduped.push(item);
    }

    return deduped;
  }

  $: canonical = buildCanonical(SITE_URL, path);
  $: socialImageUrl = buildAbsoluteAssetUrl(SITE_URL, imagePath);
  $: socialImageType = socialImageUrl ? detectImageMimeType(socialImageUrl) : '';
  $: robots = noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  $: botPreviewDirectives = noindex ? 'noindex, nofollow' : 'max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  $: pageStructuredDataItems = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : [];
  $: siteIdentityStructuredData = includeSiteIdentityStructuredData
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#website`,
          name: siteName,
          alternateName: 'CQD',
          url: `${SITE_URL}/`,
          inLanguage: language,
          publisher: { '@id': `${SITE_URL}/#organization` }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          '@id': `${SITE_URL}/#organization`,
          name: siteName,
          alternateName: 'CQD',
          url: `${SITE_URL}/`,
          logo: {
            '@type': 'ImageObject',
            url: `${SITE_URL}/favicon-512x512.png`,
            width: 512,
            height: 512
          },
          sameAs: [STORE_LINKS.github, STORE_LINKS.chrome, STORE_LINKS.firefox, STORE_LINKS.edge]
        }
      ]
    : [];
  $: jsonLdItems = dedupeStructuredData([...pageStructuredDataItems, ...siteIdentityStructuredData]);
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
  <meta name="site_name" content={siteName} />
  <meta itemprop="name" content={siteName} />
  <meta name="robots" content={robots} />
  <meta name="googlebot" content={botPreviewDirectives} />
  <meta name="bingbot" content={botPreviewDirectives} />
  <link rel="canonical" href={canonical} />
  <link rel="alternate" hreflang={language} href={canonical} />
  <link rel="alternate" hreflang="x-default" href={canonical} />

  <meta property="og:type" content={type} />
  <meta property="og:site_name" content={siteName} />
  <meta property="og:locale" content={locale} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  {#if socialImageUrl}
    <meta property="og:image" content={socialImageUrl} />
    <meta property="og:image:type" content={socialImageType} />
    <meta property="og:image:alt" content={imageAlt} />
    <meta property="og:image:width" content={String(imageWidth)} />
    <meta property="og:image:height" content={String(imageHeight)} />
  {/if}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:url" content={canonical} />
  {#if socialImageUrl}
    <meta name="twitter:image" content={socialImageUrl} />
    <meta name="twitter:image:alt" content={imageAlt} />
  {/if}

  {#each jsonLdScriptHtml as scriptHtml}
    {@html scriptHtml}
  {/each}
</svelte:head>
