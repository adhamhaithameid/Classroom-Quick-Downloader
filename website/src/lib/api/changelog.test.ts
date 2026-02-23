import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchChangelog } from './changelog';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchChangelog', () => {
  it('fetches and normalizes a valid changelog payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            entries: [
              { id: 'r-137', version: '1.3.7', date: '2026-02-20', changes: ['Bug fix A', 'Feature B'], isImportant: true },
              { id: 'r-136', version: '1.3.6', date: '2026-02-10', changes: ['Stability fix'], isImportant: false }
            ]
          }),
          { status: 200 }
        )
      )
    );

    const data = await fetchChangelog();
    expect(data.ok).toBe(true);
    expect(data.entries).toHaveLength(2);
    expect(data.entries[0]?.version).toBe('1.3.7'); // should be sorted newest first
    expect(data.entries[0]?.isImportant).toBe(true);
    expect(data.entries[0]?.changes).toEqual(['Bug fix A', 'Feature B']);
    expect(data.entries[1]?.version).toBe('1.3.6');
  });

  it('sorts entries by date descending', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            entries: [
              { id: 'r-old', version: '1.2.0', date: '2025-06-01', changes: ['Old'], isImportant: false },
              { id: 'r-mid', version: '1.3.0', date: '2025-12-01', changes: ['Middle'], isImportant: false },
              { id: 'r-new', version: '1.3.7', date: '2026-02-20', changes: ['Newest'], isImportant: true }
            ]
          }),
          { status: 200 }
        )
      )
    );

    const data = await fetchChangelog();
    expect(data.entries[0]?.id).toBe('r-new');
    expect(data.entries[1]?.id).toBe('r-mid');
    expect(data.entries[2]?.id).toBe('r-old');
  });

  it('filters out entries with missing required fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            entries: [
              { id: 'r-good', version: '1.3.7', date: '2026-02-20', changes: ['Valid'] },
              { id: '', version: '1.3.6', date: '2026-02-10', changes: ['Missing id'] },
              { id: 'r-no-ver', version: '', date: '2026-02-10', changes: ['Missing version'] },
              { id: 'r-no-date', version: '1.3.5', date: '', changes: ['Missing date'] },
              { version: '1.3.4', date: '2026-01-01', changes: ['No id at all'] }
            ]
          }),
          { status: 200 }
        )
      )
    );

    const data = await fetchChangelog();
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0]?.id).toBe('r-good');
  });

  it('filters out non-string change entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            entries: [
              { id: 'a', version: '1.3.5', date: '2026-01-01T00:00:00Z', changes: ['A'] },
              { id: 'b', version: '1.3.6', date: '2026-02-01T00:00:00Z', changes: ['B'] }
            ]
          }),
          { status: 200 }
        )
      )
    );

    const data = await fetchChangelog();

    expect(data.ok).toBe(true);
    expect(data.entries[0]?.version).toBe('1.3.6');
    expect(data.entries[1]?.version).toBe('1.3.5');
  });

  it('throws on non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 503 }))
    );

    await expect(fetchChangelog()).rejects.toThrow('Changelog request failed');
  });
});
