// filepath: extension/tests/v2-entities.test.ts
/**
 * ============================================================================
 * V2 ENTITIES TESTS — Canonical Data Model Unit Tests
 * ============================================================================
 *
 * Tests for the three critical functions in entities.ts:
 * 1. getCanonicalFileId — the 4-level priority chain
 * 2. computeFingerprint — structural change detection
 * 3. Factory functions — createCourseContext, createPostModel, createFileModel
 *
 * These tests validate the heart of V2's deduplication strategy.
 * If getCanonicalFileId breaks, the extension will show duplicate
 * buttons or miss files entirely. So we test EVERY edge case.
 *
 * @author Adham — testing my own dedup logic until I'm paranoid
 * @since v4.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCanonicalFileId,
  computeFingerprint,
  createCourseContext,
  createPostModel,
  createFileModel,
} from '../src/v2/model/entities';

// ============================================================================
// getCanonicalFileId
// ============================================================================

describe('getCanonicalFileId', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('P1: returns drive: prefix from data-drive-id attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('data-drive-id', '1AbCdEfGhIjK');
    expect(getCanonicalFileId(el)).toBe('drive:1AbCdEfGhIjK');
  });

  it('P1: finds data-drive-id on ancestor element', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-drive-id', '1XyZ_parent');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(getCanonicalFileId(child)).toBe('drive:1XyZ_parent');
  });

  it('P2: extracts Drive file ID from anchor href', () => {
    const el = document.createElement('a') as HTMLAnchorElement;
    el.href = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view';
    expect(getCanonicalFileId(el)).toBe('drive:1AbCdEfGhIjKlMnOpQrStUvWxYz');
  });

  it('P2: extracts Drive file ID from docs.google.com URL', () => {
    const el = document.createElement('a') as HTMLAnchorElement;
    el.href = 'https://docs.google.com/document/d/1LongFileIdHere12345678/edit';
    expect(getCanonicalFileId(el)).toBe('drive:1LongFileIdHere12345678');
  });

  it('P2: extracts Drive ID from child anchor when element is a container', () => {
    const container = document.createElement('div');
    const anchor = document.createElement('a');
    anchor.href = 'https://drive.google.com/file/d/1ChildAnchorId1234567890/view';
    container.appendChild(anchor);
    expect(getCanonicalFileId(container)).toBe('drive:1ChildAnchorId1234567890');
  });

  it('P3: combines data-id and data-item-id', () => {
    const el = document.createElement('div');
    el.setAttribute('data-id', 'abc123');
    el.setAttribute('data-item-id', 'def456');
    expect(getCanonicalFileId(el)).toBe('meta:abc123:def456');
  });

  it('P4: falls back to URL-based ID (stripping auth params)', () => {
    const el = document.createElement('a') as HTMLAnchorElement;
    el.href = 'https://example.com/file/custom?authuser=0&u=1&hl=en&q=test';
    const id = getCanonicalFileId(el);
    expect(id).toContain('url:');
    expect(id).not.toContain('authuser');
    expect(id).not.toContain('u=1');
    expect(id).not.toContain('hl=en');
    expect(id).toContain('q=test');
  });

  it('returns null for elements with no identifiable URL or ID', () => {
    const el = document.createElement('div');
    expect(getCanonicalFileId(el)).toBeNull();
  });

  it('P1 takes priority over P2 (both data-drive-id and URL present)', () => {
    const el = document.createElement('a') as HTMLAnchorElement;
    el.setAttribute('data-drive-id', 'dataDriveWins');
    el.href = 'https://drive.google.com/file/d/urlShouldLose9999/view';
    expect(getCanonicalFileId(el)).toBe('drive:dataDriveWins');
  });

  it('handles very long Drive file IDs (44 chars)', () => {
    const el = document.createElement('a') as HTMLAnchorElement;
    const longId = '1' + 'a'.repeat(43);
    el.href = `https://drive.google.com/file/d/${longId}/view`;
    expect(getCanonicalFileId(el)).toBe(`drive:${longId}`);
  });

  it('handles IDs with underscores and hyphens', () => {
    const el = document.createElement('a') as HTMLAnchorElement;
    el.href = 'https://drive.google.com/file/d/1A-b_C-d_E-f_G-h_I-j_K/view';
    expect(getCanonicalFileId(el)).toBe('drive:1A-b_C-d_E-f_G-h_I-j_K');
  });

  it('does not match short URL segments as Drive IDs', () => {
    const el = document.createElement('a') as HTMLAnchorElement;
    el.href = 'https://drive.google.com/file/d/short/view';
    // "short" is only 5 chars, minimum is 20
    const id = getCanonicalFileId(el);
    expect(id).not.toContain('drive:short');
  });
});

// ============================================================================
// computeFingerprint
// ============================================================================

describe('computeFingerprint', () => {
  it('produces consistent output for the same structure', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'post-1');
    el.innerHTML = '<span>child 1</span><span>child 2</span>';

    const fp1 = computeFingerprint(el);
    const fp2 = computeFingerprint(el);
    expect(fp1).toBe(fp2);
  });

  it('changes when children are added', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'post-1');
    el.innerHTML = '<span>child 1</span>';

    const fp1 = computeFingerprint(el);

    el.appendChild(document.createElement('span'));
    const fp2 = computeFingerprint(el);

    expect(fp1).not.toBe(fp2);
  });

  it('changes when drive links are added', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'post-1');

    const fp1 = computeFingerprint(el);

    const link = document.createElement('a');
    link.href = 'https://drive.google.com/file/d/abc/view';
    el.appendChild(link);

    const fp2 = computeFingerprint(el);
    expect(fp1).not.toBe(fp2);
  });

  it('excludes CQD-injected elements from child count', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'post-1');
    el.innerHTML = '<span>real child</span>';

    const fp1 = computeFingerprint(el);

    // Add a CQD element — should NOT change the fingerprint
    const cqdBtn = document.createElement('button');
    cqdBtn.setAttribute('data-cqd-injected', 'true');
    el.appendChild(cqdBtn);

    const fp2 = computeFingerprint(el);
    expect(fp1).toBe(fp2);
  });

  it('changes when aria-expanded state changes', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'post-1');
    const toggle = document.createElement('div');
    toggle.setAttribute('aria-expanded', 'false');
    el.appendChild(toggle);

    const fp1 = computeFingerprint(el);

    toggle.setAttribute('aria-expanded', 'true');
    const fp2 = computeFingerprint(el);

    expect(fp1).not.toBe(fp2);
  });
});

// ============================================================================
// Factory functions
// ============================================================================

describe('createCourseContext', () => {
  it('extracts courseId from stream URL', () => {
    const ctx = createCourseContext('/c/MTIzNDU2', 'stream' as any);
    expect(ctx.courseId).toBe('MTIzNDU2');
    expect(ctx.viewKind).toBe('stream');
    expect(ctx.posts).toBeInstanceOf(Map);
    expect(ctx.posts.size).toBe(0);
  });

  it('extracts courseId from classwork URL', () => {
    const ctx = createCourseContext('/w/ABCxyz/t/all', 'classwork_list' as any);
    expect(ctx.courseId).toBe('ABCxyz');
  });

  it('uses "unknown" for non-matching URLs', () => {
    const ctx = createCourseContext('/some/random/path', 'unknown' as any);
    expect(ctx.courseId).toBe('unknown');
  });
});

describe('createPostModel', () => {
  it('creates a PostModel with correct defaults', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'post-abc');

    const post = createPostModel(el, 'stream' as any);
    expect(post.id).toBe('post-abc');
    expect(post.files).toBeInstanceOf(Map);
    expect(post.files.size).toBe(0);
    expect(post.flags).toBeNull();
    expect(post.isExpanded).toBe(true);
    expect(post.stableScanCount).toBe(0);
    expect(post.elementRef.deref()).toBe(el);
  });

  it('generates an ID for posts without data-stream-item-id', () => {
    const el = document.createElement('div');
    const post = createPostModel(el, 'stream' as any);
    expect(post.id).toMatch(/^gen-/);
  });
});

describe('createFileModel', () => {
  it('creates a FileModel with extracted name and extension', () => {
    const el = document.createElement('a') as HTMLAnchorElement;
    el.href = 'https://drive.google.com/file/d/abc/view';
    el.setAttribute('aria-label', 'homework.pdf');

    const file = createFileModel(el, 'drive:abc', 'url-parse');
    expect(file.canonicalId).toBe('drive:abc');
    expect(file.name).toBe('homework.pdf');
    expect(file.ext).toBe('pdf');
    expect(file.idSource).toBe('url-parse');
    expect(file.hasButton).toBe(false);
    expect(file.elementRef.deref()).toBe(el);
  });

  it('uses "Untitled" when no name can be extracted', () => {
    const el = document.createElement('div');
    const file = createFileModel(el, 'url:/something', 'url-hash');
    expect(file.name).toBe('Untitled');
  });
});
