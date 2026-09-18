// filepath: extension/tests/v2-engine-targeted-mutations.test.ts
/**
 * ============================================================================
 * ENGINE V2 — TARGETED MUTATION SCANS (S11, gate G5)
 * ============================================================================
 *
 * The G5 budget says handleMutations must stay under 6ms p95. Until S11
 * every RELEVANT mutation batch dispatched a full-page fullScan (~15-22ms
 * at ~50 posts), so the p95 sat at ~18ms — 3x over budget. The fix: resolve
 * the affected post elements FROM the mutation batch and run only those
 * posts through the existing per-post pipeline. fullScan stays for view
 * changes/init and as the bounded escalation for huge or unresolvable
 * batches.
 *
 * What these tests pin:
 * 1. A mutation touching ONE post re-runs detection ONLY on that post
 *    (spied detectFlags) — other tracked posts are not re-scanned.
 * 2. The touched post IS scanned AND rendered (button for its file).
 * 3. A post added via mutation gets tracked + rendered (qa-05's
 *    "delayed post gets its button without any interaction").
 * 4. A file anchor added INTO an existing post re-scans the containing
 *    post and renders the new file's button.
 * 5. A removed post is cleaned from tracking (parity with fullScan cleanup).
 * 6. An attribute mutation inside one post re-scans only that post.
 * 7. A huge batch (over the targeted threshold) escalates to fullScan.
 * 8. A relevant-but-unresolvable batch escalates to fullScan.
 * 9. Irrelevant mutations trigger no scan at all.
 *
 * @since v4.1.0 — S11
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EngineV2, TARGETED_SCAN_MAX_POSTS } from '../src/engines/v2/engine-v2';
import { engineRegistry } from '../src/engines/engine-registry';
import type { ViewKind } from '../src/engines/types';

// ============================================================================
// HELPERS
// ============================================================================

/** Build a realistic stream post: card + one Drive attachment anchor. */
function makePost(id: string, driveId: string, fileName: string): HTMLElement {
  const post = document.createElement('article');
  post.setAttribute('data-stream-item-id', id);
  const anchor = document.createElement('a');
  anchor.setAttribute('data-drive-id', driveId);
  anchor.href = `https://drive.google.com/file/d/${driveId}Pad20Chars000000/view`;
  anchor.textContent = fileName;
  post.appendChild(anchor);
  return post;
}

function childListMutation(
  target: Node,
  added: Node[] = [],
  removed: Node[] = [],
): MutationRecord {
  return {
    type: 'childList',
    addedNodes: added as unknown as NodeList,
    removedNodes: removed as unknown as NodeList,
    target,
    attributeName: null,
    attributeNamespace: null,
    nextSibling: null,
    previousSibling: null,
    oldValue: null,
  } as unknown as MutationRecord;
}

function attributeMutation(target: HTMLElement, attr: string): MutationRecord {
  return {
    type: 'attributes',
    addedNodes: [] as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
    target,
    attributeName: attr,
    attributeNamespace: null,
    nextSibling: null,
    previousSibling: null,
    oldValue: null,
  } as unknown as MutationRecord;
}

describe('EngineV2 targeted mutation scans (S11)', () => {
  let engine: EngineV2;
  let controller: AbortController;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new EngineV2();
    controller = new AbortController();
    controller.abort(); // skip waitForContentReady, same idiom as v2-engines.test.ts
    engineRegistry.setMode('v2');
  });

  afterEach(() => {
    engine.destroy();
    engineRegistry.setMode('shadow');
  });

  /** Seed the page with 3 posts and run one initial full scan. */
  function seedPageAndScan(): void {
    const host = document.createElement('div');
    host.id = 'page';
    document.body.appendChild(host);
    host.appendChild(makePost('post-a', 'driveAaaaaPad20Chars0000', 'a.pdf'));
    host.appendChild(makePost('post-b', 'driveBbbbbPad20Chars0000', 'b.pdf'));
    host.appendChild(makePost('post-c', 'driveCccccPad20Chars0000', 'c.pdf'));
    engine.init('stream' as ViewKind, controller.signal);
    engine.fullScan();
  }

  it('a single-post mutation scans ONLY the touched post (spied detectFlags)', async () => {
    seedPageAndScan();
    expect(engine.getTrackedPosts().length).toBe(3);

    const detectSpy = vi.spyOn(
      engine as unknown as { detectFlags: (el: HTMLElement, id: string) => unknown },
      'detectFlags',
    );

    // Append one new post under the host — its own observer batch.
    const host = document.getElementById('page')!;
    const added = makePost('post-d', 'driveDddddPad20Chars0000', 'd.pdf');
    host.appendChild(added);

    engine.handleMutations([childListMutation(host, [added])]);

    // The touched post IS scanned — exactly once — and no other post is.
    expect(detectSpy).toHaveBeenCalledTimes(1);
    expect(detectSpy.mock.calls[0][1]).toBe('post-d');
  });

  it('a single-post mutation renders the touched post but leaves other posts unrendered-differently (no re-render work)', async () => {
    seedPageAndScan();

    // Count buttons before the mutation — every seeded post already has one.
    const buttonCountBefore = document.querySelectorAll('[data-cqd-file-id]').length;

    const renderSpy = vi.spyOn(
      engine as unknown as { renderPlacedButtons: () => void },
      'renderPlacedButtons',
    );

    const host = document.getElementById('page')!;
    const added = makePost('post-render', 'driveRrrrrPad20Chars0000', 'r.pdf');
    host.appendChild(added);

    engine.handleMutations([childListMutation(host, [added])]);

    // The new post got its button (touched post IS rendered).
    const addedButtons = added.querySelectorAll('[data-cqd-file-id]');
    expect(addedButtons.length).toBe(1);

    // Targeted path did NOT go through the full-page render — the per-post
    // render is scoped to the affected post.
    expect(renderSpy).not.toHaveBeenCalled();

    // Total buttons = before + exactly one new one (no duplicate injections).
    expect(document.querySelectorAll('[data-cqd-file-id]').length).toBe(buttonCountBefore + 1);
  });

  it('a file anchor added INSIDE an existing post re-scans only that post and renders the new file', async () => {
    seedPageAndScan();

    const detectSpy = vi.spyOn(
      engine as unknown as { detectFlags: (el: HTMLElement, id: string) => unknown },
      'detectFlags',
    );

    const host = document.getElementById('page')!;
    const postB = host.querySelector('[data-stream-item-id="post-b"]') as HTMLElement;
    const newAnchor = document.createElement('a');
    newAnchor.setAttribute('data-drive-id', 'driveNewddPad20Chars0000');
    newAnchor.href = 'https://drive.google.com/file/d/driveNewddPad20Chars0000/view';
    newAnchor.textContent = 'new.pdf';
    postB.appendChild(newAnchor);

    engine.handleMutations([childListMutation(postB, [newAnchor])]);

    expect(detectSpy).toHaveBeenCalledTimes(1);
    expect(detectSpy.mock.calls[0][1]).toBe('post-b');

    // The post now carries a button for the new file too.
    const fileIds = Array.from(
      postB.querySelectorAll('[data-cqd-file-id]'),
    ).map((b) => b.getAttribute('data-cqd-file-id'));
    expect(fileIds.some((id) => id?.includes('driveNewddPad20Chars0000'))).toBe(true);
  });

  it('a removed post is cleaned from tracking (fullScan cleanup parity)', async () => {
    seedPageAndScan();
    expect(engine.getTrackedPosts().length).toBe(3);

    const host = document.getElementById('page')!;
    const postC = host.querySelector('[data-stream-item-id="post-c"]') as HTMLElement;
    postC.remove();

    engine.handleMutations([childListMutation(host, [], [postC])]);

    const trackedIds = engine.getTrackedPosts().map((p) => p.id);
    expect(trackedIds).not.toContain('post-c');
    expect(trackedIds.sort()).toEqual(['post-a', 'post-b']);
  });

  it('an attribute mutation inside one post re-scans only that post', async () => {
    seedPageAndScan();

    const detectSpy = vi.spyOn(
      engine as unknown as { detectFlags: (el: HTMLElement, id: string) => unknown },
      'detectFlags',
    );

    const host = document.getElementById('page')!;
    const postB = host.querySelector('[data-stream-item-id="post-b"]') as HTMLElement;
    const anchor = postB.querySelector('a') as HTMLElement;
    anchor.setAttribute('aria-label', 'Attachment: renamed.pdf');

    engine.handleMutations([attributeMutation(anchor, 'aria-label')]);

    expect(detectSpy).toHaveBeenCalledTimes(1);
    expect(detectSpy.mock.calls[0][1]).toBe('post-b');
  });

  it(`a batch affecting more than ${TARGETED_SCAN_MAX_POSTS} posts escalates to fullScan`, async () => {
    seedPageAndScan();

    const fullScanSpy = vi.spyOn(engine, 'fullScan');

    const host = document.getElementById('page')!;
    const added: HTMLElement[] = [];
    for (let i = 0; i <= TARGETED_SCAN_MAX_POSTS + 1; i++) {
      const post = makePost(`burst-${i}`, `driveBurst${i}Pad20Chars0`, `${i}.pdf`);
      host.appendChild(post);
      added.push(post);
    }

    engine.handleMutations([childListMutation(host, added)]);

    expect(fullScanSpy).toHaveBeenCalledTimes(1);
    // Escalated scan processed everything — the burst posts are all tracked.
    for (const post of added) {
      const id = post.getAttribute('data-stream-item-id');
      expect(engine.getTrackedPosts().map((p) => p.id)).toContain(id);
    }
  });

  it('a relevant but unresolvable batch escalates to fullScan', async () => {
    seedPageAndScan();

    const fullScanSpy = vi.spyOn(engine, 'fullScan');

    // A Drive anchor added OUTSIDE any post — relevant (isRelevantNode hits
    // on data-drive-id), but no [data-stream-item-id] contains or is it.
    const strayAnchor = document.createElement('a');
    strayAnchor.setAttribute('data-drive-id', 'strayDrivePad20Chars00');
    strayAnchor.href = 'https://drive.google.com/file/d/strayDrivePad20Chars00/view';
    document.body.appendChild(strayAnchor);

    engine.handleMutations([childListMutation(document.body, [strayAnchor])]);

    expect(fullScanSpy).toHaveBeenCalledTimes(1);
  });

  it('irrelevant mutations trigger no scan at all', async () => {
    seedPageAndScan();

    const detectSpy = vi.spyOn(
      engine as unknown as { detectFlags: (el: HTMLElement, id: string) => unknown },
      'detectFlags',
    );
    const fullScanSpy = vi.spyOn(engine, 'fullScan');

    const noise = document.createElement('span');
    noise.textContent = 'churn';
    document.getElementById('page')!.appendChild(noise);

    engine.handleMutations([childListMutation(document.getElementById('page')!, [noise])]);

    expect(detectSpy).not.toHaveBeenCalled();
    expect(fullScanSpy).not.toHaveBeenCalled();
  });

  it('delayed-post journey: a post appearing via mutation gets its button without any interaction (qa-05 parity)', async () => {
    seedPageAndScan();

    const host = document.getElementById('page')!;
    const late = makePost('late-post', 'driveLatePad20Chars000', 'late.pdf');
    host.appendChild(late);

    engine.handleMutations([childListMutation(host, [late])]);

    expect(
      late.querySelector('button.cqd-download-btn[data-cqd-injected="true"]'),
    ).not.toBeNull();
  });
});
