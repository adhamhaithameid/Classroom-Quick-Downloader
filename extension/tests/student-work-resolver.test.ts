import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { STUDENT_WORK_CHANNEL_NAME } from '../src/student_work/constants';
import { ViewKind } from '../src/engines/types';
import { publishStudentWorkApiSnapshot } from '../src/engines/v3/api/runtime-bridge';
import { resolveStudentWorkUrl } from '../src/student_work/resolver';

class FakeBroadcastChannel {
  static channels = new Map<string, Set<FakeBroadcastChannel>>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    const set = FakeBroadcastChannel.channels.get(name) || new Set<FakeBroadcastChannel>();
    set.add(this);
    FakeBroadcastChannel.channels.set(name, set);
  }

  postMessage(data: unknown) {
    const peers = FakeBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this) continue;
      peer.onmessage?.({ data } as MessageEvent);
    }
  }

  close() {
    const peers = FakeBroadcastChannel.channels.get(this.name);
    peers?.delete(this);
  }

  static reset() {
    FakeBroadcastChannel.channels.clear();
  }
}

function publishResolveMessage(payload: Record<string, unknown>) {
  const sender = new FakeBroadcastChannel(STUDENT_WORK_CHANNEL_NAME);
  sender.postMessage(payload);
  sender.close();
}

describe('student_work/resolver', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  beforeEach(() => {
    FakeBroadcastChannel.reset();
    vi.useRealTimers();
    // @ts-expect-error - test mock
    globalThis.BroadcastChannel = FakeBroadcastChannel;
    vi.restoreAllMocks();
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );
    publishStudentWorkApiSnapshot(null);
    document.body.innerHTML = '';
  });

  afterAll(() => {
    vi.useFakeTimers();
    globalThis.BroadcastChannel = originalBroadcastChannel;
  });

  it('returns input URL unchanged for non-student-work links', async () => {
    const result = await resolveStudentWorkUrl(
      'https://drive.google.com/file/d/FILE/view',
      { stageTimeoutMs: 10 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://drive.google.com/file/d/FILE/view');
    expect(result.reason).toBe('already_direct');
  });

  it('resolves directly from query id without iframe/popup', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c?id=FILE_QUERY_1',
      { stageTimeoutMs: 10 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=FILE_QUERY_1');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('preserves authuser from source path when resolving direct query-id links', async () => {
    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/u/4/g/tg/a/b/c?id=FILE_QUERY_2',
      { stageTimeoutMs: 10 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=FILE_QUERY_2');
    expect(result.url).toContain('authuser=4');
  });

  it('prefers authuser query over path when resolving direct query-id links', async () => {
    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/u/4/g/tg/a/b/c?id=FILE_QUERY_3&authuser=9',
      { stageTimeoutMs: 10 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=FILE_QUERY_3');
    expect(result.url).toContain('authuser=9');
  });

  it('resolves via iframe bridge message', async () => {
    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');
    const waitForIframe = vi.fn((node: Node) => {
      if (!(node instanceof HTMLIFrameElement)) return;
      const iframeUrl = new URL(node.src);
      const requestId = iframeUrl.searchParams.get('cqd_sw_req');
      if (!requestId) return;

      setTimeout(() => {
        publishResolveMessage({
          type: 'CQD_SW_RESOLVE_RESULT',
          requestId,
          ok: true,
          resolvedUrl: 'https://drive.google.com/uc?export=download&id=IFRAME_RESOLVED',
          source: 'anchor',
        });
      }, 5);
    });
    appendSpy.mockImplementation((node: Node) => {
      waitForIframe(node);
      return node;
    });

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 50 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=IFRAME_RESOLVED');
    expect(result.source).toBe('anchor');
  });

  it('returns iframe failure when iframe cannot find a direct file URL', async () => {
    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');
    appendSpy.mockImplementation((node: Node) => {
      if (!(node instanceof HTMLIFrameElement)) return node;
      const iframeUrl = new URL(node.src);
      const requestId = iframeUrl.searchParams.get('cqd_sw_req');
      if (!requestId) return node;
      setTimeout(() => {
        publishResolveMessage({
          type: 'CQD_SW_RESOLVE_RESULT',
          requestId,
          ok: false,
          reason: 'no_drive_url_found',
        });
      }, 5);
      return node;
    });

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 80 },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_drive_url_found');
    expect(appendSpy).toHaveBeenCalled();
  });

  it('resolves from published API snapshot when hints match, without iframe', async () => {
    publishStudentWorkApiSnapshot({
      fetchedAt: Date.now(),
      context: {
        viewKind: ViewKind.STUDENT_WORK_TEACHER,
        courseId: 'COURSE_1',
        courseWorkId: 'WORK_1',
        authUser: null,
        studentSubmissionId: null,
      },
      submissions: [
        {
          id: 'SUB_1',
          attachments: [
            {
              id: 'FILE_IMAGE_1',
              title: 'screenshot.png',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_IMAGE_1',
              source: 'driveFile',
            },
            {
              id: 'FILE_JSON_3',
              title: 'payload.json',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_JSON_3',
              source: 'driveFile',
            },
          ],
        },
      ],
    });

    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c?cqd_sw_hint_name=screenshot.png&cqd_sw_hint_ext=png',
      { stageTimeoutMs: 40 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=FILE_IMAGE_1');
    expect(result.source).toBe('api_snapshot');
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it('matches API snapshot by decoded submission-hint token before iframe fallback', async () => {
    publishStudentWorkApiSnapshot({
      fetchedAt: Date.now(),
      context: {
        viewKind: ViewKind.STUDENT_WORK_TEACHER,
        courseId: 'COURSE_HINTED',
        courseWorkId: 'WORK_HINTED',
        authUser: null,
        studentSubmissionId: null,
      },
      submissions: [
        {
          id: '851711936381',
          attachments: [
            {
              id: 'FILE_HINTED_SUBMISSION',
              title: 'capture.json',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_HINTED_SUBMISSION',
              source: 'driveFile',
            },
          ],
        },
        {
          id: '846996003474',
          attachments: [
            {
              id: 'FILE_OTHER_SUBMISSION',
              title: 'capture.json',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_OTHER_SUBMISSION',
              source: 'driveFile',
            },
          ],
        },
      ],
    });

    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c?cqd_sw_hint_name=capture.json&cqd_sw_hint_ext=json#u=ODUxNzExOTM2Mzgx',
      { stageTimeoutMs: 40 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=FILE_HINTED_SUBMISSION');
    expect(result.source).toBe('api_snapshot');
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it('falls back to iframe when API snapshot hint match is tied across multiple attachments', async () => {
    publishStudentWorkApiSnapshot({
      fetchedAt: Date.now(),
      context: {
        viewKind: ViewKind.STUDENT_WORK_TEACHER,
        courseId: 'COURSE_TIE',
        courseWorkId: 'WORK_TIE',
        authUser: null,
        studentSubmissionId: null,
      },
      submissions: [
        {
          id: 'SUB_1',
          attachments: [
            {
              id: 'FILE_A',
              title: 'worksheet.pdf',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_A',
              source: 'driveFile',
            },
            {
              id: 'FILE_B',
              title: 'worksheet.pdf',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_B',
              source: 'driveFile',
            },
          ],
        },
      ],
    });

    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');
    appendSpy.mockImplementation((node: Node) => {
      if (!(node instanceof HTMLIFrameElement)) return node;
      const iframeUrl = new URL(node.src);
      const requestId = iframeUrl.searchParams.get('cqd_sw_req');
      if (!requestId) return node;
      setTimeout(() => {
        publishResolveMessage({
          type: 'CQD_SW_RESOLVE_RESULT',
          requestId,
          ok: true,
          resolvedUrl: 'https://drive.google.com/uc?export=download&id=IFRAME_TIE_BREAK',
          source: 'anchor',
        });
      }, 5);
      return node;
    });

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c?cqd_sw_hint_name=worksheet.pdf&cqd_sw_hint_ext=pdf',
      { stageTimeoutMs: 60 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=IFRAME_TIE_BREAK');
    expect(result.source).toBe('anchor');
    expect(appendSpy).toHaveBeenCalled();
  });

  it('falls back to iframe when API snapshot mixes multiple submissions', async () => {
    publishStudentWorkApiSnapshot({
      fetchedAt: Date.now(),
      context: {
        viewKind: ViewKind.STUDENT_WORK_TEACHER,
        courseId: 'COURSE_MULTI',
        courseWorkId: 'WORK_MULTI',
        authUser: null,
        studentSubmissionId: null,
      },
      submissions: [
        {
          id: 'SUB_A',
          attachments: [
            {
              id: 'FILE_A1',
              title: 'submission-a.pdf',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_A1',
              source: 'driveFile',
            },
          ],
        },
        {
          id: 'SUB_B',
          attachments: [
            {
              id: 'FILE_B1',
              title: 'submission-b.pdf',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_B1',
              source: 'driveFile',
            },
          ],
        },
      ],
    });

    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');
    appendSpy.mockImplementation((node: Node) => {
      if (!(node instanceof HTMLIFrameElement)) return node;
      const iframeUrl = new URL(node.src);
      const requestId = iframeUrl.searchParams.get('cqd_sw_req');
      if (!requestId) return node;
      setTimeout(() => {
        publishResolveMessage({
          type: 'CQD_SW_RESOLVE_RESULT',
          requestId,
          ok: true,
          resolvedUrl: 'https://drive.google.com/uc?export=download&id=IFRAME_MULTI_SUBMISSION',
          source: 'anchor',
        });
      }, 5);
      return node;
    });

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c?cqd_sw_hint_name=submission-a.pdf&cqd_sw_hint_ext=pdf',
      { stageTimeoutMs: 60 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=IFRAME_MULTI_SUBMISSION');
    expect(result.source).toBe('anchor');
    expect(appendSpy).toHaveBeenCalled();
  });

  it('falls back to iframe when API snapshot is ambiguous with no hints', async () => {
    publishStudentWorkApiSnapshot({
      fetchedAt: Date.now(),
      context: {
        viewKind: ViewKind.STUDENT_WORK_TEACHER,
        courseId: 'COURSE_2',
        courseWorkId: 'WORK_2',
        authUser: null,
        studentSubmissionId: null,
      },
      submissions: [
        {
          id: 'SUB_1',
          attachments: [
            {
              id: 'FILE_1',
              title: 'first.png',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_1',
              source: 'driveFile',
            },
            {
              id: 'FILE_2',
              title: 'second.mp4',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_2',
              source: 'driveFile',
            },
          ],
        },
      ],
    });

    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');
    appendSpy.mockImplementation((node: Node) => {
      if (!(node instanceof HTMLIFrameElement)) return node;
      const iframeUrl = new URL(node.src);
      const requestId = iframeUrl.searchParams.get('cqd_sw_req');
      if (!requestId) return node;
      setTimeout(() => {
        publishResolveMessage({
          type: 'CQD_SW_RESOLVE_RESULT',
          requestId,
          ok: true,
          resolvedUrl: 'https://drive.google.com/uc?export=download&id=IFRAME_FALLBACK_2',
          source: 'anchor',
        });
      }, 5);
      return node;
    });

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 60 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=IFRAME_FALLBACK_2');
    expect(result.source).toBe('anchor');
    expect(appendSpy).toHaveBeenCalled();
  });

  it('adds authuser hint to iframe-resolved Drive URL when missing', async () => {
    vi.stubGlobal('location', new URL('https://classroom.google.com/u/6/c/C/a/A/submissions'));
    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');
    appendSpy.mockImplementation((node: Node) => {
      if (!(node instanceof HTMLIFrameElement)) return node;
      const iframeUrl = new URL(node.src);
      const requestId = iframeUrl.searchParams.get('cqd_sw_req');
      if (!requestId) return node;
      setTimeout(() => {
        publishResolveMessage({
          type: 'CQD_SW_RESOLVE_RESULT',
          requestId,
          ok: true,
          resolvedUrl: 'https://drive.google.com/uc?export=download&id=IFRAME_AUTH',
          source: 'anchor',
        });
      }, 5);
      return node;
    });

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 60 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=IFRAME_AUTH');
    expect(result.url).toContain('authuser=6');
  });

  it('normalizes iframe-resolved docs URLs into direct drive downloads', async () => {
    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');
    appendSpy.mockImplementation((node: Node) => {
      if (!(node instanceof HTMLIFrameElement)) return node;
      const iframeUrl = new URL(node.src);
      const requestId = iframeUrl.searchParams.get('cqd_sw_req');
      if (!requestId) return node;
      setTimeout(() => {
        publishResolveMessage({
          type: 'CQD_SW_RESOLVE_RESULT',
          requestId,
          ok: true,
          resolvedUrl: 'https://docs.google.com/document/d/DOC_FILE_1/edit',
          source: 'anchor',
        });
      }, 5);
      return node;
    });

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 60 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('https://drive.google.com/uc?');
    expect(result.url).toContain('id=DOC_FILE_1');
  });

  it('rejects iframe-resolved non-https URLs', async () => {
    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');
    appendSpy.mockImplementation((node: Node) => {
      if (!(node instanceof HTMLIFrameElement)) return node;
      const iframeUrl = new URL(node.src);
      const requestId = iframeUrl.searchParams.get('cqd_sw_req');
      if (!requestId) return node;
      setTimeout(() => {
        publishResolveMessage({
          type: 'CQD_SW_RESOLVE_RESULT',
          requestId,
          ok: true,
          resolvedUrl: 'javascript:alert(1)',
          source: 'anchor',
        });
      }, 5);
      return node;
    });

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 60 },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_resolved_url');
  });

  it('returns aborted when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 10, signal: controller.signal },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('aborted');
  });

  it('returns iframe timeout when iframe stage times out', async () => {
    vi.spyOn(document.documentElement, 'appendChild').mockImplementation((node: Node) => node);

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 20 },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('resolver_timeout');
  });

  it('returns failure when iframe resolve fails', async () => {
    vi.spyOn(document.documentElement, 'appendChild').mockImplementation((node: Node) => node);

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 10 },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('resolver_timeout');
  });
});
