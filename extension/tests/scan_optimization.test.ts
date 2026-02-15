import { describe, expect, it } from 'vitest';
import { getDistinctRoots } from '../entrypoints/content/observers';
import type { QueryRoot } from '../entrypoints/content/types';

describe('scan_optimization', () => {
  it('deduplicates nested roots', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.appendChild(child);

    const roots = new Set<QueryRoot>([parent, child]);
    const distinct = getDistinctRoots(roots);

    expect(distinct).toHaveLength(1);
    expect(distinct[0]).toBe(parent);
  });

  it('keeps disjoint roots', () => {
    const root1 = document.createElement('div');
    const root2 = document.createElement('div');

    // They are siblings or just unrelated
    document.body.appendChild(root1);
    document.body.appendChild(root2);

    const roots = new Set<QueryRoot>([root1, root2]);
    const distinct = getDistinctRoots(roots);

    expect(distinct).toHaveLength(2);
    expect(distinct).toContain(root1);
    expect(distinct).toContain(root2);
  });

  it('handles document and body', () => {
    const body = document.body;
    const div = document.createElement('div');
    body.appendChild(div);

    const roots = new Set<QueryRoot>([document, body, div]);
    const distinct = getDistinctRoots(roots);

    // document contains body. body contains div.
    // So only document should remain.
    expect(distinct).toHaveLength(1);
    expect(distinct[0]).toBe(document);
  });

  it('handles single root', () => {
    const div = document.createElement('div');
    const roots = new Set<QueryRoot>([div]);
    const distinct = getDistinctRoots(roots);

    expect(distinct).toHaveLength(1);
    expect(distinct[0]).toBe(div);
  });

  it('handles empty set', () => {
    const roots = new Set<QueryRoot>();
    const distinct = getDistinctRoots(roots);
    expect(distinct).toHaveLength(0);
  });
});
