import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewKind } from '../src/engines/types';
import {
  publishStudentWorkApiSnapshot,
  readPublishedStudentWorkApiSnapshot,
} from '../src/engines/v3/api/runtime-bridge';

describe('v3/api/runtime-bridge', () => {
  beforeEach(() => {
    vi.useRealTimers();
    publishStudentWorkApiSnapshot(null);
  });

  it('publishes and reads normalized student work attachments', () => {
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
          userId: 'U_1',
          state: 'TURNED_IN',
          attachments: [
            {
              id: 'ATT_1',
              title: 'Screenshot 01.PNG',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=ATT_1',
              source: 'driveFile',
            },
          ],
        },
      ],
    });

    const snapshot = readPublishedStudentWorkApiSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.courseId).toBe('COURSE_1');
    expect(snapshot?.courseWorkId).toBe('WORK_1');
    expect(snapshot?.attachments).toHaveLength(1);
    expect(snapshot?.attachments[0]?.id).toBe('ATT_1');
    expect(snapshot?.attachments[0]?.normalizedTitle).toBe('screenshot 01.png');
    expect(snapshot?.attachments[0]?.normalizedExt).toBe('png');
  });

  it('clears stale snapshots when max age is exceeded', () => {
    vi.useFakeTimers();
    const now = new Date('2026-03-17T00:00:00Z');
    vi.setSystemTime(now);

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
          id: 'SUB_2',
          attachments: [
            {
              id: 'ATT_2',
              title: 'video.mp4',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=ATT_2',
              source: 'driveFile',
            },
          ],
        },
      ],
    });

    vi.setSystemTime(now.getTime() + 200_000);

    expect(readPublishedStudentWorkApiSnapshot()).toBeNull();
    expect(readPublishedStudentWorkApiSnapshot()).toBeNull();
  });

  it('clears snapshot when publish is called with null', () => {
    publishStudentWorkApiSnapshot({
      fetchedAt: Date.now(),
      context: {
        viewKind: ViewKind.STUDENT_WORK_TEACHER,
        courseId: 'COURSE_3',
        courseWorkId: 'WORK_3',
        authUser: null,
        studentSubmissionId: null,
      },
      submissions: [
        {
          id: 'SUB_3',
          attachments: [
            {
              id: 'ATT_3',
              title: 'doc.pdf',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=ATT_3',
              source: 'driveFile',
            },
          ],
        },
      ],
    });

    expect(readPublishedStudentWorkApiSnapshot()).not.toBeNull();
    publishStudentWorkApiSnapshot(null);
    expect(readPublishedStudentWorkApiSnapshot()).toBeNull();
  });
});

