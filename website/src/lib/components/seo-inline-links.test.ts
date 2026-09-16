import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SeoContentPage from './SeoContentPage.svelte';
import type { SeoPageConfig } from '$lib/content/seoPages';

/* Inline-link renderer guard: section paragraphs/bullets support a tiny
   markdown-style link syntax ([label](href)) so guides can cross-link
   browser install paths from inside their step bullets. Only site-relative
   and https hrefs are linkified — everything else stays literal text. */

const baseConfig: SeoPageConfig = {
  path: '/test-page',
  title: 'Test Page',
  description: 'Test description.',
  eyebrow: 'Test Eyebrow',
  h1: 'Test Heading',
  intro: 'Test intro copy.',
  keywords: 'test',
  sections: []
};

function renderBody(config: SeoPageConfig): string {
  const { body } = render(SeoContentPage, { props: { config } });
  // Normalize SSR noise: Svelte wraps each-block items in HTML comments and
  // adds scoping classes to every element. Strip both so assertions match
  // the visible markup, then collapse whitespace.
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/ class="svelte-[a-z0-9]+"/g, '')
    .replace(/\s+/g, ' ');
}

describe('SeoContentPage inline links in section text', () => {
  it('linkifies site-relative links inside step bullets', () => {
    const config: SeoPageConfig = {
      ...baseConfig,
      sections: [
        {
          heading: 'Steps',
          bullets: [
            'Install CQD from the Chrome Web Store, [Firefox Add-ons](/install/firefox), or [Edge Add-ons](/install/edge) — no account required.'
          ]
        }
      ]
    };
    const html = renderBody(config);
    expect(html).toContain('<a href="/install/firefox">Firefox Add-ons</a>');
    expect(html).toContain('<a href="/install/edge">Edge Add-ons</a>');
  });

  it('linkifies site-relative links inside section paragraphs too', () => {
    const config: SeoPageConfig = {
      ...baseConfig,
      sections: [
        {
          heading: 'Overview',
          paragraphs: ['Pick your browser from the [Firefox install guide](/install/firefox).']
        }
      ]
    };
    const html = renderBody(config);
    expect(html).toContain('<a href="/install/firefox">Firefox install guide</a>');
  });

  it('renders external https links with target=_blank and rel=noopener noreferrer', () => {
    const config: SeoPageConfig = {
      ...baseConfig,
      sections: [
        {
          heading: 'Steps',
          bullets: ['Add it from [Chrome Web Store](https://chromewebstore.google.com/x) in one click.']
        }
      ]
    };
    const html = renderBody(config);
    expect(html).toContain(
      '<a href="https://chromewebstore.google.com/x" target="_blank" rel="noopener noreferrer">Chrome Web Store</a>'
    );
  });

  it('renders plain bullets without any anchor', () => {
    const config: SeoPageConfig = {
      ...baseConfig,
      sections: [
        {
          heading: 'Steps',
          bullets: ['Open Google Classroom normally and navigate to any class.']
        }
      ]
    };
    const html = renderBody(config);
    expect(html).toContain('Open Google Classroom normally and navigate to any class.');
    // Match a real anchor open tag, not the "<a" prefix of "<article".
    expect(html).not.toMatch(/<a[\s>]/);
  });

  it('never linkifies unsafe hrefs such as javascript: URLs', () => {
    const config: SeoPageConfig = {
      ...baseConfig,
      sections: [
        {
          heading: 'Steps',
          bullets: ['Try [x](javascript:alert(1)) at your own risk.']
        }
      ]
    };
    const html = renderBody(config);
    expect(html).not.toMatch(/<a[\s>]/);
    // The raw syntax stays as visible literal text instead of becoming a link.
    expect(html).toContain('[x](javascript:alert(1)');
  });
});
