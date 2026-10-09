/**
 * Route A smoke tests — the REAL popup App mounts in jsdom against the
 * fixture chrome. One scenario per block; each installs its fixture before
 * the App renders, exactly like the dev simulator does.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installFixtureChrome } from '../src/fixtures/fixture-chrome';
import {
  firstRunFixture,
  historyRowsFixtureHelpers,
  localStatsStorage,
  settingsStorage,
  statsStorage,
  type FixtureState,
} from '../src/fixtures/fixture-state';
import {
  confettiBurstCount,
  resetConfettiBursts,
} from './confetti-stub';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function tick(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderApp(fixture: FixtureState): Promise<HTMLDivElement> {
  installFixtureChrome(fixture);
  container = document.createElement('div');
  document.body.appendChild(container);
  const { default: App } = await import('../../extension/entrypoints/popup/App');
  await act(async () => {
    root = createRoot(container!);
    root.render(<App />);
  });
  // The history fetch alone debounces 200ms; settle past every timer.
  await act(async () => {
    await tick(500);
  });
  return container;
}

beforeEach(() => {
  resetConfettiBursts();
  document.body.innerHTML = '';
  container = null;
  root = null;
});

afterEach(async () => {
  const currentRoot = root;
  await act(async () => {
    currentRoot?.unmount();
  });
  document.body.innerHTML = '';
});

describe('simulator route A — real popup App', () => {
  it('first-run: mounts the real App with level 0, empty history, zero stats', async () => {
    const el = await renderApp(firstRunFixture());
    expect(el.querySelector('.cqd-app')).not.toBeNull();
    expect(el.textContent).toContain('Classroom Quick Downloader');
    expect(el.textContent).toContain('Download Activity');
    expect(el.textContent).toContain('Level 0 — download your first file');
    expect(el.textContent).toContain('No downloads yet');
    // Zero stats → the donut shows the empty ring, no segments.
    expect(el.querySelectorAll('.cqd-ring-segment').length).toBe(1);
    // Queue idle → no queue panel.
    expect(el.querySelector('.cqd-card-queue')).toBeNull();
  });

  it('first-download: milestone toast plays and the real confetti burst fires', async () => {
    const el = await renderApp({
      ...firstRunFixture(),
      storage: {
        ...settingsStorage(),
        ...statsStorage(1, { pending: 1, last: 1 }),
        ...localStatsStorage({ pdf: 1 }),
      },
      historyRows: historyRowsFixtureHelpers.firstSuccess(),
    });
    expect(confettiBurstCount()).toBeGreaterThan(0);
    expect(el.querySelector('.cqd-milestone-toast')?.textContent).toContain(
      'Level 1 reached — first file downloaded!',
    );
    // The first download shows up in the history list.
    expect(el.querySelector('.cqd-history-list')?.textContent).toContain('syllabus.pdf');
  });

  it('history failure surface: failed rows render the error state classes', async () => {
    const el = await renderApp({
      ...firstRunFixture(),
      historyRows: historyRowsFixtureHelpers.mixed(),
    });
    expect(el.querySelector('.cqd-history-state-fail')).not.toBeNull();
    expect(el.querySelectorAll('.cqd-history-state-ok').length).toBe(2);
  });

  it('non-classroom: the redirect card replaces the main controls', async () => {
    const el = await renderApp({
      ...firstRunFixture(),
      tabUrl: 'https://github.com/adhamhaithameid',
    });
    expect(el.textContent).toContain('Use it on Google Classroom');
    expect(el.querySelector('.cqd-open-classroom-btn')).not.toBeNull();
    expect(el.querySelector('.cqd-card-analytics')).toBeNull();
  });
});
