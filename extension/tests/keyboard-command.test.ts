import { describe, expect, it, vi } from 'vitest';
import { loadFlowHarness } from './helpers/background-flow';

// ============================================================================
// KEYBOARD SHORTCUT ROUTING (bead 0h4d.1.9, plan
// docs/superpowers/plans/2026-09-28-keyboard-shortcut.md). The background
// routes Alt+Shift+D to the active tab's Download All flow when the tab is
// a Classroom page; non-Classroom tabs get a transient badge hint instead.
// The content-side listener (download_all.content.ts) answers
// CQD_RUN_DOWNLOAD_ALL and runs the same handler the button uses.
// ============================================================================

function installCommandStubs(tabUrl?: string) {
  const commandListeners: Array<(command: string) => void> = [];
  (chrome as any).commands = {
    onCommand: { addListener: (l: (command: string) => void) => commandListeners.push(l) },
  };
  const badgeCalls: Array<{ tabId: number; text: string }> = [];
  (chrome.action as any).setBadgeText = vi.fn((opts: { tabId: number; text: string }) => {
    badgeCalls.push(opts);
  });
  const sentMessages: Array<{ tabId: number; message: Record<string, unknown> }> = [];
  (chrome.tabs as any).query = vi.fn(
    (_q: unknown, cb: (tabs: Array<{ id?: number; url?: string }>) => void) => {
      cb(tabUrl ? [{ id: 42, url: tabUrl }] : []);
    },
  );
  (chrome.tabs as any).sendMessage = vi.fn(
    (tabId: number, msg: Record<string, unknown>, cb?: () => void) => {
      sentMessages.push({ tabId, message: msg });
      cb?.();
    },
  );
  return { commandListeners, badgeCalls, sentMessages };
}

describe('keyboard shortcut routing (0h4d.1.9)', () => {
  it('registers the download-all-classroom command listener at boot', async () => {
    const stubs = installCommandStubs();
    await loadFlowHarness({ downloadScript: ['id'] });
    expect(stubs.commandListeners.length).toBe(1);
  });

  it('a Classroom tab receives CQD_RUN_DOWNLOAD_ALL', async () => {
    const stubs = installCommandStubs('https://classroom.google.com/c/123/stream');
    await loadFlowHarness({ downloadScript: ['id'] });

    stubs.commandListeners[0]('download-all-classroom');

    expect(stubs.sentMessages).toEqual([
      { tabId: 42, message: { type: 'CQD_RUN_DOWNLOAD_ALL' } },
    ]);
    expect(stubs.badgeCalls).toHaveLength(0);
  });

  it('a non-Classroom tab gets a badge hint and no message', async () => {
    const stubs = installCommandStubs('https://example.com/page');
    await loadFlowHarness({ downloadScript: ['id'] });

    stubs.commandListeners[0]('download-all-classroom');

    expect(stubs.sentMessages).toHaveLength(0);
    expect(stubs.badgeCalls).toHaveLength(1);
    expect(stubs.badgeCalls[0].text).toBe('⤓');
  });

  it('other commands are ignored; no active tab is a silent no-op', async () => {
    const stubs = installCommandStubs('https://classroom.google.com/c/123/stream');
    await loadFlowHarness({ downloadScript: ['id'] });

    stubs.commandListeners[0]('some-other-command');
    expect(stubs.sentMessages).toHaveLength(0);

    const empty = installCommandStubs();
    await loadFlowHarness({ downloadScript: ['id'] });
    empty.commandListeners[0]('download-all-classroom');
    expect(empty.sentMessages).toHaveLength(0);
    expect(empty.badgeCalls).toHaveLength(0);
  });
});
