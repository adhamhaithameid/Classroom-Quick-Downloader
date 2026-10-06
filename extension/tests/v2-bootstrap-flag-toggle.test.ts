// filepath: extension/tests/v2-bootstrap-flag-toggle.test.ts
/**
 * v2_bootstrap 3e wiring: the popup's cqd-flag-toggle message must reach
 * applyFlagToggle for ALL THREE flag keys — commentsFlagEnabled,
 * editedFlagEnabled AND combinedFlagEnabled.
 *
 * Regression: combinedFlagEnabled was dropped on the floor here, so the
 * merged "Both" badge ignored its popup pill on the live-toggle path
 * (combined-flag gating fix round).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ToggleMessage = { type?: string; flag?: string; enabled?: boolean };

async function loadBootstrap(): Promise<{
  applyFlagToggle: ReturnType<typeof vi.fn>;
  messageListeners: Array<(message: ToggleMessage) => void>;
}> {
  vi.resetModules();

  const applyFlagToggle = vi.fn();
  vi.doMock('../src/v2/render/flag-renderer', () => ({ applyFlagToggle }));

  const registry = {
    register: vi.fn(),
    getSummary: vi.fn(() => 'summary'),
    getMode: vi.fn(() => 'legacy'),
  };
  class FakeEngine {}
  class FakeEngineV2 {
    getMutationTimings(): null {
      return null;
    }
    getSelectorStats(): Record<string, number> {
      return { total: 0, matched: 0, hashFallback: 0 };
    }
  }
  vi.doMock('../src/engines', () => ({
    EngineV1: FakeEngine,
    EngineV2: FakeEngineV2,
    EngineV3: FakeEngine,
    engineRegistry: registry,
  }));
  vi.doMock('../src/v2/orchestrator/mode-controller', () => ({
    initModeController: vi.fn(async () => {}),
  }));
  vi.doMock('../src/v2/orchestrator/orchestrator', () => ({
    orchestrator: { start: vi.fn(), getBus: vi.fn(() => ({})) },
  }));
  vi.doMock('../src/adapters/bridge/runtime-bridge', () => ({
    createPageRuntimeBridge: vi.fn(() => ({})),
  }));
  vi.doMock('../src/v2/orchestrator/bridge-relay', () => ({
    wireBridgeRelay: vi.fn(),
  }));
  vi.doMock('../src/v2/render/download-controller', () => ({
    wireDownloadPath: vi.fn(),
  }));
  vi.doMock('../src/v2/render/download-all-controller', () => ({
    installDownloadAllController: vi.fn(async () => {}),
    runDownloadAllForActiveMode: vi.fn(() => null),
  }));
  vi.doMock('../src/v2/render/classroom-download-controller', () => ({
    installClassroomDownloadController: vi.fn(async () => {}),
  }));
  vi.doMock('../entrypoints/content/reduce-motion', () => ({
    installReduceMotion: vi.fn(),
  }));
  vi.doMock('../src/v2/debug/debug-panel', () => ({
    initDebugPanel: vi.fn(async () => {}),
  }));

  const messageListeners: Array<(message: ToggleMessage) => void> = [];
  chrome.runtime.onMessage.addListener = vi.fn((cb: (message: ToggleMessage) => void) => {
    messageListeners.push(cb);
  }) as unknown as typeof chrome.runtime.onMessage.addListener;

  const mod = await import('../entrypoints/v2_bootstrap.content');
  await (mod.default as unknown as { main: () => Promise<void> }).main();
  return { applyFlagToggle, messageListeners };
}

function dispatch(listeners: Array<(message: ToggleMessage) => void>, message: ToggleMessage): void {
  for (const listener of listeners) listener(message);
}

describe('v2_bootstrap flag-toggle wiring', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('forwards combinedFlagEnabled toggles to applyFlagToggle', async () => {
    const { applyFlagToggle, messageListeners } = await loadBootstrap();

    dispatch(messageListeners, { type: 'cqd-flag-toggle', flag: 'combinedFlagEnabled', enabled: false });

    expect(applyFlagToggle).toHaveBeenCalledWith('combinedFlagEnabled', false);
  });

  it('still forwards commentsFlagEnabled and editedFlagEnabled', async () => {
    const { applyFlagToggle, messageListeners } = await loadBootstrap();

    dispatch(messageListeners, { type: 'cqd-flag-toggle', flag: 'commentsFlagEnabled', enabled: true });
    dispatch(messageListeners, { type: 'cqd-flag-toggle', flag: 'editedFlagEnabled', enabled: false });

    expect(applyFlagToggle).toHaveBeenCalledWith('commentsFlagEnabled', true);
    expect(applyFlagToggle).toHaveBeenCalledWith('editedFlagEnabled', false);
  });
});
