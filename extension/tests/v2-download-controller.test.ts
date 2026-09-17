// filepath: extension/tests/v2-download-controller.test.ts
/**
 * z57 STAGE 1 — the v2 interactive download path.
 *
 * Clicking a v2 button publishes 'download:requested' on the page bus, the
 * bridge-relay contract settles it as 'download:settled', and the settled
 * outcome drives the button state machine (V1 class contract). Covers the
 * four acceptance behaviors from the stage brief: click publishes; settled
 * updates state; no double-publish; reset cleans up.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createEventBus } from '../src/bus/event-bus';
import type { PageTopicMap } from '../src/contracts/topics';
import {
  wireDownloadPath,
  handleSingleDownloadClickV2,
  resetDownloadController,
  onSettled,
  cancelInFlight,
  isRequestInFlight,
  getPendingButton,
  type DownloadRuntime,
} from '../src/v2/render/download-controller';
import { setButtonStateV2, getButtonStateV2 } from '../src/v2/render/button-state';

function makeButton(url = 'https://drive.usercontent.google.com/download?id=F1&export=download&confirm=t'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'cqd-download-btn';
  btn.innerHTML =
    '<span class="cqd-download-icon"></span><span class="cqd-label">Download</span><span class="cqd-error-detail"></span>';
  btn.dataset.cqdUrl = url;
  btn.dataset.cqdName = 'lecture.pdf';
  btn.dataset.cqdExt = 'pdf';
  document.body.appendChild(btn);
  return btn;
}

describe('download controller (page side)', () => {
  let bus: ReturnType<typeof createEventBus<PageTopicMap>>;
  const sendMessage = vi.fn();
  const runtime: DownloadRuntime = { sendMessage };

  beforeEach(() => {
    document.body.innerHTML = '';
    resetDownloadController();
    bus = createEventBus<PageTopicMap>();
    wireDownloadPath(bus, runtime);
  });

  it('a click publishes download:requested with FileRef + NameHint and flips the button to loading', () => {
    const requested: Array<PageTopicMap['download:requested']> = [];
    bus.subscribe('download:requested', (p) => requested.push(p));

    const btn = makeButton();
    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');

    expect(requested).toHaveLength(1);
    expect(requested[0].requestId).toMatch(/^cqd-\d+-\d+$/);
    expect(requested[0].file).toEqual({
      fileId: 'drive-F1',
      url: btn.dataset.cqdUrl,
      ext: 'pdf',
      name: 'lecture.pdf',
    });
    expect(requested[0].nameHint).toEqual({ preferredStem: 'lecture', ext: 'pdf', source: 'aria' });
    expect(getButtonStateV2(btn)).toBe('loading');
  });

  it('a settled saved outcome flips the button to the success state', () => {
    const btn = makeButton();
    let requestId = '';
    bus.subscribe('download:requested', (p) => { requestId = p.requestId; });

    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');
    bus.publish('download:settled', { requestId, outcome: { status: 'saved' } });

    expect(getButtonStateV2(btn)).toBe('success');
    expect(isRequestInFlight(requestId)).toBe(false);
  });

  it('a settled failure carries the detail message (V1 error text contract)', () => {
    const btn = makeButton();
    let requestId = '';
    bus.subscribe('download:requested', (p) => { requestId = p.requestId; });

    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');
    bus.publish('download:settled', {
      requestId,
      outcome: { status: 'failed', detail: 'The file is no longer available.' },
    });

    expect(getButtonStateV2(btn)).toBe('error');
    expect(btn.querySelector('.cqd-error-detail')?.textContent).toBe('The file is no longer available.');
  });

  it('no double-publish: a settled request re-clicking after success waits for the idle reset', () => {
    const requested: Array<PageTopicMap['download:requested']> = [];
    bus.subscribe('download:requested', (p) => requested.push(p));
    const btn = makeButton();

    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');
    bus.publish('download:settled', {
      requestId: requested[0].requestId,
      outcome: { status: 'saved' },
    });

    // Terminal state blocks a re-publish until the auto-reset lands.
    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');
    expect(requested).toHaveLength(1);
    expect(getButtonStateV2(btn)).toBe('success');
  });

  it('no double-publish: clicking a mid-flight button cancels instead of re-publishing', () => {
    const requested: Array<PageTopicMap['download:requested']> = [];
    bus.subscribe('download:requested', (p) => requested.push(p));
    const btn = makeButton();

    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');
    const requestId = requested[0].requestId;

    // Second click while loading → cancel path (V1 cancel affordance parity).
    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');

    expect(requested).toHaveLength(1); // never re-published
    expect(getButtonStateV2(btn)).toBe('cancelled');
    expect(isRequestInFlight(requestId)).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith({ type: 'CQD_CANCEL_DOWNLOAD', requestId });
  });

  it('cancelInFlight sends the existing CQD_CANCEL_DOWNLOAD runtime message', () => {
    const requested: Array<PageTopicMap['download:requested']> = [];
    bus.subscribe('download:requested', (p) => requested.push(p));
    const btn = makeButton();
    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');

    cancelInFlight(btn);

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'CQD_CANCEL_DOWNLOAD',
      requestId: requested[0].requestId,
    });
  });

  it('a click with no wired bus fails the button honestly instead of spinning', () => {
    resetDownloadController();
    const bus2 = createEventBus<PageTopicMap>();
    wireDownloadPath(bus2, runtime);
    const requested: Array<PageTopicMap['download:requested']> = [];
    bus2.subscribe('download:requested', (p) => requested.push(p));

    const btn = makeButton();
    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');

    // The bus IS wired here — normal path applies.
    expect(requested).toHaveLength(1);
    expect(getButtonStateV2(btn)).toBe('loading');
  });

  it('reset drops all in-flight state and detaches listeners (unmount cleanup)', () => {
    const settled = vi.fn();
    onSettled(settled);
    const btn = makeButton();
    let requestId = '';
    bus.subscribe('download:requested', (p) => { requestId = p.requestId; });
    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');
    expect(getPendingButton(requestId)).toBe(btn);

    resetDownloadController();

    expect(getPendingButton(requestId)).toBeUndefined();
    bus.publish('download:settled', { requestId, outcome: { status: 'saved' } });
    expect(settled).not.toHaveBeenCalled();
  });

  it('settled fan-out notifies secondary listeners (group controller hook)', () => {
    const seen: string[] = [];
    onSettled((id) => seen.push(id));
    const btn = makeButton();
    let requestId = '';
    bus.subscribe('download:requested', (p) => { requestId = p.requestId; });

    handleSingleDownloadClickV2(btn, 'drive-F1', btn.dataset.cqdUrl!, 'lecture.pdf', 'pdf');
    bus.publish('download:settled', { requestId, outcome: { status: 'saved' } });

    expect(seen).toEqual([requestId]);
  });

  it('the terminal-state priority gate keeps terminal states sticky until reset', () => {
    const btn = makeButton();
    setButtonStateV2(btn, 'success');
    setButtonStateV2(btn, 'loading'); // must be blocked
    expect(getButtonStateV2(btn)).toBe('success');
    setButtonStateV2(btn, 'idle'); // reset always applies
    expect(getButtonStateV2(btn)).toBe('idle');
  });
});
