import type { ViewKind } from '../../types';

export interface ClassroomApiRouteContext {
  viewKind: ViewKind;
  courseId: string;
  courseWorkId: string;
  authUser: string | null;
  studentSubmissionId: string | null;
}

export interface ClassroomApiAttachment {
  id: string;
  title: string;
  downloadUrl: string;
  source: 'driveFile' | 'link' | 'form';
}

export interface ClassroomApiStudentSubmission {
  id: string;
  userId?: string;
  state?: string;
  attachments: ClassroomApiAttachment[];
}

export interface ClassroomApiSnapshot {
  fetchedAt: number;
  context: ClassroomApiRouteContext;
  submissions: ClassroomApiStudentSubmission[];
}

export interface ClassroomApiTokenProvider {
  getAccessToken(
    interactive?: boolean,
  ): Promise<string | null>;
}

export interface ClassroomApiClient {
  fetchStudentSubmissions(
    context: ClassroomApiRouteContext,
    signal?: AbortSignal,
  ): Promise<ClassroomApiStudentSubmission[]>;
  /**
   * All driveFile attachments across a course's classwork (csaa.3 phase 1):
   * courses.courseWork.list + courses.courseWorkMaterials.list, materials
   * embedded. Deduped by Drive id; downloadUrl already points at the
   * browser-session Drive fetch (zero API quota per download).
   */
  fetchCourseDriveFiles(
    courseId: string,
    authUser: string | null,
    signal?: AbortSignal,
  ): Promise<ClassroomApiAttachment[]>;
}
