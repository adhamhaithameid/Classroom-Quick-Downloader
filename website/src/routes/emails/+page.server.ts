import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PageServerLoad } from './$types';

const sourcePath = resolve(process.cwd(), '../emails/email-advertisement.html');

const stylePattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const bodyPattern = /<body[^>]*>([\s\S]*?)<\/body>/i;

export const load: PageServerLoad = async () => {
  const rawHtml = await readFile(sourcePath, 'utf8');

  const styleMatches = [...rawHtml.matchAll(stylePattern)];
  const emailHeadStyles = styleMatches.map((match) => match[1].trim()).join('\n\n');

  const bodyMatch = rawHtml.match(bodyPattern);
  const emailBodyHtml = (bodyMatch ? bodyMatch[1] : rawHtml).trim();

  return {
    emailHeadStyles,
    emailBodyHtml
  };
};
