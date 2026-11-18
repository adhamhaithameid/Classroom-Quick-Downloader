// filepath: extension/tests/v3-api-client-errors.test.ts
/**
 * Audit-defect regression pins for GoogleClassroomApiClient (2026-11-18).
 *
 * Two defects, both verified in the audit:
 *   1. HTTP 401 was swallowed into an empty/partial result. An empty course
 *      is a LIE when the token is dead — and getInventory caches that empty
 *      inventory for the 5-minute TTL, so the lie sticks across clicks.
 *      Contract now: 401 throws ClassroomApiAuthError. Consumers classify:
 *      CourseInventoryService resolves null (UNCACHED → "Couldn't list
 *      files"), refreshApiSnapshot warns without publishing a snapshot.
 *      Any other non-OK status keeps the R7 silent-degradation partial.
 *   2. fetchCourseDriveFiles stopped after 3 list pages (300 courseWork
 *      items) mid-pagination. Contract now: paginate until the API stops
 *      handing out nextPageToken, with a raised safety cap (20 pages).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClassroomApiAuthError,
  GoogleClassroomApiClient,
} from '../src/engines/v3/api/classroom-api-client';
import { CourseInventoryService } from '../src/engines/v3/api/course-inventory';
import { ClassroomApiDiscoveryService } from '../src/engines/v3/api/discovery-service';
import { ViewKind } from '../src/engines/types';
import type {
  ClassroomApiRouteContext,
  ClassroomApiTokenProvider,
} from '../src/engines/v3/api/types';

const tokenProvider: ClassroomApiTokenProvider = {
  getAccessToken: vi.fn(async () => 'token-1'),
};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const CONTEXT: ClassroomApiRouteContext = {
  viewKind: ViewKind.STUDENT_WORK_TEACHER,
  courseId: 'C1',
  courseWorkId: 'W1',
  authUser: null,
  studentSubmissionId: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HTTP 401 surfaces as an auth error (never an empty course)', () => {
  it('throws ClassroomApiAuthError when courseWork.list answers 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));

    const client = new GoogleClassroomApiClient(tokenProvider);
    await expect(client.fetchCourseDriveFiles('COURSE_1', null)).rejects.toBeInstanceOf(
      ClassroomApiAuthError,
    );
  });

  it('throws ClassroomApiAuthError when a LATER page answers 401 (no partial-stands)', async () => {
    let courseWorkCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/courseWork?')) {
        courseWorkCalls += 1;
        if (courseWorkCalls === 1) {
          return jsonResponse({
            courseWork: [{ materials: [{ driveFile: { driveFile: { id: 'FILE_1' } } }] }],
            nextPageToken: 'page-2',
          });
        }
        return jsonResponse({}, 401);
      }
      return jsonResponse({ courseWorkMaterial: [] });
    }));

    const client = new GoogleClassroomApiClient(tokenProvider);
    await expect(client.fetchCourseDriveFiles('COURSE_1', null)).rejects.toBeInstanceOf(
      ClassroomApiAuthError,
    );
  });

  it('throws ClassroomApiAuthError when studentSubmissions.list answers 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));

    const client = new GoogleClassroomApiClient(tokenProvider);
    await expect(
      client.fetchStudentSubmissions(CONTEXT, undefined),
    ).rejects.toBeInstanceOf(ClassroomApiAuthError);
  });

  it('keeps R7 silent degradation for non-401 errors (500 → partial stands)', async () => {
    let submissionsCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/studentSubmissions')) {
        submissionsCalls += 1;
        if (submissionsCalls === 1) {
          return jsonResponse({
            studentSubmissions: [{ id: 'S1', assignmentSubmission: { attachments: [] } }],
            nextPageToken: 'page-2',
          });
        }
        return jsonResponse({}, 500);
      }
      return jsonResponse({});
    }));

    const client = new GoogleClassroomApiClient(tokenProvider);
    await expect(
      client.fetchStudentSubmissions(CONTEXT, undefined),
    ).resolves.toHaveLength(1);
  });

  it('getInventory resolves null on 401 and does NOT cache the failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));

    const client = new GoogleClassroomApiClient(tokenProvider);
    const service = new CourseInventoryService(client);

    await expect(service.getInventory('C1', null)).resolves.toBeNull();
    // The second click must retry the API, not serve a cached empty course.
    await expect(service.getInventory('C1', null)).resolves.toBeNull();
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('discover() propagates the auth error without caching an empty snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));

    const client = new GoogleClassroomApiClient(tokenProvider);
    const discovery = new ClassroomApiDiscoveryService(client);
    const context = CONTEXT;

    await expect(discovery.discover(context)).rejects.toBeInstanceOf(ClassroomApiAuthError);
    // A retry goes back to the network — nothing poisoned the cache.
    await expect(discovery.discover(context)).rejects.toBeInstanceOf(ClassroomApiAuthError);
    expect(vi.mocked(fetch).mock.calls.length).toBe(2);
  });
});

describe('course list pagination runs until the API is exhausted', () => {
  it('follows nextPageToken past the old 3-page cap and stops when it ends', async () => {
    const TOTAL_PAGES = 5;
    let courseWorkCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/courseWork?')) {
        courseWorkCalls += 1;
        const page = courseWorkCalls;
        return jsonResponse({
          courseWork: [{ materials: [{ driveFile: { driveFile: { id: `FILE_${page}` } } }] }],
          ...(page < TOTAL_PAGES ? { nextPageToken: `page-${page + 1}` } : {}),
        });
      }
      return jsonResponse({ courseWorkMaterial: [] });
    }));

    const client = new GoogleClassroomApiClient(tokenProvider);
    const files = await client.fetchCourseDriveFiles('COURSE_1', null);

    expect(courseWorkCalls).toBe(TOTAL_PAGES);
    expect(files.map((f) => f.id)).toEqual(['FILE_1', 'FILE_2', 'FILE_3', 'FILE_4', 'FILE_5']);
  });
});
