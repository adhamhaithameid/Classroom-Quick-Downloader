<script lang="ts">
  import { base } from '$app/paths';
  import { SITE_URL } from '$lib/config';
  import SeoMeta from '$lib/components/SeoMeta.svelte';

  const pagePath = '/watch/cqd-demo';
  const canonicalUrl = `${SITE_URL}${pagePath}`;
  const videoUrl = `${SITE_URL}/videos/solution.mp4`;
  const thumbnailUrl = `${SITE_URL}/images/solution-flags.webp`;
  const videoUploadDate = '2026-03-04T00:00:00+00:00';
  const videoDurationIso = 'PT21S';

  const videoStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    '@id': `${canonicalUrl}#video`,
    name: 'Classroom Quick Downloader demo: one-click batch downloads',
    description: 'Watch the CQD demo showing one-click batch download of Google Classroom attachments.',
    uploadDate: videoUploadDate,
    datePublished: videoUploadDate,
    duration: videoDurationIso,
    thumbnailUrl: [thumbnailUrl],
    contentUrl: videoUrl,
    embedUrl: canonicalUrl,
    isFamilyFriendly: true,
    inLanguage: 'en',
    publisher: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Classroom Quick Downloader',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon-512x512.png`
      }
    }
  };

  const breadcrumbStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/`
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Video Demos',
        item: `${SITE_URL}/site-map`
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'CQD Demo Video',
        item: canonicalUrl
      }
    ]
  };

  const pageStructuredData = [videoStructuredData, breadcrumbStructuredData];
</script>

<SeoMeta
  title="CQD Demo Video - One Click Google Classroom Downloads"
  description="Watch the Classroom Quick Downloader demo and see how to batch-download Google Classroom attachments in one click."
  path={pagePath}
  keywords="classroom quick downloader video demo, google classroom download video, batch download classroom attachments"
  type="article"
  structuredData={pageStructuredData}
/>

<article class="watch-page">
  <h1>CQD Demo Video</h1>
  <p>
    This video shows the production workflow for downloading Google Classroom attachments in one click with Classroom Quick Downloader.
  </p>

  <div class="watch-frame">
    <video controls preload="metadata" poster="{base}/images/solution-flags.webp">
      <source src="{base}/videos/solution.mp4" type="video/mp4" />
    </video>
  </div>

  <p class="watch-links">
    <a href="{base}/watch/manual-vs-cqd">Watch the manual vs CQD comparison video</a>
    <a href="{base}/">Back to homepage</a>
  </p>
</article>

<style>
  .watch-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
    color: #0f172a;
  }

  .watch-page h1 {
    margin: 0;
    font-size: clamp(2rem, 4vw, 2.7rem);
    line-height: 1.1;
    color: #020617;
  }

  .watch-page p {
    margin: 0.9rem 0 0;
    line-height: 1.7;
    color: #334155;
  }

  .watch-frame {
    margin-top: 1rem;
    border: 1px solid #dbe5ef;
    border-radius: 1rem;
    overflow: hidden;
    background: #000;
    box-shadow: 0 14px 36px rgba(15, 23, 42, 0.1);
  }

  .watch-frame video {
    width: 100%;
    height: auto;
    display: block;
    aspect-ratio: 16 / 9;
    background: #000;
  }

  .watch-links {
    margin-top: 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
  }

  .watch-links a {
    border: 1px solid #d1d5db;
    border-radius: 999px;
    padding: 0.45rem 0.75rem;
    text-decoration: none;
    color: #0f172a;
    font-weight: 600;
    font-size: 0.9rem;
    background: #fff;
  }

  .watch-links a:hover {
    border-color: rgba(4, 120, 87, 0.35);
    color: #047857;
    background: rgba(4, 120, 87, 0.05);
  }
</style>
