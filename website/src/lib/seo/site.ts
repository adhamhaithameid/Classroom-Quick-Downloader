import { SITE_URL } from '$lib/config';
import { seoPages } from '$lib/content/seoPages';

const CORE_INDEXABLE_PATHS = ['/', '/privacy', '/faq', '/changelog', '/site-map'] as const;
const VIDEO_INDEXABLE_PATHS = ['/watch/cqd-demo', '/watch/manual-vs-cqd'] as const;

export const SITE_NAME = 'Classroom Quick Downloader' as const;
export const DEFAULT_LANGUAGE = 'en' as const;
export const SITE_LOCALE = 'en_US' as const;

export const SOCIAL_IMAGE = {
  path: '/images/cqd-social-card.png',
  alt: 'Classroom Quick Downloader helping students bulk download Google Classroom files',
  width: 1200,
  height: 630
} as const;

export const INDEXABLE_SITE_PATHS = [...new Set([
  ...CORE_INDEXABLE_PATHS,
  ...VIDEO_INDEXABLE_PATHS,
  ...Object.values(seoPages).map((page) => page.path)
])];

export const SITEMAP_IMAGE_ASSET_PATHS = [
  '/images/cqd-social-card.png',
  '/images/solution-flags.webp',
  '/images/problem-flags.webp'
] as const;

export const SITEMAP_VIDEO_ENTRIES = [
  {
    pagePath: '/watch/cqd-demo',
    contentPath: '/videos/solution.mp4',
    thumbnailPath: '/images/solution-flags.webp',
    title: 'Classroom Quick Downloader demo: one-click batch downloads',
    description: 'Watch the CQD demo video showing one-click batch download of Google Classroom attachments.',
    publicationDate: '2026-03-04T00:00:00+00:00',
    durationSeconds: 21,
    familyFriendly: true
  },
  {
    pagePath: '/watch/manual-vs-cqd',
    contentPath: '/videos/problem.mp4',
    thumbnailPath: '/images/problem-flags.webp',
    title: 'Manual downloads vs Classroom Quick Downloader',
    description: 'Compare manual Google Classroom downloading with the faster CQD workflow in this side-by-side video.',
    publicationDate: '2026-03-04T00:00:00+00:00',
    durationSeconds: 39,
    familyFriendly: true
  }
] as const;

export function toAbsoluteSiteUrl(path: string): string {
  const base = SITE_URL.replace(/\/+$/, '');
  const normalizedPath = path === '/' ? '/' : `/${path.replace(/^\/+/, '').replace(/\/+$/, '')}`;
  return normalizedPath === '/' ? `${base}/` : `${base}${normalizedPath}`;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
