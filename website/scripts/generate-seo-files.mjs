import { writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_SITE_URL = 'https://classroom-quick-downloader-website.pages.dev';

function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return DEFAULT_SITE_URL;
  const parsed = new URL(value);
  const base = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  return base || DEFAULT_SITE_URL;
}

const baseUrl = normalizeBaseUrl(process.env.PUBLIC_SITE_URL);
const rootDir = path.resolve(process.cwd(), 'static');

const sitemapPaths = [
  '/',
  '/privacy',
  '/faq',
  '/changelog',
  '/download-all-attachments-google-classroom',
  '/bulk-download-google-classroom-assignments',
  '/google-drive-cant-scan-virus-warning-download',
  '/google-workspace-school-accounts-support',
  '/download-google-classroom-materials-fast',
  '/install/chrome',
  '/install/firefox',
  '/install/edge',
  '/security',
  '/support',
  '/press-kit',
  '/featured',
  '/compare/classroom-quick-downloader-vs-classroom-one-click-downloader',
  '/compare/classroom-quick-downloader-vs-classmate',
  '/compare/classroom-quick-downloader-vs-classfetch',
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPaths
  .map((p) => `  <url><loc>${baseUrl}${p}</loc></url>`)
  .join('\n')}\n</urlset>\n`;

const robotsTxt = [
  'User-agent: *',
  'Disallow: /uninstall',
  'Disallow: /404',
  '',
  `Sitemap: ${baseUrl}/sitemap.xml`,
  '',
].join('\n');

writeFileSync(path.join(rootDir, 'sitemap.xml'), sitemapXml, 'utf8');
writeFileSync(path.join(rootDir, 'robots.txt'), robotsTxt, 'utf8');

console.log(`[seo] generated sitemap/robots for ${baseUrl}`);
