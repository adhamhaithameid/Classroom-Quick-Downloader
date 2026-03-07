// filepath: extension/tests/v2-button-renderer.test.ts
/**
 * ============================================================================
 * V2 BUTTON RENDERER — Test Suite
 * ============================================================================
 *
 * Tests for the idempotent button renderer — template cloning, delegated
 * events, CSS-only hover states, and DOM insertion.
 *
 * @author Adham — template cloning is the single biggest perf win in V2
 * @since v4.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PlacementDecision } from '../src/engines/types';
import type { ScannedFile } from '../src/v2/model/dom-scanner';
import {
  renderButton,
  renderBatch,
  renderDownloadAllButton,
  removeStaleButtons,
  removeAllV2Buttons,
  setupDelegatedClickHandler,
  resetTemplates,
  detectDarkMode,
} from '../src/v2/render/button-renderer';
import { getFileIdAttr, getInjectedAttr } from '../src/v2/decision/file-placement';

// ============================================================================
// HELPERS
// ============================================================================

function mockFile(id: string, name: string = 'test.pdf'): ScannedFile {
  const el = document.createElement('a');
  el.href = `https://drive.google.com/file/d/${id}/view`;
  el.setAttribute('aria-label', name);
  return {
    canonicalId: `drive:${id}`,
    element: el,
    idSource: 'url-parse' as const,
    name,
    ext: name.split('.').pop() || '',
    downloadUrl: el.href,
  };
}

function mockDecision(
  fileId: string,
  target: HTMLElement,
  insertionPoint: PlacementDecision['insertionPoint'] = 'append',
): PlacementDecision {
  return {
    fileId,
    targetElement: target,
    insertionPoint,
    anchorSelector: 'test-selector',
    confidence: 90,
    reasonCodes: ['SINGLE_FILE_BUTTON', 'ANCHOR_FILE_ELEMENT'],
    fallbackUsed: false,
  };
}

// ============================================================================
// RENDER BUTTON
// ============================================================================

describe('Button Renderer: renderButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetTemplates();
  });

  it('creates a button with correct structure', () => {
    const file = mockFile('struct_20chars_paddi');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const decision = mockDecision(file.canonicalId, target);

    const btn = renderButton(decision, file);

    expect(btn).not.toBeNull();
    expect(btn!.tagName).toBe('BUTTON');
    expect(btn!.classList.contains('cqd-v2-btn')).toBe(true);
    expect(btn!.getAttribute(getInjectedAttr())).toBe('true');
    expect(btn!.getAttribute(getFileIdAttr())).toBe('drive:struct_20chars_paddi');
  });

  it('button has icon and label children', () => {
    const file = mockFile('children20charspadin');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const btn = renderButton(mockDecision(file.canonicalId, target), file);

    const icon = btn!.querySelector('.cqd-v2-icon');
    const label = btn!.querySelector('.cqd-v2-label');

    expect(icon).not.toBeNull();
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe('Download');
  });

  it('sets aria-label for accessibility', () => {
    const file = mockFile('aria_20chars_pad_here', 'important-doc.pdf');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const btn = renderButton(mockDecision(file.canonicalId, target), file);

    expect(btn!.getAttribute('aria-label')).toBe('Download important-doc.pdf');
  });

  it('stores file metadata in dataset', () => {
    const file = mockFile('dataset20charspaddin', 'report.xlsx');
    file.downloadUrl = 'https://drive.google.com/file/d/dataset20charspaddin/view';
    const target = document.createElement('div');
    document.body.appendChild(target);
    const btn = renderButton(mockDecision(file.canonicalId, target), file);

    expect(btn!.dataset.cqdUrl).toBe(file.downloadUrl);
    expect(btn!.dataset.cqdName).toBe('report.xlsx');
    expect(btn!.dataset.cqdExt).toBe('xlsx');
  });

  it('applies dark mode class when isDark=true', () => {
    const file = mockFile('dark_20chars_pad_here');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const btn = renderButton(mockDecision(file.canonicalId, target), file, true);

    expect(btn!.classList.contains('cqd-theme-dark')).toBe(true);
  });

  it('does not apply dark mode class when isDark=false', () => {
    const file = mockFile('light20chars_pad_her');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const btn = renderButton(mockDecision(file.canonicalId, target), file, false);

    expect(btn!.classList.contains('cqd-theme-dark')).toBe(false);
  });
});

// ============================================================================
// IDEMPOTENCY
// ============================================================================

describe('Button Renderer: Idempotency', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetTemplates();
  });

  it('returns null when button already exists', () => {
    const file = mockFile('idempotent20chars_pa');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const decision = mockDecision(file.canonicalId, target);

    // First render: success
    const btn1 = renderButton(decision, file);
    expect(btn1).not.toBeNull();

    // Second render: idempotent, returns null
    const btn2 = renderButton(decision, file);
    expect(btn2).toBeNull();
  });

  it('only creates one DOM element for duplicate calls', () => {
    const file = mockFile('oneDom_20chars_paddi');
    const target = document.createElement('div');
    document.body.appendChild(target);
    const decision = mockDecision(file.canonicalId, target);

    renderButton(decision, file);
    renderButton(decision, file);
    renderButton(decision, file);

    const buttons = target.querySelectorAll('.cqd-v2-btn');
    expect(buttons).toHaveLength(1);
  });
});

// ============================================================================
// INSERTION POSITIONS
// ============================================================================

describe('Button Renderer: Insertion Positions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetTemplates();
  });

  it('append — adds button as last child', () => {
    const file = mockFile('appendPos20chars_pad');
    const target = document.createElement('div');
    const existing = document.createElement('span');
    target.appendChild(existing);
    document.body.appendChild(target);

    renderButton(mockDecision(file.canonicalId, target, 'append'), file);

    expect(target.lastChild).toBeInstanceOf(HTMLButtonElement);
  });

  it('prepend — adds button as first child', () => {
    const file = mockFile('prependPos20chars_pa');
    const target = document.createElement('div');
    const existing = document.createElement('span');
    target.appendChild(existing);
    document.body.appendChild(target);

    renderButton(mockDecision(file.canonicalId, target, 'prepend'), file);

    expect(target.firstChild).toBeInstanceOf(HTMLButtonElement);
  });

  it('before — adds button as previous sibling', () => {
    const file = mockFile('beforePos20chars_pad');
    const parent = document.createElement('div');
    const target = document.createElement('span');
    parent.appendChild(target);
    document.body.appendChild(parent);

    renderButton(mockDecision(file.canonicalId, target, 'before'), file);

    expect(parent.firstChild).toBeInstanceOf(HTMLButtonElement);
    expect(parent.lastChild).toBe(target);
  });

  it('after — adds button as next sibling', () => {
    const file = mockFile('afterPos_20chars_pad');
    const parent = document.createElement('div');
    const target = document.createElement('span');
    parent.appendChild(target);
    document.body.appendChild(parent);

    renderButton(mockDecision(file.canonicalId, target, 'after'), file);

    expect(parent.firstChild).toBe(target);
    expect(parent.lastChild).toBeInstanceOf(HTMLButtonElement);
  });
});

// ============================================================================
// BATCH RENDERING
// ============================================================================

describe('Button Renderer: renderBatch', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetTemplates();
  });

  it('renders multiple buttons in one call', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const files = new Map<string, ScannedFile>();
    const decisions: PlacementDecision[] = [];

    for (let i = 0; i < 5; i++) {
      const file = mockFile(`batch${String(i).padStart(2, '0')}_20charspad`);
      files.set(file.canonicalId, file);
      decisions.push(mockDecision(file.canonicalId, target));
    }

    const rendered = renderBatch(decisions, files);
    expect(rendered).toHaveLength(5);
  });

  it('returns empty array for empty decisions', () => {
    const rendered = renderBatch([], new Map());
    expect(rendered).toHaveLength(0);
  });

  it('skips decisions with no matching file', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const decisions: PlacementDecision[] = [
      mockDecision('drive:nonexistent_file', target),
    ];

    const rendered = renderBatch(decisions, new Map());
    expect(rendered).toHaveLength(0);
  });
});

// ============================================================================
// DOWNLOAD ALL BUTTON
// ============================================================================

describe('Button Renderer: Download All', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetTemplates();
  });

  it('renders Download All button with correct class', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const files = [
      mockFile('dlAll1_20chars_paddi'),
      mockFile('dlAll2_20chars_paddi'),
    ];
    const decision = mockDecision('download-all:post-1', target);

    const btn = renderDownloadAllButton(decision, files);

    expect(btn).not.toBeNull();
    expect(btn!.classList.contains('cqd-download-all')).toBe(true);
  });

  it('renders file count in count badge', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const files = [
      mockFile('count1_20chars_paddi'),
      mockFile('count2_20chars_paddi'),
      mockFile('count3_20chars_paddi'),
    ];
    const decision = mockDecision('download-all:post-2', target);

    const btn = renderDownloadAllButton(decision, files);
    const countEl = btn!.querySelector('.cqd-v2-count');

    expect(countEl).not.toBeNull();
    expect(countEl!.textContent).toBe('3');
  });

  it('Download All button is idempotent', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const files = [
      mockFile('idem1_20chars_paddin'),
      mockFile('idem2_20chars_paddin'),
    ];
    const decision = mockDecision('download-all:post-3', target);

    const btn1 = renderDownloadAllButton(decision, files);
    const btn2 = renderDownloadAllButton(decision, files);

    expect(btn1).not.toBeNull();
    expect(btn2).toBeNull();
  });
});

// ============================================================================
// STALE BUTTON CLEANUP
// ============================================================================

describe('Button Renderer: Stale Button Cleanup', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetTemplates();
  });

  it('removes buttons for files no longer in valid set', () => {
    const post = document.createElement('div');
    document.body.appendChild(post);

    // Create 3 buttons
    for (const id of ['file_a', 'file_b', 'file_c']) {
      const btn = document.createElement('button');
      btn.setAttribute(getInjectedAttr(), 'true');
      btn.setAttribute(getFileIdAttr(), id);
      btn.classList.add('cqd-v2-btn');
      post.appendChild(btn);
    }

    expect(post.querySelectorAll('.cqd-v2-btn')).toHaveLength(3);

    // Only file_a is still valid
    removeStaleButtons(post, new Set(['file_a']));

    expect(post.querySelectorAll('.cqd-v2-btn')).toHaveLength(1);
    expect(post.querySelector(`[${getFileIdAttr()}="file_a"]`)).not.toBeNull();
  });

  it('keeps all buttons when all are valid', () => {
    const post = document.createElement('div');
    document.body.appendChild(post);

    for (const id of ['keep_a', 'keep_b']) {
      const btn = document.createElement('button');
      btn.setAttribute(getInjectedAttr(), 'true');
      btn.setAttribute(getFileIdAttr(), id);
      post.appendChild(btn);
    }

    removeStaleButtons(post, new Set(['keep_a', 'keep_b']));

    expect(post.querySelectorAll(`[${getInjectedAttr()}]`)).toHaveLength(2);
  });
});

// ============================================================================
// REMOVE ALL
// ============================================================================

describe('Button Renderer: removeAllV2Buttons', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetTemplates();
  });

  it('removes all V2 buttons from document', () => {
    for (let i = 0; i < 5; i++) {
      const btn = document.createElement('button');
      btn.classList.add('cqd-v2-btn');
      document.body.appendChild(btn);
    }

    expect(document.querySelectorAll('.cqd-v2-btn')).toHaveLength(5);

    removeAllV2Buttons();

    expect(document.querySelectorAll('.cqd-v2-btn')).toHaveLength(0);
  });

  it('removes V2 buttons only from specified scope', () => {
    const scope = document.createElement('div');
    const outside = document.createElement('div');

    const btn1 = document.createElement('button');
    btn1.classList.add('cqd-v2-btn');
    scope.appendChild(btn1);

    const btn2 = document.createElement('button');
    btn2.classList.add('cqd-v2-btn');
    outside.appendChild(btn2);

    document.body.appendChild(scope);
    document.body.appendChild(outside);

    removeAllV2Buttons(scope);

    expect(scope.querySelectorAll('.cqd-v2-btn')).toHaveLength(0);
    expect(outside.querySelectorAll('.cqd-v2-btn')).toHaveLength(1);
  });
});

// ============================================================================
// DELEGATED CLICK HANDLER
// ============================================================================

describe('Button Renderer: Delegated Click Handler', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetTemplates();
  });

  it('calls onSingleClick when a single-file button is clicked', () => {
    const postRoot = document.createElement('div');
    document.body.appendChild(postRoot);

    const onSingle = vi.fn();
    const onAll = vi.fn();
    setupDelegatedClickHandler(postRoot, onSingle, onAll);

    // Create and append a button
    const btn = document.createElement('button');
    btn.classList.add('cqd-v2-btn');
    btn.setAttribute(getFileIdAttr(), 'drive:clickTest_file');
    btn.dataset.cqdUrl = 'https://example.com/file.pdf';
    btn.dataset.cqdName = 'file.pdf';
    btn.dataset.cqdExt = 'pdf';
    postRoot.appendChild(btn);

    // Simulate click
    btn.click();

    expect(onSingle).toHaveBeenCalledOnce();
    expect(onSingle).toHaveBeenCalledWith(
      'drive:clickTest_file',
      'https://example.com/file.pdf',
      'file.pdf',
      'pdf',
      btn,
    );
    expect(onAll).not.toHaveBeenCalled();
  });

  it('calls onDownloadAllClick when Download All button is clicked', () => {
    const postRoot = document.createElement('div');
    document.body.appendChild(postRoot);

    const onSingle = vi.fn();
    const onAll = vi.fn();
    setupDelegatedClickHandler(postRoot, onSingle, onAll);

    const btn = document.createElement('button');
    btn.classList.add('cqd-v2-btn');
    btn.setAttribute(getFileIdAttr(), 'download-all:post-123');
    postRoot.appendChild(btn);

    btn.click();

    expect(onAll).toHaveBeenCalledOnce();
    expect(onAll).toHaveBeenCalledWith('post-123', btn);
    expect(onSingle).not.toHaveBeenCalled();
  });

  it('ignores clicks on non-button elements', () => {
    const postRoot = document.createElement('div');
    document.body.appendChild(postRoot);

    const onSingle = vi.fn();
    const onAll = vi.fn();
    setupDelegatedClickHandler(postRoot, onSingle, onAll);

    const span = document.createElement('span');
    postRoot.appendChild(span);

    span.click();

    expect(onSingle).not.toHaveBeenCalled();
    expect(onAll).not.toHaveBeenCalled();
  });
});

// ============================================================================
// DARK MODE DETECTION
// ============================================================================

describe('Button Renderer: Dark Mode Detection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false in default jsdom environment', () => {
    // jsdom has no dark mode by default
    expect(detectDarkMode()).toBe(false);
  });

  it('detects dark mode via data-theme attribute', () => {
    document.body.setAttribute('data-theme', 'dark');
    expect(detectDarkMode()).toBe(true);
    document.body.removeAttribute('data-theme');
  });

  it('detects dark mode via class name', () => {
    document.body.classList.add('dark-theme');
    expect(detectDarkMode()).toBe(true);
    document.body.classList.remove('dark-theme');
  });
});
