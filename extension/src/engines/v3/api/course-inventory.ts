// filepath: extension/src/engines/v3/api/course-inventory.ts
/**
 * ============================================================================
 * COURSE INVENTORY — the enumeration behind "Download All Classroom" (csaa.6)
 * ============================================================================
 *
 * One entry point for "every downloadable file in this course": the client's
 * courseWork.list + courseWorkMaterials.list driveFile set, gated by the
 * csaa.5 rate limiter (per-HTTP-call accounting inside the client) and
 * cached for 5 minutes (csaa.5: classwork lists change slowly).
 *
 * Failure contract (R7): every failure mode — no token, no budget, HTTP
 * error, abort — resolves to a partial or null inventory. It never throws
 * at the caller and never blocks rendering.
 */

import type { ClassroomApiAttachment, ClassroomApiClient } from './types';

export interface CourseInventoryFile {
  driveId: string;
  title: string;
  downloadUrl: string;
}

export interface CourseInventory {
  fetchedAt: number;
  courseId: string;
  files: CourseInventoryFile[];
}

/** csaa.5: classwork lists cached longer than the 120s submissions snapshot. */
export const INVENTORY_CACHE_TTL_MS = 300_000;

export class CourseInventoryService {
  private client: ClassroomApiClient;
  private cache = new Map<string, CourseInventory>();
  private ttlMs: number;
  private now: () => number;

  constructor(
    client: ClassroomApiClient,
    options: { ttlMs?: number; now?: () => number } = {},
  ) {
    this.client = client;
    this.ttlMs = options.ttlMs ?? INVENTORY_CACHE_TTL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  async getInventory(
    courseId: string,
    authUser: string | null,
    signal?: AbortSignal,
  ): Promise<CourseInventory | null> {
    const cached = this.cache.get(courseId);
    if (cached && this.now() - cached.fetchedAt <= this.ttlMs) return cached;
    this.cache.delete(courseId);

    let attachments: ClassroomApiAttachment[];
    try {
      attachments = await this.client.fetchCourseDriveFiles(courseId, authUser, signal);
    } catch {
      return null;
    }
    if (signal?.aborted) return null;

    const inventory: CourseInventory = {
      fetchedAt: this.now(),
      courseId,
      files: attachments.map((attachment) => ({
        driveId: attachment.id,
        title: attachment.title,
        downloadUrl: attachment.downloadUrl,
      })),
    };
    // An empty inventory is cached too — repeated clicks must not hammer
    // the API when the course genuinely has no Drive files.
    this.cache.set(courseId, inventory);
    return inventory;
  }

  clear(): void {
    this.cache.clear();
  }
}
