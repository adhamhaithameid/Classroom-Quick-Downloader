import { describe, expect, it } from 'vitest';
import { ViewKind } from '../src/engines/types';
import { resolveClassroomApiRouteContext } from '../src/engines/v3/api/route-context';

describe('v3/api/route-context', () => {
  it('parses teacher by-status route context', () => {
    const context = resolveClassroomApiRouteContext(
      'https://classroom.google.com/c/COURSE_1/a/WORK_1/submissions/by-status/and-sort-name/all/all',
    );

    expect(context).not.toBeNull();
    expect(context?.courseId).toBe('COURSE_1');
    expect(context?.courseWorkId).toBe('WORK_1');
    expect(context?.studentSubmissionId).toBeNull();
    expect(context?.viewKind).toBe(ViewKind.STUDENT_WORK_TEACHER);
  });

  it('parses individual student submission route context', () => {
    const context = resolveClassroomApiRouteContext(
      'https://classroom.google.com/u/3/c/COURSE_2/a/WORK_2/submissions/STUDENT_SUB_77?authuser=8',
    );

    expect(context).not.toBeNull();
    expect(context?.courseId).toBe('COURSE_2');
    expect(context?.courseWorkId).toBe('WORK_2');
    expect(context?.studentSubmissionId).toBe('STUDENT_SUB_77');
    expect(context?.authUser).toBe('8');
    expect(context?.viewKind).toBe(ViewKind.STUDENT_SUBMISSIONS);
  });

  it('returns null for non-student-work routes', () => {
    const context = resolveClassroomApiRouteContext(
      'https://classroom.google.com/c/COURSE_3/a/WORK_3/details',
    );
    expect(context).toBeNull();
  });

  // ------------------------------------------------------------------
  // csaa.3 phase 1: classwork routes resolve for the course inventory
  // ------------------------------------------------------------------

  it('resolves the classwork list route to a course context', () => {
    const context = resolveClassroomApiRouteContext(
      'https://classroom.google.com/w/COURSE_9/t/all',
    );

    expect(context).not.toBeNull();
    expect(context?.courseId).toBe('COURSE_9');
    expect(context?.courseWorkId).toBe('');
    expect(context?.studentSubmissionId).toBeNull();
    expect(context?.viewKind).toBe(ViewKind.CLASSWORK_LIST);
  });

  it('resolves a classwork topic route', () => {
    const context = resolveClassroomApiRouteContext(
      'https://classroom.google.com/u/1/w/COURSE_9/t/TOPIC_4?authuser=2',
    );

    expect(context).not.toBeNull();
    expect(context?.courseId).toBe('COURSE_9');
    expect(context?.viewKind).toBe(ViewKind.CLASSWORK_TOPIC);
    expect(context?.authUser).toBe('2');
  });

  it('keeps submissions precedence over the classwork pattern', () => {
    const context = resolveClassroomApiRouteContext(
      'https://classroom.google.com/u/1/c/COURSE_1/a/WORK_1/submissions/by-status/and-sort-name/all/all',
    );

    expect(context?.viewKind).toBe(ViewKind.STUDENT_WORK_TEACHER);
    expect(context?.courseWorkId).toBe('WORK_1');
  });

  it('still rejects routes that match neither pattern', () => {
    expect(
      resolveClassroomApiRouteContext('https://classroom.google.com/c/COURSE_1'),
    ).toBeNull();
    expect(
      resolveClassroomApiRouteContext('https://example.com/w/COURSE_1/t/all'),
    ).toBeNull();
  });
});
