import type { PageServerLoad } from './$types';
import { loadRepoMarkdown } from '$lib/content/repoMarkdown';

export const prerender = true;

export const load: PageServerLoad = async () => {
  const doc = await loadRepoMarkdown('PRIVACY.md');
  return { doc };
};
