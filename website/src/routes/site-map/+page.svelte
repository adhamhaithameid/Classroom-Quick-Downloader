<script lang="ts">
  import { base } from '$app/paths';
  import { SITE_URL } from '$lib/config';
  import SeoMeta from '$lib/components/SeoMeta.svelte';
  import { INDEXABLE_SITE_PATHS } from '$lib/seo/site';
  import { glassSheen } from '$lib/actions/glassSheen';

  type SiteMapGroup =
    | 'Core pages'
    | 'Video demos'
    | 'Install guides'
    | 'Use-case guides'
    | 'Comparison pages'
    | 'Trust and support'
    | 'Additional pages';

  const GROUP_ORDER: SiteMapGroup[] = [
    'Core pages',
    'Video demos',
    'Install guides',
    'Use-case guides',
    'Comparison pages',
    'Trust and support',
    'Additional pages'
  ];

  const CORE_PATHS = new Set(['/', '/privacy', '/faq', '/changelog', '/site-map']);
  const TRUST_PATHS = new Set(['/security', '/support', '/press-kit', '/featured']);

  function normalizePath(path: string): string {
    if (!path || path === '/') return '/';
    const withSlash = path.startsWith('/') ? path : `/${path}`;
    return withSlash.replace(/\/+$/, '');
  }

  function hrefForPath(path: string): string {
    return `${base}${path === '/' ? '/' : path}`;
  }

  function labelForPath(path: string): string {
    const labelMap: Record<string, string> = {
      '/': 'Overview',
      '/privacy': 'Privacy',
      '/faq': 'FAQ',
      '/changelog': 'Changelog',
      '/site-map': 'Site Map',
      '/security': 'Security',
      '/support': 'Support',
      '/press-kit': 'Press Kit',
      '/featured': 'Featured',
      '/watch/cqd-demo': 'CQD Demo Video',
      '/watch/manual-vs-cqd': 'Manual Vs CQD Video Comparison',
      '/download-all-attachments-google-classroom': 'Download All Attachments From Google Classroom',
      '/bulk-download-google-classroom-assignments': 'Bulk Download Google Classroom Assignments',
      '/google-drive-cant-scan-virus-warning-download': "Fix Drive 'Can't Scan This File For Viruses'",
      '/google-workspace-school-accounts-support': 'Google Workspace School Accounts Support',
      '/download-google-classroom-materials-fast': 'Download Google Classroom Materials Fast',
      '/install/chrome': 'Install On Chrome',
      '/install/firefox': 'Install On Firefox',
      '/install/edge': 'Install On Edge',
      '/compare/classroom-quick-downloader-vs-classroom-one-click-downloader':
        'CQD vs Classroom One Click Downloader',
      '/compare/classroom-quick-downloader-vs-classmate': 'CQD vs Classmate',
      '/compare/classroom-quick-downloader-vs-classfetch': 'CQD vs Classfetch'
    };
    const explicit = labelMap[path];
    if (explicit) return explicit;
    return path
      .replace(/^\//, '')
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.split('-').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' '))
      .join(' / ');
  }

  function groupForPath(path: string): SiteMapGroup {
    if (CORE_PATHS.has(path)) return 'Core pages';
    if (path.startsWith('/watch/')) return 'Video demos';
    if (path.startsWith('/install/')) return 'Install guides';
    if (path.startsWith('/compare/')) return 'Comparison pages';
    if (
      path.startsWith('/download-') ||
      path.startsWith('/bulk-') ||
      path.startsWith('/google-drive-') ||
      path.startsWith('/google-workspace-')
    ) {
      return 'Use-case guides';
    }
    if (TRUST_PATHS.has(path)) return 'Trust and support';
    return 'Additional pages';
  }

  const indexableLinks = INDEXABLE_SITE_PATHS
    .map((path) => normalizePath(path))
    .filter((path, index, paths) => paths.indexOf(path) === index)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({
      path,
      label: labelForPath(path),
      group: groupForPath(path)
    }));

  $: groupedLinks = GROUP_ORDER
    .map((group) => ({
      group,
      links: indexableLinks.filter((link) => link.group === group)
    }))
    .filter((section) => section.links.length > 0);

  const siteMapStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Site Map - Classroom Quick Downloader',
    description: 'Browse every indexable Classroom Quick Downloader page from one crawlable directory.',
    url: `${SITE_URL}/site-map`,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Classroom Quick Downloader',
      url: `${SITE_URL}/`
    }
  };
</script>

<SeoMeta
  title="Site Map - Classroom Quick Downloader"
  description="Browse every indexable Classroom Quick Downloader page from one crawlable directory."
  path="/site-map"
  keywords="classroom quick downloader site map, google classroom downloader pages, website index"
  structuredData={siteMapStructuredData}
/>

<article class="site-map-page">
  <section class="site-map-hero">
    <h1>Site Map</h1>
    <p>Use this page to quickly access all public CQD pages. Search crawlers can use it as an additional internal-link hub.</p>
  </section>

  <section class="site-map-sections">
    {#each groupedLinks as section}
      <article class="site-map-card" use:glassSheen>
        <h2>{section.group}</h2>
        <ul>
          {#each section.links as link}
            <li>
              <a href={hrefForPath(link.path)}>{link.label}</a>
              <code>{link.path}</code>
            </li>
          {/each}
        </ul>
      </article>
    {/each}
  </section>
</article>

<style>
  .site-map-page {
    max-width: 1040px;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
    color: #0f172a;
  }

  .site-map-hero {
    border: 1px solid #dbe5ef;
    border-radius: 1rem;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    box-shadow: 0 15px 40px rgba(15, 23, 42, 0.06);
    padding: 2rem 1.5rem;
  }

  .site-map-hero h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.5rem);
    line-height: 1.1;
    color: #020617;
  }

  .site-map-hero p {
    margin: 0.9rem 0 0;
    color: #334155;
    line-height: 1.7;
    max-width: 72ch;
  }

  .site-map-sections {
    margin-top: 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.9rem;
  }

  .site-map-card {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--glass-border);
    border-radius: 0.9rem;
    background: var(--glass-bg);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    backdrop-filter: blur(20px) saturate(180%);
    padding: 1rem 1.1rem 1.1rem;
    box-shadow:
      0 1px 2px rgba(15, 20, 25, 0.05),
      0 12px 30px rgba(15, 20, 25, 0.1),
      0 8px 24px rgba(26, 139, 85, 0.08),
      inset 0 1px 0 var(--glass-highlight);
    transition:
      transform 0.45s var(--glass-ease),
      box-shadow 0.45s var(--glass-ease),
      border-color 0.3s ease;
  }

  .site-map-card:hover {
    transform: translateY(-2px);
    border-color: rgba(26, 139, 85, 0.22);
    box-shadow:
      0 8px 20px rgba(26, 139, 85, 0.12),
      0 0 0 1px rgba(26, 139, 85, 0.06),
      0 20px 44px rgba(15, 20, 25, 0.12),
      inset 0 1px 0 var(--glass-highlight);
  }

  /* Static top gloss shared by the glass surfaces. */
  .site-map-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0) 36%),
      linear-gradient(120deg, rgba(255, 255, 255, 0.3), rgba(239, 247, 250, 0.16) 48%, rgba(255, 255, 255, 0.28));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      inset 0 -1px 0 rgba(255, 255, 255, 0.35);
  }

  /* Pointer-tracked specular sweep (glassSheen action). */
  .site-map-card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(
      240px circle at var(--card-mx, 50%) var(--card-my, 0%),
      rgba(255, 255, 255, 0.55),
      rgba(255, 255, 255, 0) 72%
    );
    transition: opacity 0.35s ease;
  }

  .site-map-card:hover::after {
    opacity: 1;
  }

  .site-map-card h2 {
    margin: 0;
    font-size: 1rem;
    color: var(--text);
  }

  .site-map-card ul {
    margin: 0.7rem 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.55rem;
  }

  .site-map-card li {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    border: 1px solid var(--border-subtle);
    border-radius: 0.68rem;
    background: rgba(255, 255, 255, 0.55);
    padding: 0.55rem 0.65rem;
  }

  .site-map-card a {
    color: var(--text);
    text-decoration: none;
    font-weight: 600;
  }

  .site-map-card a:hover {
    color: var(--gc-green);
    text-decoration: underline;
  }

  .site-map-card code {
    font-size: 0.72rem;
    color: var(--text-secondary);
    word-break: break-word;
  }

  @media (prefers-reduced-motion: reduce) {
    .site-map-card {
      transition: none;
    }

    .site-map-card::after {
      display: none;
    }
  }

  @media (prefers-reduced-transparency: reduce) {
    .site-map-card {
      background: #fcfefd;
      border-color: rgba(226, 232, 240, 0.9);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }

    .site-map-card li {
      background: #fcfefd;
      border-color: rgba(226, 232, 240, 0.9);
    }

    .site-map-card::before,
    .site-map-card::after {
      display: none;
    }
  }
</style>
