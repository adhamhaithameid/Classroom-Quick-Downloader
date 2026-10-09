// filepath: extension/tests/download-count-reporter.test.ts
/**
 * 1.9.0 confetti, commit 4 — the DORMANT download-count reporter. With
 * REMOTE_COUNTS_ENABLED false (shipped default) NO fetch is ever built;
 * flipping the module export in tests proves the payload shape and the
 * deterministic clientBatchId idempotency.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCountBatchId, reportDownloadCount } from '../entrypoints/utils/analytics/count-reporter';

const MOCKED_SWITCH = { enabled: false };

vi.mock('../entrypoints/utils/analytics/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../entrypoints/utils/analytics/constants')>();
  return {
    ...actual,
    get REMOTE_COUNTS_ENABLED() {
      return MOCKED_SWITCH.enabled;
    },
  };
});

async function importReporter() {
  return await import('../entrypoints/utils/analytics/count-reporter');
}

describe('download-count reporter (1.9.0 commit 4, dormant)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    MOCKED_SWITCH.enabled = false;
    fetchSpy = vi.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
  });

  afterEach(() => {
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('never builds a fetch while the switch is false (shipped default)', async () => {
    const { sendCountReport, reportDownloadCount: report } = await importReporter();
    const result = await sendCountReport({
      installId: 'install-1',
      lifetimeCount: 100,
      browser: 'chrome',
      clientBatchId: 'dlc-install-1-100',
    });
    expect(result).toEqual({ success: false, skipped: true });
    const wired = await report({ installId: 'install-1', lifetimeCount: 100 });
    expect(wired.skipped).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('with the switch flipped, sends the exact payload to TRACK_URL', async () => {
    MOCKED_SWITCH.enabled = true;
    const { reportDownloadCount: report } = await importReporter();
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await report({ installId: 'install-1', lifetimeCount: 100 });
    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/track');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.installId).toBe('install-1');
    expect(body.lifetimeCount).toBe(100);
    expect(typeof body.browser).toBe('string');
    expect(body.browser?.length).toBeGreaterThan(0);
    expect(body.clientBatchId).toBe(buildCountBatchId('install-1', 100));
  });

  it('clientBatchId is deterministic per pending report (idempotent replays)', () => {
    expect(buildCountBatchId('install-1', 100)).toBe('dlc-install-1-100');
    expect(buildCountBatchId('install-1', 100)).toBe(buildCountBatchId('install-1', 100));
    // A different count (drift beacon) is a different report.
    expect(buildCountBatchId('install-1', 200)).not.toBe(buildCountBatchId('install-1', 100));
  });

  it('maps worker failure modes without throwing', async () => {
    MOCKED_SWITCH.enabled = true;
    const { sendCountReport } = await importReporter();
    fetchSpy.mockResolvedValue(new Response('{"ok":false}', { status: 429 }));
    const limited = await sendCountReport({
      installId: 'i',
      lifetimeCount: 1,
      browser: 'chrome',
      clientBatchId: 'x',
    });
    expect(limited.success).toBe(false);
    fetchSpy.mockRejectedValue(new Error('offline'));
    const offline = await sendCountReport({
      installId: 'i',
      lifetimeCount: 1,
      browser: 'chrome',
      clientBatchId: 'x',
    });
    expect(offline.success).toBe(false);
    expect(offline.error).toContain('offline');
  });

  it('reportDownloadCount assembles the payload from stats alone (switch on)', async () => {
    MOCKED_SWITCH.enabled = true;
    const { reportDownloadCount: report } = await importReporter();
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 }),
    );
    const result = await report({ installId: 'abc', lifetimeCount: 500 });
    expect(result).toEqual({ success: true, duplicate: true });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.clientBatchId).toBe('dlc-abc-500');
  });
});
