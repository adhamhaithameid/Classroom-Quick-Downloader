/**
 * Route A smoke tests — the REAL popup App mounts in jsdom against the
 * fixture chrome. One scenario per block; each installs its fixture before
 * the App renders, exactly like the dev simulator does.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixture, installFixtureChrome } from '../src/fixtures/fixture-chrome';
import {
  corruptStatsStorage,
  firstRunFixture,
  historyRowsFixtureHelpers,
  localStatsStorage,
  preSchemaSettingsStorage,
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

  it('changelog fetch fails: the error line and Retry render in the overlay', async () => {
    const el = await renderApp({ ...firstRunFixture(), changelog: 'fail' });
    // Open the changelog through the REAL version button.
    await act(async () => {
      el.querySelector<HTMLButtonElement>('.cqd-brand-version')?.click();
      await tick(50);
    });
    const state = el.querySelector('.cqd-cl-state-error');
    expect(state).not.toBeNull();
    expect(state?.textContent).toContain('Simulator: the changelog fetch failed.');
    expect(el.querySelector('.cqd-cl-retry-btn')).not.toBeNull();
  });

  it('changelog offline: the cache-fallback warn line renders with the cached entries', async () => {
    const el = await renderApp({ ...firstRunFixture(), changelog: 'offline' });
    await act(async () => {
      el.querySelector<HTMLButtonElement>('.cqd-brand-version')?.click();
      await tick(50);
    });
    const warn = el.querySelector('.cqd-cl-state-warn');
    expect(warn).not.toBeNull();
    expect(warn?.textContent).toContain('cached changelog');
    // The cached copy renders under the warn line and marks the installed
    // version "Current" — production's offline view shows the same shape.
    expect(el.querySelector('.cqd-cl-entry')).not.toBeNull();
    expect(el.querySelector('.cqd-cl-tag-current')?.textContent).toBe('Current');
  });

  it('corrupt stats: a checksum-invalid record resets to an honest level 0', async () => {
    const el = await renderApp({
      ...firstRunFixture(),
      storage: {
        ...settingsStorage(),
        ...corruptStatsStorage(),
        ...localStatsStorage({}),
      },
    });
    // The stored record claims 137; the failed integrity check resets it.
    expect(el.querySelector('.cqd-lifetime-count')?.textContent).toBe('0');
    expect(el.textContent).toContain('Level 0 — download your first file');
  });

  it('upgraded install: pre-schema storage migrates and stamps v2 on load', async () => {
    const el = await renderApp({
      ...firstRunFixture(),
      storage: {
        ...preSchemaSettingsStorage(),
        ...statsStorage(0),
        ...localStatsStorage({}),
      },
    });
    // The REAL migration write landed in the fixture store: stored values
    // survive (Edited off), the new keys back-fill, and the stamp appears.
    const storage = fixture().storage;
    expect(storage.cqdSettingsSchemaVersion).toBe(2);
    expect(storage.editedFlagEnabled).toBe(false);
    expect(storage.reducedMotionPreferred).toBe(false);
    // The migrated Edited-off value drives the real pill state.
    const edited = el.querySelector<HTMLButtonElement>('button[data-flag="editedFlagEnabled"]');
    expect(edited?.getAttribute('aria-pressed')).toBe('false');
  });

  it('engine API gated: the beta segment is disabled with the setup tooltip', async () => {
    const el = await renderApp(firstRunFixture());
    const api = el.querySelector<HTMLButtonElement>('button[data-mode="v3"]');
    expect(api).not.toBeNull();
    expect(api!.disabled).toBe(true);
    expect(api!.getAttribute('title')).toContain('Requires OAuth setup');
  });

  it('history corrupt record: renders without crashing', async () => {
    const el = await renderApp({
      ...firstRunFixture(),
      historyRows: [historyRowsFixtureHelpers.corrupt()],
    });
    const list = el.querySelector('.cqd-history-list');
    expect(list).not.toBeNull();
    expect(list!.textContent).toContain('Invalid Date');
  });

  it('options route: the real options page mounts with permissions rows', async () => {
    installFixtureChrome(firstRunFixture());
    container = document.createElement('div');
    document.body.appendChild(container);
    const { OptionsApp } = await import('../../extension/entrypoints/options/OptionsApp');
    await act(async () => {
      root = createRoot(container!);
      root.render(<OptionsApp />);
    });
    await act(async () => {
      await tick(50);
    });
    expect(container!.querySelector('.cqd-options')).not.toBeNull();
    expect(container!.textContent).toContain('Settings apply immediately');
    // The standing Permissions reference renders its rows on this surface.
    expect(container!.querySelector('.cqd-options-perms')?.textContent).toContain('Permissions');
    expect(container!.querySelectorAll('.cqd-perm-row').length).toBeGreaterThan(0);
  });
});
