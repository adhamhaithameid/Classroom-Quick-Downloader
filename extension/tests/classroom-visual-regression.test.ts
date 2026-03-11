import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { queryPostCards } from '../entrypoints/content/post-card-utils';

const mixedLinksFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/classroom/mixed-links-post-en.html'),
  'utf8'
);
const rtlFlaggedFixture = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/classroom/rtl-flagged-post-ar.html'),
  'utf8'
);

describe('classroom visual structure regressions', () => {
  it('keeps the mixed-links fixture anchored to one outer card', () => {
    document.body.innerHTML = mixedLinksFixture;

    const outer = document.querySelector('[data-stream-item-id="fixture-stream-3"]') as HTMLElement;
    const cards = queryPostCards();

    expect(cards).toHaveLength(1);
    expect(cards[0]).toBe(outer);
    expect(document.querySelectorAll('.comment-shell').length).toBe(1);
    expect(outer.querySelectorAll('.luto0c[data-attachment-id]').length).toBe(2);
    expect(outer.querySelectorAll('a[href*="docs.google.com/forms"]').length).toBe(1);
    expect(outer.querySelectorAll('a[href*="docs.google.com/spreadsheets"]').length).toBe(1);
    expect(outer.querySelectorAll('a[href*="youtube.com"]').length).toBe(1);
  });

  it('keeps the RTL flagged fixture anchored to one outer card', () => {
    document.body.innerHTML = rtlFlaggedFixture;

    const outer = document.querySelector('[data-stream-item-id="fixture-stream-ar-1"]') as HTMLElement;
    const cards = queryPostCards();

    expect(cards).toHaveLength(1);
    expect(cards[0]).toBe(outer);
    expect(document.querySelectorAll('.comment-shell').length).toBe(1);
    expect(outer.getAttribute('dir')).toBe('rtl');
    expect(outer.textContent).toContain('تم التعديل');
    expect(outer.textContent).toContain('٥ تعليقات صفية');
  });
});
