// filepath: extension/tests/v2-docs-anchor-discovery.test.ts
/**
 * z57 STAGE 2 — docs/sheets/slides/drawings anchor discovery parity.
 *
 * V1's DRIVE_ANCHOR_SELECTOR (entrypoints/content/state.ts) covers
 * docs.google.com document/presentation/drawings/spreadsheets anchors; V2's
 * FILE_ANCHOR_CANDIDATES missed them, so Docs/Sheets attachments got no
 * buttons in v2 mode (the qa-01 docs-url assertion family). These tests pin
 * each anchor shape V1 handles — including the Forms EXCLUSION (golden rule
 * 3) — through the real engine discovery path.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { EngineV2 } from '../src/engines/v2/engine-v2';
import { createFileAnchorScorer } from '../src/v2/selectors/selector-registry';

/**
 * Attach one post (with the given attachment anchor markup) to the document
 * and run the real EngineV2 file discovery over it.
 */
function discover(attachmentHtml: string): Array<{ canonicalId: string; name: string; ext?: string; downloadUrl: string }> {
  document.body.innerHTML = `
    <div data-stream-item-id="docs-post-1">
      <article>
        ${attachmentHtml}
      </article>
    </div>`;
  const postEl = document.querySelector('[data-stream-item-id="docs-post-1"]') as HTMLElement;
  const engine = new EngineV2();
  // discoverFiles is private; run it through the engine's own scorer seam the
  // same way discoverFiles does — queryAllCandidates (the union across
  // candidates; a post can mix Drive and Docs kinds) + extractFileNode.
  const scorer = createFileAnchorScorer();
  const found = scorer.queryAllCandidates(postEl).allElements;
  const extract = (engine as unknown as {
    extractFileNode: (el: HTMLElement) => { canonicalId: string; name: string; ext?: string; downloadUrl: string } | null;
  }).extractFileNode.bind(engine);

  const out: Array<{ canonicalId: string; name: string; downloadUrl: string }> = [];
  const seen = new Set<string>();
  for (const el of found) {
    const file = extract(el);
    if (file && !seen.has(file.canonicalId)) {
      seen.add(file.canonicalId);
      out.push(file);
    }
  }
  return out;
}

describe('v2 docs anchor discovery (z57 S2)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('discovers a Docs document anchor and converts its URL to the Drive download endpoint', () => {
    const files = discover(`
      <div data-attachment-id="d1">
        <a aria-label="Attachment: Syllabus.docx" href="https://docs.google.com/document/d/DOCID123/edit">Syllabus.docx</a>
      </div>`);

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('Syllabus.docx');
    expect(files[0].downloadUrl).toContain('drive.usercontent.google.com/download');
    expect(files[0].downloadUrl).toContain('id=DOCID123');
  });

  it('discovers a Sheets spreadsheet anchor (the qa-01/qa-06 xlsx shape)', () => {
    const files = discover(`
      <div data-attachment-id="s1">
        <a aria-label="Attachment: grades.xlsx" href="https://docs.google.com/spreadsheets/d/SHID123/edit?usp=sharing">grades.xlsx</a>
      </div>`);

    expect(files).toHaveLength(1);
    expect(files[0].downloadUrl).toContain('id=SHID123');
    expect(files[0].ext).toBe('xlsx');
  });

  it('discovers Slides and Drawings anchors', () => {
    const files = discover(`
      <div data-attachment-id="p1">
        <a aria-label="Attachment: deck.pptx" href="https://docs.google.com/presentation/d/PRESID/edit">deck.pptx</a>
      </div>
      <div data-attachment-id="dr1">
        <a aria-label="Attachment: sketch" href="https://docs.google.com/drawings/d/DRAWID/edit">sketch</a>
      </div>`);

    expect(files).toHaveLength(2);
    const urls = files.map((f) => f.downloadUrl).sort();
    expect(urls[0]).toContain('id=DRAWID');
    expect(urls[1]).toContain('id=PRESID');
  });

  it('anchor candidates mirror V1 DRIVE_ANCHOR_SELECTOR shapes exactly (no /u/N viewer links — V1 parity)', () => {
    // V1's selector list is host-anchored ("docs.google.com/document/…"), so
    // a /u/N viewer URL matches no anchor shape in V1 either. The pure URL
    // layer (core/acquire/download-url) still handles the /u/N path form —
    // pinned in core-download-url.test.ts. This test locks the parity line.
    const files = discover(`
      <div data-attachment-id="u1">
        <a href="https://docs.google.com/u/1/document/d/USERDOC/edit">doc.pdf</a>
      </div>`);
    expect(files).toHaveLength(0);
  });

  it('never discovers a Forms anchor (golden rule 3 — forms stay button-free)', () => {
    const files = discover(`
      <div data-attachment-id="form1">
        <a aria-label="Attachment: Feedback form" href="https://docs.google.com/forms/d/e/1FAIpQLSdZBCCxLrM0oZiJF2QEFBR4RdhBj_byOSGFBD5rs74U8XaAWw/viewform?usp=dialog">Feedback form</a>
      </div>`);
    expect(files).toHaveLength(0);
  });

  it('discovers Drive anchors alongside docs anchors with distinct canonical ids', () => {
    const files = discover(`
      <div data-attachment-id="mix1">
        <a aria-label="Attachment: lecture.pdf" href="https://drive.google.com/file/d/DRIVEID123/view?usp=classroom_web">lecture.pdf</a>
      </div>
      <div data-attachment-id="mix2">
        <a aria-label="Attachment: notes.pdf" href="https://docs.google.com/document/d/DOCID456/edit">notes.pdf</a>
      </div>`);

    expect(files).toHaveLength(2);
    expect(files[0].canonicalId).not.toBe(files[1].canonicalId);
  });

  it('keeps the same canonical id across rescans of identical docs anchors (dedup stability)', () => {
    const html = `
      <div data-attachment-id="stable1">
        <a aria-label="Attachment: same.xlsx" href="https://docs.google.com/spreadsheets/d/STABLEID/edit">same.xlsx</a>
      </div>`;
    const first = discover(html);
    const second = discover(html);
    expect(first[0].canonicalId).toBe(second[0].canonicalId);
  });
});
