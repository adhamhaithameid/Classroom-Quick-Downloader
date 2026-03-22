<script lang="ts">
  import { base } from '$app/paths';
  import { APP_VERSION, SITE_URL } from '$lib/config';
  import SeoMeta from '$lib/components/SeoMeta.svelte';
  import type { SeoPageConfig } from '$lib/content/seoPages';
  import { SITE_NAME, SOCIAL_IMAGE } from '$lib/seo/site';

  export let config: SeoPageConfig;

  function resolveHref(href: string): string {
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) return href;
    if (!href.startsWith('/')) return href;
    return `${base}${href}`;
  }

  function normalizePath(path: string): string {
    if (!path || path === '/') return '/';
    const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
    return withLeadingSlash.replace(/\/+$/, '');
  }

  function toCanonicalUrl(path: string): string {
    const normalizedBase = SITE_URL.replace(/\/+$/, '');
    const normalizedPath = normalizePath(path);
    return normalizedPath === '/' ? `${normalizedBase}/` : `${normalizedBase}${normalizedPath}`;
  }

  function humanizeSegment(segment: string): string {
    return segment
      .split('-')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function buildBreadcrumbData(path: string, pageName: string): Record<string, unknown> {
    const segments = normalizePath(path).split('/').filter(Boolean);
    const crumbs: Array<{ name: string; item: string }> = [{ name: 'Home', item: toCanonicalUrl('/') }];
    let runningPath = '';
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      runningPath = `${runningPath}/${segment}`;
      const isLast = index === segments.length - 1;
      crumbs.push({
        name: isLast ? pageName : humanizeSegment(segment),
        item: toCanonicalUrl(runningPath)
      });
    }

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.item
      }))
    };
  }

  $: canonicalUrl = toCanonicalUrl(config.path);
  $: webPageStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: config.h1,
    description: config.description,
    url: canonicalUrl,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: toCanonicalUrl('/')
    },
    about: {
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'BrowserExtension'
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: toCanonicalUrl(SOCIAL_IMAGE.path)
    }
  };

  $: breadcrumbStructuredData = buildBreadcrumbData(config.path, config.h1);
  $: seoStructuredData = [webPageStructuredData, breadcrumbStructuredData];
</script>

<SeoMeta
  title={config.title}
  description={config.description}
  path={config.path}
  keywords={config.keywords}
  type="article"
  structuredData={seoStructuredData}
/>

<article class="seo-page">
  <section class="seo-hero">
    <span class="seo-eyebrow">{config.eyebrow}</span>
    <h1>{config.h1}</h1>
    <p>{config.intro}</p>
    <div class="seo-hero-actions">
      {#if config.primaryCta}
        <a
          class="seo-btn seo-btn-primary"
          href={resolveHref(config.primaryCta.href)}
          target={config.primaryCta.external ? '_blank' : undefined}
          rel={config.primaryCta.external ? 'noopener noreferrer' : undefined}
        >
          {config.primaryCta.label}
        </a>
      {/if}
      {#if config.secondaryCta}
        <a
          class="seo-btn seo-btn-secondary"
          href={resolveHref(config.secondaryCta.href)}
          target={config.secondaryCta.external ? '_blank' : undefined}
          rel={config.secondaryCta.external ? 'noopener noreferrer' : undefined}
        >
          {config.secondaryCta.label}
        </a>
      {/if}
    </div>
  </section>

  <section class="seo-sections">
    {#each config.sections as section}
      <article class="seo-card">
        <h2>{section.heading}</h2>
        {#each section.paragraphs as paragraph}
          <p>{paragraph}</p>
        {/each}
        {#if section.bullets && section.bullets.length > 0}
          <ul>
            {#each section.bullets as bullet}
              <li>{bullet}</li>
            {/each}
          </ul>
        {/if}
      </article>
    {/each}
  </section>

  <section class="seo-disclaimer">
    <p>
      Classroom Quick Downloader {APP_VERSION} • Not affiliated with Google or Google Classroom.
    </p>
  </section>
</article>

<style>
  .seo-page {
    max-width: 980px;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
    color: #0f172a;
  }

  .seo-hero {
    padding: 2.2rem;
    border: 1px solid #dbe5ef;
    border-radius: 1rem;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    box-shadow: 0 15px 40px rgba(15, 23, 42, 0.06);
  }

  .seo-eyebrow {
    display: inline-block;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0f766e;
    margin-bottom: 0.8rem;
  }

  .seo-hero h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3.3vw, 2.8rem);
    line-height: 1.1;
    color: #020617;
  }

  .seo-hero p {
    margin: 1rem 0 0;
    font-size: 1.02rem;
    line-height: 1.7;
    color: #334155;
    max-width: 70ch;
  }

  .seo-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    margin-top: 1.2rem;
  }

  .seo-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.62rem 1rem;
    border-radius: 0.72rem;
    font-size: 0.92rem;
    font-weight: 600;
    text-decoration: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .seo-btn:hover {
    transform: translateY(-1px);
  }

  .seo-btn-primary {
    background: #047857;
    border: 1px solid #047857;
    color: #ffffff;
    box-shadow: 0 10px 25px rgba(4, 120, 87, 0.18);
  }

  .seo-btn-secondary {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    color: #0f172a;
  }

  .seo-sections {
    margin-top: 1.1rem;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.85rem;
  }

  .seo-card {
    border: 1px solid #e2e8f0;
    border-radius: 0.9rem;
    background: #ffffff;
    padding: 1.25rem 1.2rem;
  }

  .seo-card h2 {
    margin: 0 0 0.6rem;
    color: #0f172a;
    font-size: 1.08rem;
  }

  .seo-card p {
    margin: 0.5rem 0;
    color: #334155;
    line-height: 1.7;
  }

  .seo-card ul {
    margin: 0.6rem 0 0;
    padding-left: 1.1rem;
    color: #334155;
    line-height: 1.65;
  }

  .seo-card li + li {
    margin-top: 0.3rem;
  }

  .seo-disclaimer {
    margin-top: 1rem;
    color: #64748b;
    font-size: 0.86rem;
    text-align: center;
  }

  @media (max-width: 740px) {
    .seo-page {
      padding: 1.25rem 0.7rem 2rem;
    }

    .seo-hero {
      padding: 1.1rem;
      border-radius: 0.8rem;
    }

    .seo-card {
      padding: 1rem;
      border-radius: 0.72rem;
    }
  }
</style>
