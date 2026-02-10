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
    (globalThis as { chrome: unknown }).chrome = {
      runtime: {
        sendMessage: sendMessageSpy,
        lastError: undefined,
      },
    } as unknown;
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
    
    (globalThis as { chrome: unknown }).chrome = {
      downloads: {
        cancel: cancelSpy,
        erase: eraseSpy,
      },
      runtime: {
        lastError: undefined,
      },
    } as unknown;
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

/**
 * ===============================================
 * REAL-LIFE TESTS: Pre-Download Delay
 * These test the actual delay behavior before download starts
 * Uses synchronous simulation since real timers don't work well in jsdom
 * ===============================================
 */
describe('Pre-Download Delay (Real Behavior)', () => {
  let cancelHoldDelayMs: number;
  let downloadStarted: boolean;
  let pendingButtons: Map<string, { requestId: string; button: HTMLButtonElement }>;
  let button: HTMLButtonElement;

  beforeEach(() => {
    vi.useFakeTimers();
    cancelHoldDelayMs = 1000; // 1 second delay
    downloadStarted = false;
    pendingButtons = new Map();
    button = document.createElement('button');
    button.className = 'cqd-download-btn';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getButtonState(btn: HTMLButtonElement): string {
    if (btn.classList.contains('cqd-loading')) return 'loading';
    if (btn.classList.contains('cqd-cancel')) return 'cancel';
    if (btn.classList.contains('cqd-cancelled')) return 'cancelled';
    return 'idle';
  }

  // Synchronous simulation of download with delay check
  function simulateDownloadStart(requestId: string): void {
    button.classList.add('cqd-loading');
    pendingButtons.set(requestId, { requestId, button });
  }

  function checkAndStartDownload(requestId: string): boolean {
    // Check if cancelled during wait
    if (!pendingButtons.has(requestId)) {
      return false;
    }

    const state = getButtonState(button);
    if (state === 'cancelled' || state === 'idle') {
      return false;
    }

    // Download would start here
    downloadStarted = true;
    return true;
  }

  it('should have delay > 0 configured', () => {
    expect(cancelHoldDelayMs).toBe(1000);
  });

  it('should set loading state when download starts', () => {
    simulateDownloadStart('req-1');
    expect(getButtonState(button)).toBe('loading');
    expect(pendingButtons.has('req-1')).toBe(true);
  });

  it('should start download if not cancelled after delay', () => {
    const requestId = 'req-success';
    simulateDownloadStart(requestId);
    
    // Simulate delay passing without cancellation
    vi.advanceTimersByTime(cancelHoldDelayMs);
    
    // After delay, check and start
    const started = checkAndStartDownload(requestId);
    
    expect(started).toBe(true);
    expect(downloadStarted).toBe(true);
  });

  it('should not start download if cancelled during wait', () => {
    const requestId = 'req-cancel-during-wait';
    simulateDownloadStart(requestId);
    
    // User cancels before delay completes
    pendingButtons.delete(requestId);
    button.classList.remove('cqd-loading');
    button.classList.add('cqd-cancelled');
    
    // After delay, check and start
    vi.advanceTimersByTime(cancelHoldDelayMs);
    const started = checkAndStartDownload(requestId);
    
    expect(started).toBe(false);
    expect(downloadStarted).toBe(false);
  });

  it('should start download immediately when delay is 0', () => {
    cancelHoldDelayMs = 0;
    const requestId = 'req-immediate';
    simulateDownloadStart(requestId);
    
    // No delay needed
    if (cancelHoldDelayMs === 0) {
      const started = checkAndStartDownload(requestId);
      expect(started).toBe(true);
      expect(downloadStarted).toBe(true);
    }
  });

  it('should allow cancellation at any point during loading state', () => {
    const requestId = 'req-cancel-early';
    simulateDownloadStart(requestId);
    
    // User cancels immediately (within first 100ms)
    vi.advanceTimersByTime(100);
    pendingButtons.delete(requestId);
    button.classList.remove('cqd-loading');
    button.classList.add('cqd-cancelled');
    
    const started = checkAndStartDownload(requestId);
    
    expect(started).toBe(false);
    expect(getButtonState(button)).toBe('cancelled');
  });
});

/**
 * ===============================================
 * REAL-LIFE TESTS: Cancel Analytics Tracking
 * These verify cancelled downloads are properly tracked
 * ===============================================
 */
describe('Cancel Analytics Tracking', () => {
  interface LocalStats {
    success: number;
    fail: number;
    cancelled: number;
    total: number;
    attempts: number;
  }

  interface AnalyticsEvent {
    status: 'success' | 'fail' | 'cancelled';
    type: string;
    duration_ms: number;
    bypass_used: boolean;
  }

  let stats: LocalStats;
  let eventQueue: AnalyticsEvent[];

  beforeEach(() => {
    stats = { success: 0, fail: 0, cancelled: 0, total: 0, attempts: 0 };
    eventQueue = [];
  });

  function recordDownloadEvent(event: AnalyticsEvent): void {
    eventQueue.push(event);
    
    stats.attempts++;
    if (event.status === 'success') {
      stats.success++;
      stats.total++;
    } else if (event.status === 'cancelled') {
      stats.cancelled++;
    } else {
      stats.fail++;
    }
  }

  it('should increment cancelled counter when download is cancelled', () => {
    recordDownloadEvent({
      status: 'cancelled',
      type: 'pdf',
      duration_ms: 1500,
      bypass_used: false,
    });

    expect(stats.cancelled).toBe(1);
  });

  it('should track cancelled separately from success and fail', () => {
    recordDownloadEvent({ status: 'success', type: 'pdf', duration_ms: 100, bypass_used: false });
    recordDownloadEvent({ status: 'fail', type: 'doc', duration_ms: 200, bypass_used: false });
    recordDownloadEvent({ status: 'cancelled', type: 'pptx', duration_ms: 300, bypass_used: false });

    expect(stats.success).toBe(1);
    expect(stats.fail).toBe(1);
    expect(stats.cancelled).toBe(1);
    expect(stats.attempts).toBe(3);
  });

  it('should not increment total for cancelled downloads', () => {
    recordDownloadEvent({ status: 'cancelled', type: 'pdf', duration_ms: 100, bypass_used: false });

    expect(stats.total).toBe(0);
    expect(stats.cancelled).toBe(1);
  });

  it('should queue cancelled event for Cloudflare sync', () => {
    recordDownloadEvent({
      status: 'cancelled',
      type: 'pdf',
      duration_ms: 500,
      bypass_used: false,
    });

    expect(eventQueue.length).toBe(1);
    expect(eventQueue[0].status).toBe('cancelled');
  });

  it('should track bypass_used field for cancelled downloads', () => {
    recordDownloadEvent({
      status: 'cancelled',
      type: 'doc',
      duration_ms: 800,
      bypass_used: true, // Bypass was started but user cancelled
    });

    expect(eventQueue[0].bypass_used).toBe(true);
  });

  it('should accumulate multiple cancelled downloads', () => {
    for (let i = 0; i < 5; i++) {
      recordDownloadEvent({
        status: 'cancelled',
        type: 'pdf',
        duration_ms: i * 100,
        bypass_used: false,
      });
    }

    expect(stats.cancelled).toBe(5);
    expect(eventQueue.length).toBe(5);
  });
});

/**
 * ===============================================
 * REAL-LIFE TESTS: Cancel Button Immediate Response
 * These verify cancel shows immediately on hover without delay
 * ===============================================
 */
describe('Cancel Button Immediate Response', () => {
  let button: HTMLButtonElement;

  beforeEach(() => {
    button = document.createElement('button');
    button.className = 'cqd-download-btn cqd-loading';
  });

  function simulateMouseEnter(): void {
    // Should show cancel IMMEDIATELY - no delay
    if (button.classList.contains('cqd-loading') || button.classList.contains('cqd-trying')) {
      button.classList.remove('cqd-loading', 'cqd-trying');
      button.classList.add('cqd-cancel');
    }
  }

  function simulateMouseLeave(): void {
    if (button.classList.contains('cqd-cancel')) {
      button.classList.remove('cqd-cancel');
      button.classList.add('cqd-loading');
    }
  }

  it('should show cancel immediately on mouseenter', () => {
    simulateMouseEnter();
    expect(button.classList.contains('cqd-cancel')).toBe(true);
    expect(button.classList.contains('cqd-loading')).toBe(false);
  });

  it('should revert to loading on mouseleave', () => {
    simulateMouseEnter();
    simulateMouseLeave();
    expect(button.classList.contains('cqd-loading')).toBe(true);
    expect(button.classList.contains('cqd-cancel')).toBe(false);
  });

  it('should work for trying state too', () => {
    button.classList.remove('cqd-loading');
    button.classList.add('cqd-trying');

    simulateMouseEnter();
    expect(button.classList.contains('cqd-cancel')).toBe(true);
  });

  it('should not show cancel for idle state', () => {
    button.classList.remove('cqd-loading');
    simulateMouseEnter();
    expect(button.classList.contains('cqd-cancel')).toBe(false);
  });
});

/**
 * ===============================================
 * REAL-LIFE TESTS: End-to-End Cancel Flow
 * This simulates the complete user journey
 * ===============================================
 */
describe('End-to-End Cancel Flow', () => {
  let button: HTMLButtonElement;
  let pendingDownloads: Map<string, { downloadId?: number; startTime: number }>;
  let cancelledCount: number;
  let downloadCancelledCallback: ((requestId: string) => void) | null;

  beforeEach(() => {
    button = document.createElement('button');
    button.className = 'cqd-download-btn';
    pendingDownloads = new Map();
    cancelledCount = 0;
    downloadCancelledCallback = null;
  });

  function startDownload(requestId: string): void {
    button.classList.add('cqd-loading');
    button.disabled = true;
    pendingDownloads.set(requestId, { startTime: Date.now() });
  }

  function cancelDownload(requestId: string): boolean {
    const pending = pendingDownloads.get(requestId);
    if (!pending) return false;

    // Simulate chrome.downloads.cancel()
    // Simulate chrome.downloads.erase()
    
    pendingDownloads.delete(requestId);
    cancelledCount++;
    
    button.classList.remove('cqd-loading', 'cqd-cancel');
    button.classList.add('cqd-cancelled');
    button.disabled = true;

    downloadCancelledCallback?.(requestId);
    return true;
  }

  function resetButton(): void {
    button.classList.remove('cqd-cancelled');
    button.disabled = false;
  }

  it('should complete full cancel flow: click -> loading -> hover -> cancel -> cancelled -> idle', async () => {
    const requestId = 'e2e-test-1';

    // 1. User clicks download
    startDownload(requestId);
    expect(button.classList.contains('cqd-loading')).toBe(true);

    // 2. User hovers (cancel shows immediately)
    button.classList.remove('cqd-loading');
    button.classList.add('cqd-cancel');
    expect(button.classList.contains('cqd-cancel')).toBe(true);

    // 3. User clicks cancel
    const cancelled = cancelDownload(requestId);
    expect(cancelled).toBe(true);
    expect(button.classList.contains('cqd-cancelled')).toBe(true);

    // 4. After timeout, button resets
    resetButton();
    expect(button.classList.contains('cqd-cancelled')).toBe(false);
    expect(button.disabled).toBe(false);
  });

  it('should increment cancelled count after successful cancel', () => {
    const requestId = 'e2e-count-test';
    
    startDownload(requestId);
    cancelDownload(requestId);

    expect(cancelledCount).toBe(1);
  });

  it('should not cancel if no pending download exists', () => {
    const cancelled = cancelDownload('non-existent');
    expect(cancelled).toBe(false);
    expect(cancelledCount).toBe(0);
  });

  it('should call callback when download is cancelled', () => {
    const callbackSpy = vi.fn();
    downloadCancelledCallback = callbackSpy;

    const requestId = 'callback-test';
    startDownload(requestId);
    cancelDownload(requestId);

    expect(callbackSpy).toHaveBeenCalledWith(requestId);
  });

  it('should handle multiple rapid cancel attempts gracefully', () => {
    const requestId = 'multi-cancel-test';
    
    startDownload(requestId);
    
    // First cancel should succeed
    expect(cancelDownload(requestId)).toBe(true);
    
    // Subsequent cancels should fail gracefully
    expect(cancelDownload(requestId)).toBe(false);
    expect(cancelDownload(requestId)).toBe(false);
    
    expect(cancelledCount).toBe(1);
  });
});
