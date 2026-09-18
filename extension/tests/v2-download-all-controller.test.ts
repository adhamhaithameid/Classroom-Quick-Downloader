// filepath: extension/tests/v2-download-all-controller.test.ts
/**
 * z57 STAGE 3 — the v2 Download All group state machine.
 *
 * Pins the qa-02 UX contract on the v2 pipeline: staggered per-file requests
 * through the single publish path, progress sub-text, cqd-all-success with
 * auto-reset, cqd-all-error when ALL files fail (partial = success by
 * design), click-during-busy cancel via the existing CQD_CANCEL_DOWNLOAD
 * message, and the idle "N files" restore after reset.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createEventBus } from '../src/bus/event-bus';
import type { PageTopicMap } from '../src/contracts/topics';
import { EngineV2 } from '../src/engines/v2/engine-v2';
import type { ViewKind } from '../src/engines/types';
import {
  wireDownloadPath,
  resetDownloadController,
  type DownloadRuntime,
} from '../src/v2/render/download-controller';
import {
  installDownloadAllController,
  uninstallDownloadAllController,
  resetDownloadAllController,
  handleDownloadAllClickV2,
  getRunFor,
  PER_FILE_STAGGER_MS,
  GROUP_FEEDBACK_MS,
  GROUP_CANCELLED_RESET_MS,
} from '../src/v2/render/download-all-controller';
import { getButtonStateV2 } from '../src/v2/render/button-state';

const sendMessage = vi.fn();
const runtime: DownloadRuntime & { sendMessage: ReturnType<typeof vi.fn> } = { sendMessage };

interface Fixture {
  group: HTMLButtonElement;
  files: HTMLButtonElement[];
}

function makePost(fileCount: number, postId = 'post-1'): Fixture {
  const post = document.createElement('article');
  post.setAttribute('data-stream-item-id', postId);
  document.body.appendChild(post);

  const files: HTMLButtonElement[] = [];
  for (let i = 0; i < fileCount; i++) {
    const btn = document.createElement('button');
    btn.className = 'cqd-download-btn';
    btn.setAttribute('data-cqd-file-id', `drive-file-${i}`);
    btn.setAttribute('data-cqd-injected', 'true');
    btn.innerHTML =
      '<span class="cqd-download-icon"></span><span class="cqd-label">Download</span><span class="cqd-error-detail"></span>';
    btn.dataset.cqdUrl = `https://drive.usercontent.google.com/download?id=file-${i}&export=download&confirm=t`;
    btn.dataset.cqdName = `f${i}.pdf`;
    btn.dataset.cqdExt = 'pdf';
    post.appendChild(btn);
    files.push(btn);
  }

  const group = document.createElement('button');
  group.className = 'cqd-download-all-btn';
  group.setAttribute('data-cqd-file-id', `download-all:${postId}`);
  group.setAttribute('data-cqd-injected', 'true');
  group.innerHTML =
    '<span class="cqd-icon-wrapper cqd-download-all-icon-wrapper"><span class="cqd-download-all-icon"></span></span>' +
    '<span class="cqd-download-all-main">Download all</span><span class="cqd-download-all-sub"></span>';
  group.dataset.cqdGroupCount = String(fileCount);
  post.appendChild(group);

  return { group, files };
}

/** The staggered run must have started every file. */
function runStarted(count: number): boolean {
  const requested = requestedPayloads();
  return requested.length === count;
}

const requested: Array<PageTopicMap['download:requested']> = [];
function requestedPayloads(): typeof requested {
  return requested;
}

describe('v2 Download All group machine (z57 S3)', () => {
  let bus: ReturnType<typeof createEventBus<PageTopicMap>>;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    requested.length = 0;
    sendMessage.mockClear();
    resetDownloadController();
    resetDownloadAllController();
    uninstallDownloadAllController();
    bus = createEventBus<PageTopicMap>();
    wireDownloadPath(bus, runtime);
    installDownloadAllController(runtime);
    bus.subscribe('download:requested', (p) => requested.push(p));
  });

  afterEach(() => {
    uninstallDownloadAllController();
    resetDownloadController();
    vi.useRealTimers();
  });

  it('starts a staggered run: one download:requested per file, 1 s apart', () => {
    const { group } = makePost(3);
    handleDownloadAllClickV2('post-1', group);

    expect(requested).toHaveLength(1); // first file enters on the click
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS);
    expect(requested).toHaveLength(2);
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS);
    expect(runStarted(3)).toBe(true);
    expect(getRunFor('post-1')).toBeDefined();
  });

  it('shows progress sub-text during the run and success with auto-reset', () => {
    const { group, files } = makePost(2);
    handleDownloadAllClickV2('post-1', group);
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS * 3);
    expect(requested).toHaveLength(2);
    expect(group.querySelector('.cqd-download-all-sub')?.textContent).toBe('0 → 2');
    expect(group.className).not.toContain('cqd-all-');

    // Both settle saved.
    for (const p of requestedPayloads()) {
      bus.publish('download:settled', { requestId: p.requestId, outcome: { status: 'saved' } });
    }
    expect(group.classList.contains('cqd-all-success')).toBe(true);
    expect(group.querySelector('.cqd-download-all-sub')?.textContent).toBe('2 / 2');
    expect(group.querySelector('.cqd-download-all-main')?.textContent).toBe('Downloaded');
    expect(getButtonStateV2(files[0])).toBe('success');

    // Auto-reset after the GROUP_FEEDBACK window.
    vi.advanceTimersByTime(GROUP_FEEDBACK_MS + 10);
    expect(group.classList.contains('cqd-all-success')).toBe(false);
    expect(group.querySelector('.cqd-download-all-sub')?.textContent).toBe('2 files');
  });

  it('drives cqd-all-error only when ALL files fail; partial failure is a success state', () => {
    const { group } = makePost(2, 'post-err');
    handleDownloadAllClickV2('post-err', group);
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS * 3);

    const payloads = requestedPayloads();
    bus.publish('download:settled', {
      requestId: payloads[0].requestId,
      outcome: { status: 'failed', detail: '403' },
    });
    // One still loading — group stays busy (no terminal class yet).
    expect(group.classList.contains('cqd-all-error')).toBe(false);
    expect(group.querySelector('.cqd-download-all-sub')?.textContent).toBe('0 → 2 (1 failed)');

    bus.publish('download:settled', {
      requestId: payloads[1].requestId,
      outcome: { status: 'failed', detail: '403' },
    });
    expect(group.classList.contains('cqd-all-error')).toBe(true);
    expect(group.querySelector('.cqd-download-all-sub')?.textContent).toBe('2 failed');

    // Partial: one ok, one failed → success state (V1 design parity).
    const { group: g2 } = makePost(2, 'post-partial');
    handleDownloadAllClickV2('post-partial', g2);
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS * 3);
    const p2 = requestedPayloads().slice(-2);
    bus.publish('download:settled', { requestId: p2[0].requestId, outcome: { status: 'saved' } });
    bus.publish('download:settled', { requestId: p2[1].requestId, outcome: { status: 'failed' } });
    expect(g2.classList.contains('cqd-all-success')).toBe(true);
    expect(g2.querySelector('.cqd-download-all-sub')?.textContent).toBe('1 ok, 1 failed');
  });

  it('click during a busy run cancels: CQD_CANCEL_DOWNLOAD per in-flight file + cqd-all-cancelled', () => {
    const { group, files } = makePost(2);
    handleDownloadAllClickV2('post-1', group);
    expect(getButtonStateV2(files[0])).toBe('loading'); // first file on the click

    // Click again mid-run → cancel path.
    handleDownloadAllClickV2('post-1', group);

    expect(group.classList.contains('cqd-all-cancelled')).toBe(true);
    expect(group.querySelector('.cqd-download-all-main')?.textContent).toBe('Cancelled');
    expect(getButtonStateV2(files[0])).toBe('cancelled');
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'CQD_CANCEL_DOWNLOAD',
      requestId: requestedPayloads()[0].requestId,
    });

    // Cancelled group resets after the short window.
    vi.advanceTimersByTime(GROUP_CANCELLED_RESET_MS + 10);
    expect(group.classList.contains('cqd-all-cancelled')).toBe(false);
  });

  it('never double-publishes: a busy group click cancels instead of re-requesting', () => {
    const { group } = makePost(3);
    handleDownloadAllClickV2('post-1', group);
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS * 3);
    expect(requested).toHaveLength(3);

    handleDownloadAllClickV2('post-1', group); // busy → cancel, not more requests
    expect(requested).toHaveLength(3);
  });

  it('a cancelled run leaves not-yet-started files unpublished and accounted for', () => {
    const { group, files } = makePost(3);
    handleDownloadAllClickV2('post-1', group); // file 0 started on the click

    handleDownloadAllClickV2('post-1', group); // cancel
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS * 5); // the stagger windows elapse

    expect(requested).toHaveLength(1); // files 1 and 2 never published
    // Every file in a cancelled run is accounted for: the in-flight file got
    // the CQD_CANCEL_DOWNLOAD message, never-started ones flipped cancelled.
    expect(getButtonStateV2(files[1])).toBe('cancelled');
    expect(getButtonStateV2(files[2])).toBe('cancelled');
    expect(group.classList.contains('cqd-all-cancelled')).toBe(false); // reset already landed
  });

  it('a fresh click after the reset starts a clean new run', () => {
    const { group } = makePost(2);
    handleDownloadAllClickV2('post-1', group);
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS * 3);
    for (const p of requestedPayloads()) {
      bus.publish('download:settled', { requestId: p.requestId, outcome: { status: 'saved' } });
    }
    vi.advanceTimersByTime(GROUP_FEEDBACK_MS + 10); // reset

    handleDownloadAllClickV2('post-1', group);
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS * 3);
    expect(requested).toHaveLength(4); // 2 from the first run + 2 from the second
  });

  it('deduplicates per-file buttons by canonical id when enumerating the group', () => {
    const { group, files } = makePost(2);
    // Simulate the same file appearing twice (duplicate button).
    const dup = files[0].cloneNode(true) as HTMLButtonElement;
    files[0].parentElement!.appendChild(dup);

    handleDownloadAllClickV2('post-1', group);
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS * 3);
    expect(requested).toHaveLength(2); // one per unique file id
  });

  it('cancel reaches the background with NO injected runtime (lazy chrome.runtime fallback)', () => {
    // Production bootstrap installs the group controller WITHOUT a runtime
    // (v2_bootstrap.content.ts) — cancel must fall back to chrome.runtime
    // .sendMessage exactly like the single-file controller does.
    const chromeSend = vi.fn();
    const g = globalThis as { chrome?: { runtime?: Record<string, unknown> } };
    (globalThis as unknown as { chrome: unknown }).chrome = {
      ...g.chrome,
      runtime: {
        ...g.chrome?.runtime,
        sendMessage: chromeSend,
        lastError: undefined,
      },
    };
    installDownloadAllController(null); // explicit NO runtime, as in production

    const { group } = makePost(2);
    handleDownloadAllClickV2('post-1', group); // file 0 enters the pipeline
    handleDownloadAllClickV2('post-1', group); // Cancel All

    expect(group.classList.contains('cqd-all-cancelled')).toBe(true);
    // The lazy wrapper mirrors chrome.runtime.sendMessage(message, callback);
    // the MESSAGE shape is the contract under test.
    expect(chromeSend.mock.calls[0]?.[0]).toEqual({
      type: 'CQD_CANCEL_DOWNLOAD',
      requestId: requestedPayloads()[0].requestId,
    });
  });

  it('the group machine survives an init→destroy→init cycle (orchestrator navigation)', async () => {
    // EngineV2.destroy() runs on EVERY view change; the group machine's run
    // state dies with the page, but the machine itself (click handler +
    // settled listener + bus) is wired once per document and must survive.
    const initEngine = async (): Promise<void> => {
      const engine = new EngineV2();
      const controller = new AbortController();
      controller.abort(); // skip waitForContentReady
      await engine.init('stream' as ViewKind, controller.signal);
      engine.destroy();
    };

    await initEngine(); // first navigation
    await initEngine(); // a second one — the very next Classroom view

    const { group, files } = makePost(2);
    handleDownloadAllClickV2('post-1', group);
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS * 3);
    expect(requested).toHaveLength(2);
    expect(getButtonStateV2(files[0])).toBe('loading');

    for (const p of requestedPayloads()) {
      bus.publish('download:settled', { requestId: p.requestId, outcome: { status: 'saved' } });
    }
    expect(group.classList.contains('cqd-all-success')).toBe(true);
    expect(group.querySelector('.cqd-download-all-main')?.textContent).toBe('Downloaded');
  });
});
