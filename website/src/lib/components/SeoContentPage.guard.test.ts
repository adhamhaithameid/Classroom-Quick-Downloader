import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SeoContentPage from './SeoContentPage.svelte';
import type { SeoPageConfig } from '$lib/content/seoPages';

const config: SeoPageConfig = {
  path: '/test-page',
  title: 'Test Page',
  description: 'Test description.',
  eyebrow: 'Test Eyebrow',
  h1: 'Test Heading',
  intro: 'Test intro copy.',
  keywords: 'test',
  sections: [
    {
      heading: 'Section One',
      paragraphs: ['Paragraph one.'],
      bullets: ['Bullet one.']
    }
  ],
  faqs: [{ question: 'Q?', answer: 'A.' }],
  primaryCta: { label: 'Primary', href: '/x' },
  secondaryCta: { label: 'Secondary', href: '/y' }
};

function componentSource(): string {
  return readFileSync(new URL('./SeoContentPage.svelte', import.meta.url), 'utf8');
}

describe('SeoContentPage brand guard', () => {
  it('renders the full content structure', () => {
    const { body } = render(SeoContentPage, { props: { config } });
    const html = body.replace(/\s+/g, ' ');
    expect(html).toContain('Test Heading');
    expect(html).toContain('Section One');
    expect(html).toContain('Frequently Asked Questions');
  });

  it('renders section links as descriptive anchors for cross-linking guides', () => {
    const configWithLinks: SeoPageConfig = {
      ...config,
      sections: [
        ...config.sections,
        {
          heading: 'Browser Guides',
          paragraphs: ['Pick your browser:'],
          links: [
            { label: 'Firefox install guide', href: '/install/firefox' },
            { label: 'Edge install guide', href: '/install/edge' }
          ]
        }
      ]
    };
    const { body } = render(SeoContentPage, { props: { config: configWithLinks } });
    const html = body.replace(/\s+/g, ' ');
    expect(html).toContain('Firefox install guide');
    expect(html).toContain('Edge install guide');
    expect(html).toContain('href="/install/firefox"');
    expect(html).toContain('href="/install/edge"');
  });

  it('does not reintroduce the off-brand teal palette', () => {
    const source = componentSource();
    expect(source).not.toContain('#047857');
    expect(source).not.toContain('#0f766e');
  });

  it('uses the site green tokens instead of hardcoded brand colors', () => {
    const source = componentSource();
    expect(source).toContain('var(--gc-green');
  });

  it('keeps a real type scale: h2 clearly above body text', () => {
    const source = componentSource();
    const h2Block = source.match(/\.seo-card h2 \{[^}]*\}/)?.[0] ?? '';
    const fontSize = h2Block.match(/font-size:\s*clamp\(([^)]*)\)/)?.[1] ?? '';
    const sizes = [...fontSize.matchAll(/([\d.]+)rem/g)].map((m) => parseFloat(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThan(1.2);
  });
});
