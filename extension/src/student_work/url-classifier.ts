// filepath: extension/src/student_work/url-classifier.ts

const AUTHUSER_SEGMENT_RE = /^\d+$/;

const DRIVE_ID_PARAM_KEYS = ['id', 'resourceId', 'fileId'] as const;

function splitPathSegments(pathname: string): string[] {
  return pathname.split('/').filter((segment) => segment.length > 0);
}

function stripAuthUserPrefix(pathname: string): string[] | null {
  const segments = splitPathSegments(pathname);
  if (segments[0] !== 'u') return segments;
  const authUser = segments[1];
  if (!authUser || !AUTHUSER_SEGMENT_RE.test(authUser)) return null;
  return segments.slice(2);
}

function hasStudentWorkBasePath(segments: string[]): boolean {
  if (segments.length < 5) return false;
  if (segments[0] !== 'c') return false;
  if (segments[2] !== 'a') return false;
  if (segments[4] !== 'submissions') return false;
  return segments[1].length > 0 && segments[3].length > 0;
}

export function isStudentWorkRoute(pathname: string): boolean {
  const segments = stripAuthUserPrefix(pathname);
  if (!segments) return false;
  return hasStudentWorkBasePath(segments);
}

export function isStudentWorkByStatusRoute(pathname: string): boolean {
  const segments = stripAuthUserPrefix(pathname);
  if (!segments || !hasStudentWorkBasePath(segments)) return false;
  return (
    segments.length === 9 &&
    segments[5] === 'by-status' &&
    segments[6] === 'and-sort-name' &&
    segments[7].length > 0 &&
    segments[8].length > 0
  );
}

export function isStudentWorkViewerPath(pathname: string): boolean {
  const segments = stripAuthUserPrefix(pathname);
  if (!segments) return false;
  return segments[0] === 'g' && segments[1] === 'tg';
}

export function isStudentWorkAttachmentUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    return parsed.hostname === 'classroom.google.com' && isStudentWorkViewerPath(parsed.pathname);
  } catch {
    return false;
  }
}

// literally just extracting an ID, why is it this complicated
export function extractDriveIdFromClassroomUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl, window.location.href);

    for (const key of DRIVE_ID_PARAM_KEYS) {
      const value = parsed.searchParams.get(key);
      if (value && value.trim().length > 0) return value.trim();
    }

    return null;
  } catch {
    return null;
  }
}

export function buildDriveDownloadUrl(fileId: string, authUser?: string | null): string {
  const url = new URL('https://drive.google.com/uc');
  url.searchParams.set('export', 'download');
  url.searchParams.set('id', fileId);
  if (authUser && authUser.trim().length > 0) {
    url.searchParams.set('authuser', authUser.trim());
  }
  return url.toString();
}

export function extractAuthUserFromClassroomPath(pathname: string): string | null {
  const segments = splitPathSegments(pathname);
  if (segments[0] !== 'u') return null;
  const authUser = segments[1]?.trim() ?? '';
  return AUTHUSER_SEGMENT_RE.test(authUser) ? authUser : null;
}

export function addResolverParams(
  rawUrl: string,
  params: Record<string, string>,
): string {
  const parsed = new URL(rawUrl, window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    parsed.searchParams.set(key, value);
  });
  return parsed.toString();
}
