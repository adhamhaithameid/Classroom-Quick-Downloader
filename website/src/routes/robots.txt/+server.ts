import { SITE_URL } from '$lib/config';

export const prerender = true;

export function GET() {
  const siteUrl = SITE_URL.replace(/\/+$/, '');
  let host = '';
  try {
    host = new URL(siteUrl).host;
  } catch {
    host = '';
  }
  const body = `User-agent: *
Allow: /
Disallow: /uninstall
Disallow: /404
Disallow: /overview-editor
Disallow: /landing2

Sitemap: ${siteUrl}/sitemap.xml
${host ? `Host: ${host}\n` : ''}
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  });
}
