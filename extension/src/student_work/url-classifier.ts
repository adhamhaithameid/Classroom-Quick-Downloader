// filepath: extension/src/student_work/url-classifier.ts

const STUDENT_WORK_ROUTE_RE = /^\/(?:u\/\d+\/)?c\/[^/]+\/a\/[^/]+\/submissions(?:\/[^?#]+)*\/?$/;
const STUDENT_WORK_VIEWER_RE = /^\/(?:u\/\d+\/)?g\/tg\//;
const AUTHUSER_PATH_RE = /^\/u\/(\d+)(?:\/|$)/;

const DRIVE_ID_PARAM_KEYS = ['id', 'resourceId', 'fileId'] as const;

export function isStudentWorkRoute(pathname: string): boolean {
  return STUDENT_WORK_ROUTE_RE.test(pathname);
}

export function isStudentWorkViewerPath(pathname: string): boolean {
  return STUDENT_WORK_VIEWER_RE.test(pathname);
}

export function isStudentWorkAttachmentUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    return parsed.hostname === 'classroom.google.com' && isStudentWorkViewerPath(parsed.pathname);
  } catch {
    return false;
  }
}

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
  const match = AUTHUSER_PATH_RE.exec(pathname);
  if (!match) return null;
  const authUser = match[1]?.trim();
  return authUser && authUser.length > 0 ? authUser : null;
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
