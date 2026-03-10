import { INDEXABLE_SITE_PATHS, escapeXml, toAbsoluteSiteUrl } from '$lib/seo/site';

export const prerender = true;

export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${INDEXABLE_SITE_PATHS.map((path) => `  <url><loc>${escapeXml(toAbsoluteSiteUrl(path))}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8'
    }
  });
}
