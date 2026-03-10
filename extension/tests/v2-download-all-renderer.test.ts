// filepath: extension/tests/v2-download-all-renderer.test.ts
/**
 * ============================================================================
 * V2 DOWNLOAD ALL RENDERER — Test Suite
 * ============================================================================
 *
 * Tests for the Download All button's progress tracking, state management,
 * and file grouping utilities.
 *
 * @author Adham — Download All is the feature users love the most
 * @since v4.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createProgress,
  getProgressState,
  updateDownloadAllUI,
  resetDownloadAllButton,
  findDownloadAllButton,
} from '../src/v2/render/download-all-renderer';
import { getFileIdAttr } from '../src/v2/decision/file-placement';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create a mock Download All button.
 */
function mockDownloadAllButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'cqd-v2-btn cqd-download-all';

  const icon = document.createElement('span');
  icon.className = 'cqd-v2-icon cqd-icon-download';

  const label = document.createElement('span');
  label.className = 'cqd-v2-label';
  label.textContent = 'Download All';

  const count = document.createElement('span');
  count.className = 'cqd-v2-count';
  count.textContent = '0';

  btn.appendChild(icon);
  btn.appendChild(label);
  btn.appendChild(count);

  return btn;
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

describe('Download All Renderer: Progress Tracking', () => {
  it('createProgress starts with all files pending', () => {
    const progress = createProgress(5);

    expect(progress.total).toBe(5);
    expect(progress.completed).toBe(0);
    expect(progress.inProgress).toBe(0);
    expect(progress.failed).toBe(0);
    expect(progress.pending).toBe(5);
    expect(progress.cancelled).toBe(false);
  });

  it('createProgress works with 0 files', () => {
    const progress = createProgress(0);
    expect(progress.total).toBe(0);
    expect(progress.pending).toBe(0);
  });
});

// ============================================================================
// STATE COMPUTATION
// ============================================================================

describe('Download All Renderer: State Computation', () => {
  it('idle state when nothing started', () => {
    const progress = createProgress(3);
    expect(getProgressState(progress)).toBe('idle');
  });

  it('downloading state when files in progress', () => {
    const progress = createProgress(3);
    progress.inProgress = 1;
    progress.pending = 2;
    expect(getProgressState(progress)).toBe('downloading');
  });

  it('success state when all completed', () => {
    const progress = createProgress(3);
    progress.completed = 3;
    progress.pending = 0;
    expect(getProgressState(progress)).toBe('success');
  });

  it('error state when all failed', () => {
    const progress = createProgress(3);
    progress.failed = 3;
    progress.pending = 0;
    expect(getProgressState(progress)).toBe('error');
  });

  it('partial state when some completed and some failed', () => {
    const progress = createProgress(3);
    progress.completed = 2;
    progress.failed = 1;
    progress.pending = 0;
    expect(getProgressState(progress)).toBe('partial');
  });

  it('cancelled state overrides everything', () => {
    const progress = createProgress(3);
    progress.inProgress = 2;
    progress.cancelled = true;
    expect(getProgressState(progress)).toBe('cancelled');
  });

  it('cancelled takes priority over success', () => {
    const progress = createProgress(3);
    progress.completed = 3;
    progress.pending = 0;
    progress.cancelled = true;
    expect(getProgressState(progress)).toBe('cancelled');
  });
});

// ============================================================================
// UI UPDATES
// ============================================================================

describe('Download All Renderer: UI Updates', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('updateDownloadAllUI sets loading state', () => {
    const btn = mockDownloadAllButton();
    document.body.appendChild(btn);

    const progress = createProgress(3);
    progress.inProgress = 1;
    progress.completed = 1;
    progress.pending = 1;

    updateDownloadAllUI(btn, progress);

    expect(btn.classList.contains('cqd-loading')).toBe(true);
    expect(btn.querySelector('.cqd-v2-label')!.textContent).toBe('Downloading');
    expect(btn.querySelector('.cqd-v2-count')!.textContent).toBe('1/3');
  });

  it('updateDownloadAllUI sets success state', () => {
    const btn = mockDownloadAllButton();
    document.body.appendChild(btn);

    const progress = createProgress(3);
    progress.completed = 3;
    progress.pending = 0;

    updateDownloadAllUI(btn, progress);

    expect(btn.classList.contains('cqd-success')).toBe(true);
    expect(btn.querySelector('.cqd-v2-label')!.textContent).toBe('Downloaded');
  });

  it('updateDownloadAllUI sets error state', () => {
    const btn = mockDownloadAllButton();
    document.body.appendChild(btn);

    const progress = createProgress(3);
    progress.failed = 3;
    progress.pending = 0;

    updateDownloadAllUI(btn, progress);

    expect(btn.classList.contains('cqd-error')).toBe(true);
    expect(btn.querySelector('.cqd-v2-label')!.textContent).toBe('Failed');
    expect(btn.querySelector('.cqd-v2-count')!.textContent).toBe('3');
  });

  it('updateDownloadAllUI sets cancelled state', () => {
    const btn = mockDownloadAllButton();
    document.body.appendChild(btn);

    const progress = createProgress(3);
    progress.completed = 1;
    progress.cancelled = true;

    updateDownloadAllUI(btn, progress);

    expect(btn.classList.contains('cqd-cancelled')).toBe(true);
    expect(btn.querySelector('.cqd-v2-label')!.textContent).toBe('Cancelled');
    expect(btn.querySelector('.cqd-v2-count')!.textContent).toBe('1/3');
  });

  it('updateDownloadAllUI clears previous state classes', () => {
    const btn = mockDownloadAllButton();
    btn.classList.add('cqd-loading');
    document.body.appendChild(btn);

    const progress = createProgress(3);
    progress.completed = 3;
    progress.pending = 0;

    updateDownloadAllUI(btn, progress);

    expect(btn.classList.contains('cqd-loading')).toBe(false);
    expect(btn.classList.contains('cqd-success')).toBe(true);
  });
});

// ============================================================================
// RESET
// ============================================================================

describe('Download All Renderer: Reset', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('resetDownloadAllButton restores idle state', () => {
    const btn = mockDownloadAllButton();
    btn.classList.add('cqd-success');
    btn.querySelector('.cqd-v2-label')!.textContent = 'Downloaded';
    btn.querySelector('.cqd-v2-count')!.textContent = '5';
    document.body.appendChild(btn);

    resetDownloadAllButton(btn, 3);

    expect(btn.classList.contains('cqd-success')).toBe(false);
    expect(btn.classList.contains('cqd-loading')).toBe(false);
    expect(btn.querySelector('.cqd-v2-label')!.textContent).toBe('Download All');
    expect(btn.querySelector('.cqd-v2-count')!.textContent).toBe('3');
  });

  it('resetDownloadAllButton clears all state classes', () => {
    const btn = mockDownloadAllButton();
    btn.classList.add('cqd-loading', 'cqd-error', 'cqd-cancelled');
    document.body.appendChild(btn);

    resetDownloadAllButton(btn, 2);

    expect(btn.classList.contains('cqd-loading')).toBe(false);
    expect(btn.classList.contains('cqd-error')).toBe(false);
    expect(btn.classList.contains('cqd-cancelled')).toBe(false);
  });
});

// ============================================================================
// FIND BUTTON
// ============================================================================

describe('Download All Renderer: findDownloadAllButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds existing Download All button by post ID', () => {
    const post = document.createElement('div');
    const btn = document.createElement('button');
    btn.setAttribute(getFileIdAttr(), 'download-all:post-123');
    post.appendChild(btn);
    document.body.appendChild(post);

    const found = findDownloadAllButton(post, 'post-123');
    expect(found).toBe(btn);
  });

  it('returns null when no Download All button exists', () => {
    const post = document.createElement('div');
    document.body.appendChild(post);

    const found = findDownloadAllButton(post, 'no-such-post');
    expect(found).toBeNull();
  });
});
