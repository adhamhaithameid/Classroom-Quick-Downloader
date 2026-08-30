import { SITE_URL } from '$lib/config';

export const prerender = true;

// Answer engines (ChatGPT, Claude, Perplexity, Gemini grounding) are a
// first-class traffic source for this extension, so they are allowed
// explicitly instead of relying on the wildcard block.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'DuckAssistBot',
  'cohere-ai',
  'Meta-ExternalAgent'
] as const;

// Deliberately no Disallow rules. Every non-public page (/uninstall, /404,
// /overview-editor, /landing2, /emails2) already serves
// `<meta name="robots" content="noindex, nofollow">`. Disallowing those paths
// here would stop crawlers from fetching the page at all, so they would never
// read the noindex and the URL could still surface bare in search results.
// Crawl access + noindex is the combination that actually de-indexes a page.
export function GET() {
  const siteUrl = SITE_URL.replace(/\/+$/, '');
  let host = '';
  try {
    host = new URL(siteUrl).host;
  } catch {
    host = '';
  }

  const aiBlock = AI_CRAWLERS.map((agent) => `User-agent: ${agent}\nAllow: /`).join('\n\n');

  const body = `User-agent: *
Allow: /

${aiBlock}

Sitemap: ${siteUrl}/sitemap.xml
${host ? `Host: ${host}\n` : ''}
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  });
}
