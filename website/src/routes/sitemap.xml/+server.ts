import {
  INDEXABLE_SITE_PATHS,
  SITEMAP_IMAGE_ASSET_PATHS,
  SITEMAP_VIDEO_ENTRIES,
  escapeXml,
  toAbsoluteSiteUrl
} from '$lib/seo/site';

export const prerender = true;

const DEFAULT_CHANGEFREQ = 'weekly';
const DEFAULT_PRIORITY = '0.7';
const ROOT_PRIORITY = '1.0';
const HIGH_PRIORITY = '0.9';

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function changeFreqForPath(path: string): string {
  if (path === '/') return 'daily';
  if (path === '/changelog' || path.startsWith('/compare/')) return 'weekly';
  if (path.startsWith('/install/')) return 'monthly';
  return DEFAULT_CHANGEFREQ;
}

function priorityForPath(path: string): string {
  if (path === '/') return ROOT_PRIORITY;
  if (path === '/faq' || path === '/privacy' || path === '/changelog') return HIGH_PRIORITY;
  return DEFAULT_PRIORITY;
}

function imageTagsForPath(path: string): string {
  if (path !== '/' && path !== '/press-kit') return '';
  const tags = SITEMAP_IMAGE_ASSET_PATHS
    .map((assetPath) => `    <image:image><image:loc>${escapeXml(toAbsoluteSiteUrl(assetPath))}</image:loc></image:image>`)
    .join('\n');
  return tags ? `${tags}\n` : '';
}

function videoTagsForPath(path: string): string {
  const videos = SITEMAP_VIDEO_ENTRIES.filter((entry) => entry.pagePath === path);
  if (!videos.length) return '';
  const tags = videos
    .map((entry) => {
      const title = escapeXml(entry.title);
      const description = escapeXml(entry.description);
      const contentLoc = escapeXml(toAbsoluteSiteUrl(entry.contentPath));
      const thumbnailLoc = escapeXml(toAbsoluteSiteUrl(entry.thumbnailPath));
      const publicationDateTag = entry.publicationDate
        ? `      <video:publication_date>${escapeXml(entry.publicationDate)}</video:publication_date>\n`
        : '';
      const durationTag = typeof entry.durationSeconds === 'number'
        ? `      <video:duration>${entry.durationSeconds}</video:duration>\n`
        : '';
      const familyFriendlyTag = typeof entry.familyFriendly === 'boolean'
        ? `      <video:family_friendly>${entry.familyFriendly ? 'yes' : 'no'}</video:family_friendly>\n`
        : '';
      return [
        '    <video:video>',
        `      <video:thumbnail_loc>${thumbnailLoc}</video:thumbnail_loc>`,
        `      <video:title>${title}</video:title>`,
        `      <video:description>${description}</video:description>`,
        publicationDateTag.trimEnd(),
        durationTag.trimEnd(),
        familyFriendlyTag.trimEnd(),
        `      <video:content_loc>${contentLoc}</video:content_loc>`,
        '    </video:video>'
      ].filter(Boolean).join('\n');
    })
    .join('\n');
  return tags ? `${tags}\n` : '';
}

export function GET() {
  const today = toIsoDate(new Date());
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${INDEXABLE_SITE_PATHS.map((path) => {
  const loc = escapeXml(toAbsoluteSiteUrl(path));
  const changefreq = changeFreqForPath(path);
  const priority = priorityForPath(path);
  const imageTags = imageTagsForPath(path);
  const videoTags = videoTagsForPath(path);
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${imageTags}${videoTags}  </url>`;
}).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8'
    }
  });
}
