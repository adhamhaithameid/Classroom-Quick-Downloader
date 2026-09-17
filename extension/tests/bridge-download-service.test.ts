// filepath: extension/tests/bridge-download-service.test.ts
/**
 * S6/G2 T3 — the worker side of the bridge: a CQD_BRIDGE_REQUEST carrying
 * {file, nameHint} drives the EXISTING download state machine, and the
 * machine's terminal statuses answer the bridge exactly once, correlated by
 * requestId. Statuses map onto the AcquireOutcome contract.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PendingDownload } from '../entrypoints/background/types';
import { createInMemoryBridge } from './fakes/fake-bridge-port';
import {
  startBridgeDownloadService,
  mapStatusToOutcome,
} from '../entrypoints/background/bridge-download-service';

const FILE = {
  fileId: 'FILE123',
  url: 'https://drive.usercontent.google.com/download?id=FILE123&export=download&confirm=t',
  ext: 'pdf',
  name: 'lecture.pdf',
};
const NAME_HINT = { preferredStem: 'lecture', ext: 'pdf', source: 'aria' as const };

function makePending(requestId: string): PendingDownload {
  return {
    requestId,
    startTime: Date.now(),
    originalUrl: FILE.url,
    baseUrl: FILE.url,
    isDrive: true,
    fileMeta: { ext: 'pdf', name: 'lecture.pdf' },
    attemptedAuthUsers: [],
    isCancelled: false,
  } as PendingDownload;
}

const mocks = vi.hoisted(() => ({
  handleDownloadRequest: vi.fn() as any,
  setDownloadStatusListener: vi.fn() as any,
}));

vi.mock('../entrypoints/background/download-handler', () => ({
  handleDownloadRequest: mocks.handleDownloadRequest,
}));
vi.mock('../entrypoints/background/message-sender', () => ({
  setDownloadStatusListener: mocks.setDownloadStatusListener,
}));

describe('bridge download service (worker side)', () => {
  let page: ReturnType<typeof createInMemoryBridge>['page'];
  let worker: ReturnType<typeof createInMemoryBridge>['worker'];
  let workerResponds: Array<{ requestId: string; response: unknown }>;

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps leaked mockImplementations — restore the default.
    mocks.handleDownloadRequest.mockImplementation(() => true);
    const pair = createInMemoryBridge();
    page = pair.page;
    worker = pair.worker;
    workerResponds = [];
    worker.respond = (requestId: string, response: unknown) => {
      workerResponds.push({ requestId, response });
    };
  });

  it('drives handleDownloadRequest from a bridge request with the file payload', () => {
    startBridgeDownloadService(worker);

    page.send({ requestId: 'req-1', payload: { file: FILE, nameHint: NAME_HINT } });

    expect(mocks.handleDownloadRequest).toHaveBeenCalledTimes(1);
    const [message, sender, respond] = mocks.handleDownloadRequest.mock.calls[0];
    expect(message).toMatchObject({
      type: 'CQD_DOWNLOAD',
      url: FILE.url,
      requestId: 'req-1',
      fileMeta: { ext: 'pdf', name: 'lecture.pdf' },
    });
    expect(respond).toBeTypeOf('function');
    void sender;
  });

  it('a synchronous refusal (started:false) settles the bridge request as blocked', () => {
    mocks.handleDownloadRequest.mockImplementation(
      (_m: unknown, _s: unknown, respond: (r?: any) => void) => {
        respond({ started: false, userMessage: 'Download blocked: invalid URL.' });
        return true;
      },
    );
    startBridgeDownloadService(worker);

    page.send({ requestId: 'req-2', payload: { file: FILE, nameHint: NAME_HINT } });

    expect(workerResponds).toEqual([
      { requestId: 'req-2', response: { status: 'blocked', detail: 'Download blocked: invalid URL.' } },
    ]);
  });

  it('terminal statuses from the machine answer the bridge exactly once', () => {
    startBridgeDownloadService(worker);
    const listener = mocks.setDownloadStatusListener.mock.calls.at(-1)![0] as (
      p: PendingDownload,
      status: string,
      userMessage?: string,
      errorCode?: string,
    ) => void;

    // The bridge request must be accepted before its statuses settle it.
    page.send({ requestId: 'req-3', payload: { file: FILE, nameHint: NAME_HINT } });
    const pending = makePending('req-3');
    // The sweep is trying — progress, not a settle.
    listener(pending, 'trying', 'Trying your other Google accounts…', 'AUTH_LOOP');
    expect(workerResponds).toEqual([]);

    // Terminal error settles once.
    listener(pending, 'error', 'Access denied for all your accounts.', 'AUTH_ALL_FAILED');
    listener(pending, 'error', 'Access denied for all your accounts.', 'AUTH_ALL_FAILED');
    expect(workerResponds).toEqual([
      {
        requestId: 'req-3',
        response: { status: 'auth-exhausted', detail: 'Access denied for all your accounts.' },
      },
    ]);
  });

  it('maps success to saved and generic errors to failed', () => {
    startBridgeDownloadService(worker);
    const listener = mocks.setDownloadStatusListener.mock.calls.at(-1)![0] as (
      p: PendingDownload,
      status: string,
      userMessage?: string,
      errorCode?: string,
    ) => void;

    page.send({ requestId: 'req-ok', payload: { file: FILE, nameHint: NAME_HINT } });
    page.send({ requestId: 'req-fail', payload: { file: FILE, nameHint: NAME_HINT } });
    listener(makePending('req-ok'), 'success');
    listener(makePending('req-fail'), 'error', 'Download interrupted', 'NETWORK_FAILED');

    expect(workerResponds).toEqual([
      { requestId: 'req-ok', response: { status: 'saved' } },
      { requestId: 'req-fail', response: { status: 'failed', detail: 'Download interrupted' } },
    ]);
  });

  it('statuses for requests the bridge did not originate are ignored', () => {
    startBridgeDownloadService(worker);
    const listener = mocks.setDownloadStatusListener.mock.calls.at(-1)![0] as (
      p: PendingDownload,
      status: string,
    ) => void;

    listener(makePending('not-a-bridge-request'), 'success');

    expect(workerResponds).toEqual([]);
  });

  it('bounds the accepted-set memory: statuses beyond the FIFO window are ignored', () => {
    startBridgeDownloadService(worker);
    const listener = mocks.setDownloadStatusListener.mock.calls.at(-1)![0] as (
      p: PendingDownload,
      status: string,
    ) => void;

    // 501 accepted-but-never-settled requests: the FIRST must fall out FIFO.
    page.send({ requestId: 'old-1', payload: { file: FILE, nameHint: NAME_HINT } });
    for (let i = 2; i <= 501; i++) {
      page.send({ requestId: `old-${i}`, payload: { file: FILE, nameHint: NAME_HINT } });
    }

    listener(makePending('old-1'), 'success');

    // old-1 was evicted from the bounded accepted set — no stale settle.
    expect(workerResponds).toEqual([]);
  });

  it('the returned off fn detaches the listener and stops serving requests', () => {
    const off = startBridgeDownloadService(worker);
    off();

    page.send({ requestId: 'req-4', payload: { file: FILE, nameHint: NAME_HINT } });

    expect(mocks.handleDownloadRequest).not.toHaveBeenCalled();
    expect(mocks.setDownloadStatusListener).toHaveBeenLastCalledWith(null);
  });
});

describe('mapStatusToOutcome (pure mapping)', () => {
  it('covers every status the machine can emit', () => {
    expect(mapStatusToOutcome('success')).toEqual({ status: 'saved' });
    expect(mapStatusToOutcome('complete')).toEqual({ status: 'saved' });
    expect(mapStatusToOutcome('error', 'no access', 'AUTH_ALL_FAILED')).toEqual({
      status: 'auth-exhausted',
      detail: 'no access',
    });
    expect(mapStatusToOutcome('error', 'boom', 'OTHER')).toEqual({ status: 'failed', detail: 'boom' });
    expect(mapStatusToOutcome('interrupted', 'net')).toEqual({ status: 'failed', detail: 'net' });
    expect(mapStatusToOutcome('blocked_html')).toEqual({ status: 'blocked' });
  });
});
