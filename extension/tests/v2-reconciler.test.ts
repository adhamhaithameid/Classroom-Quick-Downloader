// filepath: extension/tests/v2-reconciler.test.ts
/**
 * ============================================================================
 * V2 RECONCILER TESTS — Diffing & Operation Generation
 * ============================================================================
 *
 * Tests for the reconciler — the module that diffs scan results
 * against the model and produces minimal operations.
 *
 * This is mission-critical: if the reconciler produces wrong operations,
 * buttons will be missing, duplicated, or placed incorrectly.
 *
 * @author Adham — my React experience paying off in test design
 * @since v4.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  reconcile,
  applyOpsToModel,
} from '../src/v2/model/reconciler';
import type { ReconcileOp } from '../src/v2/model/reconciler';
import type { ScanResult, ScannedPost } from '../src/v2/model/dom-scanner';
import {
  createCourseContext,
  createPostModel,
  createFileModel,
  computeFingerprint,
} from '../src/v2/model/entities';
import type { CourseContext } from '../src/v2/model/entities';

// ============================================================================
// HELPERS
// ============================================================================

function makeScannedPost(overrides: Partial<ScannedPost> = {}): ScannedPost {
  const el = document.createElement('div');
  el.setAttribute('data-stream-item-id', overrides.id || 'test-post');
  if (overrides.element) {
    // Use the provided element
  } else {
    overrides.element = el;
  }
  return {
    id: 'test-post',
    element: el,
    fingerprint: computeFingerprint(el),
    files: [],
    isExpanded: true,
    isConnected: true,
    ...overrides,
  };
}

function makeScanResult(posts: Map<string, ScannedPost>): ScanResult {
  let totalFiles = 0;
  for (const post of posts.values()) {
    totalFiles += post.files.length;
  }
  return {
    timestamp: Date.now(),
    duration_ms: 1,
    viewKind: 'stream' as any,
    posts,
    totalFiles,
    scorerTraces: new Map(),
  };
}

function makeModel(): CourseContext {
  return createCourseContext('/c/test123', 'stream' as any);
}

// ============================================================================
// TESTS
// ============================================================================

describe('reconcile', () => {
  let model: CourseContext;

  beforeEach(() => {
    document.body.innerHTML = '';
    model = makeModel();
  });

  it('produces ADD_POST for new posts', () => {
    const posts = new Map<string, ScannedPost>();
    posts.set('new-1', makeScannedPost({ id: 'new-1' }));
    posts.set('new-2', makeScannedPost({ id: 'new-2' }));

    const result = reconcile(model, makeScanResult(posts));

    expect(result.addedCount).toBe(2);
    expect(result.removedCount).toBe(0);
    expect(result.ops.filter(op => op.type === 'ADD_POST')).toHaveLength(2);
  });

  it('produces REMOVE_POST for posts no longer in scan', () => {
    // Add a post to the model first
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'old-post');
    document.body.appendChild(el);
    const postModel = createPostModel(el, 'stream' as any);
    model.posts.set('old-post', postModel);

    // Scan finds no posts
    const result = reconcile(model, makeScanResult(new Map()));

    expect(result.removedCount).toBe(1);
    expect(result.ops.find(op => op.type === 'REMOVE_POST')).toBeTruthy();
  });

  it('produces STABLE for unchanged posts', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'stable-post');
    document.body.appendChild(el);

    // Add the post to the model
    const postModel = createPostModel(el, 'stream' as any);
    model.posts.set('stable-post', postModel);

    // Scan finds the same post with the same fingerprint
    const posts = new Map<string, ScannedPost>();
    posts.set('stable-post', makeScannedPost({
      id: 'stable-post',
      element: el,
      fingerprint: postModel.fingerprint,
    }));

    const result = reconcile(model, makeScanResult(posts));

    expect(result.stableCount).toBe(1);
    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(0);
  });

  it('produces UPDATE_POST when files are added', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'update-post');
    document.body.appendChild(el);

    const postModel = createPostModel(el, 'stream' as any);
    model.posts.set('update-post', postModel);

    // Add a file link to the element (changing the fingerprint)
    const link = document.createElement('a');
    link.href = 'https://drive.google.com/file/d/newFile123456789012/view';
    el.appendChild(link);

    // Scan with the new file
    const posts = new Map<string, ScannedPost>();
    posts.set('update-post', makeScannedPost({
      id: 'update-post',
      element: el,
      fingerprint: computeFingerprint(el), // Different fingerprint now
      files: [{
        canonicalId: 'drive:newFile123456789012',
        element: link,
        idSource: 'url-parse',
        name: 'test.pdf',
        ext: 'pdf',
        downloadUrl: 'https://drive.google.com/file/d/newFile123456789012/view',
      }],
    }));

    const result = reconcile(model, makeScanResult(posts));

    expect(result.updatedCount).toBe(1);
    const updateOp = result.ops.find(op => op.type === 'UPDATE_POST');
    expect(updateOp).toBeTruthy();
    if (updateOp && updateOp.type === 'UPDATE_POST') {
      expect(updateOp.addedFiles).toHaveLength(1);
      expect(updateOp.removedFiles).toHaveLength(0);
    }
  });

  it('produces TOGGLE_VISIBILITY when accordion state changes', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'toggle-post');
    document.body.appendChild(el);

    const postModel = createPostModel(el, 'stream' as any);
    postModel.isExpanded = false;
    model.posts.set('toggle-post', postModel);

    const posts = new Map<string, ScannedPost>();
    posts.set('toggle-post', makeScannedPost({
      id: 'toggle-post',
      element: el,
      fingerprint: postModel.fingerprint,
      isExpanded: true, // Changed from false to true
    }));

    const result = reconcile(model, makeScanResult(posts));

    expect(result.toggleCount).toBe(1);
    const toggleOp = result.ops.find(op => op.type === 'TOGGLE_VISIBILITY');
    expect(toggleOp).toBeTruthy();
  });

  it('handles mixed operations in one batch', () => {
    // Set up model with 3 existing posts
    for (const id of ['keep-1', 'remove-1', 'keep-2']) {
      const el = document.createElement('div');
      el.setAttribute('data-stream-item-id', id);
      document.body.appendChild(el);
      model.posts.set(id, createPostModel(el, 'stream' as any));
    }

    // Scan has: keep-1, keep-2 (stable), add-1 (new), remove-1 is missing
    const posts = new Map<string, ScannedPost>();
    for (const id of ['keep-1', 'keep-2']) {
      const existing = model.posts.get(id)!;
      posts.set(id, makeScannedPost({
        id,
        element: existing.elementRef.deref()!,
        fingerprint: existing.fingerprint,
      }));
    }
    posts.set('add-1', makeScannedPost({ id: 'add-1' }));

    const result = reconcile(model, makeScanResult(posts));

    expect(result.stableCount).toBe(2);
    expect(result.addedCount).toBe(1);
    expect(result.removedCount).toBe(1);
  });
});

// ============================================================================
// applyOpsToModel
// ============================================================================

describe('applyOpsToModel', () => {
  let model: CourseContext;

  beforeEach(() => {
    model = makeModel();
  });

  it('adds new posts to the model', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'new-1');

    const ops: ReconcileOp[] = [{
      type: 'ADD_POST',
      postId: 'new-1',
      post: makeScannedPost({ id: 'new-1', element: el }),
    }];

    applyOpsToModel(model, ops, 'stream' as any);

    expect(model.posts.has('new-1')).toBe(true);
    expect(model.posts.get('new-1')!.id).toBe('new-1');
  });

  it('removes posts from the model', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'remove-1');
    model.posts.set('remove-1', createPostModel(el, 'stream' as any));

    const ops: ReconcileOp[] = [{ type: 'REMOVE_POST', postId: 'remove-1' }];
    applyOpsToModel(model, ops, 'stream' as any);

    expect(model.posts.has('remove-1')).toBe(false);
  });

  it('increments scanCount and updates lastScanAt on STABLE', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'stable-1');
    model.posts.set('stable-1', createPostModel(el, 'stream' as any));

    const ops: ReconcileOp[] = [{ type: 'STABLE', postId: 'stable-1' }];
    applyOpsToModel(model, ops, 'stream' as any);

    expect(model.posts.get('stable-1')!.stableScanCount).toBe(1);
    expect(model.scanCount).toBe(1);
  });

  it('toggles visibility correctly', () => {
    const el = document.createElement('div');
    el.setAttribute('data-stream-item-id', 'toggle-1');
    const post = createPostModel(el, 'stream' as any);
    post.isExpanded = true;
    model.posts.set('toggle-1', post);

    const ops: ReconcileOp[] = [{
      type: 'TOGGLE_VISIBILITY',
      postId: 'toggle-1',
      isExpanded: false,
    }];
    applyOpsToModel(model, ops, 'stream' as any);

    expect(model.posts.get('toggle-1')!.isExpanded).toBe(false);
  });
});
