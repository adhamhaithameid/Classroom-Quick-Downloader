import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchChangelog } from './changelog';

describe('fetchChangelog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns sorted entries from worker payload', async () => {
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
