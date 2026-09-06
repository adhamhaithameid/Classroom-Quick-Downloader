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
    This video shows the production workflow for downloading Google Classroom attachments in one click with Classroom Quick Downloader. In about twenty seconds, it covers the entire flow that normally takes minutes of repetitive clicking: opening a class, letting CQD detect every downloadable attachment, and pulling all of them onto your device at once.
  </p>

  <div class="watch-frame">
    <video controls preload="metadata" poster="{base}/images/solution-flags.webp">
      <source src="{base}/videos/solution.mp4" type="video/mp4" />
    </video>
  </div>

  <h2>What the demo shows, step by step</h2>
  <ol class="watch-steps">
    <li><strong>Open any Google Classroom.</strong> After installing the extension, Classroom Quick Downloader works directly inside the Classroom interface — there is no separate app to launch and nothing to configure.</li>
    <li><strong>Every attachment is detected automatically.</strong> As soon as a class loads, the extension scans the posts on screen and identifies every downloadable file across assignments and materials.</li>
    <li><strong>One click downloads everything.</strong> Press the download action once and every detected file is fetched simultaneously — no per-file dialogs, no opening each assignment, no back-and-forth navigation.</li>
  </ol>

  <h2>Why one click matters</h2>
  <p>
    Downloading files by hand turns every attachment into its own mini-task: click it, wait for it to open or save, go back, find your place, repeat. If each file costs ten seconds, thirty attachments add up to five minutes of pure clicking — per class, per week. The demo shows the same job collapsing into a single action, which is the core idea behind Classroom Quick Downloader.
  </p>

  <h2>Where it works</h2>
  <p>
    CQD runs in Chrome, Firefox, Edge, and other Chromium-based browsers such as Brave, Opera, Vivaldi, and Arc. It supports personal Google accounts as well as Google Workspace for Education school accounts, and it works on both the Classwork and Stream tabs. Files go straight from Google's servers to your device — the extension has no third-party tracking and builds no user profiles.
  </p>

  <h2>Try it yourself</h2>
  <p>
    The fastest way to evaluate CQD is to run it against one of your own classes. Install the extension for your browser, then follow the full walkthrough for downloading all attachments from a Google Classroom, or read more about bulk-downloading Google Classroom assignments. Answers to common questions live in the FAQ.
  </p>

  <p class="watch-links">
    <a href="{base}/install/chrome">Install for Chrome</a>
    <a href="{base}/download-all-attachments-google-classroom">Step-by-step guide</a>
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

  .watch-page h2 {
    margin: 2rem 0 0;
    font-size: 1.4rem;
    line-height: 1.25;
    color: #020617;
  }

  .watch-page ol {
    margin: 0.9rem 0 0;
    padding-left: 1.4rem;
    line-height: 1.7;
    color: #334155;
  }

  .watch-page li {
    margin-top: 0.45rem;
  }

  .watch-page li::marker {
    color: #047857;
    font-weight: 700;
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
