import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { seoPages } from '$lib/content/seoPages';
import { privacyContent } from '$lib/content/privacy';
import { APP_VERSION, SITE_URL } from '$lib/config';
import { INDEXABLE_SITE_PATHS, lastModForPath, SITE_PATH_LASTMOD } from './site';
import SeoContentPage from '$lib/components/SeoContentPage.svelte';

/* SEO regression guard: codifies the audits from the 2026 organic-growth
   overhaul. If one of these fails, a page's metadata, trust claims, or
   structured data drifted from the product truth. */

const FALSE_LICENSE_PATTERNS = [/MIT-licen/i, /open-source extension/i, /free and open source/i, /free, open source/i];
const LEGACY_DOMAIN = 'pages.dev';

describe('seo regression: page metadata', () => {
  const pages = Object.values(seoPages);

  it('has unique paths, titles, and descriptions across all SEO pages', () => {
    const paths = pages.map((p) => p.path);
    const titles = pages.map((p) => p.title);
    const descriptions = pages.map((p) => p.description);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('keeps titles and descriptions inside SERP-friendly lengths', () => {
    for (const page of pages) {
      expect(page.title.length, `title length for ${page.path}`).toBeGreaterThanOrEqual(20);
      expect(page.title.length, `title length for ${page.path}`).toBeLessThanOrEqual(70);
      expect(page.description.length, `description length for ${page.path}`).toBeGreaterThanOrEqual(80);
      expect(page.description.length, `description length for ${page.path}`).toBeLessThanOrEqual(170);
    }
  });

  it('every page has an intro, at least one section, and well-formed FAQs', () => {
    for (const page of pages) {
      expect(page.intro.trim().length, `intro for ${page.path}`).toBeGreaterThan(0);
      expect(page.sections.length, `sections for ${page.path}`).toBeGreaterThan(0);
      for (const faq of page.faqs ?? []) {
        expect(faq.question.trim()).toBeTruthy();
        expect(faq.answer.trim()).toBeTruthy();
      }
    }
  });

  it('every indexable SEO page is in the sitemap path list', () => {
    for (const page of pages) {
      expect(INDEXABLE_SITE_PATHS, `${page.path} missing from sitemap paths`).toContain(page.path);
    }
  });
});

describe('seo regression: trust claims match the product', () => {
  it('never reintroduces false MIT/open-source license claims', () => {
    const serializedSeoPages = JSON.stringify(seoPages);
    const serializedPrivacy = JSON.stringify(privacyContent);
    for (const pattern of FALSE_LICENSE_PATTERNS) {
      expect(pattern.test(serializedSeoPages), `seoPages matched ${pattern}`).toBe(false);
      expect(pattern.test(serializedPrivacy), `privacy matched ${pattern}`).toBe(false);
    }
  });

  it('privacy permissions copy matches the extension manifest', () => {
    const manifestSource = readFileSync(new URL('../../../../extension/wxt.config.ts', import.meta.url), 'utf8');
    const permissionBlock = manifestSource.match(/permissions:\s*\[([^\]]*)\]/)?.[1] ?? '';
    const manifestPermissions = [...permissionBlock.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(manifestPermissions).toEqual(expect.arrayContaining(['downloads', 'storage', 'alarms']));

    const permissionsSection = privacyContent.sections.find((section) => section.id === 'browser-permissions');
    expect(permissionsSection).toBeDefined();
    const bullets = permissionsSection!.bullets.join('\n');
    for (const permission of manifestPermissions) {
      expect(bullets, `privacy copy should mention "${permission}"`).toContain(`"${permission}"`);
    }
    // The manifest grants no activeTab permission; copy must not claim it does.
    expect(bullets).not.toMatch(/"activeTab" — (Allows|Lets|Required)/);
    expect(bullets).toContain('activeTab');
  });

  it('keeps legacy Pages domains out of content and sitemap configuration', () => {
    expect(JSON.stringify(seoPages)).not.toContain(LEGACY_DOMAIN);
    expect(JSON.stringify(privacyContent)).not.toContain(LEGACY_DOMAIN);
    expect(JSON.stringify(SITE_PATH_LASTMOD)).not.toContain(LEGACY_DOMAIN);
  });
});

describe('seo regression: sitemap integrity', () => {
  it('has a curated lastmod for every indexable path, in YYYY-MM-DD form', () => {
    for (const path of INDEXABLE_SITE_PATHS) {
      const lastmod = lastModForPath(path);
      expect(lastmod, `lastmod for ${path}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('only curates lastmod for paths that are actually indexable', () => {
    for (const path of Object.keys(SITE_PATH_LASTMOD)) {
      expect(INDEXABLE_SITE_PATHS, `${path} is curated but not indexable`).toContain(path);
    }
  });
});

describe('seo regression: guide page structured data', () => {
  const config = Object.values(seoPages)[0];

  it('renders a TechArticle whose author and dateModified match visible content', () => {
    const { head } = render(SeoContentPage, { props: { config } });
    const techArticleMatch = head.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"TechArticle"[^<]*)<\/script>/);
    expect(techArticleMatch).toBeTruthy();
    const techArticle = JSON.parse(techArticleMatch![1]) as Record<string, unknown>;
    expect(techArticle.headline).toBe(config.h1);
    expect(techArticle.dateModified).toBe(lastModForPath(config.path));
    expect(techArticle.author).toMatchObject({ '@type': 'Person', name: 'Adham Haitham' });
    expect((techArticle.publisher as Record<string, unknown>)['@id']).toBe(`${SITE_URL}/#organization`);
  });
});

describe('seo regression: llms.txt machine-readable facts', () => {
  it('states version, license, and support without false open-source claims', async () => {
    const llmsModule = await import('../../routes/llms.txt/+server');
    const response = llmsModule.GET();
    const body = await response.text();

    expect(body).not.toMatch(/open.source/i);
    expect(body).toContain('source-available');
    expect(body).toContain(`Latest version: ${APP_VERSION}`);
    expect(body).toContain('PolyForm Noncommercial');
    expect(body).toContain('adhamhaithameid@gmail.com');
    expect(body).toContain(SITE_URL);
    expect(body).not.toContain(LEGACY_DOMAIN);
  });
});
