// filepath: extension/tests/v2-file-placement.test.ts
/**
 * ============================================================================
 * V2 FILE PLACEMENT — Test Suite
 * ============================================================================
 *
 * Tests for the placement decision engine — the core of Phase 3.
 *
 * The file placement engine takes scanned posts with files and produces
 * PlacementDecision objects that tell the renderer WHERE to put buttons.
 *
 * We test:
 * 1. computePlacement — produces decisions for files in posts
 * 2. Deduplication — already-placed files are skipped
 * 3. Per-ViewKind recipes — different views produce different placements
 * 4. Confidence scores — reflect the selector level used
 * 5. Download All — placed only when file count >= threshold
 * 6. Accordion — collapsed posts produce no decisions
 * 7. Edge cases — empty posts, 1 file, 10+ files
 *
 * @author Adham — this is the most important test file for Phase 3
 * @since v4.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ViewKind } from '../src/engines/types';
import type { ScannedPost, ScannedFile } from '../src/v2/model/dom-scanner';
import {
  computePlacement,
  computeDownloadAllPlacement,
  isAlreadyPlaced,
  getFileIdAttr,
  getInjectedAttr,
} from '../src/v2/decision/file-placement';

// ============================================================================
// HELPERS — Build test fixtures
// ============================================================================

/**
 * Create a mock ScannedFile for testing.
 */
function mockFile(id: string, name: string = 'test.pdf'): ScannedFile {
  const el = document.createElement('a');
  el.href = `https://drive.google.com/file/d/${id}/view`;
  el.setAttribute('aria-label', name);

  return {
    canonicalId: `drive:${id}`,
    element: el,
    idSource: 'url-parse',
    name,
    ext: name.split('.').pop() || '',
    downloadUrl: el.href,
  };
}

/**
 * Create a mock ScannedPost with files.
 */
function mockPost(
  postId: string,
  files: ScannedFile[] = [],
  expanded: boolean = true,
): ScannedPost {
  const el = document.createElement('div');
  el.setAttribute('data-stream-item-id', postId);

  // Append file elements as children so placement engine can traverse
  for (const f of files) {
    el.appendChild(f.element);
  }

  document.body.appendChild(el);

  return {
    id: postId,
    element: el,
    fingerprint: `${postId}-${files.length}`,
    files,
    isExpanded: expanded,
    isConnected: true,
  };
}

// ============================================================================
// COMPUTE PLACEMENT — Basic functionality
// ============================================================================

describe('File Placement: computePlacement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns empty array for post with no files', () => {
    const post = mockPost('empty-1');
    const decisions = computePlacement(post, ViewKind.STREAM);
    expect(decisions).toEqual([]);
  });

  it('returns one decision for post with 1 file', () => {
    const file = mockFile('file1_20chars_padding');
    const post = mockPost('one-file-1', [file]);
    const decisions = computePlacement(post, ViewKind.STREAM);

    // Should have exactly 1 decision (single file button, no Download All for 1 file)
    expect(decisions).toHaveLength(1);
    expect(decisions[0].fileId).toBe('drive:file1_20chars_padding');
  });

  it('returns decisions for multiple files plus Download All', () => {
    const files = [
      mockFile('multiFile_01_padding'),
      mockFile('multiFile_02_padding'),
      mockFile('multiFile_03_padding'),
    ];
    const post = mockPost('multi-1', files);
    const decisions = computePlacement(post, ViewKind.STREAM);

    // 3 single-file decisions + 1 Download All = 4 total
    expect(decisions).toHaveLength(4);

    // Check that we have 3 single-file decisions
    const singleDecisions = decisions.filter(d => !d.fileId.startsWith('download-all:'));
    expect(singleDecisions).toHaveLength(3);

    // Check that we have 1 Download All decision
    const downloadAllDecisions = decisions.filter(d => d.fileId.startsWith('download-all:'));
    expect(downloadAllDecisions).toHaveLength(1);
    expect(downloadAllDecisions[0].fileId).toBe('download-all:multi-1');
  });

  it('all decisions have required fields', () => {
    const file = mockFile('reqFields_20chars_pa');
    const post = mockPost('fields-1', [file]);
    const decisions = computePlacement(post, ViewKind.STREAM);

    for (const d of decisions) {
      expect(d.fileId).toBeTruthy();
      expect(d.targetElement).toBeTruthy();
      expect(d.insertionPoint).toBeTruthy();
      expect(d.anchorSelector).toBeTruthy();
      expect(typeof d.confidence).toBe('number');
      expect(d.confidence).toBeGreaterThan(0);
      expect(d.confidence).toBeLessThanOrEqual(100);
      expect(Array.isArray(d.reasonCodes)).toBe(true);
      expect(d.reasonCodes.length).toBeGreaterThan(0);
      expect(typeof d.fallbackUsed).toBe('boolean');
    }
  });
});

// ============================================================================
// DEDUPLICATION
// ============================================================================

describe('File Placement: Deduplication', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('skips files that already have buttons placed', () => {
    const file = mockFile('dupCheck_20chars_pad');
    const post = mockPost('dedup-1', [file]);

    // Simulate an already-placed button
    const fakeBtn = document.createElement('button');
    fakeBtn.setAttribute(getFileIdAttr(), 'drive:dupCheck_20chars_pad');
    fakeBtn.setAttribute(getInjectedAttr(), 'true');
    post.element.appendChild(fakeBtn);

    const decisions = computePlacement(post, ViewKind.STREAM);

    // Should skip the already-placed file
    const singleDecisions = decisions.filter(d => !d.fileId.startsWith('download-all:'));
    expect(singleDecisions).toHaveLength(0);
  });

  it('does not skip files without existing buttons', () => {
    const file = mockFile('noDup_20chars_paddin');
    const post = mockPost('no-dedup-1', [file]);

    const decisions = computePlacement(post, ViewKind.STREAM);

    const singleDecisions = decisions.filter(d => !d.fileId.startsWith('download-all:'));
    expect(singleDecisions).toHaveLength(1);
  });

  it('isAlreadyPlaced returns true when button exists', () => {
    const el = document.createElement('div');
    const btn = document.createElement('button');
    btn.setAttribute(getFileIdAttr(), 'drive:test_placed_file');
    btn.setAttribute(getInjectedAttr(), 'true');
    el.appendChild(btn);

    expect(isAlreadyPlaced('drive:test_placed_file', el)).toBe(true);
  });

  it('isAlreadyPlaced returns false when no button exists', () => {
    const el = document.createElement('div');
    expect(isAlreadyPlaced('drive:nonexistent', el)).toBe(false);
  });
});

// ============================================================================
// VIEW-SPECIFIC PLACEMENT
// ============================================================================

describe('File Placement: View-Specific Behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('stream view produces file-element anchored single buttons', () => {
    const file = mockFile('streamView_20chars_p');
    const post = mockPost('stream-1', [file]);
    const decisions = computePlacement(post, ViewKind.STREAM);

    const single = decisions.find(d => !d.fileId.startsWith('download-all:'));
    expect(single).toBeTruthy();
    // File-element strategy → anchor is the file element itself
    expect(single!.targetElement).toBe(file.element);
    expect(single!.reasonCodes).toContain('ANCHOR_FILE_ELEMENT');
  });

  it('classwork list collapsed post produces no decisions', () => {
    const file = mockFile('collapsed_20chars_pa');
    const post = mockPost('collapsed-1', [file], false); // collapsed

    const decisions = computePlacement(post, ViewKind.CLASSWORK_LIST);

    // Collapsed classwork post → 0 decisions (hideWhenCollapsed = true)
    expect(decisions).toHaveLength(0);
  });

  it('classwork list expanded post produces decisions', () => {
    const file = mockFile('expanded_20chars_pad');
    const post = mockPost('expanded-1', [file], true); // expanded

    const decisions = computePlacement(post, ViewKind.CLASSWORK_LIST);

    expect(decisions.length).toBeGreaterThan(0);
  });

  it('stream view ignores accordion state (always shows buttons)', () => {
    const file = mockFile('streamNoAcc_20chars_');
    // Even with isExpanded = false, stream view doesn't support accordion
    const post = mockPost('stream-no-acc', [file], false);

    const decisions = computePlacement(post, ViewKind.STREAM);

    // Stream doesn't have accordion, so buttons should still show
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('unknown view falls back gracefully', () => {
    const file = mockFile('unknownView_20chars_');
    const post = mockPost('unknown-1', [file]);

    const decisions = computePlacement(post, ViewKind.UNKNOWN);

    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions[0].reasonCodes).toContain('SINGLE_FILE_BUTTON');
  });
});

// ============================================================================
// CONFIDENCE SCORES
// ============================================================================

describe('File Placement: Confidence Scores', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('file-element strategy has high confidence (90)', () => {
    const file = mockFile('confFile_20chars_pad');
    const post = mockPost('conf-1', [file]);

    const decisions = computePlacement(post, ViewKind.STREAM);
    const single = decisions.find(d => !d.fileId.startsWith('download-all:'));

    // File-element direct anchoring → 90 confidence
    expect(single!.confidence).toBe(90);
    expect(single!.fallbackUsed).toBe(false);
  });

  it('post-root fallback has low confidence (30)', () => {
    const files = [
      mockFile('fallback1_20chars_pa'),
      mockFile('fallback2_20chars_pa'),
    ];
    const post = mockPost('fallback-1', files);

    const decisions = computePlacement(post, ViewKind.STUDENT_SUBMISSIONS);
    // Student submissions uses post-root for Download All
    const dlAll = decisions.find(d => d.fileId.startsWith('download-all:'));

    expect(dlAll).toBeTruthy();
    expect(dlAll!.confidence).toBe(30);
    expect(dlAll!.fallbackUsed).toBe(true);
  });
});

// ============================================================================
// DOWNLOAD ALL PLACEMENT
// ============================================================================

describe('File Placement: Download All', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('no Download All for single file', () => {
    const post = mockPost('dl-all-1', [mockFile('single_20chars_paddi')]);

    const decisions = computePlacement(post, ViewKind.STREAM);
    const dlAll = decisions.filter(d => d.fileId.startsWith('download-all:'));

    expect(dlAll).toHaveLength(0);
  });

  it('Download All appears with 2+ files', () => {
    const post = mockPost('dl-all-2', [
      mockFile('dlAll2a_20chars_padd'),
      mockFile('dlAll2b_20chars_padd'),
    ]);

    const decisions = computePlacement(post, ViewKind.STREAM);
    const dlAll = decisions.filter(d => d.fileId.startsWith('download-all:'));

    expect(dlAll).toHaveLength(1);
    expect(dlAll[0].fileId).toBe('download-all:dl-all-2');
    expect(dlAll[0].reasonCodes).toContain('DOWNLOAD_ALL_BUTTON');
  });

  it('computeDownloadAllPlacement returns null for 1 file', () => {
    const post = mockPost('dl-only-1', [mockFile('dlOnly1_20chars_padd')]);

    const result = computeDownloadAllPlacement(post, ViewKind.STREAM);
    expect(result).toBeNull();
  });

  it('computeDownloadAllPlacement returns decision for 2 files', () => {
    const post = mockPost('dl-only-2', [
      mockFile('dlOnly2a_20chars_pad'),
      mockFile('dlOnly2b_20chars_pad'),
    ]);

    const result = computeDownloadAllPlacement(post, ViewKind.STREAM);
    expect(result).not.toBeNull();
    expect(result!.fileId).toBe('download-all:dl-only-2');
  });

  it('computeDownloadAllPlacement returns a header decision for collapsed classwork (bug 2.1)', () => {
    // V1 parity: the group button lives on the post header, which stays
    // visible when a classwork item is folded — the decision must survive.
    const post = mockPost('dl-collapsed', [
      mockFile('dlColl1_20chars_padd'),
      mockFile('dlColl2_20chars_padd'),
    ], false);

    const result = computeDownloadAllPlacement(post, ViewKind.CLASSWORK_LIST);
    expect(result).not.toBeNull();
    expect(result!.fileId).toBe('download-all:dl-collapsed');
  });
});

// ============================================================================
// REASON CODES
// ============================================================================

describe('File Placement: Reason Codes', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('single button has SINGLE_FILE_BUTTON reason code', () => {
    const post = mockPost('reason-1', [mockFile('reason1_20chars_padd')]);
    const decisions = computePlacement(post, ViewKind.STREAM);

    const single = decisions.find(d => !d.fileId.startsWith('download-all:'));
    expect(single!.reasonCodes).toContain('SINGLE_FILE_BUTTON');
  });

  it('Download All has DOWNLOAD_ALL_BUTTON reason code', () => {
    const post = mockPost('reason-2', [
      mockFile('reason2a_20chars_pad'),
      mockFile('reason2b_20chars_pad'),
    ]);
    const decisions = computePlacement(post, ViewKind.STREAM);

    const dlAll = decisions.find(d => d.fileId.startsWith('download-all:'));
    expect(dlAll!.reasonCodes).toContain('DOWNLOAD_ALL_BUTTON');
  });

  it('file-element anchor has ANCHOR_FILE_ELEMENT reason code', () => {
    const post = mockPost('reason-3', [mockFile('reason3_20chars_padd')]);
    const decisions = computePlacement(post, ViewKind.STREAM);

    const single = decisions.find(d => !d.fileId.startsWith('download-all:'));
    expect(single!.reasonCodes).toContain('ANCHOR_FILE_ELEMENT');
  });

  it('reason codes include VIEW kind', () => {
    const post = mockPost('reason-4', [mockFile('reason4_20chars_padd')]);
    const decisions = computePlacement(post, ViewKind.STREAM);

    const single = decisions.find(d => !d.fileId.startsWith('download-all:'));
    expect(single!.reasonCodes).toContain('VIEW_STREAM');
  });

  it('fallback anchor has FALLBACK_USED reason code', () => {
    const post = mockPost('reason-5', [
      mockFile('reason5a_20chars_pad'),
      mockFile('reason5b_20chars_pad'),
    ]);
    // Student submissions uses post-root for Download All → fallback
    const decisions = computePlacement(post, ViewKind.STUDENT_SUBMISSIONS);

    const dlAll = decisions.find(d => d.fileId.startsWith('download-all:'));
    expect(dlAll!.reasonCodes).toContain('FALLBACK_USED');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('File Placement: Edge Cases', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('handles post with 10+ files', () => {
    const files = Array.from({ length: 12 }, (_, i) =>
      mockFile(`bigPost${String(i).padStart(2, '0')}_20chars`)
    );
    const post = mockPost('big-1', files);

    const decisions = computePlacement(post, ViewKind.STREAM);

    // 12 single buttons + 1 Download All = 13
    expect(decisions).toHaveLength(13);
  });

  it('getFileIdAttr returns the correct attribute name', () => {
    expect(getFileIdAttr()).toBe('data-cqd-file-id');
  });

  it('getInjectedAttr returns the correct attribute name', () => {
    expect(getInjectedAttr()).toBe('data-cqd-injected');
  });
});

// ===========================================================================
// z57 S3 — Download All placement fallback: with NO header anchor the target
// is the post root, and a 'before' insertion would land the button OUTSIDE
// the post card. The fallback degrades to 'append' (inside the card) — the
// V1 outcome qa-02 pins ("Download All lives inside its post card").
// ===========================================================================
describe('computePlacement: Download All post-root fallback insertion (z57)', () => {
  it('appends into the post root when the header anchor falls back', () => {
    document.body.innerHTML = '';
    const postEl = document.createElement('article');
    postEl.setAttribute('data-stream-item-id', 'fb-post-1');
    // A file the registry matches, and NO header-ish element at all.
    const anchor = document.createElement('a');
    anchor.href = 'https://drive.google.com/file/d/FALLBACKID1/view';
    postEl.appendChild(anchor);
    const second = anchor.cloneNode(true) as HTMLAnchorElement;
    second.href = 'https://drive.google.com/file/d/FALLBACKID2/view';
    postEl.appendChild(second);
    document.body.appendChild(postEl);

    const post = {
      id: 'fb-post-1',
      element: postEl,
      fingerprint: 'fb',
      files: [
        {
          canonicalId: 'drive-FALLBACKID1',
          element: anchor,
          idSource: 'url-parse' as const,
          name: 'a.pdf',
          ext: 'pdf',
          downloadUrl: anchor.href,
        },
        {
          canonicalId: 'drive-FALLBACKID2',
          element: second,
          idSource: 'url-parse' as const,
          name: 'b.pdf',
          ext: 'pdf',
          downloadUrl: second.href,
        },
      ],
      isExpanded: true,
      isConnected: true,
    };

    const decisions = computePlacement(post, 'stream' as never);
    const all = decisions.find((d) => d.fileId === 'download-all:fb-post-1');
    expect(all).toBeDefined();
    expect(all!.targetElement).toBe(postEl);
    expect(all!.insertionPoint).toBe('append');
  });
});

// ===========================================================================
// Bug 2.1 — collapsed classwork posts keep the header-mounted Download All
// (V1 parity: V1 mounts its group button on the post header row via
// findHeaderContainer .N5dSp/.JZicYb, which stays visible when a classwork
// item is folded). The hideWhenCollapsed gate must keep SINGLE-file buttons
// hidden while still emitting the group decision.
// ===========================================================================
describe('File Placement: collapsed classwork keeps Download All (bug 2.1)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  /**
   * A realistic collapsed classwork item: the header toggle + three-dots
   * menu stay in the DOM, and so do the (hidden) attachment chips.
   */
  function buildCollapsedClasswork(postId: string, files: ScannedFile[]) {
    const li = document.createElement('li');
    li.setAttribute('data-stream-item-id', postId);
    li.classList.add('AZd1I'); // Classroom golden class: folded item

    const toggle = document.createElement('div');
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('aria-expanded', 'false');
    li.appendChild(toggle);

    const menu = document.createElement('span');
    menu.setAttribute('aria-haspopup', 'menu');
    li.appendChild(menu);

    for (const f of files) {
      const chip = document.createElement('div');
      chip.className = 'KlRXdf'; // attachment chip container
      chip.appendChild(f.element);
      li.appendChild(chip);
    }

    document.body.appendChild(li);

    const post: ScannedPost = {
      id: postId,
      element: li,
      fingerprint: `${postId}-collapsed`,
      files,
      isExpanded: false,
      isConnected: true,
    };
    return { li, toggle, menu, post };
  }

  it('collapsed classwork post with 2+ attachments yields a download-all decision anchored at the header', () => {
    const files = [mockFile('collAllA_20chars_pad'), mockFile('collAllB_20chars_pad')];
    const { li, menu, post } = buildCollapsedClasswork('collapsed-all-1', files);

    const decisions = computePlacement(post, ViewKind.CLASSWORK_LIST);

    // Single-file buttons STAY hidden when collapsed.
    const single = decisions.filter((d) => !d.fileId.startsWith('download-all:'));
    expect(single).toHaveLength(0);

    // …but the Download All decision is emitted, anchored at the header.
    const all = decisions.filter((d) => d.fileId === 'download-all:collapsed-all-1');
    expect(all).toHaveLength(1);
    expect(all[0].reasonCodes).toContain('DOWNLOAD_ALL_BUTTON');
    expect(li.contains(all[0].targetElement)).toBe(true);
    expect(all[0].targetElement).not.toBe(li);
    expect(all[0].fallbackUsed).toBe(false);
    expect(all[0].targetElement).toBe(menu);
  });

  it('mixed post (1 Drive + 1 link) stays below the threshold — V1 skips non-downloadable attachments', () => {
    // V1 evidence: single download buttons exist ONLY for Drive/Docs URLs
    // (entrypoints/content/observers.ts injectSingleFileButtons gated by
    // state.ts DRIVE_URL_PATTERNS — "External links never get download
    // buttons"), and V1's group machine counts registered single buttons
    // only (download_all.content.ts registerSingleButton + the >=2 gate).
    // So a post mixing 1 Drive file and 1 external link gets NO Download
    // All button in V1: the link is invisible to the group machine.
    const drive = mockFile('linkMixA_20chars_pad');
    const postEl = document.createElement('div');
    postEl.setAttribute('data-stream-item-id', 'link-mix-1');

    const driveChip = document.createElement('div');
    driveChip.className = 'KlRXdf';
    driveChip.appendChild(drive.element);
    postEl.appendChild(driveChip);

    const link = document.createElement('a');
    link.href = 'https://www.youtube.com/watch?v=cqd-test';
    link.setAttribute('aria-label', 'Attachment: Lecture video');
    const linkChip = document.createElement('div');
    linkChip.className = 'KlRXdf';
    linkChip.appendChild(link);
    postEl.appendChild(linkChip);

    document.body.appendChild(postEl);

    const post: ScannedPost = {
      id: 'link-mix-1',
      element: postEl,
      fingerprint: 'link-mix-1',
      files: [drive],
      isExpanded: true,
      isConnected: true,
    };

    const decisions = computePlacement(post, ViewKind.STREAM);

    const all = decisions.filter((d) => d.fileId === 'download-all:link-mix-1');
    expect(all).toHaveLength(0);

    // Single-download placement must NOT change: still only the Drive file.
    const single = decisions.filter((d) => !d.fileId.startsWith('download-all:'));
    expect(single).toHaveLength(1);
    expect(single[0].fileId).toBe(drive.canonicalId);
  });

  it('link/video attachments do not inflate the count on an above-threshold post', () => {
    // 2 downloadable Drive attachments + 1 YouTube chip: the decision's
    // attachmentCount is the DOWNLOADABLE set (2), not the raw attachment
    // node set (3) — the "N files" label and the run stay in agreement
    // (V1's group counts exactly what it can download).
    const postEl = document.createElement('div');
    postEl.setAttribute('data-stream-item-id', 'link-mix-2');
    const files = [mockFile('linkMixB_20chars_pad'), mockFile('linkMixC_20chars_pad')];
    for (const f of files) {
      const chip = document.createElement('div');
      chip.className = 'KlRXdf';
      chip.appendChild(f.element);
      postEl.appendChild(chip);
    }

    const video = document.createElement('a');
    video.href = 'https://www.youtube.com/watch?v=cqd-test';
    video.setAttribute('aria-label', 'Attachment: Lecture video');
    const videoChip = document.createElement('div');
    videoChip.className = 'KlRXdf';
    videoChip.appendChild(video);
    postEl.appendChild(videoChip);

    document.body.appendChild(postEl);

    const post: ScannedPost = {
      id: 'link-mix-2',
      element: postEl,
      fingerprint: 'link-mix-2',
      files,
      isExpanded: true,
      isConnected: true,
    };

    const decisions = computePlacement(post, ViewKind.STREAM);
    const all = decisions.filter((d) => d.fileId === 'download-all:link-mix-2');
    expect(all).toHaveLength(1);
    expect(all[0].attachmentCount).toBe(2);
  });

  it('download-all decision still counts downloadable attachment nodes discovery misses', () => {
    // 1 discovered Drive file + 1 chip whose Classroom drive-proxy anchor
    // discovery cannot canonicalize (no /d/<id> in the href, no drive-id
    // data attribute). V1 downloads it (DRIVE_URL_PATTERNS matches
    // classroom.google.com/drive/), so the threshold holds and the decision
    // carries the true downloadable count.
    const drive = mockFile('missMixA_20chars_pad');
    const postEl = document.createElement('div');
    postEl.setAttribute('data-stream-item-id', 'link-mix-3');

    const driveChip = document.createElement('div');
    driveChip.className = 'KlRXdf';
    driveChip.appendChild(drive.element);
    postEl.appendChild(driveChip);

    const proxyChip = document.createElement('div');
    proxyChip.setAttribute('data-attachment-id', 'att-1');
    const proxy = document.createElement('a');
    proxy.href = 'https://classroom.google.com/drive/attachment/abc123';
    proxy.textContent = 'Slides.pdf';
    proxyChip.appendChild(proxy);
    postEl.appendChild(proxyChip);

    document.body.appendChild(postEl);

    const post: ScannedPost = {
      id: 'link-mix-3',
      element: postEl,
      fingerprint: 'link-mix-3',
      files: [drive],
      isExpanded: true,
      isConnected: true,
    };

    const decisions = computePlacement(post, ViewKind.STREAM);
    const all = decisions.filter((d) => d.fileId === 'download-all:link-mix-3');
    expect(all).toHaveLength(1);
    expect(all[0].attachmentCount).toBe(2);
  });

  it('a post with only link/video attachments gets no Download All decision', () => {
    const postEl = document.createElement('div');
    postEl.setAttribute('data-stream-item-id', 'links-only-1');

    for (const url of ['https://www.youtube.com/watch?v=a', 'https://example.com/doc']) {
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('aria-label', 'Attachment: something');
      const chip = document.createElement('div');
      chip.className = 'KlRXdf';
      chip.appendChild(link);
      postEl.appendChild(chip);
    }

    document.body.appendChild(postEl);

    const post: ScannedPost = {
      id: 'links-only-1',
      element: postEl,
      fingerprint: 'links-only-1',
      files: [],
      isExpanded: true,
      isConnected: true,
    };

    const decisions = computePlacement(post, ViewKind.STREAM);
    expect(decisions.filter((d) => d.fileId.startsWith('download-all:'))).toHaveLength(0);
    expect(decisions).toHaveLength(0);
  });

  it('plain page links without attachment signals do not trigger the decision', () => {
    const drive = mockFile('noMixA_20chars_pad');
    const postEl = document.createElement('div');
    postEl.setAttribute('data-stream-item-id', 'no-mix-1');

    const chip = document.createElement('div');
    chip.className = 'KlRXdf';
    chip.appendChild(drive.element);
    postEl.appendChild(chip);

    // A bare external link in the post body — not an attachment chip.
    const plain = document.createElement('a');
    plain.href = 'https://example.com/some-page';
    plain.setAttribute('aria-label', 'Some site');
    postEl.appendChild(plain);

    document.body.appendChild(postEl);

    const post: ScannedPost = {
      id: 'no-mix-1',
      element: postEl,
      fingerprint: 'no-mix-1',
      files: [drive],
      isExpanded: true,
      isConnected: true,
    };

    const decisions = computePlacement(post, ViewKind.STREAM);
    expect(decisions.filter((d) => d.fileId.startsWith('download-all:'))).toHaveLength(0);
    expect(decisions.filter((d) => !d.fileId.startsWith('download-all:'))).toHaveLength(1);
  });
});
