import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as iconManager from '../entrypoints/background/icon-manager';
import {
  UPDATE_CHECK_ALARM,
  createUpdateDotController,
  ensureUpdateCheckAlarm,
} from '../entrypoints/background/update-dot';
import { CHANGELOG_SEEN_KEY, UPDATE_STATE_KEY } from '../entrypoints/utils/update-state';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeChrome() {
  const store: Record<string, unknown> = {};
  const setIcon = vi.fn();
  (chrome as any).runtime = { getManifest: () => ({ version: '1.9.3' }), id: 'test' };
  (chrome as any).storage = {
    local: {
      get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
      set: vi.fn(async (patch: Record<string, unknown>) => {
        Object.assign(store, patch);
      }),
    },
    onChanged: { addListener: vi.fn() },
  };
  (chrome as any).tabs = { query: vi.fn((_q: unknown, cb: (t: unknown[]) => void) => cb([])) };
  (chrome as any).action = { setIcon };
  (chrome as any).alarms = { create: vi.fn() };
  return { store, setIcon, alarmCreate: (chrome as any).alarms.create };
}

function changelogResponse(latest: string) {
  return new Response(
    JSON.stringify({ ok: true, entries: [{ version: latest }, { version: '1.0.1' }] }),
    { status: 200 },
  );
}

describe('background update dot (08fg.3)', () => {
  let env: ReturnType<typeof makeChrome>;
  let decorate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    env = makeChrome();
    decorate = vi.spyOn(iconManager, 'setIconDecorationPaths');
    iconManager.setIconDecorationPaths(null);
  });

  it('fetches the live changelog and decorates the icon for a newer unseen version', async () => {
    const fetchImpl = vi.fn(async () => changelogResponse('1.9.4'));
    const c = createUpdateDotController({ fetchImpl, now: () => 1_000 * DAY_MS });
    await c.checkNow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(env.store[UPDATE_STATE_KEY]).toMatchObject({ latestVersion: '1.9.4' });
    expect(decorate).toHaveBeenLastCalledWith({
      color: expect.objectContaining({ 16: 'icon/dot/16.png', 128: 'icon/dot/128.png' }),
      gray: expect.objectContaining({ 16: 'icon/dot-gray/16.png' }),
    });
  });

  it('skips the decoration when the installed version is not older', async () => {
    const c = createUpdateDotController({
      fetchImpl: vi.fn(async () => changelogResponse('1.9.3')),
      now: () => 1_000 * DAY_MS,
    });
    await c.checkNow();
    expect(decorate).toHaveBeenLastCalledWith(null);
  });

  it('dismisses the dot when the seen map covers the latest version', async () => {
    const c = createUpdateDotController({
      fetchImpl: vi.fn(async () => changelogResponse('1.9.4')),
      now: () => 1_000 * DAY_MS,
    });
    await c.checkNow();
    expect(decorate).toHaveBeenLastCalledWith(expect.objectContaining({ color: expect.anything() }));

    env.store[CHANGELOG_SEEN_KEY] = { '1.9.4': 'tok' };
    await c.onStorageChanged(CHANGELOG_SEEN_KEY);
    expect(decorate).toHaveBeenLastCalledWith(null);
  });

  it('is staleness-gated: a second check within 12h does not fetch', async () => {
    const fetchImpl = vi.fn(async () => changelogResponse('1.9.4'));
    let t = 1_000 * DAY_MS;
    const c = createUpdateDotController({ fetchImpl, now: () => t });
    await c.checkNow();
    t += DAY_MS / 4; // 6h < the 12h gate
    await c.checkNow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t += DAY_MS;
    await c.checkNow();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('force bypasses the staleness gate', async () => {
    const fetchImpl = vi.fn(async () => changelogResponse('1.9.4'));
    let t = 1_000 * DAY_MS;
    const c = createUpdateDotController({ fetchImpl, now: () => t });
    await c.checkNow();
    await c.checkNow(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps the previous state when the fetch fails', async () => {
    let t = 1_000 * DAY_MS;
    const c = createUpdateDotController({
      fetchImpl: vi.fn(async () => changelogResponse('1.9.4')),
      now: () => t,
    });
    await c.checkNow();
    const fail = createUpdateDotController({
      fetchImpl: vi.fn(async () => new Response('{}', { status: 500 })),
      now: () => t + DAY_MS,
    });
    await fail.checkNow();
    expect(env.store[UPDATE_STATE_KEY]).toMatchObject({ latestVersion: '1.9.4' });
  });

  it('routes the update-check alarm to checkNow', async () => {
    const fetchImpl = vi.fn(async () => changelogResponse('1.9.4'));
    const c = createUpdateDotController({ fetchImpl, now: () => 1_000 * DAY_MS });
    c.onAlarm(UPDATE_CHECK_ALARM);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    c.onAlarm('unrelated-alarm');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('ensureUpdateCheckAlarm registers a 12h repeating alarm', () => {
    ensureUpdateCheckAlarm();
    expect(env.alarmCreate).toHaveBeenCalledWith(UPDATE_CHECK_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: 720,
    });
  });

  it('repaints known tabs with the dot variant per classroom state', async () => {
    (chrome.tabs.query as any).mockImplementation((_q: unknown, cb: (t: unknown[]) => void) =>
      cb([
        { id: 7, url: 'https://classroom.google.com/h' },
        { id: 8, url: 'https://example.com' },
      ]),
    );
    const c = createUpdateDotController({
      fetchImpl: vi.fn(async () => changelogResponse('1.9.4')),
      now: () => 1_000 * DAY_MS,
    });
    await c.checkNow();
    expect(env.setIcon).toHaveBeenCalledWith({
      tabId: 7,
      path: expect.objectContaining({ 16: 'icon/dot/16.png' }),
    });
    expect(env.setIcon).toHaveBeenCalledWith({
      tabId: 8,
      path: expect.objectContaining({ 16: 'icon/dot-gray/16.png' }),
    });
  });
});
