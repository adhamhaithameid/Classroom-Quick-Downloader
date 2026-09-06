// filepath: extension/tests/v2-mode-controller.test.ts
/**
 * ============================================================================
 * V2 MODE CONTROLLER — Full Test Suite
 * ============================================================================
 *
 * Tests for the mode controller — the bridge between chrome.storage
 * and the EngineRegistry.
 *
 * These tests exercise readMode, setMode, initModeController, and
 * the message/storage listeners.
 *
 * @author Adham — mocking chrome.storage properly took three tries
 * @since v4.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to re-import fresh modules for each test because mode-controller
// uses the singleton engineRegistry. vi.resetModules gives us clean state.

async function loadModeControllerModule() {
  vi.resetModules();

  // Create a fresh registry for isolated testing
  const registryModule = await import('../src/engines/engine-registry');
  const registry = registryModule.engineRegistry;

  const modeController = await import('../src/v2/orchestrator/mode-controller');
  return { modeController, registry };
}

describe('Mode Controller', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================================================
  // readMode
  // ========================================================================

  describe('readMode', () => {
    it('returns "legacy" as default mode', async () => {
      const { modeController } = await loadModeControllerModule();
      const mode = await modeController.readMode();
      expect(mode).toBe('legacy');
    });

    it('reads mode from chrome.storage.local', async () => {
      // Set up chrome.storage mock to return shadow
      chrome.storage.local.get = vi.fn().mockResolvedValue({
        cqdV2Mode: 'shadow',
      });

      const { modeController } = await loadModeControllerModule();
      const mode = await modeController.readMode();
      expect(mode).toBe('shadow');
    });

    it('returns "legacy" for invalid stored value', async () => {
      chrome.storage.local.get = vi.fn().mockResolvedValue({
        cqdV2Mode: 'invalid-mode',
      });

      const { modeController } = await loadModeControllerModule();
      const mode = await modeController.readMode();
      expect(mode).toBe('legacy');
    });

    it('returns "legacy" when storage read fails', async () => {
      chrome.storage.local.get = vi.fn().mockRejectedValue(new Error('quota exceeded'));

      const { modeController } = await loadModeControllerModule();
      const mode = await modeController.readMode();
      expect(mode).toBe('legacy');
    });

    it('reads v2 and v3 modes correctly', async () => {
      chrome.storage.local.get = vi.fn().mockResolvedValue({
        cqdV2Mode: 'v2',
      });

      const { modeController } = await loadModeControllerModule();
      expect(await modeController.readMode()).toBe('v2');

      chrome.storage.local.get = vi.fn().mockResolvedValue({
        cqdV2Mode: 'v3',
      });
      // Need fresh import to avoid caching
      vi.resetModules();
      const { modeController: mc2 } = await loadModeControllerModule();
      expect(await mc2.readMode()).toBe('v3');
    });
  });

  // ========================================================================
  // setMode
  // ========================================================================

  describe('setMode', () => {
    it('writes to chrome.storage and updates registry', async () => {
      const setSpy = vi.fn().mockResolvedValue(undefined);
      chrome.storage.local.set = setSpy;

      const { modeController, registry } = await loadModeControllerModule();
      await modeController.setMode('shadow');

      expect(setSpy).toHaveBeenCalledWith({ cqdV2Mode: 'shadow' });
      expect(registry.getMode()).toBe('shadow');
    });

    it('rejects invalid mode values', async () => {
      const setSpy = vi.fn();
      chrome.storage.local.set = setSpy;

      const { modeController } = await loadModeControllerModule();
      await modeController.setMode('not-a-mode' as any);

      // Should NOT have written to storage
      expect(setSpy).not.toHaveBeenCalled();
    });

    it('handles storage write failure gracefully', async () => {
      chrome.storage.local.set = vi.fn().mockRejectedValue(new Error('write failed'));

      const { modeController } = await loadModeControllerModule();
      // Should not throw
      await expect(modeController.setMode('v2')).resolves.not.toThrow();
    });

    it('sets all valid mode values', async () => {
      chrome.storage.local.set = vi.fn().mockResolvedValue(undefined);
      const { modeController, registry } = await loadModeControllerModule();

      for (const mode of ['legacy', 'shadow', 'v2', 'v3'] as const) {
        await modeController.setMode(mode);
        expect(registry.getMode()).toBe(mode);
      }
    });
  });

  // ========================================================================
  // initModeController
  // ========================================================================

  describe('initModeController', () => {
    it('reads mode from storage and sets it in registry', async () => {
      chrome.storage.local.get = vi.fn().mockResolvedValue({
        cqdV2Mode: 'v2',
      });

      const { modeController, registry } = await loadModeControllerModule();
      await modeController.initModeController();

      expect(registry.getMode()).toBe('v2');
    });

    it('sets up message listener for remote mode changes', async () => {
      chrome.storage.local.get = vi.fn().mockResolvedValue({});

      const addListenerSpy = vi.spyOn(chrome.runtime.onMessage, 'addListener');

      const { modeController } = await loadModeControllerModule();
      await modeController.initModeController();

      expect(addListenerSpy).toHaveBeenCalled();
    });

    it('sets up storage change listener', async () => {
      chrome.storage.local.get = vi.fn().mockResolvedValue({});

      const addListenerSpy = vi.spyOn(chrome.storage.onChanged, 'addListener');

      const { modeController } = await loadModeControllerModule();
      await modeController.initModeController();

      expect(addListenerSpy).toHaveBeenCalled();
    });

    it('defaults to legacy when storage is empty', async () => {
      chrome.storage.local.get = vi.fn().mockResolvedValue({});

      const { modeController, registry } = await loadModeControllerModule();
      await modeController.initModeController();

      expect(registry.getMode()).toBe('legacy');
    });
  });
});
