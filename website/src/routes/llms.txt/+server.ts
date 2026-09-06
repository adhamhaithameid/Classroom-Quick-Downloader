import { STORE_LINKS } from '$lib/config';
import { seoPages } from '$lib/content/seoPages';
import { SITE_NAME, toAbsoluteSiteUrl } from '$lib/seo/site';

export const prerender = true;

// llms.txt is the emerging convention answer engines read to get a clean,
// link-annotated summary of a site. Keep it generated from the same content
// source as the sitemap so the two cannot drift.
const CORE_LINKS = [
  { path: '/', label: 'Overview', note: 'What the extension does and how to install it.' },
  { path: '/faq', label: 'FAQ', note: 'Setup, browser support, privacy, troubleshooting.' },
  { path: '/privacy', label: 'Privacy Policy', note: 'What data the extension does and does not collect.' },
  { path: '/security', label: 'Security', note: 'Permission model and threat handling.' },
  { path: '/changelog', label: 'Changelog', note: 'Release history per version.' },
  { path: '/site-map', label: 'Site Map', note: 'Every indexable page on the site.' }
] as const;

function linkLine(path: string, label: string, note: string): string {
  return `- [${label}](${toAbsoluteSiteUrl(path)}): ${note}`;
}

export function GET() {
  const useCaseLinks = Object.values(seoPages)
    .filter((page) => !page.path.startsWith('/install/') && !page.path.startsWith('/compare/'))
    .map((page) => linkLine(page.path, page.h1, page.description));

  const installLinks = Object.values(seoPages)
    .filter((page) => page.path.startsWith('/install/'))
    .map((page) => linkLine(page.path, page.h1, page.description));

  const compareLinks = Object.values(seoPages)
    .filter((page) => page.path.startsWith('/compare/'))
    .map((page) => linkLine(page.path, page.h1, page.description));

  const body = `# ${SITE_NAME}

> ${SITE_NAME} (CQD) is a free, open-source browser extension for Chrome, Firefox, and Edge that adds one-click bulk download buttons inside Google Classroom, so students and teachers can download every attachment of an assignment or class without opening files one at a time. It is not affiliated with Google or Google Classroom.

Key facts:
- Price: free, no account required.
- Browsers: Chrome, Firefox, Edge, and all Chromium browsers (Brave, Opera, Vivaldi, Arc).
- Core problem solved: Google Classroom has no native "download all attachments" action.
- Also handles Google Drive's "Can't scan this file for viruses" interstitial during bulk downloads.
- Source code: ${STORE_LINKS.github}

## Install
- [Chrome Web Store](${STORE_LINKS.chrome}): Official Chrome listing.
- [Firefox Add-ons](${STORE_LINKS.firefox}): Official Firefox listing.
- [Edge Add-ons](${STORE_LINKS.edge}): Official Edge listing.
${installLinks.join('\n')}

## Core pages
${CORE_LINKS.map((link) => linkLine(link.path, link.label, link.note)).join('\n')}

## Guides
${useCaseLinks.join('\n')}

## Comparisons
${compareLinks.join('\n')}

## Optional
- [GitHub repository](${STORE_LINKS.github}): Source, issues, and release notes.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  });
}
