import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import * as styles from '../entrypoints/content/styles';

const { injectStyles, injectStudentWorkStyles } = styles;

// The row-button base declarations, lifted from the shared constant (the
// button selectors differ per sheet, the declaration block must not).
const sharedBaseBlock = (sheet: string): string =>
  /will-change: transform, box-shadow, width, border-radius, padding-inline;[\s\S]*?background-color var\(--cqd-transition\);/.exec(
    sheet,
  )?.[0] ?? '';

describe('content/styles', () => {
  beforeEach(() => {
    document.getElementById('cqd-style')?.remove();
    document.getElementById('cqd-sw-style')?.remove();
  });

  it('injects style tag once', () => {
    injectStyles();
    const first = document.getElementById('cqd-style');
    expect(first).toBeTruthy();
    expect(first?.textContent).toContain('--cqd-transition');

    injectStyles();
    const all = document.querySelectorAll('#cqd-style');
    expect(all).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* S11: single source for the shared download-button CSS               */
/* ------------------------------------------------------------------ */
describe('content/styles shared button sheet (S11 de-dupe)', () => {
  // Declaration lines that exist in BOTH sheets' button sections. While the
  // CSS is duplicated, each occurs TWICE in the module; single-source means
  // the module declares each exactly once, in the shared constant.
  const sharedMarkers = [
    'will-change: transform, box-shadow, width, border-radius, padding-inline;',
    'transform: translateZ(0);',
  ];

  it('both builders emit the same shared declaration block (single source)', async () => {
    const source = readFileSync(
      resolve(process.cwd(), 'entrypoints/content/styles.ts'),
      'utf-8',
    );

    // The shared declarations live in ONE exported constant…
    expect(typeof styles.SHARED_BUTTON_SHEET).toBe('string');
    // …declared exactly once in the module — no second hand-maintained copy.
    for (const marker of sharedMarkers) {
      const occurrences = source.split(marker).length - 1;
      expect(occurrences, `expected exactly one occurrence of: ${marker}`).toBe(1);
    }

    injectStyles();
    injectStudentWorkStyles();
    const full = document.getElementById('cqd-style')?.textContent ?? '';
    const scoped = document.getElementById('cqd-sw-style')?.textContent ?? '';

    // The constant's shared declaration block must appear verbatim in BOTH
    // builders' emitted sheets.
    const block = sharedBaseBlock(styles.SHARED_BUTTON_SHEET as string);
    expect(block).toBeTruthy();
    expect(full).toContain(block);
    expect(scoped).toContain(block);
  });
});
