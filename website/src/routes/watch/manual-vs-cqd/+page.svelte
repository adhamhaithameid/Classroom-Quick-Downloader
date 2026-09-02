<script lang="ts">
  import { base } from '$app/paths';
  import { SITE_URL } from '$lib/config';
  import SeoMeta from '$lib/components/SeoMeta.svelte';

  const pagePath = '/watch/manual-vs-cqd';
  const canonicalUrl = `${SITE_URL}${pagePath}`;
  const videoUrl = `${SITE_URL}/videos/problem.mp4`;
  const thumbnailUrl = `${SITE_URL}/images/problem-flags.webp`;
  const videoUploadDate = '2026-03-04T00:00:00+00:00';
  const videoDurationIso = 'PT39S';

  const videoStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    '@id': `${canonicalUrl}#video`,
    name: 'Manual downloads vs Classroom Quick Downloader',
    description: 'See the manual Google Classroom download flow and compare it against the faster CQD workflow.',
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
        name: 'Manual vs CQD Video',
        item: canonicalUrl
      }
    ]
  };

  const pageStructuredData = [videoStructuredData, breadcrumbStructuredData];
</script>

<SeoMeta
  title="Manual Vs CQD Video - Google Classroom Download Comparison"
  description="Watch a side-by-side style comparison of manual Google Classroom downloading versus Classroom Quick Downloader."
  path={pagePath}
  keywords="manual vs classroom quick downloader, google classroom download comparison video, classroom quick downloader demo"
  type="article"
  structuredData={pageStructuredData}
/>

<article class="watch-page">
  <h1>Manual Vs CQD Video Comparison</h1>
  <p>
    This video highlights the repeated manual download flow in Google Classroom and why CQD is faster for bulk downloads. Seeing the two workflows back to back makes the cost of manual downloading obvious: material that takes dozens of clicks by hand takes one click with Classroom Quick Downloader.
  </p>

  <div class="watch-frame">
    <video controls preload="metadata" poster="{base}/images/problem-flags.webp">
      <source src="{base}/videos/problem.mp4" type="video/mp4" />
    </video>
  </div>

  <h2>The manual way: click, wait, repeat</h2>
  <p>
    Without an extension, every attachment is its own chore. You open an assignment, click an attachment, wait for the preview or Drive view to load, download the file, navigate back, find your place, and start over on the next one. Multiply that by every attachment in every post — and by every class you take — and the minutes vanish quickly. It is also easy to lose track partway through and miss a file entirely.
  </p>

  <h2>The CQD way: one click, every file</h2>
  <p>
    With Classroom Quick Downloader installed, the same class becomes a single action. The extension detects all downloadable attachments on the page at once, and one click downloads them simultaneously to your device. You never open individual assignments just to reach their files, and nothing gets skipped, because detection covers the whole page rather than one link at a time.
  </p>

  <h2>What to look for in the video</h2>
  <ul class="watch-checklist">
    <li>How many discrete clicks the manual flow needs for just a handful of files</li>
    <li>How much of that work disappears when CQD handles the same class</li>
    <li>The visual flags that mark edited and commented posts, so changes stand out without opening anything</li>
  </ul>

  <h2>When manual downloading still makes sense</h2>
  <p>
    For a single small file you need right now, clicking it directly is fine. The gap appears whenever files stack up — multi-part assignments, weekly resource drops, end-of-term archives. That is exactly the workload CQD was built for: a student who was tired of clicking turned the repetition into one click.
  </p>

  <h2>Compare the flows yourself</h2>
  <p>
    Install CQD for your browser and race it against your current routine on a real class. The bulk-download walkthrough explains the process in detail, and the FAQ covers browser support, school accounts, and privacy.
  </p>

  <p class="watch-links">
    <a href="{base}/install/chrome">Install for Chrome</a>
    <a href="{base}/bulk-download-google-classroom-assignments">Bulk download guide</a>
    <a href="{base}/faq">FAQ</a>
    <a href="{base}/watch/cqd-demo">Watch the CQD demo video</a>
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

  .watch-page ul {
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
