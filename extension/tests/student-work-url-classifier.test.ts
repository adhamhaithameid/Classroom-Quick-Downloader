import { describe, expect, it } from 'vitest';
import {
  addResolverParams,
  buildDriveDownloadUrl,
  extractAuthUserFromClassroomPath,
  extractDriveIdFromClassroomUrl,
  isStudentWorkAttachmentUrl,
  isStudentWorkRoute,
  isStudentWorkViewerPath,
} from '../src/student_work/url-classifier';

describe('student_work/url-classifier', () => {
  describe('isStudentWorkRoute', () => {
    it('matches teacher submissions route', () => {
      expect(isStudentWorkRoute('/c/abc/a/def/submissions')).toBe(true);
    });

    it('matches authuser-prefixed teacher submissions route', () => {
      expect(isStudentWorkRoute('/u/1/c/abc/a/def/submissions')).toBe(true);
    });

    it('matches student submissions route', () => {
      expect(isStudentWorkRoute('/c/abc/a/def/submissions/student-123')).toBe(true);
    });

    it('matches teacher by-status submissions route', () => {
      expect(isStudentWorkRoute('/c/abc/a/def/submissions/by-status/and-sort-name/all/all')).toBe(true);
    });

    it('accepts trailing slash and nested student route segments', () => {
      expect(isStudentWorkRoute('/c/abc/a/def/submissions/student-123/')).toBe(true);
      expect(isStudentWorkRoute('/u/2/c/abc/a/def/submissions/student-123/attachments')).toBe(true);
    });

    it('rejects non-student-work routes', () => {
      expect(isStudentWorkRoute('/c/abc/a/def/details')).toBe(false);
      expect(isStudentWorkRoute('/w/abc/t/all')).toBe(false);
    });
  });

  describe('isStudentWorkViewerPath', () => {
    it('matches /g/tg path variants', () => {
      expect(isStudentWorkViewerPath('/g/tg/course/work/submission')).toBe(true);
      expect(isStudentWorkViewerPath('/u/1/g/tg/course/work/submission')).toBe(true);
    });

    it('rejects non-viewer paths', () => {
      expect(isStudentWorkViewerPath('/drive/file/abc')).toBe(false);
    });
  });

  describe('isStudentWorkAttachmentUrl', () => {
    it('accepts classroom viewer links', () => {
      const url = 'https://classroom.google.com/g/tg/course/work/submission';
      expect(isStudentWorkAttachmentUrl(url)).toBe(true);
    });

    it('accepts authuser-prefixed classroom viewer links', () => {
      const url = 'https://classroom.google.com/u/5/g/tg/course/work/submission';
      expect(isStudentWorkAttachmentUrl(url)).toBe(true);
    });

    it('rejects drive links', () => {
      const url = 'https://drive.google.com/file/d/FILE/view';
      expect(isStudentWorkAttachmentUrl(url)).toBe(false);
    });
  });

  describe('extractDriveIdFromClassroomUrl', () => {
    it('extracts id from id/resourceId/fileId query params', () => {
      expect(
        extractDriveIdFromClassroomUrl('https://classroom.google.com/g/tg/x/y/z?id=FILE_ID_1'),
      ).toBe('FILE_ID_1');
      expect(
        extractDriveIdFromClassroomUrl('https://classroom.google.com/g/tg/x/y/z?resourceId=FILE_ID_2'),
      ).toBe('FILE_ID_2');
      expect(
        extractDriveIdFromClassroomUrl('https://classroom.google.com/g/tg/x/y/z?fileId=FILE_ID_3'),
      ).toBe('FILE_ID_3');
    });

    it('returns null when no drive id params exist', () => {
      expect(
        extractDriveIdFromClassroomUrl('https://classroom.google.com/g/tg/x/y/z?foo=bar'),
      ).toBeNull();
    });

    it('trims extracted values from supported query params', () => {
      expect(
        extractDriveIdFromClassroomUrl('https://classroom.google.com/g/tg/x/y/z?id=%20FILE_TRIM%20'),
      ).toBe('FILE_TRIM');
    });
  });

  it('builds normalized drive download URL', () => {
    const withoutAuth = buildDriveDownloadUrl('FILE123');
    expect(withoutAuth).toBe('https://drive.google.com/uc?export=download&id=FILE123');

    const withAuth = buildDriveDownloadUrl('FILE123', '1');
    expect(withAuth).toBe('https://drive.google.com/uc?export=download&id=FILE123&authuser=1');
  });

  describe('extractAuthUserFromClassroomPath', () => {
    it('extracts authuser from /u/{n} classroom path prefix', () => {
      expect(extractAuthUserFromClassroomPath('/u/1/c/abc/a/def/submissions')).toBe('1');
      expect(extractAuthUserFromClassroomPath('/u/7/g/tg/course/work/submission')).toBe('7');
    });

    it('returns null for non-prefixed paths', () => {
      expect(extractAuthUserFromClassroomPath('/c/abc/a/def/submissions')).toBeNull();
      expect(extractAuthUserFromClassroomPath('/g/tg/course/work/submission')).toBeNull();
    });

    it('returns null for malformed authuser prefixes', () => {
      expect(extractAuthUserFromClassroomPath('/u//c/abc/a/def/submissions')).toBeNull();
      expect(extractAuthUserFromClassroomPath('/u/not-a-number/c/abc/a/def/submissions')).toBeNull();
    });
  });

  it('adds resolver params safely', () => {
    const updated = addResolverParams('https://classroom.google.com/g/tg/a/b/c?x=1', {
      cqd_sw_req: 'req-1',
      cqd_sw_mode: 'iframe',
    });
    expect(updated).toContain('x=1');
    expect(updated).toContain('cqd_sw_req=req-1');
    expect(updated).toContain('cqd_sw_mode=iframe');
  });

  it('overwrites existing resolver params when adding new ones', () => {
    const updated = addResolverParams(
      'https://classroom.google.com/g/tg/a/b/c?cqd_sw_req=old&cqd_sw_mode=popup',
      {
        cqd_sw_req: 'req-2',
        cqd_sw_mode: 'iframe',
      },
    );
    expect(updated).toContain('cqd_sw_req=req-2');
    expect(updated).toContain('cqd_sw_mode=iframe');
    expect(updated).not.toContain('cqd_sw_req=old');
  });
});
