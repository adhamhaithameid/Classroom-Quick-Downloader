import { ViewKind } from '../../types';
import { classifyRoute } from '../../../v2/context/route-classifier';
import type { ClassroomApiRouteContext } from './types';

const SUBMISSIONS_ROUTE_RE =
  /^\/(?:u\/(\d+)\/)?c\/([^/]+)\/a\/([^/]+)\/submissions(?:\/([^/?#]+))?/;

// Classwork routes (csaa.3 phase 1): /w/{courseId}/t/all and /w/{courseId}/t/{topicId}.
// Mirrors the v2 route-classifier's /w/…/t/ pattern; the courseId is the /w/ segment.
const CLASSWORK_ROUTE_RE = /^\/(?:u\/(\d+)\/)?w\/([^/]+)\/t(?:\/([^/?#]+))?(?:\/|$)/;

const TEACHER_SENTINELS = new Set([
  '',
  'by-status',
  'and-sort-name',
]);

function resolveAuthUser(parsed: URL, fromPath: string | undefined): string | null {
  const queryAuthUser = parsed.searchParams.get('authuser') || parsed.searchParams.get('u');
  if (queryAuthUser && queryAuthUser.trim().length > 0) {
    return queryAuthUser.trim();
  }
  if (fromPath && fromPath.trim().length > 0) {
    return fromPath.trim();
  }
  return null;
}

export function resolveClassroomApiRouteContext(
  rawUrl: string,
): ClassroomApiRouteContext | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, window.location.href);
  } catch {
    return null;
  }

  if (parsed.hostname !== 'classroom.google.com') return null;

  const match = parsed.pathname.match(SUBMISSIONS_ROUTE_RE);
  if (match) {
    const [, pathAuthUser, courseId, courseWorkId, tailSegment] = match;
    const normalizedTail = (tailSegment || '').trim();
    const studentSubmissionId = TEACHER_SENTINELS.has(normalizedTail) ? null : normalizedTail || null;

    const classified = classifyRoute(parsed.toString());
    const viewKind = classified === ViewKind.UNKNOWN
      ? (studentSubmissionId ? ViewKind.STUDENT_SUBMISSIONS : ViewKind.STUDENT_WORK_TEACHER)
      : classified;

    return {
      viewKind,
      courseId,
      courseWorkId,
      authUser: resolveAuthUser(parsed, pathAuthUser),
      studentSubmissionId,
    };
  }

  const classworkMatch = parsed.pathname.match(CLASSWORK_ROUTE_RE);
  if (classworkMatch) {
    const [, pathAuthUser, courseId, topicSegment] = classworkMatch;
    const topicId = (topicSegment || '').trim();
    return {
      viewKind: topicId && topicId !== 'all' ? ViewKind.CLASSWORK_TOPIC : ViewKind.CLASSWORK_LIST,
      courseId,
      courseWorkId: '',
      authUser: resolveAuthUser(parsed, pathAuthUser),
      studentSubmissionId: null,
    };
  }

  return null;
}
