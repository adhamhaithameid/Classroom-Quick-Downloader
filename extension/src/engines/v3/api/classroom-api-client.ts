import { buildDriveDownloadUrl } from '../../../student_work/url-classifier';
import type {
  ClassroomApiAttachment,
  ClassroomApiClient,
  ClassroomApiRouteContext,
  ClassroomApiStudentSubmission,
  ClassroomApiTokenProvider,
} from './types';

const CLASSROOM_API_BASE_URL = 'https://classroom.googleapis.com/v1';
const DEFAULT_PAGE_SIZE = 200;
/** csaa.5: hard cap of pages per list call (quota guard, not correctness). */
const MAX_LIST_PAGES = 3;
const LIST_PAGE_SIZE = 100;

interface GoogleClassroomStudentSubmissionResponse {
  studentSubmissions?: GoogleClassroomSubmission[];
  nextPageToken?: string;
}

/** Materials union on courseWork/courseWorkMaterials. csaa.2: courseWork nests
 *  the Drive file under SharedDriveFile (`driveFile.driveFile.id`); older flat
 *  shapes are accepted defensively. */
interface GoogleClassroomMaterial {
  driveFile?: {
    driveFile?: { id?: string; title?: string };
    id?: string;
    title?: string;
  };
  link?: { url?: string; title?: string };
  form?: { formUrl?: string; title?: string };
}

interface GoogleClassroomMaterialListResponse {
  courseWork?: { id?: string; title?: string; materials?: GoogleClassroomMaterial[] }[];
  courseWorkMaterial?: { id?: string; title?: string; materials?: GoogleClassroomMaterial[] }[];
  nextPageToken?: string;
}

interface GoogleClassroomAttachment {
  driveFile?: {
    id?: string;
    title?: string;
    alternateLink?: string;
  };
  link?: {
    url?: string;
    title?: string;
  };
  form?: {
    formUrl?: string;
    title?: string;
  };
}

interface GoogleClassroomSubmission {
  id?: string;
  userId?: string;
  state?: string;
  assignmentSubmission?: {
    attachments?: GoogleClassroomAttachment[];
  };
}

function normalizeAttachment(
  raw: GoogleClassroomAttachment,
  authUser: string | null,
): ClassroomApiAttachment | null {
  const driveId = raw?.driveFile?.id?.trim() || '';
  if (driveId) {
    return {
      id: driveId,
      title: raw?.driveFile?.title?.trim() || `drive-${driveId}`,
      downloadUrl: buildDriveDownloadUrl(driveId, authUser),
      source: 'driveFile',
    };
  }

  const linkUrl = raw?.link?.url?.trim() || '';
  if (linkUrl) {
    return {
      id: `link:${linkUrl}`,
      title: raw?.link?.title?.trim() || linkUrl,
      downloadUrl: linkUrl,
      source: 'link',
    };
  }

  const formUrl = raw?.form?.formUrl?.trim() || '';
  if (formUrl) {
    return {
      id: `form:${formUrl}`,
      title: raw?.form?.title?.trim() || formUrl,
      downloadUrl: formUrl,
      source: 'form',
    };
  }

  return null;
}

function mapSubmission(
  raw: GoogleClassroomSubmission,
  authUser: string | null,
): ClassroomApiStudentSubmission | null {
  const submissionId = (raw?.id || '').trim();
  if (!submissionId) return null;

  const attachments = (raw?.assignmentSubmission?.attachments || [])
    .map((attachment) => normalizeAttachment(attachment, authUser))
    .filter((attachment): attachment is ClassroomApiAttachment => !!attachment);

  return {
    id: submissionId,
    userId: raw?.userId?.trim() || undefined,
    state: raw?.state?.trim() || undefined,
    attachments,
  };
}

export interface ClassroomApiClientOptions {
  /**
   * Budget gate consulted before EVERY HTTP call (initial + pagination
   * pages). False → the call is skipped and whatever was collected so far
   * is returned (csaa.5: silent degradation, never a thrown error).
   */
  beforeCall?: () => boolean;
}

export class GoogleClassroomApiClient implements ClassroomApiClient {
  private tokenProvider: ClassroomApiTokenProvider;
  private beforeCall: (() => boolean) | null;

  constructor(
    tokenProvider: ClassroomApiTokenProvider,
    options: ClassroomApiClientOptions = {},
  ) {
    this.tokenProvider = tokenProvider;
    this.beforeCall = options.beforeCall ?? null;
  }

  private budgetAvailable(): boolean {
    return !this.beforeCall || this.beforeCall();
  }

  async fetchStudentSubmissions(
    context: ClassroomApiRouteContext,
    signal?: AbortSignal,
  ): Promise<ClassroomApiStudentSubmission[]> {
    const token = await this.tokenProvider.getAccessToken(false);
    if (!token) return [];

    const submissions: ClassroomApiStudentSubmission[] = [];
    let pageToken: string | null = null;
    let pageGuard = 0;

    while (pageGuard < 10) {
      pageGuard += 1;
      if (!this.budgetAvailable()) return submissions;
      const requestUrl = new URL(
        `${CLASSROOM_API_BASE_URL}/courses/${encodeURIComponent(context.courseId)}/courseWork/${encodeURIComponent(context.courseWorkId)}/studentSubmissions`,
      );
      requestUrl.searchParams.set('pageSize', String(DEFAULT_PAGE_SIZE));
      if (context.studentSubmissionId) {
        requestUrl.searchParams.set('states', 'TURNED_IN');
      }
      if (pageToken) requestUrl.searchParams.set('pageToken', pageToken);

      const response = await fetch(requestUrl.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });
      if (!response.ok) {
        return submissions;
      }

      const payload = await response.json() as GoogleClassroomStudentSubmissionResponse;
      const batch = (payload.studentSubmissions || [])
        .map((submission) => mapSubmission(submission, context.authUser))
        .filter((submission): submission is ClassroomApiStudentSubmission => !!submission);

      submissions.push(...batch);
      if (!payload.nextPageToken) break;
      pageToken = payload.nextPageToken;
    }

    if (context.studentSubmissionId) {
      return submissions.filter((submission) => submission.id === context.studentSubmissionId);
    }

    return submissions;
  }

  /**
   * courseWork.list + courseWorkMaterials.list, materials embedded, driveFile
   * only (links/forms/youtube are not files), deduped by Drive id (first
   * wins). Paginated with a hard page cap (csaa.5); any non-OK response
   * yields the partial list — silent degradation per R7.
   */
  async fetchCourseDriveFiles(
    courseId: string,
    authUser: string | null,
    signal?: AbortSignal,
  ): Promise<ClassroomApiAttachment[]> {
    const token = await this.tokenProvider.getAccessToken(false);
    if (!token) return [];

    const byId = new Map<string, ClassroomApiAttachment>();
    const collect = (materials: GoogleClassroomMaterial[] | undefined) => {
      for (const material of materials || []) {
        const driveId = material?.driveFile?.driveFile?.id?.trim() || material?.driveFile?.id?.trim() || '';
        if (!driveId || byId.has(driveId)) continue;
        byId.set(driveId, {
          id: driveId,
          title: material?.driveFile?.driveFile?.title?.trim()
            || material?.driveFile?.title?.trim()
            || `drive-${driveId}`,
          downloadUrl: buildDriveDownloadUrl(driveId, authUser),
          source: 'driveFile',
        });
      }
    };

    const listAll = async (
      path: 'courseWork' | 'courseWorkMaterials',
      collectionKey: 'courseWork' | 'courseWorkMaterial',
    ): Promise<void> => {
      let pageToken: string | null = null;
      for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
        if (!this.budgetAvailable()) return;
        const requestUrl = new URL(
          `${CLASSROOM_API_BASE_URL}/courses/${encodeURIComponent(courseId)}/${path}`,
        );
        requestUrl.searchParams.set('pageSize', String(LIST_PAGE_SIZE));
        if (pageToken) requestUrl.searchParams.set('pageToken', pageToken);

        const response = await fetch(requestUrl.toString(), {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          signal,
        });
        if (!response.ok) return;

        const payload = await response.json() as GoogleClassroomMaterialListResponse;
        for (const item of payload[collectionKey] || []) collect(item?.materials);
        if (!payload.nextPageToken) return;
        pageToken = payload.nextPageToken;
      }
    };

    await listAll('courseWork', 'courseWork');
    await listAll('courseWorkMaterials', 'courseWorkMaterial');

    return Array.from(byId.values());
  }
}
