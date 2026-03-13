import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { queryPostCards } from '../entrypoints/content/post-card-utils';

const materialDetailsFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/classroom/material-details-en.html'),
  'utf8',
);
const assignmentDetailsFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/classroom/assignment-details-en.html'),
  'utf8',
);
const announcementDetailFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/classroom/announcement-detail-en.html'),
  'utf8',
);
const studentWorkTeacherFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/classroom/student-work-teacher-en.html'),
  'utf8',
);
const studentSubmissionsFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/classroom/student-submissions-en.html'),
  'utf8',
);

async function loadObserversModule() {
  vi.resetModules();
  const injectButtonIntoAttachment = vi.fn((container: HTMLElement) => {
    container.setAttribute('data-cqd-processed', 'true');
    if (!container.querySelector('[data-cqd-injected="true"]')) {
      const marker = document.createElement('button');
      marker.setAttribute('data-cqd-injected', 'true');
      container.appendChild(marker);
    }
  });
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

describe('remaining Classroom detail surface regressions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/fixture'));
  });

  it('keeps material details attachments actionable while skipping comment shells', async () => {
    document.body.innerHTML = materialDetailsFixture;
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();

    mod.injectSingleFileButtons(document.body);

    expect(injectButtonIntoAttachment).toHaveBeenCalledTimes(1);
    expect(injectButtonIntoAttachment).toHaveBeenCalledWith(
      document.querySelector('.KlRXdf'),
      'https://drive.google.com/file/d/FIXTURE_DRIVE_FILE_ID_PLACEHOLDER/view?usp=classroom_web&authuser=0',
    );
  });

  it('keeps assignment details free from random buttons on unsupported links', async () => {
    document.body.innerHTML = assignmentDetailsFixture;
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();

    mod.injectSingleFileButtons(document.body);

    expect(injectButtonIntoAttachment).not.toHaveBeenCalled();
  });

  it('keeps announcement detail anchored to one outer card', async () => {
    document.body.innerHTML = announcementDetailFixture;
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();

    mod.injectSingleFileButtons(document.body);
    const cards = queryPostCards();

    expect(injectButtonIntoAttachment).not.toHaveBeenCalled();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toBe(document.querySelector('[data-stream-item-id="fixture-announcement-1"]'));
  });

  it('keeps teacher submissions controls free from stray buttons', async () => {
    document.body.innerHTML = studentWorkTeacherFixture;
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();

    mod.injectSingleFileButtons(document.body);

    expect(injectButtonIntoAttachment).not.toHaveBeenCalled();
  });

  it('keeps student submission rows deduplicated and free from random buttons', async () => {
    document.body.innerHTML = studentSubmissionsFixture;
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();

    mod.injectSingleFileButtons(document.body);
    const cards = queryPostCards();

    expect(injectButtonIntoAttachment).not.toHaveBeenCalled();
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.getAttribute('data-stream-item-id'))).toEqual([
      'fixture-submission-1',
      'fixture-submission-2',
    ]);
  });
});
