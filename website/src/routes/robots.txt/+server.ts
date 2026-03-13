import { SITE_URL } from '$lib/config';

export const prerender = true;

export function GET() {
  const siteUrl = SITE_URL.replace(/\/+$/, '');
  const body = `User-agent: *
Disallow: /uninstall
Disallow: /404

Sitemap: ${siteUrl}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  });
}
