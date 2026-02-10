import { beforeEach, describe, expect, it, vi } from 'vitest';

type AlarmName = 'CQD_ANALYTICS_FLUSH' | 'CQD_ANALYTICS_CONFIG';

async function loadAlarmModule(isFirefox = false) {
  vi.resetModules();
  const flushSpy = vi.fn();
  const refreshSpy = vi.fn(async () => {});
  const recentDownloads = new Map<string, number>();

  vi.doMock('../entrypoints/utils/analytics', () => ({
    Analytics: { flush: flushSpy },
    refreshRemoteAnalyticsConfig: refreshSpy,
  }));
  vi.doMock('../entrypoints/background/state', () => ({
    IS_FIREFOX: isFirefox,
    recentDownloads,
  }));

  const mod = await import('../entrypoints/background/analytics-alarm');
  return { mod, flushSpy, refreshSpy, recentDownloads };
}

describe('background analytics alarm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (chrome as any).alarms = {
      create: vi.fn(),
      onAlarm: {
        addListener: vi.fn(),
      },
    };
    chrome.tabs = {
      remove: vi.fn(),
    } as never;
  });

  it('initializes analytics alarms once and dispatches alarm handlers', async () => {
    const { mod, flushSpy, refreshSpy } = await loadAlarmModule(false);
    const addListener = (chrome as any).alarms.onAlarm.addListener as ReturnType<typeof vi.fn>;
    mod.ensureAnalyticsAlarm();
    mod.ensureAnalyticsAlarm();

    expect((chrome as any).alarms.create).toHaveBeenCalledTimes(2);
    expect((chrome as any).alarms.create).toHaveBeenNthCalledWith(1, 'CQD_ANALYTICS_FLUSH', { periodInMinutes: 5 });
    expect((chrome as any).alarms.create).toHaveBeenNthCalledWith(2, 'CQD_ANALYTICS_CONFIG', { periodInMinutes: 180 });
    expect(addListener).toHaveBeenCalledTimes(1);

    const listener = addListener.mock.calls[0]?.[0] as (alarm: { name: AlarmName }) => void;
    listener({ name: 'CQD_ANALYTICS_FLUSH' });
    expect(flushSpy).toHaveBeenCalledTimes(1);
    listener({ name: 'CQD_ANALYTICS_CONFIG' });
    await Promise.resolve();
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('no-ops when alarms API is unavailable', async () => {
    const { mod } = await loadAlarmModule();
    (chrome as any).alarms = undefined;
    expect(() => mod.ensureAnalyticsAlarm()).not.toThrow();
  });

  it('closes recent file tabs only in firefox mode', async () => {
    const { mod, recentDownloads } = await loadAlarmModule(true);
    recentDownloads.set('done.pdf', Date.now() - 2000);

    mod.checkAndCloseFileTab(12, 'file:///tmp/done.pdf');
    expect(chrome.tabs.remove).toHaveBeenCalledWith(12);
    expect(recentDownloads.has('done.pdf')).toBe(false);
  });

  it('ignores non-file urls, old completions, and non-firefox mode', async () => {
    const firefox = await loadAlarmModule(true);
    firefox.recentDownloads.set('old.pdf', Date.now() - 20_000);
    firefox.mod.checkAndCloseFileTab(13, 'file:///tmp/old.pdf');
    firefox.mod.checkAndCloseFileTab(13, 'https://example.com');
    expect(chrome.tabs.remove).not.toHaveBeenCalled();

    const nonFirefox = await loadAlarmModule(false);
    nonFirefox.recentDownloads.set('new.pdf', Date.now());
    nonFirefox.mod.checkAndCloseFileTab(14, 'file:///tmp/new.pdf');
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });
});

