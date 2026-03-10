import { SITE_URL } from '$lib/config';
import { seoPages } from '$lib/content/seoPages';

export const SOCIAL_IMAGE = {
  path: '/images/solution-flags.webp',
  alt: 'Classroom Quick Downloader showing edited and commented Google Classroom posts',
  width: 1642,
  height: 1520
} as const;

const CORE_INDEXABLE_PATHS = ['/', '/privacy', '/faq', '/changelog'] as const;

export const INDEXABLE_SITE_PATHS = [
  ...CORE_INDEXABLE_PATHS,
  ...Object.values(seoPages).map((page) => page.path)
] as const;
