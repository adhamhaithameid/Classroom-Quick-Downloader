/**
 * Regression suite for the shared V1 group machine (src/download-all/refresh.ts).
 *
 * Pins the #537 sticky semantics the classroom fork carries
 * (entrypoints/download_all.content.ts:597-637) and the mid-run re-flush:
 * - inProgress is LIVE state — seeding it made groups hang busy forever.
 * - downloaded/failed are STICKY — per-file buttons auto-reset to idle 2-3 s
 *   after settling (waitForSuccessReset), and a class-only recomputation
 *   would erase the outcome mid-run.
 * - While a run is active the group re-evaluates on a bounded trailing timer,
 *   so terminal windows (2-3 s) are actually observed and the group settles.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GroupState, FileEntry } from '../src/download-all/types';
import { updateGroupState } from '../src/download-all/refresh';
import { handleDownloadAllClick } from '../src/download-all/button-controller';
import { GROUP_FEEDBACK_SUCCESS_MS } from '../src/download-all/state';

vi.mock('../entrypoints/content/i18n', () => ({ t: (key: string) => key }));
vi.mock('../entrypoints/content/icons', () => ({
  CANCEL_ICON_SVG_URL: 'cancel.svg',
  DOWNLOAD_ICON_SVG_URL: 'download.svg',
}));
vi.mock('../entrypoints/content/theme', () => ({ isPageDark: () => false }));

function makeGroup(fileCount: number): { group: GroupState; buttons: HTMLButtonElement[] } {
  const root = document.createElement('div');
  const header = document.createElement('div');
  header.className = 'N5dSp';
  root.appendChild(header);
  document.body.appendChild(root);

  const files = new Map<string, FileEntry>();
  const buttons: HTMLButtonElement[] = [];
  for (let i = 0; i < fileCount; i += 1) {
    const btn = document.createElement('button');
    btn.className = 'cqd-download-btn';
    btn.dataset['cqdFileKey'] = `file-${i}`;
    const label = document.createElement('span');
    label.className = 'cqd-label';
    btn.appendChild(label);
    root.appendChild(btn);
    buttons.push(btn);
    files.set(`file-${i}`, {
      key: `file-${i}`,
      buttons: new Set([btn]),
      downloaded: false,
      failed: false,
      inProgress: false,
    });
  }

  const group: GroupState = {
    root,
    files,
    downloadAllBtn: null,
    activated: false,
    isBusy: false,
    cancelPending: false,
  };
  return { group, buttons };
}

/** One trailing-flush tick: the 250 ms re-arm plus the rAF flush frame. */
function tickTrailingFlush(): void {
  vi.advanceTimersByTime(250);
  vi.advanceTimersByTime(16);
}

function allButtonLabel(group: GroupState): string {
  return group.downloadAllBtn?.querySelector<HTMLElement>('.cqd-download-all-main')?.textContent ?? '';
}

describe('shared group machine sticky semantics (#537 family, bead km60)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('A: a file that leaves loading without a terminal class must not keep the group busy', () => {
    const { group, buttons } = makeGroup(2);
    // State computation only runs for an active group (the not-activated
    // branch renders the idle label and returns) — same gate as the fork.
    group.activated = true;

    buttons[0].classList.add('cqd-loading');
    updateGroupState(group);
    expect(group.isBusy).toBe(true);

    buttons[0].classList.remove('cqd-loading');
    updateGroupState(group);
    expect(group.isBusy).toBe(false);
    expect(group.files.get('file-0')?.inProgress).toBe(false);
  });

  it('B: a failure survives the per-button auto-reset to idle (sticky failed)', () => {
    const { group, buttons } = makeGroup(2);
    group.activated = true;

    buttons[0].classList.add('cqd-error');
    updateGroupState(group);
    expect(group.files.get('file-0')?.failed).toBe(true);

    buttons[0].classList.remove('cqd-error');
    updateGroupState(group);
    expect(group.files.get('file-0')?.failed).toBe(true);
  });

  it('C: a success survives the per-button auto-reset to idle (sticky downloaded)', () => {
    const { group, buttons } = makeGroup(2);
    group.activated = true;

    buttons[0].classList.add('cqd-success');
    updateGroupState(group);
    expect(group.files.get('file-0')?.downloaded).toBe(true);

    buttons[0].classList.remove('cqd-success');
    updateGroupState(group);
    expect(group.files.get('file-0')?.downloaded).toBe(true);
  });

  it('D: a run reaches its terminal label and auto-resets via the trailing flush', () => {
    const { group, buttons } = makeGroup(2);

    handleDownloadAllClick(group);
    expect(group.activated).toBe(true);

    buttons[0].classList.add('cqd-loading');
    buttons[1].classList.add('cqd-loading');
    updateGroupState(group);
    expect(group.isBusy).toBe(true);
    expect(allButtonLabel(group)).toBe('downloading');

    // File 0 settles visibly, then auto-resets to idle after the feedback
    // window; the trailing flush must observe the success while it shows.
    buttons[0].classList.remove('cqd-loading');
    buttons[0].classList.add('cqd-success');
    tickTrailingFlush();
    expect(group.files.get('file-0')?.downloaded).toBe(true);
    buttons[0].classList.remove('cqd-success');

    // File 1 fails visibly, then auto-resets to idle.
    buttons[1].classList.remove('cqd-loading');
    buttons[1].classList.add('cqd-error');
    tickTrailingFlush();
    expect(group.files.get('file-1')?.failed).toBe(true);
    buttons[1].classList.remove('cqd-error');

    // Both outcomes sticky -> allCompleted -> terminal label, reset armed.
    tickTrailingFlush();
    expect(group.downloadAllBtn?.classList.contains('cqd-all-success')).toBe(true);
    expect(allButtonLabel(group)).toBe('downloaded');

    // The reset window closes: flags clear, label returns to idle.
    vi.advanceTimersByTime(GROUP_FEEDBACK_SUCCESS_MS);
    tickTrailingFlush();
    expect(group.activated).toBe(false);
    expect(group.isBusy).toBe(false);
    expect(group.files.get('file-0')?.downloaded).toBe(false);
    expect(group.downloadAllBtn?.classList.contains('cqd-all-success')).toBe(false);
    expect(allButtonLabel(group)).toBe('downloadAll');
  });
});
