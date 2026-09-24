import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TESTIMONIALS,
  TESTIMONIAL_AGGREGATE,
  mergeLiveTestimonials
} from './data';

const componentSource = readFileSync(
  join(__dirname, '../components/TestimonialsSection.svelte'),
  'utf8'
);

describe('testimonials data integrity', () => {
  it('contains only 5-star reviews, each with a real store link', () => {
    for (const r of TESTIMONIALS) {
      expect(r.rating).toBe(5);
      expect(r.href).toMatch(/^https:\/\/(chromewebstore\.google\.com|microsoftedge\.microsoft\.com|addons\.mozilla\.org)/);
      expect(r.text.length).toBeGreaterThan(0);
    }
  });

  it('shows reviews from all three stores', () => {
    const stores = new Set(TESTIMONIALS.map((r) => r.store));
    expect(stores).toEqual(new Set(['chrome', 'edge', 'firefox']));
  });

  it('gives every chrome reviewer a shipped avatar asset', () => {
    for (const r of TESTIMONIALS.filter((r) => r.avatar)) {
      expect(r.avatar).toMatch(/^\/testimonials\/avatars\/[a-z0-9-]+\.png$/);
    }
  });

  it('keeps the aggregate equal to the real weighted store average', () => {
    // chrome 4.8x25 + edge 5.0x2 + firefox 4.0x4
    expect(((4.8 * 25 + 5.0 * 2 + 4.0 * 4) / 31).toFixed(1)).toBe(
      TESTIMONIAL_AGGREGATE.score.toFixed(1)
    );
    expect(TESTIMONIAL_AGGREGATE.ratings).toBe(31);
    // per-store counts must sum to the stated total
    const sum = Object.values(TESTIMONIAL_AGGREGATE.counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(TESTIMONIAL_AGGREGATE.ratings);
  });

  it('never attributes a review to the developer', () => {
    const developerNames = ['adham haitham eid', 'adham haitham'];
    for (const r of TESTIMONIALS) {
      expect(developerNames).not.toContain(r.name.toLowerCase());
    }
  });
});

describe('live review merge guard rails', () => {
  it('keeps the baseline intact when no live reviews arrive', () => {
    expect(mergeLiveTestimonials(TESTIMONIALS, undefined)).toEqual(TESTIMONIALS);
    expect(mergeLiveTestimonials(TESTIMONIALS, [])).toEqual(TESTIMONIALS);
  });

  it('appends only new 5-star reviews and drops duplicates and developer entries', () => {
    const base = TESTIMONIALS[0];
    const merged = mergeLiveTestimonials(TESTIMONIALS, [
      { reviewer: 'New Person', rating: 5, text: 'brand new review', dateText: 'Oct 1, 2026', store: 'chrome' },
      { reviewer: 'New Person', rating: 5, text: 'brand new review', dateText: 'Oct 1, 2026', store: 'chrome' },
      { reviewer: 'Adham Haitham Eid', rating: 5, text: 'self review attempt', dateText: 'Oct 1, 2026', store: 'chrome' },
      { reviewer: 'Meh Person', rating: 3, text: 'three star should not show', dateText: 'Oct 1, 2026', store: 'chrome' },
      { reviewer: base.name, rating: 5, text: base.text, dateText: base.date, store: 'chrome' }
    ]);
    expect(merged.length).toBe(TESTIMONIALS.length + 1);
    expect(merged.at(-1)?.name).toBe('New Person');
    expect(merged.some((r) => r.name === 'Adham Haitham Eid')).toBe(false);
    expect(merged.some((r) => r.rating !== 5)).toBe(false);
  });
});

describe('testimonials section guardrails', () => {
  it('renders reviews from the shared data module with no progress bar or counter', () => {
    expect(componentSource).toContain('r.text.replace');
    expect(componentSource).not.toMatch(/ts-progress|ts-counter/i);
  });

  it('keeps carousel a11y roles and site-matching header hierarchy', () => {
    expect(componentSource).toContain('aria-roledescription="carousel"');
    expect(componentSource).toContain('aria-roledescription="slide"');
    expect(componentSource).toContain('Previous testimonials');
    expect(componentSource).toContain('Next testimonials');
    // site pattern: letterspaced label above the title
    expect(componentSource).toContain('TESTIMONIALS');
    expect(componentSource.indexOf('ts-label')).toBeLessThan(componentSource.indexOf('ts-title'));
  });

  it('has no pause button and autoplay never stops on interaction', () => {
    expect(componentSource).not.toMatch(/ts-pause|ts-controls|stoppedByUser|hoverHold|focusHold|onManual|onToggle/i);
    expect(componentSource).toContain('setInterval');
    // arrows navigate without stopping the timer
    expect(componentSource).toContain('on:click={() => go(-1)}');
    expect(componentSource).toContain('on:click={() => go(1)}');
    // autoplay still yields to the reduced-motion accessibility setting
    expect(componentSource).toContain('prefers-reduced-motion: reduce');
  });

  it('uses the shared browser icon sprite and the magnetic action', () => {
    expect(componentSource).toContain('use:magnetic');
    expect(componentSource).toContain('#cqd-logo-');
    expect(componentSource).toContain("from '$lib/actions/magnetic'");
  });

  it('references real reviewer avatars that exist on disk', () => {
    for (const r of TESTIMONIALS.filter((t) => t.avatar)) {
      const file = join(__dirname, '../../../static', r.avatar ?? '');
      expect(() => readFileSync(file)).not.toThrow();
    }
  });
});
