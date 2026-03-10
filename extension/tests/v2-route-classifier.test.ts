// filepath: extension/tests/v2-route-classifier.test.ts
/**
 * ============================================================================
 * V2 ROUTE CLASSIFIER TESTS — URL → ViewKind Mapping
 * ============================================================================
 *
 * Tests for the route classifier that maps Google Classroom URLs
 * to ViewKind enum values. This is critical — if the classifier
 * mis-classifies a page, the engine will use wrong selectors.
 *
 * @author Adham — testing ALL the URL patterns I could find 🤞🏻
 * @since v4.0.0
 */

import { describe, it, expect } from 'vitest';
import { classifyRoute, isClassroomUrl } from '../src/v2/context/route-classifier';

describe('classifyRoute', () => {
  // Stream view
  it('classifies /c/{id} as stream', () => {
    expect(classifyRoute('https://classroom.google.com/c/MTIz')).toBe('stream');
  });

  it('classifies /u/0/c/{id} as stream (multi-account)', () => {
    expect(classifyRoute('https://classroom.google.com/u/0/c/MTIz')).toBe('stream');
  });

  it('classifies /u/2/c/{id} as stream (third account)', () => {
    expect(classifyRoute('https://classroom.google.com/u/2/c/MTIz')).toBe('stream');
  });

  // Classwork list
  it('classifies /w/{id}/t/all as classwork_list', () => {
    expect(classifyRoute('https://classroom.google.com/w/MTIz/t/all')).toBe('classwork_list');
  });

  it('classifies /u/0/w/{id}/t/all as classwork_list', () => {
    expect(classifyRoute('https://classroom.google.com/u/0/w/MTIz/t/all')).toBe('classwork_list');
  });

  // Topic view
  it('classifies /w/{id}/tc/{topicId} as classwork_topic', () => {
    expect(classifyRoute('https://classroom.google.com/w/MTIz/tc/topic1')).toBe('classwork_topic');
  });

  // Assignment details
  it('classifies /c/{id}/a/{itemId}/details as assignment_details', () => {
    expect(classifyRoute('https://classroom.google.com/c/MTIz/a/itemABC/details')).toBe('assignment_details');
  });

  // Material details
  it('classifies /c/{id}/m/{itemId}/details as material_details', () => {
    expect(classifyRoute('https://classroom.google.com/c/MTIz/m/itemXYZ/details')).toBe('material_details');
  });

  // Student work teacher view
  it('classifies /c/{id}/a/{itemId}/submissions as student_work_teacher', () => {
    expect(classifyRoute('https://classroom.google.com/c/MTIz/a/item1/submissions')).toBe('student_work_teacher');
  });

  // Student submissions (individual)
  it('classifies /c/{id}/a/{item}/submissions/{studentId} as student_submissions', () => {
    expect(classifyRoute('https://classroom.google.com/c/MTIz/a/item1/submissions/student1')).toBe('student_submissions');
  });

  // Announcement detail
  it('classifies /c/{id}/p/{postId} as announcement_detail', () => {
    expect(classifyRoute('https://classroom.google.com/c/MTIz/p/post123')).toBe('announcement_detail');
  });

  // Unknown routes
  it('returns unknown for unrecognized Classroom paths', () => {
    expect(classifyRoute('https://classroom.google.com/settings')).toBe('unknown');
  });

  it('returns unknown for non-Classroom URLs', () => {
    expect(classifyRoute('https://google.com/search')).toBe('unknown');
  });

  it('returns unknown for blank page', () => {
    expect(classifyRoute('about:blank')).toBe('unknown');
  });
});

describe('isClassroomUrl', () => {
  it('returns true for classroom.google.com URLs', () => {
    expect(isClassroomUrl('https://classroom.google.com/c/MTIz')).toBe(true);
    expect(isClassroomUrl('https://classroom.google.com/u/0/c/MTIz')).toBe(true);
  });

  it('returns false for non-Classroom URLs', () => {
    expect(isClassroomUrl('https://google.com')).toBe(false);
    expect(isClassroomUrl('https://drive.google.com')).toBe(false);
    expect(isClassroomUrl('about:blank')).toBe(false);
  });
});

// this feels so clean