import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import defaultPlacementsSeed from '$lib/svgCatalog/defaultPlacements.v2.json';
import OverviewPage from './overview/+page.svelte';

function squish(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

describe('overview visual guardrails', () => {
  it('keeps Plus Jakarta Sans preloaded and does not reintroduce Inter', () => {
    const { head } = render(OverviewPage);
    const normalizedHead = squish(head);

    expect(normalizedHead).toContain('Plus+Jakarta+Sans');
    expect(normalizedHead).not.toContain('family=Inter');
  });

  it('keeps required decorative containers for floating and 3D systems', () => {
    const { body } = render(OverviewPage);
    const html = squish(body);

    expect(html).toContain('l2-page-orbs');
    expect(html).toContain('l2-page-grid');
    expect(html).toContain('l2-page-floats');
  });

  it('keeps a minimum default placement mix and pinned supercharge star', () => {
    const placements = defaultPlacementsSeed.placements;
    const counts = placements.reduce(
      (acc, placement) => {
        acc.total += 1;
        if (placement.type === 'float') acc.float += 1;
        if (placement.type === 'doodle') acc.doodle += 1;
        if (placement.type === '3d') acc.threeD += 1;
        acc.sections.add(placement.section);
        return acc;
      },
      {
        total: 0,
        float: 0,
        doodle: 0,
        threeD: 0,
        sections: new Set<string>()
      }
    );

    expect(counts.total).toBeGreaterThanOrEqual(24);
    expect(counts.float).toBeGreaterThanOrEqual(8);
    expect(counts.doodle).toBeGreaterThanOrEqual(10);
    expect(counts.threeD).toBeGreaterThanOrEqual(2);
    expect(counts.sections.has('hero')).toBe(true);
    expect(counts.sections.has('features')).toBe(true);
    expect(counts.sections.has('proof')).toBe(true);
    expect(counts.sections.has('cta')).toBe(true);

    const pinnedStar = placements.find((placement) => placement.id === 'dd-1772174598462-101');
    expect(pinnedStar?.sampleId).toBe('D-50');
    expect(pinnedStar?.type).toBe('doodle');
  });

  it('keeps global font token and animated ambient background rules in app.css', () => {
    const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');

    expect(css).toContain('Plus+Jakarta+Sans');
    expect(css).toContain("--font-ui: 'Plus Jakarta Sans'");
    expect(css).toContain('body::before');
    expect(css).toContain('body::after');
    expect(css).toContain('@keyframes floatOrb');
  });
});
