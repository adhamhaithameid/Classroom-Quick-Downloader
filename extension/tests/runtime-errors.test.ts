import { describe, expect, it, vi, beforeEach } from 'vitest';

// Minimal chrome stub: runtime-errors only touches chrome.storage.local and
// Analytics.track (mocked separately below). It must be in place before the
// module under test is imported.
const storageData = new Map<string, unknown>();
const storageStub = {
  local: {
    get: async (key: string) => ({ [key]: storageData.get(key) }),
    set: async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) storageData.set(k, v);
    },
  },
};
vi.stubGlobal('chrome', { storage: storageStub, runtime: {} });

const trackSpy = vi.fn();
vi.mock('../entrypoints/utils/analytics/index', () => ({
  Analytics: { track: (event: unknown) => trackSpy(event) },
}));

const {
  sanitizeErrorSignature,
  errorSignature,
  shouldReport,
  installRuntimeErrorReporting,
  RUNTIME_ERROR_FILE_TYPE,
} = await import('../entrypoints/utils/analytics/runtime-errors');

describe('runtime error telemetry', () => {
  beforeEach(() => {
    // setup.ts enables fake timers globally; this suite's fire-and-forget
    // reporting needs real microtasks/timers.
    vi.useRealTimers();
    storageData.clear();
    trackSpy.mockClear();
  });

  it('reduces arbitrary error text to schema-safe signatures', () => {
    expect(sanitizeErrorSignature('TypeError: cannot read property')).toBe('typeerror_cannot_read_property'.slice(0, 32));
    expect(sanitizeErrorSignature('  !!  ')).toBe('unknown_error');
    expect(sanitizeErrorSignature('X'.repeat(80))).toHaveLength(32);
    expect(sanitizeErrorSignature('Bad-Chars Here!')).toBe('bad-chars_here');
  });

  it('builds signatures from error names with optional context', () => {
    const error = new TypeError('boom');
    expect(errorSignature(error)).toBe('typeerror');
    expect(errorSignature(error, 'Download Handler')).toBe('typeerror_download_handler');
    expect(errorSignature('a string rejection')).toBe('unhandled_rejection');
    expect(errorSignature(undefined)).toBe('unknown_error');
  });

  it('enforces the hourly cap and resets on a new hour bucket', () => {
    const now = Date.parse('2026-09-21T15:30:00Z');
    const thisHour = { hour: '2026-09-21T15', count: 10 };
    const lastHour = { hour: '2026-09-21T14', count: 500 };
    expect(shouldReport(thisHour, now)).toBe(false);
    expect(shouldReport(lastHour, now)).toBe(true);
    expect(shouldReport({ hour: '2026-09-21T15', count: 3 }, now)).toBe(true);
  });

  it('installs listeners and reports through Analytics.track with rate limiting', async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    vi.stubGlobal('self', {
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        listeners.set(type, handler);
      },
    });

    installRuntimeErrorReporting();

    process.on('unhandledRejection', (e) => console.log('UNHANDLED-IN-TEST:', e));
    expect(listeners.get('error')).toBeDefined();
    expect(listeners.get('unhandledrejection')).toBeDefined();

    listeners.get('unhandledrejection')!({ reason: new RangeError('nope') });
    listeners.get('unhandledrejection')!({ reason: new RangeError('nope') });
    for (let i = 0; i < 50 && trackSpy.mock.calls.length < 2; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(trackSpy).toHaveBeenCalledTimes(2);

    // Fill the hour bucket; further reports are suppressed.
    storageData.set('cqd.analytics.runtimeErrorRate', { hour: new Date().toISOString().slice(0, 13), count: 10 });
    listeners.get('unhandledrejection')!({ reason: new RangeError('nope') });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(trackSpy).toHaveBeenCalledTimes(2);
  });
});
