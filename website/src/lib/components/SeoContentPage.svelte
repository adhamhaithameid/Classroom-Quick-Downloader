<script lang="ts">
  import { base } from '$app/paths';
  import { APP_VERSION, SITE_URL, STORE_LINKS } from '$lib/config';
  import SeoMeta from '$lib/components/SeoMeta.svelte';
  import { relatedPagesFor, type SeoPageConfig } from '$lib/content/seoPages';
  import { SITE_NAME, SOCIAL_IMAGE, lastModForPath } from '$lib/seo/site';
  import { trackGuideCtaClick, trackGuideEngaged, GUIDE_ENGAGEMENT_PERCENT } from '$lib/analytics/websiteEvents';

  export let config: SeoPageConfig;

  // Fire the engagement event once per guide, at the shared scroll threshold.
  let engagedPath = '';
  let engaged = false;
  $: if (config.path !== engagedPath) {
    engagedPath = config.path;
    engaged = false;
  }

  function handleGuideScroll(): void {
    if (engaged || typeof window === 'undefined' || typeof document === 'undefined') return;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    if (window.scrollY / scrollable >= GUIDE_ENGAGEMENT_PERCENT / 100) {
      engaged = true;
      trackGuideEngaged(config.path);
    }
  }

  function resolveHref(href: string): string {
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) return href;
    if (!href.startsWith('/')) return href;
    return `${base}${href}`;
  }

  // Tiny inline-link syntax for section copy: [label](href). Only
  // site-relative and https hrefs are linkified — anything else (and any
  // unlinked text) stays literal. Segments render through plain Svelte
  // elements (never {@html}), so the output is XSS-safe by construction.
  type InlineSegment =
    | { kind: 'text'; value: string }
    | { kind: 'link'; label: string; href: string; external: boolean };

  const INLINE_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

  function isLinkifiableHref(href: string): boolean {
    return href.startsWith('/') || href.startsWith('https://');
  }

  function parseInlineSegments(text: string): InlineSegment[] {
    const segments: InlineSegment[] = [];
    let cursor = 0;
    for (const match of text.matchAll(INLINE_LINK_PATTERN)) {
      const [raw, label, href] = match;
      const start = match.index ?? 0;
      if (start > cursor) segments.push({ kind: 'text', value: text.slice(cursor, start) });
      if (isLinkifiableHref(href)) {
        segments.push({ kind: 'link', label, href, external: href.startsWith('https://') });
      } else {
        // Unsafe href: keep the original bracket syntax as visible text.
        segments.push({ kind: 'text', value: raw });
      }
      cursor = start + raw.length;
    }
    if (cursor < text.length) segments.push({ kind: 'text', value: text.slice(cursor) });
    return segments;
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

  const UPDATED_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function formatUpdatedDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    if (!year || !month || !day) return isoDate;
    return `${UPDATED_MONTHS[month - 1]} ${day}, ${year}`;
  }

  $: canonicalUrl = toCanonicalUrl(config.path);
  // One source of truth with the sitemap: the visible "Updated" byline and
  // the TechArticle dateModified both come from the curated lastmod map.
  $: updatedIso = lastModForPath(config.path);
  $: updatedLabel = formatUpdatedDate(updatedIso);
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

  $: techArticleStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: config.h1,
    description: config.description,
    inLanguage: 'en',
    author: { '@type': 'Person', name: 'Adham Haitham', url: STORE_LINKS.github },
    publisher: { '@id': `${SITE_URL}/#organization` },
    mainEntityOfPage: canonicalUrl,
    dateModified: updatedIso
  };
  $: breadcrumbStructuredData = buildBreadcrumbData(config.path, config.h1);
  $: faqStructuredData = config.faqs && config.faqs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: config.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer
          }
        }))
      }
    : null;
  $: relatedPages = relatedPagesFor(config.path);
  $: relatedStructuredData = relatedPages.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Related guides for ${config.h1}`,
        itemListElement: relatedPages.map((related, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: related.label,
          url: toCanonicalUrl(related.path)
        }))
      }
    : null;
  $: seoStructuredData = [
    webPageStructuredData,
    techArticleStructuredData,
    breadcrumbStructuredData,
    ...(faqStructuredData ? [faqStructuredData] : []),
    ...(relatedStructuredData ? [relatedStructuredData] : [])
  ];
</script>

<SeoMeta
  title={config.title}
  description={config.description}
  path={config.path}
  keywords={config.keywords}
  type="article"
  structuredData={seoStructuredData}
/>

<svelte:window on:scroll={handleGuideScroll} />

<article class="seo-page">
  <section class="seo-hero glass-panel">
    <span class="seo-eyebrow">{config.eyebrow}</span>
    <h1>{config.h1}</h1>
    <p>{config.intro}</p>
    <p class="seo-byline">
      Maintained by <strong>Adham Haitham</strong> · <time datetime={updatedIso}>Updated {updatedLabel}</time>
    </p>
    <div class="seo-hero-actions">
      {#if config.primaryCta}
        <a
          class="seo-btn seo-btn-primary"
          href={resolveHref(config.primaryCta.href)}
          target={config.primaryCta.external ? '_blank' : undefined}
          rel={config.primaryCta.external ? 'noopener noreferrer' : undefined}
          on:click={() => trackGuideCtaClick('guide_primary', config.path)}
        >
          {config.primaryCta.label}
        </a>
      {/if}
      {#if config.secondaryCta}
        <a
          class="seo-btn seo-btn-secondary glass-panel glass-hover"
          href={resolveHref(config.secondaryCta.href)}
          target={config.secondaryCta.external ? '_blank' : undefined}
          rel={config.secondaryCta.external ? 'noopener noreferrer' : undefined}
          on:click={() => trackGuideCtaClick('guide_secondary', config.path)}
        >
          {config.secondaryCta.label}
        </a>
      {/if}
    </div>
  </section>

  <section class="seo-sections">
    {#each config.sections as section, i}
      <article class="seo-card glass-panel glass-hover" style="--card-i: {i}">
        <h2>{section.heading}</h2>
        {#each section.paragraphs ?? [] as paragraph}
          <p>{#each parseInlineSegments(paragraph) as segment, segmentIndex (segmentIndex)}{#if segment.kind === 'link'}<a href={resolveHref(segment.href)} target={segment.external ? '_blank' : undefined} rel={segment.external ? 'noopener noreferrer' : undefined}>{segment.label}</a>{:else}{segment.value}{/if}{/each}</p>
        {/each}
        {#if section.bullets && section.bullets.length > 0}
          <ul>
            {#each section.bullets as bullet}
              <li>{#each parseInlineSegments(bullet) as segment, segmentIndex (segmentIndex)}{#if segment.kind === 'link'}<a href={resolveHref(segment.href)} target={segment.external ? '_blank' : undefined} rel={segment.external ? 'noopener noreferrer' : undefined}>{segment.label}</a>{:else}{segment.value}{/if}{/each}</li>
            {/each}
          </ul>
        {/if}
        {#if section.links && section.links.length > 0}
          <ul class="seo-section-links">
            {#each section.links as link}
              <li>
                <a
                  href={resolveHref(link.href)}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                >{link.label}</a>
              </li>
            {/each}
          </ul>
        {/if}
      </article>
    {/each}
  </section>

  {#if config.faqs && config.faqs.length > 0}
    <section class="seo-faq glass-panel" aria-labelledby="seo-faq-heading">
      <h2 id="seo-faq-heading">Frequently Asked Questions</h2>
      {#each config.faqs as faq}
        <article class="seo-faq-item">
          <h3>{faq.question}</h3>
          <p>{faq.answer}</p>
        </article>
      {/each}
    </section>
  {/if}

  {#if relatedPages.length}
    <section class="seo-related glass-panel" aria-labelledby="seo-related-heading">
      <h2 id="seo-related-heading">Related Guides</h2>
      <ul>
        {#each relatedPages as related}
          <li>
            <a href={resolveHref(related.path)}>{related.label}</a>
            <span>{related.description}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

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
    color: var(--text);
  }

  .seo-hero {
    padding: 2.2rem;
    border-radius: 1rem;
  }

  .seo-eyebrow {
    display: inline-block;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gc-green-dark);
    margin-bottom: 0.8rem;
  }

  .seo-hero h1 {
    margin: 0;
    font-size: clamp(2.1rem, 4.5vw, 3.4rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.08;
    color: var(--text);
  }

  .seo-hero p {
    margin: 1rem 0 0;
    font-size: 1.05rem;
    line-height: 1.7;
    color: var(--text-secondary);
    max-width: 70ch;
  }

  .seo-byline {
    margin: 0.9rem 0 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .seo-byline strong {
    color: var(--text);
    font-weight: 700;
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
    padding: 0.66rem 1.1rem;
    border-radius: var(--radius-sm);
    font-size: 0.94rem;
    font-weight: 600;
    text-decoration: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .seo-btn:hover {
    transform: translateY(-1px);
  }

  .seo-btn:focus-visible {
    outline: 3px solid rgba(26, 139, 85, 0.4);
    outline-offset: 2px;
  }

  .seo-btn-primary {
    background: var(--gc-green-dark);
    border: 1px solid rgba(19, 122, 71, 0.6);
    color: #ffffff;
    box-shadow: var(--shadow-green);
  }

  .seo-btn-secondary {
    color: var(--text);
  }

  .seo-sections {
    margin-top: 1.1rem;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.85rem;
  }

  .seo-card {
    border-radius: 0.9rem;
    padding: 1.25rem 1.2rem;
  }

  .seo-card h2 {
    margin: 0 0 0.6rem;
    color: var(--text);
    font-size: clamp(1.35rem, 2.2vw, 1.6rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  .seo-card p {
    margin: 0.5rem 0;
    color: var(--text-secondary);
    line-height: 1.7;
  }

  .seo-card ul {
    margin: 0.6rem 0 0;
    padding-left: 1.1rem;
    color: var(--text-secondary);
    line-height: 1.65;
  }

  .seo-card li + li {
    margin-top: 0.3rem;
  }

  /* Inline links inside card copy share the guide link look. */
  .seo-card a {
    color: var(--gc-green-dark);
    font-weight: 600;
    text-decoration: none;
  }

  .seo-card a:hover {
    text-decoration: underline;
  }

  .seo-related {
    margin-top: 1.1rem;
    border-radius: 0.9rem;
    padding: 1.25rem 1.2rem;
  }

  .seo-faq h2 {
    margin: 0 0 0.6rem;
    color: var(--text);
    font-size: clamp(1.35rem, 2.2vw, 1.6rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  .seo-faq-item h3 {
    margin: 0.9rem 0 0.2rem;
    color: var(--text);
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.4;
  }

  .seo-faq-item p {
    margin: 0.2rem 0 0;
    color: var(--text-secondary);
    line-height: 1.7;
  }

  .seo-related h2 {
    margin: 0 0 0.7rem;
    color: var(--text);
    font-size: clamp(1.35rem, 2.2vw, 1.6rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }

  .seo-related ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.7rem;
  }

  .seo-related a {
    display: block;
    color: var(--gc-green-dark);
    font-weight: 600;
    text-decoration: none;
    line-height: 1.4;
  }

  .seo-related a:hover {
    text-decoration: underline;
  }

  .seo-related span {
    display: block;
    margin-top: 0.15rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .seo-disclaimer {
    margin-top: 1rem;
    color: var(--text-secondary);
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
