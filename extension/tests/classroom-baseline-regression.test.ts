import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { queryPostCards } from '../entrypoints/content/post-card-utils';

const classworkMaterialFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/classroom/classwork-material-post-en.html'),
  'utf8',
);
const streamFlaggedFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/classroom/stream-flagged-post-en.html'),
  'utf8',
);

async function loadObserversModule() {
  vi.resetModules();
  const injectButtonIntoAttachment = vi.fn();
  const extractDriveUrlFromAnchor = vi.fn((anchor: HTMLAnchorElement) => anchor.href || null);
  const findDriveUrl = vi.fn(() => 'https://drive.google.com/file/d/FIXTURE_DRIVE_FILE_ID_PLACEHOLDER');
  const injectStyles = vi.fn();

  const state = {
    scanTimeoutId: null as number | null,
    observer: null as MutationObserver | null,
    rescanIntervalId: null as number | null,
    effectiveEnabled: true,
    initialized: false,
  };

  vi.doMock('../entrypoints/content/state', () => ({
    get scanTimeoutId() { return state.scanTimeoutId; },
    setScanTimeoutId: (id: number | null) => { state.scanTimeoutId = id; },
    get observer() { return state.observer; },
    setObserver: (obs: MutationObserver | null) => { state.observer = obs; },
    get rescanIntervalId() { return state.rescanIntervalId; },
    setRescanIntervalId: (id: number | null) => { state.rescanIntervalId = id; },
    get effectiveEnabled() { return state.effectiveEnabled; },
    setEffectiveEnabled: (enabled: boolean) => { state.effectiveEnabled = enabled; },
    get initialized() { return state.initialized; },
    setInitialized: (next: boolean) => { state.initialized = next; },
    RESCAN_DEBOUNCE_MS: 1,
    RESCAN_INTERVAL_MS: 1000,
    CLASSROOM_URL_PATTERN: /^https:\/\/classroom\.google\.com\//,
    DRIVE_ANCHOR_SELECTOR: 'a[href*="drive.google.com"], a[href*="docs.google.com"]',
    ATTACHMENT_CONTAINER_SELECTOR: '[data-attachment-id], .luto0c, .KlRXdf, [data-drive-id]',
    INJECTED_ATTR: 'data-cqd-injected',
    PROCESSED_ATTR: 'data-cqd-processed',
  }));
  vi.doMock('../entrypoints/content/button-factory', () => ({
    injectButtonIntoAttachment,
  }));
  vi.doMock('../entrypoints/content/url-utils', () => ({
    extractDriveUrlFromAnchor,
    findDriveUrl,
  }));
  vi.doMock('../entrypoints/content/styles', () => ({
    injectStyles,
  }));

  const mod = await import('../entrypoints/content/observers');
  return { mod, injectButtonIntoAttachment };
}

describe('real-structure Classroom regression fixtures', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/fixture'));
  });

  it('injects exactly one button for the real attachment card and ignores loose body links', async () => {
    document.body.innerHTML = classworkMaterialFixture;
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();

    mod.injectSingleFileButtons(document.body);

    expect(injectButtonIntoAttachment).toHaveBeenCalledTimes(1);
    expect(injectButtonIntoAttachment).toHaveBeenCalledWith(
      document.querySelector('.luto0c'),
      'https://drive.google.com/file/d/FIXTURE_DRIVE_FILE_ID_PLACEHOLDER/view?usp=classroom_web&authuser=0',
    );
  });

  it('keeps mixed-content classwork fixture as one post card', () => {
    document.body.innerHTML = classworkMaterialFixture;

    const cards = queryPostCards();

    expect(cards).toHaveLength(1);
    expect(cards[0]).toBe(document.querySelector('[data-stream-item-id="fixture-stream-1"]'));
  });

  it('keeps flagged stream fixture as one post card and preserves edited/comment text', () => {
    document.body.innerHTML = streamFlaggedFixture;

    const cards = queryPostCards();

    expect(cards).toHaveLength(1);
    expect(cards[0]).toBe(document.querySelector('[data-stream-item-id="fixture-stream-2"]'));
    expect(cards[0]?.textContent).toContain('Edited Mar 10');
    expect(cards[0]?.textContent).toContain('5 class comments');
  });
});
