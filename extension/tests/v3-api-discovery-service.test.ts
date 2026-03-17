import { describe, expect, it, vi } from 'vitest';
import { ViewKind } from '../src/engines/types';
import { ClassroomApiDiscoveryService } from '../src/engines/v3/api/discovery-service';
import { ClassroomApiSnapshotCache } from '../src/engines/v3/api/cache';
import type { ClassroomApiClient, ClassroomApiRouteContext } from '../src/engines/v3/api/types';

function sampleContext(): ClassroomApiRouteContext {
  return {
    viewKind: ViewKind.STUDENT_WORK_TEACHER,
    courseId: 'COURSE_1',
    courseWorkId: 'WORK_1',
    authUser: null,
    studentSubmissionId: null,
  };
}

describe('v3/api/discovery-service', () => {
  it('caches API snapshots per route context', async () => {
    const client: ClassroomApiClient = {
      fetchStudentSubmissions: vi.fn(async () => ([
        { id: 'sub-1', attachments: [] },
      ])),
    };

    const service = new ClassroomApiDiscoveryService(
      client,
      new ClassroomApiSnapshotCache(60_000),
    );

    const first = await service.discover(sampleContext());
    const second = await service.discover(sampleContext());

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first?.submissions).toHaveLength(1);
    expect(second?.submissions).toHaveLength(1);
    expect(client.fetchStudentSubmissions).toHaveBeenCalledTimes(1);
  });

  it('forceRefresh bypasses cache', async () => {
    const client: ClassroomApiClient = {
      fetchStudentSubmissions: vi.fn(async () => ([])),
    };

    const service = new ClassroomApiDiscoveryService(
      client,
      new ClassroomApiSnapshotCache(60_000),
    );

    await service.discover(sampleContext());
    await service.discover(sampleContext(), { forceRefresh: true });

    expect(client.fetchStudentSubmissions).toHaveBeenCalledTimes(2);
  });
});
