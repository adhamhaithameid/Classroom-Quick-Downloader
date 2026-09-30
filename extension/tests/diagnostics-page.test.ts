// filepath: extension/tests/diagnostics-page.test.ts
/**
 * 0h4d.1.7 task 3 — the diagnostics page. Renders the built report, and the
 * copy/download/regenerate actions work. Inputs arrive through the real
 * message surface (CQD_QUEUE_SNAPSHOT / CQD_HISTORY_GET) with chrome stubs.
 */
import { createElement } from 'react';
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagnosticsApp } from '../entrypoints/diagnostics/DiagnosticsApp';

describe('diagnostics page (0h4d.1.7)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let sendMessages: Array<Record<string, unknown>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    sendMessages = [];

    (chrome.runtime as any).sendMessage = vi.fn(
      (msg: Record<string, unknown>, cb: (res: unknown) => void) => {
        sendMessages.push(msg);
        if (msg.type === 'CQD_QUEUE_SNAPSHOT') {
          cb({
            ok: true,
            paused: false,
            rows: [{ queued: false }, { queued: false }, { queued: true }],
          });
        } else if (msg.type === 'CQD_HISTORY_GET') {
          cb({
            ok: true,
            rows: [
              { id: '1', ts: 1, status: 'success', filename: 'a.pdf', host: 'x', url: 'u' },
              { id: '2', ts: 2, status: 'failed', errorCode: 'SIZE_MISMATCH', filename: 'b.pdf', host: 'x', url: 'u' },
              { id: '3', ts: 3, status: 'failed', errorCode: 'SIZE_MISMATCH', filename: 'c.pdf', host: 'x', url: 'u' },
            ],
          });
        }
      },
    );
    (chrome.runtime as any).getManifest = vi.fn(() => ({ version: '1.8.7' }));
    (chrome as any).i18n = { getUILanguage: vi.fn(() => 'en') };
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: 'Mozilla/5.0 TestUA Chrome/137',
      configurable: true,
    });
    Object.defineProperty(globalThis.navigator, 'language', {
      value: 'en-US',
      configurable: true,
    });
    (globalThis as any).navigator.clipboard = { writeText: vi.fn(() => Promise.resolve()) };
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  function render() {
    flushSync(() => {
      root.render(createElement(DiagnosticsApp));
    });
  }

  async function settle() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
  }

  it('renders the built report with queue counts and the failure digest', async () => {
    render();
    await settle();
    const text = container.querySelector('[data-testid="diag-report"]')?.textContent ?? '';
    expect(text).toContain('cqd-diagnostics/1');
    expect(text).toContain('"active": 2');
    expect(text).toContain('"queued": 1');
    expect(text).toContain('SIZE_MISMATCH');
    expect(text).toContain('1.8.7');
    // Both surfaces were queried.
    expect(sendMessages.map((m) => m.type)).toEqual(['CQD_QUEUE_SNAPSHOT', 'CQD_HISTORY_GET']);
  });

  it('copy writes the report JSON to the clipboard', async () => {
    render();
    await settle();
    const copyBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Copy report'),
    ) as HTMLButtonElement;
    await act(async () => {
      copyBtn.click();
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const written = (navigator.clipboard.writeText as any).mock.calls[0][0] as string;
    expect(written).toContain('cqd-diagnostics/1');
  });

  it('regenerate re-queries the background', async () => {
    render();
    await settle();
    const before = sendMessages.length;
    const regenBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Regenerate'),
    ) as HTMLButtonElement;
    await act(async () => {
      regenBtn.click();
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(sendMessages.length).toBe(before * 2);
  });
});
