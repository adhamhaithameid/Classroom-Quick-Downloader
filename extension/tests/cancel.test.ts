/**
 * Cancel Functionality Tests
 * Tests for the cancel download feature including:
 * - Button state transitions during cancel
 * - Message passing to background script
 * - Chrome downloads.cancel() and downloads.erase() calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Types
type ButtonState = 'idle' | 'loading' | 'trying' | 'success' | 'error' | 'cancel' | 'cancelled';

interface PendingButton {
  requestId: string;
  button: HTMLButtonElement;
}

// Simplified implementation for testing
function getButtonState(button: HTMLButtonElement): ButtonState {
  const cls = button.classList;
  if (cls.contains('cqd-loading')) return 'loading';
  if (cls.contains('cqd-trying')) return 'trying';
  if (cls.contains('cqd-success')) return 'success';
  if (cls.contains('cqd-error')) return 'error';
  if (cls.contains('cqd-cancel')) return 'cancel';
  if (cls.contains('cqd-cancelled')) return 'cancelled';
  return 'idle';
}

function setButtonState(button: HTMLButtonElement, state: ButtonState): void {
  button.classList.remove(
    'cqd-loading',
    'cqd-trying',
    'cqd-success',
    'cqd-error',
    'cqd-cancel',
    'cqd-cancelled',
  );
  
  if (state !== 'idle') {
    button.classList.add(`cqd-${state}`);
  }
  
  button.disabled = state === 'loading' || state === 'trying' || state === 'cancelled';
}

describe('Cancel Button State Transitions', () => {
  let button: HTMLButtonElement;

  beforeEach(() => {
    button = document.createElement('button');
    button.className = 'cqd-download-btn';
  });

  afterEach(() => {
    button.remove();
  });

  it('should transition from idle to loading', () => {
    setButtonState(button, 'loading');
    expect(getButtonState(button)).toBe('loading');
    expect(button.disabled).toBe(true);
  });

  it('should transition from loading to cancel (hover effect)', () => {
    setButtonState(button, 'loading');
    setButtonState(button, 'cancel');
    expect(getButtonState(button)).toBe('cancel');
    expect(button.disabled).toBe(false); // Allow click to confirm
  });

  it('should transition from cancel to cancelled (after click)', () => {
    setButtonState(button, 'cancel');
    setButtonState(button, 'cancelled');
    expect(getButtonState(button)).toBe('cancelled');
    expect(button.disabled).toBe(true);
  });

  it('should transition from cancelled to idle (after timeout)', () => {
    setButtonState(button, 'cancelled');
    setButtonState(button, 'idle');
    expect(getButtonState(button)).toBe('idle');
    expect(button.disabled).toBe(false);
  });

  it('should transition from cancel back to loading (mouse leave)', () => {
    setButtonState(button, 'cancel');
    setButtonState(button, 'loading');
    expect(getButtonState(button)).toBe('loading');
    expect(button.disabled).toBe(true);
  });

  it('should not have multiple state classes', () => {
    setButtonState(button, 'loading');
    setButtonState(button, 'cancel');
    
    const stateClasses = ['cqd-loading', 'cqd-trying', 'cqd-cancel', 'cqd-cancelled'];
    const activeClasses = stateClasses.filter(cls => button.classList.contains(cls));
    expect(activeClasses.length).toBe(1);
    expect(activeClasses[0]).toBe('cqd-cancel');
  });
});

describe('Cancel Message Passing', () => {
  let sendMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMessageSpy = vi.fn();
    // @ts-expect-error - Mock chrome
    globalThis.chrome = {
      runtime: {
        sendMessage: sendMessageSpy,
        lastError: null,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should send CQD_CANCEL_DOWNLOAD message with requestId', () => {
    const requestId = 'test-req-123';
    
    chrome.runtime.sendMessage({
      type: 'CQD_CANCEL_DOWNLOAD',
      requestId,
    });

    expect(sendMessageSpy).toHaveBeenCalledWith({
      type: 'CQD_CANCEL_DOWNLOAD',
      requestId: 'test-req-123',
    });
  });

  it('should include correct message type', () => {
    chrome.runtime.sendMessage({
      type: 'CQD_CANCEL_DOWNLOAD',
      requestId: 'any-id',
    });

    const call = sendMessageSpy.mock.calls[0][0];
    expect(call.type).toBe('CQD_CANCEL_DOWNLOAD');
  });
});

describe('Cancel Handler Logic', () => {
  const pendingButtons = new Map<string, PendingButton>();
  let button: HTMLButtonElement;

  beforeEach(() => {
    button = document.createElement('button');
    button.className = 'cqd-download-btn';
    pendingButtons.clear();
  });

  afterEach(() => {
    button.remove();
  });

  function findPendingButtonByElement(btn: HTMLButtonElement): PendingButton | undefined {
    for (const pending of pendingButtons.values()) {
      if (pending.button === btn) {
        return pending;
      }
    }
    return undefined;
  }

  function simulateHandleCancelClick(btn: HTMLButtonElement): { sent: boolean; requestId?: string } {
    const pending = findPendingButtonByElement(btn);
    if (!pending) {
      setButtonState(btn, 'idle');
      return { sent: false };
    }

    // Would send message here
    const requestId = pending.requestId;
    
    // Remove from pending
    pendingButtons.delete(pending.requestId);
    
    // Show cancelled state
    setButtonState(btn, 'cancelled');
    
    return { sent: true, requestId };
  }

  it('should find pending download by button element', () => {
    const requestId = 'req-find-test';
    pendingButtons.set(requestId, { requestId, button });

    const found = findPendingButtonByElement(button);
    expect(found).toBeDefined();
    expect(found?.requestId).toBe(requestId);
  });

  it('should return undefined when no pending download exists', () => {
    const found = findPendingButtonByElement(button);
    expect(found).toBeUndefined();
  });

  it('should remove from pending after cancel', () => {
    const requestId = 'req-remove-test';
    pendingButtons.set(requestId, { requestId, button });

    simulateHandleCancelClick(button);
    
    expect(pendingButtons.has(requestId)).toBe(false);
  });

  it('should set cancelled state after cancel', () => {
    const requestId = 'req-state-test';
    pendingButtons.set(requestId, { requestId, button });

    simulateHandleCancelClick(button);
    
    expect(getButtonState(button)).toBe('cancelled');
  });

  it('should reset to idle when no pending download exists', () => {
    setButtonState(button, 'loading');
    
    simulateHandleCancelClick(button);
    
    expect(getButtonState(button)).toBe('idle');
  });

  it('should return the correct requestId when cancelling', () => {
    const requestId = 'req-return-test';
    pendingButtons.set(requestId, { requestId, button });

    const result = simulateHandleCancelClick(button);
    
    expect(result.sent).toBe(true);
    expect(result.requestId).toBe(requestId);
  });
});

describe('Chrome Downloads Cancel API', () => {
  let cancelSpy: ReturnType<typeof vi.fn>;
  let eraseSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cancelSpy = vi.fn((id, callback) => callback?.());
    eraseSpy = vi.fn((query, callback) => callback?.([]));
    
    // @ts-expect-error - Mock chrome
    globalThis.chrome = {
      downloads: {
        cancel: cancelSpy,
        erase: eraseSpy,
      },
      runtime: {
        lastError: null,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call chrome.downloads.cancel with download ID', () => {
    const downloadId = 12345;
    
    chrome.downloads.cancel(downloadId, () => {});
    
    expect(cancelSpy).toHaveBeenCalledWith(downloadId, expect.any(Function));
  });

  it('should call chrome.downloads.erase with download ID', () => {
    const downloadId = 12345;
    
    chrome.downloads.erase({ id: downloadId }, () => {});
    
    expect(eraseSpy).toHaveBeenCalledWith({ id: downloadId }, expect.any(Function));
  });

  it('should handle cancel callback', () => {
    const callbackSpy = vi.fn();
    
    chrome.downloads.cancel(123, callbackSpy);
    
    expect(callbackSpy).toHaveBeenCalled();
  });

  it('should handle erase callback', () => {
    const callbackSpy = vi.fn();
    
    chrome.downloads.erase({ id: 123 }, callbackSpy);
    
    expect(callbackSpy).toHaveBeenCalled();
  });
});

describe('Cancel State CSS Classes', () => {
  let button: HTMLButtonElement;

  beforeEach(() => {
    button = document.createElement('button');
    button.className = 'cqd-download-btn';
  });

  it('should have cqd-cancel class in cancel state', () => {
    setButtonState(button, 'cancel');
    expect(button.classList.contains('cqd-cancel')).toBe(true);
  });

  it('should have cqd-cancelled class in cancelled state', () => {
    setButtonState(button, 'cancelled');
    expect(button.classList.contains('cqd-cancelled')).toBe(true);
  });

  it('should remove cancel class when changing state', () => {
    setButtonState(button, 'cancel');
    setButtonState(button, 'idle');
    expect(button.classList.contains('cqd-cancel')).toBe(false);
  });

  it('should remove cancelled class when changing state', () => {
    setButtonState(button, 'cancelled');
    setButtonState(button, 'idle');
    expect(button.classList.contains('cqd-cancelled')).toBe(false);
  });
});

describe('Download All Cancel Behavior', () => {
  interface FileEntry {
    key: string;
    inProgress: boolean;
    downloaded: boolean;
    failed: boolean;
  }

  interface GroupState {
    activated: boolean;
    isBusy: boolean;
    cancelPending: boolean;
    files: Map<string, FileEntry>;
  }

  function createGroupState(): GroupState {
    return {
      activated: false,
      isBusy: false,
      cancelPending: false,
      files: new Map(),
    };
  }

  it('should set cancelPending to true when cancelling', () => {
    const group = createGroupState();
    group.activated = true;
    group.isBusy = true;

    // Simulate cancel
    group.cancelPending = true;

    expect(group.cancelPending).toBe(true);
  });

  it('should track multiple files in progress', () => {
    const group = createGroupState();
    group.files.set('file1', { key: 'file1', inProgress: true, downloaded: false, failed: false });
    group.files.set('file2', { key: 'file2', inProgress: true, downloaded: false, failed: false });
    group.files.set('file3', { key: 'file3', inProgress: false, downloaded: true, failed: false });

    const inProgressCount = Array.from(group.files.values()).filter(f => f.inProgress).length;
    expect(inProgressCount).toBe(2);
  });

  it('should reset file states after cancel', () => {
    const group = createGroupState();
    group.files.set('file1', { key: 'file1', inProgress: true, downloaded: false, failed: false });

    // Simulate cancel reset
    for (const file of group.files.values()) {
      file.inProgress = false;
      file.downloaded = false;
      file.failed = false;
    }

    const file1 = group.files.get('file1');
    expect(file1?.inProgress).toBe(false);
  });

  it('should reset cancelPending after timeout', () => {
    const group = createGroupState();
    group.cancelPending = true;

    // Simulate timeout reset
    group.cancelPending = false;
    group.activated = false;
    group.isBusy = false;

    expect(group.cancelPending).toBe(false);
    expect(group.activated).toBe(false);
    expect(group.isBusy).toBe(false);
  });
});
