/**
 * V1 CHARACTERIZATION — pins the CURRENT output of legacy V1 helpers on fixed
 * inputs. These tests document behavior as it is today, warts included; they
 * are the safety net for the S5 wrap and the S10 V1-detector strip.
 *
 * A characterization failure means V1 behavior drifted — investigate before
 * "fixing" the test. Changing an expectation here requires a note in the PR
 * explaining what changed and why (that is the whole point of pinning).
 *
 * Pinned 2026-08-22 at extension suite 3414 tests green.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanAttachmentName } from '../../entrypoints/content/file-meta';
import { toDownloadUrl } from '../../entrypoints/content/url-utils';
import { detectComments } from '../../entrypoints/content/smart-detector-comments';
import { isActualPostCard } from '../../entrypoints/content/post-card-utils';

describe('characterization: V1 cleanAttachmentName', () => {
  it('strips known English garbage type labels', () => {
    expect(cleanAttachmentName('Worksheet PDF')).toBe('Worksheet');
    expect(cleanAttachmentName('Spreadsheet Microsoft Excel')).toBe('Spreadsheet');
  });

  it('collapses a doubled filename', () => {
    expect(cleanAttachmentName('notes.txtnotes.txt')).toBe('notes.txt');
  });

  // DOCUMENTED GAP (D10): localized type labels are NOT stripped — #541.
  it('leaves localized type labels attached (known defect D10)', () => {
    expect(cleanAttachmentName('example.zipTömörítettArchívum')).toBe(
      'example.zipTömörítettArchívum',
    );
  });
});

describe('characterization: V1 toDownloadUrl', () => {
  it('converts a Drive file URL to the uc export form', () => {
    expect(toDownloadUrl('https://drive.google.com/file/d/ABC123/view?usp=sharing')).toBe(
      'https://drive.google.com/uc?export=download&id=ABC123',
    );
  });

  it('passes through non-drive URLs untouched', () => {
    expect(toDownloadUrl('https://example.com/file.pdf')).toBe('https://example.com/file.pdf');
  });
});

describe('characterization: V1 detectComments', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads count from the L0 DOM-truth shell regardless of language', () => {
    document.body.innerHTML = `
      <article data-stream-item-id="p1">
        <div class="qCWAqb"><div class="huI6Cb">4</div></div>
      </article>`;
    const post = document.querySelector<HTMLElement>('[data-stream-item-id]')!;
    const result = detectComments(post, 'en');
    expect(result.hasComments).toBe(true);
    expect(result.count).toBe(4);
  });

  it('treats "No class comments" as absent', () => {
    document.body.innerHTML = `
      <article data-stream-item-id="p2">
        <span>No class comments</span>
      </article>`;
    const post = document.querySelector<HTMLElement>('[data-stream-item-id]')!;
    const result = detectComments(post, 'en');
    expect(result.hasComments).toBe(false);
  });
});

describe('characterization: V1 post-card hygiene', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('rejects internal jscontroller containers as cards', () => {
    document.body.innerHTML = `
      <div data-stream-item-id="x" jscontroller="h38nBf"></div>`;
    const el = document.querySelector<HTMLElement>('[data-stream-item-id]')!;
    expect(isActualPostCard(el)).toBe(false);
  });

  it('accepts a plain stream card', () => {
    document.body.innerHTML = `
      <li data-stream-item-id="y" class="n4xnA"><div>post</div></li>`;
    const el = document.querySelector<HTMLElement>('[data-stream-item-id]')!;
    expect(isActualPostCard(el)).toBe(true);
  });
});
