// filepath: extension/tests/v2-dom-scanner.test.ts
/**
 * ============================================================================
 * V2 DOM SCANNER — Full Test Suite
 * ============================================================================
 *
 * Tests for the DOMScanner — the module that discovers posts and files
 * on the page using the 5-level selector system.
 *
 * We test against realistic Classroom DOM structures (extracted from
 * real snapshots). Each test creates DOM elements that match what
 * Google Classroom actually produces.
 *
 * Categories:
 * 1. fullScan — discover all posts and files
 * 2. scanSinglePost — targeted post scanning
 * 3. File extraction — canonical ID dedup, multiple sources
 * 4. Accordion state — expanded/collapsed detection
 * 5. Nested posts — skip posts inside posts
 * 6. CQD exclusion — skip our own injected elements
 * 7. Edge cases — empty page, no files, broken selectors
 *
 * @author Adham — recreating Classroom DOM in test fixtures is tedious but necessary
 * @since v4.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DOMScanner } from '../src/v2/model/dom-scanner';

// ============================================================================
// HELPERS — Classroom DOM Fixtures
// ============================================================================

/**
 * Create a realistic post element with file attachments.
 */
function createPost(
  postId: string,
  files: { href: string; label: string; driveId?: string }[] = [],
): HTMLElement {
  const post = document.createElement('div');
  post.setAttribute('data-stream-item-id', postId);

  for (const file of files) {
    const container = document.createElement('div');
    container.className = 'KlRXdf'; // Google's attachment container class

    const anchor = document.createElement('a');
    anchor.href = file.href;
    anchor.setAttribute('aria-label', file.label);

    // In the real Classroom DOM, data-drive-id is on the container
    // AND the anchor element can also have it. The scorer may pick
    // either element. We put it on both to match real behavior.
    if (file.driveId) {
      container.setAttribute('data-drive-id', file.driveId);
      anchor.setAttribute('data-drive-id', file.driveId);
    }

    container.appendChild(anchor);
    post.appendChild(container);
  }

  return post;
}

/**
 * Create a classwork post with accordion toggle.
 */
function createClassworkPost(
  postId: string,
  expanded: boolean,
  files: { href: string; label: string }[] = [],
): HTMLElement {
  const post = document.createElement('li');
  post.className = 'tfGBod';
  post.setAttribute('data-stream-item-id', postId);

  const toggle = document.createElement('button');
  toggle.setAttribute('aria-expanded', String(expanded));
  post.appendChild(toggle);

  for (const file of files) {
    const anchor = document.createElement('a');
    anchor.href = file.href;
    anchor.setAttribute('aria-label', file.label);
    post.appendChild(anchor);
  }

  return post;
}

// ============================================================================
// FULL SCAN
// ============================================================================

describe('DOMScanner: fullScan', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('discovers posts by data-stream-item-id', () => {
    document.body.appendChild(createPost('post-1'));
    document.body.appendChild(createPost('post-2'));
    document.body.appendChild(createPost('post-3'));

    const scanner = new DOMScanner();
    const result = scanner.fullScan('stream' as any);

    expect(result.posts.size).toBe(3);
    expect(result.posts.has('post-1')).toBe(true);
    expect(result.posts.has('post-2')).toBe(true);
    expect(result.posts.has('post-3')).toBe(true);
  });

  it('counts total files across all posts', () => {
    document.body.appendChild(createPost('post-1', [
      { href: 'https://drive.google.com/file/d/file1_20chars_padding/view', label: 'doc1.pdf' },
      { href: 'https://drive.google.com/file/d/file2_20chars_padding/view', label: 'doc2.pdf' },
    ]));
    document.body.appendChild(createPost('post-2', [
      { href: 'https://drive.google.com/file/d/file3_20chars_padding/view', label: 'slides.pptx' },
    ]));

    const scanner = new DOMScanner();
    const result = scanner.fullScan('stream' as any);

    expect(result.totalFiles).toBe(3);
  });

  it('returns metadata: timestamp, duration, viewKind', () => {
    const scanner = new DOMScanner();
    const result = scanner.fullScan('classwork_list' as any);

    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.viewKind).toBe('classwork_list');
  });

  it('returns empty results for empty page', () => {
    const scanner = new DOMScanner();
    const result = scanner.fullScan('stream' as any);

    expect(result.posts.size).toBe(0);
    expect(result.totalFiles).toBe(0);
  });

  it('includes scorer traces for debugging', () => {
    document.body.appendChild(createPost('post-1'));

    const scanner = new DOMScanner();
    const result = scanner.fullScan('stream' as any);

    expect(result.scorerTraces.size).toBeGreaterThan(0);
    expect(result.scorerTraces.has('posts')).toBe(true);
  });
});

// ============================================================================
// SINGLE POST SCAN
// ============================================================================

describe('DOMScanner: scanSinglePost', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('scans a single post element', () => {
    const post = createPost('single-1', [
      { href: 'https://drive.google.com/file/d/singleFile20charsHere/view', label: 'test.pdf' },
    ]);
    document.body.appendChild(post);

    const scanner = new DOMScanner();
    const result = scanner.scanSinglePost(post, 'stream' as any);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('single-1');
    expect(result!.files).toHaveLength(1);
  });

  it('returns null for disconnected element', () => {
    const post = createPost('disconnected-1');
    // Don't append to body — it's disconnected

    const scanner = new DOMScanner();
    const result = scanner.scanSinglePost(post, 'stream' as any);

    expect(result).toBeNull();
  });

  it('returns null for element without data-stream-item-id', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    const scanner = new DOMScanner();
    const result = scanner.scanSinglePost(el, 'stream' as any);

    expect(result).toBeNull();
  });

  it('includes correct fingerprint', () => {
    const post = createPost('fp-1', [
      { href: 'https://drive.google.com/file/d/fingerprintFile20ch_/view', label: 'test.pdf' },
    ]);
    document.body.appendChild(post);

    const scanner = new DOMScanner();
    const result = scanner.scanSinglePost(post, 'stream' as any);

    expect(result!.fingerprint).toBeTruthy();
    expect(typeof result!.fingerprint).toBe('string');

    // Same scan should produce same fingerprint
    const result2 = scanner.scanSinglePost(post, 'stream' as any);
    expect(result!.fingerprint).toBe(result2!.fingerprint);
  });
});

// ============================================================================
// FILE EXTRACTION
// ============================================================================

describe('DOMScanner: File Extraction', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('deduplicates files by canonical ID', () => {
    // Same Drive file ID in two different elements
    const post = document.createElement('div');
    post.setAttribute('data-stream-item-id', 'dedup-1');

    const anchor1 = document.createElement('a');
    anchor1.href = 'https://drive.google.com/file/d/sameFileId20charLong/view';
    anchor1.setAttribute('aria-label', 'doc.pdf');
    post.appendChild(anchor1);

    const anchor2 = document.createElement('a');
    anchor2.href = 'https://drive.google.com/file/d/sameFileId20charLong/edit';
    anchor2.setAttribute('aria-label', 'doc.pdf (edit)');
    post.appendChild(anchor2);

    document.body.appendChild(post);

    const scanner = new DOMScanner();
    const result = scanner.fullScan('stream' as any);

    const scannedPost = result.posts.get('dedup-1');
    // Both anchors have the same Drive file ID, so only 1 file
    expect(scannedPost!.files).toHaveLength(1);
    expect(scannedPost!.files[0].canonicalId).toBe('drive:sameFileId20charLong');
  });

  it('extracts files via data-drive-id attribute', () => {
    const post = createPost('data-drive-1', [
      {
        href: 'https://drive.google.com/file/d/xyz_data_drive_test/view',
        label: 'via-data-drive.pdf',
        driveId: 'dataDriveAttrValueHere',
      },
    ]);
    document.body.appendChild(post);

    const scanner = new DOMScanner();
    const result = scanner.fullScan('stream' as any);

    const files = result.posts.get('data-drive-1')!.files;
    expect(files).toHaveLength(1);
    // data-drive-id takes priority over URL extraction
    expect(files[0].canonicalId).toBe('drive:dataDriveAttrValueHere');
    expect(files[0].idSource).toBe('data-drive-id');
  });

  it('extracts file name from aria-label', () => {
    const post = createPost('name-1', [
      {
        href: 'https://drive.google.com/file/d/nameTestFile20chars_/view',
        label: 'homework-chapter-5.pdf',
      },
    ]);
    document.body.appendChild(post);

    const scanner = new DOMScanner();
    const result = scanner.fullScan('stream' as any);

    const files = result.posts.get('name-1')!.files;
    expect(files[0].name).toBe('homework-chapter-5.pdf');
    expect(files[0].ext).toBe('pdf');
  });

  it('skips CQD-injected elements', () => {
    const post = document.createElement('div');
    post.setAttribute('data-stream-item-id', 'skip-cqd');

    // Real file: a proper Drive file anchor
    const realContainer = document.createElement('div');
    realContainer.className = 'KlRXdf';
    const realFile = document.createElement('a');
    realFile.href = 'https://drive.google.com/file/d/realFile20charsPaddin/view';
    realFile.setAttribute('aria-label', 'real.pdf');
    realContainer.appendChild(realFile);
    post.appendChild(realContainer);

    // CQD-injected element: should be skipped by extractFiles
    // Note: Real CQD buttons use data-cqd-file-id, not data-drive-id.
    // data-drive-id is a Google attribute. We mark ours with data-cqd-injected.
    const cqdButton = document.createElement('button');
    cqdButton.setAttribute('data-cqd-injected', 'true');
    cqdButton.setAttribute('data-cqd-file-id', 'shouldBeIgnored12345');
    post.appendChild(cqdButton);

    document.body.appendChild(post);

    const scanner = new DOMScanner();
    const result = scanner.fullScan('stream' as any);

    const files = result.posts.get('skip-cqd')!.files;
    expect(files).toHaveLength(1);
    expect(files[0].canonicalId).toBe('drive:realFile20charsPaddin');
  });
});

// ============================================================================
// ACCORDION STATE
// ============================================================================

describe('DOMScanner: Accordion State', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects expanded state via aria-expanded', () => {
    const post = createClassworkPost('acc-expanded', true);
    document.body.appendChild(post);

    const scanner = new DOMScanner();
    const result = scanner.fullScan('classwork_list' as any);

    expect(result.posts.get('acc-expanded')!.isExpanded).toBe(true);
  });

  it('detects collapsed state via aria-expanded=false', () => {
    const post = createClassworkPost('acc-collapsed', false);
    document.body.appendChild(post);

    const scanner = new DOMScanner();
    const result = scanner.fullScan('classwork_list' as any);

    expect(result.posts.get('acc-collapsed')!.isExpanded).toBe(false);
  });

  it('treats stream posts as always expanded', () => {
    const post = createClassworkPost('stream-post', false);
    document.body.appendChild(post);

    const scanner = new DOMScanner();
    const result = scanner.fullScan('stream' as any);

    // Even though aria-expanded=false, stream view → always expanded
    expect(result.posts.get('stream-post')!.isExpanded).toBe(true);
  });

  it('treats topic view posts as always expanded', () => {
    const post = createClassworkPost('topic-post', false);
    document.body.appendChild(post);

    const scanner = new DOMScanner();
    const result = scanner.fullScan('classwork_topic' as any);

    expect(result.posts.get('topic-post')!.isExpanded).toBe(true);
  });
});

// ============================================================================
// NESTED POSTS
// ============================================================================

describe('DOMScanner: Nested Posts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('skips nested posts (post inside another post)', () => {
    const outer = document.createElement('div');
    outer.setAttribute('data-stream-item-id', 'outer');

    const inner = document.createElement('div');
    inner.setAttribute('data-stream-item-id', 'inner');
    outer.appendChild(inner);

    document.body.appendChild(outer);

    const scanner = new DOMScanner();
    const result = scanner.fullScan('stream' as any);

    // Only the outer post should be found
    expect(result.posts.has('outer')).toBe(true);
    expect(result.posts.has('inner')).toBe(false);
  });
});

// ============================================================================
// SCORERS GETTER
// ============================================================================

describe('DOMScanner: getScorers', () => {
  it('exposes scorer instances for debugging', () => {
    const scanner = new DOMScanner();
    const scorers = scanner.getScorers();

    expect(scorers.post).toBeTruthy();
    expect(scorers.file).toBeTruthy();
    expect(scorers.accordion).toBeTruthy();
  });
});
