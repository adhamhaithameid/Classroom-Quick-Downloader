// filepath: extension/tests/v2-selector-audit.test.ts
/**
 * ============================================================================
 * S11 #615 — SELECTOR AUDIT: hash-id fallback rate
 * ============================================================================
 *
 * ENGINE_V4_SYSTEM_DESIGN §5 rule 1: a hash id is a fallback, never a
 * default — a rising hash-id rate is the early warning that Classroom
 * changed its attachment markup, days before users report anything. The
 * engine tracks HOW each file id resolved (FileNode.idSource) and now
 * exposes the aggregate (EngineV2.getSelectorStats →
 * window.__cqdPerfSnapshot().selectorStats).
 *
 * What these tests pin:
 * 1. The aggregate math over a mixed fixture: a data-drive-id file and a
 *    hash-fallback file (a drive /open?id= anchor with no attribute or URL
 *    segment to parse) → hashIdCount 1, totalFiles 2, hashIdRate 0.5.
 * 2. An empty file map reports zeros (never NaN).
 * 3. The accuracy-corpus classroom fixtures carry ZERO hash-fallback files —
 *    the documented 2026-09 corpus rate (docs/engine/selector-audit-2026-09.md).
 *
 * @since v4.1.0 — S11
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EngineV2 } from '../src/engines/v2/engine-v2';
import { engineRegistry } from '../src/engines/engine-registry';
import { createFileAnchorScorer } from '../src/v2/selectors/selector-registry';
import type { ViewKind } from '../src/engines/types';

/** Build a stream post whose attachment anchor carries data-drive-id. */
function makeDriveIdPost(id: string, driveId: string): HTMLElement {
  const post = document.createElement('article');
  post.setAttribute('data-stream-item-id', id);
  const anchor = document.createElement('a');
  anchor.setAttribute('data-drive-id', driveId);
  anchor.href = `https://drive.google.com/file/d/${driveId}/view`;
  anchor.textContent = 'Syllabus.pdf';
  post.appendChild(anchor);
  return post;
}

/**
 * Build a stream post whose anchor resolves ONLY through the URL-hash
 * fallback: a drive /open?id= link with no data-drive-id, no /d/{id}/ URL
 * segment, and no data-id/data-item-id pair.
 */
function makeHashFallbackPost(id: string): HTMLElement {
  const post = document.createElement('article');
  post.setAttribute('data-stream-item-id', id);
  const anchor = document.createElement('a');
  anchor.href = 'https://drive.google.com/open?id=no-canonical-parse-here';
  anchor.textContent = 'weird-link.pdf';
  post.appendChild(anchor);
  return post;
}

describe('EngineV2.getSelectorStats (S11 #615 selector audit)', () => {
  let engine: EngineV2;
  let controller: AbortController;

  beforeEach(() => {
    document.body.innerHTML = '';
    engine = new EngineV2();
    controller = new AbortController();
    controller.abort(); // skip waitForContentReady, same idiom as v2-engines.test.ts
    engineRegistry.setMode('v2');
  });

  it('counts hash-fallback files and total files across the current file map', () => {
    const host = document.createElement('div');
    host.id = 'page';
    document.body.appendChild(host);
    host.appendChild(makeDriveIdPost('post-a', 'driveAaaaaPad20Chars0000'));
    host.appendChild(makeHashFallbackPost('post-b'));

    engine.init('stream' as ViewKind, controller.signal);
    engine.fullScan();

    expect(engine.getTrackedPosts().length).toBe(2);
    expect(engine.getSelectorStats()).toEqual({
      hashIdCount: 1,
      totalFiles: 2,
      hashIdRate: 0.5,
    });
  });

  it('reports zeros (never NaN) when no files are tracked', () => {
    engine.init('stream' as ViewKind, controller.signal);
    engine.fullScan();

    expect(engine.getSelectorStats()).toEqual({
      hashIdCount: 0,
      totalFiles: 0,
      hashIdRate: 0,
    });
  });
});

describe('selector audit over the accuracy-corpus classroom fixtures', () => {
  /**
   * Run the real discovery seam (file-anchor scorer + extractFileNode — the
   * exact priority chain under audit) over one fixture page and return the
   * per-file idSource values, deduped by canonical id like discoverFiles.
   */
  function idSourcesInFixture(fixture: string): string[] {
    document.body.innerHTML = fixture;
    const engine = new EngineV2();
    const scorer = createFileAnchorScorer();
    const extract = (engine as unknown as {
      extractFileNode: (el: HTMLElement) => { idSource: string; canonicalId: string } | null;
    }).extractFileNode.bind(engine);

    const sources: string[] = [];
    const seen = new Set<string>();
    for (const el of scorer.queryAllCandidates(document.body).allElements) {
      const file = extract(el);
      if (file && !seen.has(file.canonicalId)) {
        seen.add(file.canonicalId);
        sources.push(file.idSource);
      }
    }
    return sources;
  }

  it('carries ZERO hash-fallback files (the 2026-09 corpus rate)', () => {
    const fixturesDir = resolve(process.cwd(), 'tests/fixtures/classroom');
    const manifest = JSON.parse(
      readFileSync(resolve(fixturesDir, 'manifest.json'), 'utf8'),
    ) as { fixtures: Array<{ file: string }> };
    expect(manifest.fixtures.length).toBeGreaterThan(0);

    let totalFiles = 0;
    let hashIdCount = 0;
    for (const { file } of manifest.fixtures) {
      const html = readFileSync(resolve(fixturesDir, file), 'utf8');
      for (const source of idSourcesInFixture(html)) {
        totalFiles++;
        if (source === 'url-hash') hashIdCount++;
      }
    }

    // The documented corpus rate — see docs/engine/selector-audit-2026-09.md.
    // If this fails, a NEW fixture is synthesizing hash fallbacks: audit the
    // fixture's anchor markup before touching the pinned numbers.
    expect({ totalFiles, hashIdCount }).toEqual({ totalFiles: 8, hashIdCount: 0 });
  });
});
