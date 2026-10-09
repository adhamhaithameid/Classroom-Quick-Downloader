// CQD Simulator tests — the map must list the full state matrix.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { installFixtureChrome } from '../src/fixtures/fixture-chrome';
import { firstRunFixture } from '../src/fixtures/fixture-state';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  const currentRoot = root;
  await act(async () => {
    currentRoot?.unmount();
  });
  document.body.innerHTML = '';
});

describe('state map', () => {
  it('lists at least 20 deep-linkable states across groups', async () => {
    installFixtureChrome(firstRunFixture());
    container = document.createElement('div');
    document.body.appendChild(container);
    const { MapRoute } = await import('../src/routes/MapRoute');
    await act(async () => {
      root = createRoot(container!);
      root.render(<MapRoute />);
    });
    const cards = container!.querySelectorAll('a.sim-map-card');
    expect(cards.length).toBeGreaterThanOrEqual(20);
    // Every card deep-links somewhere real.
    for (const card of cards) {
      expect(card.getAttribute('href')).toMatch(/^#(popup|page|options)=/);
    }
    // The required groups render.
    const text = container!.textContent ?? '';
    for (const group of [
      'First run',
      'First download',
      'Milestones',
      'Levels',
      'Queue',
      'History',
      'Changelog',
      'Storage integrity',
      'Engine selector',
      'Flag pills',
      'Legal',
      'Reduce motion',
      'Views',
      'Classroom pages',
    ]) {
      expect(text).toContain(group);
    }
    // The edge-state cells deep-link their registry ids.
    const hrefs = new Set(
      Array.from(cards).map((card) => card.getAttribute('href')),
    );
    for (const id of ['changelog-offline', 'stats-corrupt-reset', 'upgraded-install']) {
      expect(hrefs).toContain(`#popup=${id}`);
    }
  });
});
