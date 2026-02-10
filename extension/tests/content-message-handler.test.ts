import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonState } from '../entrypoints/content/types';

type MockContext = {
  state: {
    desiredEnabled: boolean;
    effectiveEnabled: boolean;
    globalEnabled: boolean;
    pendingButtons: Map<string, { button: HTMLButtonElement; startedAt: number }>;
  };
  startSpy: ReturnType<typeof vi.fn>;
  stopSpy: ReturnType<typeof vi.fn>;
  setButtonStateSpy: ReturnType<typeof vi.fn>;
  setPillProgressSpy: ReturnType<typeof vi.fn>;
  showErrorSpy: ReturnType<typeof vi.fn>;
  waitForSuccessSpy: ReturnType<typeof vi.fn>;
  ensureMinLoadingSpy: ReturnType<typeof vi.fn>;
  subscribeSpy: ReturnType<typeof vi.fn>;
  getListener: () => ((message: any, sender: any, sendResponse: (payload: any) => void) => void | true) | null;
  mod: typeof import('../entrypoints/content/message-handler');
};

type RuntimeListener = (message: any, sender: any, sendResponse: (payload: any) => void) => void | true;

function makeButton() {
  const button = document.createElement('button');
  const icon = document.createElement('span');
  icon.className = 'cqd-download-icon';
  const label = document.createElement('span');
  label.className = 'cqd-label';
  const err = document.createElement('span');
  err.className = 'cqd-error-detail';
  button.append(icon, label, err);
  return button;
}

async function loadMessageHandler(isClassroom = true): Promise<MockContext> {
  vi.resetModules();
  const state = {
    desiredEnabled: true,
    effectiveEnabled: false,
    globalEnabled: true,
    pendingButtons: new Map<string, { button: HTMLButtonElement; startedAt: number }>(),
  };
  const startSpy = vi.fn();
  const stopSpy = vi.fn();
  const setButtonStateSpy = vi.fn();
  const setPillProgressSpy = vi.fn();
  const showErrorSpy = vi.fn(async () => {});
  const waitForSuccessSpy = vi.fn(async () => {});
  const ensureMinLoadingSpy = vi.fn(async () => {});
  const subscribeSpy = vi.fn();
  let listener: RuntimeListener | null = null;

  vi.doMock('../entrypoints/content/state', () => ({
    pendingButtons: state.pendingButtons,
    get desiredEnabled() {
      return state.desiredEnabled;
    },
    setDesiredEnabled(enabled: boolean) {
      state.desiredEnabled = enabled;
    },
    get effectiveEnabled() {
      return state.effectiveEnabled;
    },
    get globalEnabled() {
      return state.globalEnabled;
    },
    setGlobalEnabled(enabled: boolean) {
      state.globalEnabled = enabled;
    },
  }));
  vi.doMock('../entrypoints/content/button-state', () => ({
    getButtonState: vi.fn(() => 'idle' as ButtonState),
    setButtonState: setButtonStateSpy,
    setPillProgress: setPillProgressSpy,
  }));
  vi.doMock('../entrypoints/content/download-handler', () => ({
    ensureMinLoading: ensureMinLoadingSpy,
    waitForSuccessReset: waitForSuccessSpy,
    showErrorState: showErrorSpy,
  }));
  vi.doMock('../entrypoints/content/observers', () => ({
    startCQD: startSpy,
    stopCQD: stopSpy,
    isGoogleClassroom: vi.fn(() => isClassroom),
  }));
  vi.doMock('../entrypoints/content/flags', () => ({
    subscribeToGlobalState: subscribeSpy,
  }));

  const runtime = chrome.runtime as unknown as { onMessage: { addListener: (cb: RuntimeListener) => void; removeListener: () => void }; sendMessage: (...args: unknown[]) => void };
  runtime.onMessage = {
    addListener: vi.fn((cb: any) => {
      listener = cb;
    }),
    removeListener: vi.fn(),
  };
  runtime.sendMessage = vi.fn();

  const mod = await import('../entrypoints/content/message-handler');
  return {
    state,
    startSpy,
    stopSpy,
    setButtonStateSpy,
    setPillProgressSpy,
    showErrorSpy,
    waitForSuccessSpy,
    ensureMinLoadingSpy,
    subscribeSpy,
    getListener: () => listener,
    mod,
  };
}

describe('content message handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('recomputes effective state based on global and desired flags', async () => {
    const ctx = await loadMessageHandler(true);
    ctx.mod.recomputeEffectiveStateFromFlags();
    expect(ctx.startSpy).toHaveBeenCalledTimes(1);

    ctx.state.desiredEnabled = false;
    ctx.mod.recomputeEffectiveStateFromFlags();
    expect(ctx.stopSpy).toHaveBeenCalledTimes(1);
  });

  it('handles popup query and desired-state update messages', async () => {
    const ctx = await loadMessageHandler(true);
    ctx.mod.setupMessageListeners();
    const listener = ctx.getListener();
    expect(listener).toBeTruthy();
    const sendResponse = vi.fn();
    listener?.({ type: 'CQD_POPUP_QUERY_STATE' }, {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ desiredEnabled: true, effectiveEnabled: false });

    listener?.({ type: 'CQD_POPUP_SET_DESIRED_STATE', enabled: false }, {}, sendResponse);
    expect(ctx.state.desiredEnabled).toBe(false);
    expect(ctx.stopSpy).toHaveBeenCalled();
  });

  it('handles download status transitions for trying/success/error paths', async () => {
    const ctx = await loadMessageHandler(true);
    ctx.mod.setupMessageListeners();
    const listener = ctx.getListener();
    const button = makeButton();
    ctx.state.pendingButtons.set('req-1', { button, startedAt: Date.now() - 1000 });

    listener?.({ type: 'CQD_DOWNLOAD_STATUS', requestId: 'req-1', status: 'trying', userMessage: 'retrying' }, {}, vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.ensureMinLoadingSpy).toHaveBeenCalled();
    expect(ctx.setButtonStateSpy).toHaveBeenCalledWith(button, 'trying', { userMessage: 'retrying' });

    listener?.({ type: 'CQD_DOWNLOAD_STATUS', requestId: 'req-1', status: 'complete' }, {}, vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.state.pendingButtons.has('req-1')).toBe(false);
    expect(ctx.setPillProgressSpy).toHaveBeenCalledWith(button, 1);
    expect(ctx.setButtonStateSpy).toHaveBeenCalledWith(button, 'success');
    expect(ctx.waitForSuccessSpy).toHaveBeenCalled();

    ctx.state.pendingButtons.set('req-2', { button, startedAt: Date.now() - 1000 });
    listener?.({ type: 'CQD_DOWNLOAD_STATUS', requestId: 'req-2', status: 'error', errorCode: 'AUTH_CHECK', userMessage: 'auth' }, {}, vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.showErrorSpy).toHaveBeenCalledWith(button, 'auth');

    ctx.state.pendingButtons.set('req-3', { button, startedAt: Date.now() - 1000 });
    listener?.({ type: 'CQD_DOWNLOAD_STATUS', requestId: 'req-3', status: 'interrupted', userMessage: 'failed' }, {}, vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.state.pendingButtons.has('req-3')).toBe(false);
    expect(ctx.setPillProgressSpy).toHaveBeenCalledWith(button, 0);
  });

  it('ignores interrupted/error overwrite when button is already cancelled', async () => {
    const ctx = await loadMessageHandler(true);
    ctx.mod.setupMessageListeners();
    const listener = ctx.getListener();
    const button = makeButton();
    button.classList.add('cqd-cancelled');
    ctx.state.pendingButtons.set('req-cancelled', { button, startedAt: Date.now() - 1000 });

    listener?.({ type: 'CQD_DOWNLOAD_STATUS', requestId: 'req-cancelled', status: 'interrupted' }, {}, vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.state.pendingButtons.has('req-cancelled')).toBe(false);
    expect(ctx.showErrorSpy).not.toHaveBeenCalled();
  });

  it('initContentScript wires icon update, subscription, and listener setup only on classroom pages', async () => {
    const classroom = await loadMessageHandler(true);
    classroom.mod.initContentScript();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'CQD_UPDATE_ICON' });
    expect(classroom.subscribeSpy).toHaveBeenCalled();
    expect((chrome.runtime.onMessage.addListener as any).mock.calls.length).toBeGreaterThan(0);

    const onEnable = classroom.subscribeSpy.mock.calls[0]?.[0] as () => void;
    const onDisable = classroom.subscribeSpy.mock.calls[0]?.[1] as () => void;
    onEnable();
    expect(classroom.startSpy).toHaveBeenCalled();
    onDisable();
    expect(classroom.stopSpy).toHaveBeenCalled();

    const nonClassroom = await loadMessageHandler(false);
    nonClassroom.mod.initContentScript();
    expect(nonClassroom.subscribeSpy).not.toHaveBeenCalled();
  });
});
