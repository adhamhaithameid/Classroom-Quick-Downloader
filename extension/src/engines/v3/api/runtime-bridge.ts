import type { ClassroomApiSnapshot } from './types';

export interface PublishedStudentWorkApiAttachment {
  id: string;
  title: string;
  downloadUrl: string;
  submissionId: string;
  userId?: string;
  state?: string;
  normalizedTitle: string;
  normalizedExt: string;
}

export interface PublishedStudentWorkApiSnapshot {
  publishedAt: number;
  courseId: string;
  courseWorkId: string;
  studentSubmissionId: string | null;
  attachments: PublishedStudentWorkApiAttachment[];
}

const STUDENT_WORK_API_SNAPSHOT_KEY = '__CQD_SW_API_SNAPSHOT_V1';
const MAX_DEFAULT_AGE_MS = 120_000;

declare global {
  interface Window {
    [STUDENT_WORK_API_SNAPSHOT_KEY]?: PublishedStudentWorkApiSnapshot;
  }
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function deriveNormalizedExt(title: string): string {
  const extMatch = title.match(/\.([a-zA-Z0-9]{2,10})$/);
  return extMatch?.[1]?.toLowerCase() || '';
}

export function publishStudentWorkApiSnapshot(snapshot: ClassroomApiSnapshot | null): void {
  if (typeof window === 'undefined') return;

  if (!snapshot) {
    delete window[STUDENT_WORK_API_SNAPSHOT_KEY];
    return;
  }

  const attachments: PublishedStudentWorkApiAttachment[] = [];
  const seen = new Set<string>();

  for (const submission of snapshot.submissions) {
    for (const attachment of submission.attachments) {
      const key = `${submission.id}::${attachment.id}::${attachment.downloadUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const normalizedTitle = normalizeToken(attachment.title || attachment.id);
      attachments.push({
        id: attachment.id,
        title: attachment.title || attachment.id,
        downloadUrl: attachment.downloadUrl,
        submissionId: submission.id,
        userId: submission.userId,
        state: submission.state,
        normalizedTitle,
        normalizedExt: deriveNormalizedExt(attachment.title || ''),
      });
    }
  }

  window[STUDENT_WORK_API_SNAPSHOT_KEY] = {
    publishedAt: Date.now(),
    courseId: snapshot.context.courseId,
    courseWorkId: snapshot.context.courseWorkId,
    studentSubmissionId: snapshot.context.studentSubmissionId,
    attachments,
  };
}

export function readPublishedStudentWorkApiSnapshot(
  maxAgeMs = MAX_DEFAULT_AGE_MS,
): PublishedStudentWorkApiSnapshot | null {
  if (typeof window === 'undefined') return null;
  const snapshot = window[STUDENT_WORK_API_SNAPSHOT_KEY];
  if (!snapshot) return null;
  if (Date.now() - snapshot.publishedAt > maxAgeMs) {
    delete window[STUDENT_WORK_API_SNAPSHOT_KEY];
    return null;
  }
  return snapshot;
}
