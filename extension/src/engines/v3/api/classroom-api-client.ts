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

interface GoogleClassroomStudentSubmissionResponse {
  studentSubmissions?: GoogleClassroomSubmission[];
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

export class GoogleClassroomApiClient implements ClassroomApiClient {
  private tokenProvider: ClassroomApiTokenProvider;

  constructor(tokenProvider: ClassroomApiTokenProvider) {
    this.tokenProvider = tokenProvider;
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
}
