import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleClassroomApiClient } from '../src/engines/v3/api/classroom-api-client';
import {
  CourseInventoryService,
  INVENTORY_CACHE_TTL_MS,
} from '../src/engines/v3/api/course-inventory';
import type { ClassroomApiTokenProvider } from '../src/engines/v3/api/types';

const tokenProvider: ClassroomApiTokenProvider = {
  getAccessToken: vi.fn(async () => 'token-1'),
};

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('v3/api client fetchCourseDriveFiles', () => {
  it('collects drive files from both lists, handling the SharedDriveFile double-nest', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/courseWork?')) {
        return jsonResponse({
          courseWork: [
            {
              id: 'w1',
              title: 'Worksheet',
              materials: [
                // csaa.2 wire-shape trap: courseWork nests under SharedDriveFile.
                { driveFile: { driveFile: { id: 'FILE_1', title: 'Worksheet.pdf' } } },
                { link: { url: 'https://example.com' } },
                { form: { formUrl: 'https://forms.example.com' } },
              ],
            },
          ],
        });
      }
      return jsonResponse({
        courseWorkMaterial: [
          {
            id: 'm1',
            title: 'Reading',
            materials: [
              // Legacy flat shape accepted defensively.
              { driveFile: { id: 'FILE_2', title: 'Reading.docx' } },
            ],
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new GoogleClassroomApiClient(tokenProvider);
    const files = await client.fetchCourseDriveFiles('COURSE_1', null);

    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({ id: 'FILE_1', title: 'Worksheet.pdf', source: 'driveFile' });
    expect(files[1]?.id).toBe('FILE_2');
    // Downloads are browser-session Drive fetches, not API calls.
    expect(files[0]?.downloadUrl).toContain('drive.google.com');
    // Two lists, one page each.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('dedupes by Drive id across both lists (first wins)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/courseWork?')) {
        return jsonResponse({
          courseWork: [{ materials: [{ driveFile: { driveFile: { id: 'FILE_1', title: 'First.pdf' } } }] }],
        });
      }
      return jsonResponse({
        courseWorkMaterial: [{ materials: [{ driveFile: { id: 'FILE_1', title: 'Second.pdf' } }] }],
      });
    }));

    const client = new GoogleClassroomApiClient(tokenProvider);
    const files = await client.fetchCourseDriveFiles('COURSE_1', null);

    expect(files).toHaveLength(1);
    expect(files[0]?.title).toBe('First.pdf');
  });

  it('stops at the page cap and keeps partial results on HTTP errors', async () => {
    let courseWorkCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/courseWork?')) {
        courseWorkCalls += 1;
        if (courseWorkCalls <= 2) {
          // Keep handing out a nextPageToken — the cap must stop the loop.
          return jsonResponse({
            courseWork: [{ materials: [{ driveFile: { driveFile: { id: `FILE_${courseWorkCalls}` } } }] }],
            nextPageToken: `page-${courseWorkCalls}`,
          });
        }
        return jsonResponse({}, false);
      }
      // courseWorkMaterials endpoint errors — partial inventory stands.
      return jsonResponse({}, false);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new GoogleClassroomApiClient(tokenProvider);
    const files = await client.fetchCourseDriveFiles('COURSE_1', null);

    expect(files.map((f) => f.id)).toEqual(['FILE_1', 'FILE_2']);
  });

  it('honors the budget gate before every HTTP call', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ courseWork: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new GoogleClassroomApiClient(tokenProvider, { beforeCall: () => false });
    const files = await client.fetchCourseDriveFiles('COURSE_1', null);

    expect(files).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns nothing when the token provider denies', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    const client = new GoogleClassroomApiClient({ getAccessToken: async () => null });
    const files = await client.fetchCourseDriveFiles('COURSE_1', null);

    expect(files).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('v3/api course-inventory service', () => {
  function makeClient(files: Array<{ id: string; title: string }>, failing = false) {
    return {
      fetchStudentSubmissions: vi.fn(async () => []),
      fetchCourseDriveFiles: vi.fn(async () => {
        if (failing) throw new Error('network gone');
        return files.map((f) => ({
          id: f.id,
          title: f.title,
          downloadUrl: `https://drive.google.com/uc?export=download&id=${f.id}`,
          source: 'driveFile' as const,
        }));
      }),
    };
  }

  it('caches the inventory within the TTL and refetches after it', async () => {
    let now = 1_000;
    const client = makeClient([{ id: 'FILE_1', title: 'A.pdf' }]);
    const service = new CourseInventoryService(client, { now: () => now });

    const first = await service.getInventory('C1', null);
    const second = await service.getInventory('C1', null);
    expect(first?.files).toHaveLength(1);
    expect(second).toBe(first);
    expect(client.fetchCourseDriveFiles).toHaveBeenCalledTimes(1);

    now = 1_000 + INVENTORY_CACHE_TTL_MS + 1;
    const third = await service.getInventory('C1', null);
    expect(third).not.toBe(first);
    expect(client.fetchCourseDriveFiles).toHaveBeenCalledTimes(2);
  });

  it('caches empty inventories too (no API hammering on repeated clicks)', async () => {
    const client = makeClient([]);
    const service = new CourseInventoryService(client);

    const first = await service.getInventory('C1', null);
    const second = await service.getInventory('C1', null);

    expect(first?.files).toEqual([]);
    expect(second).toBe(first);
    expect(client.fetchCourseDriveFiles).toHaveBeenCalledTimes(1);
  });

  it('resolves null on client failure — silent degradation, never throws', async () => {
    const client = makeClient([], true);
    const service = new CourseInventoryService(client);

    await expect(service.getInventory('C1', null)).resolves.toBeNull();
  });
});
