import { beforeEach, describe, expect, it } from 'vitest';
import { injectStyles } from '../entrypoints/content/styles';

describe('content/styles', () => {
  beforeEach(() => {
    document.getElementById('cqd-style')?.remove();
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
