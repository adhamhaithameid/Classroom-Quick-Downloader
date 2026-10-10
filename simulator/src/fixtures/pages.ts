/**
 * Classroom page registry — Route B serves the REAL captured fixtures from
 * extension/tests/fixtures/classroom (imported verbatim, ?raw). The wrapper
 * CSS in page-html.ts approximates only Classroom's own page chrome; post
 * markup is byte-for-byte the shipped fixture.
 *
 * Route B loads each page from a same-origin URL served by the dev server
 * (`/sim/classroom/<id>.html`, see page-html.ts + vite.config.ts) so
 * `iframe.contentDocument` stays readable for Annotate mode.
 */

import streamFlaggedPostEn from '../../../extension/tests/fixtures/classroom/stream-flagged-post-en.html?raw';
import classworkMaterialPostEn from '../../../extension/tests/fixtures/classroom/classwork-material-post-en.html?raw';
import mixedLinksPostEn from '../../../extension/tests/fixtures/classroom/mixed-links-post-en.html?raw';
import rtlFlaggedPostAr from '../../../extension/tests/fixtures/classroom/rtl-flagged-post-ar.html?raw';
import announcementDetailEn from '../../../extension/tests/fixtures/classroom/announcement-detail-en.html?raw';
import assignmentDetailsEn from '../../../extension/tests/fixtures/classroom/assignment-details-en.html?raw';
import materialDetailsEn from '../../../extension/tests/fixtures/classroom/material-details-en.html?raw';
import studentSubmissionsEn from '../../../extension/tests/fixtures/classroom/student-submissions-en.html?raw';
import studentWorkTeacherEn from '../../../extension/tests/fixtures/classroom/student-work-teacher-en.html?raw';
import { CLASSROOM_PAGE_META, type ClassroomPageMeta } from './page-html';

export type { ClassroomPageMeta } from './page-html';

export interface ClassroomPage extends ClassroomPageMeta {
  html: string;
}

const HTML_BY_ID: Record<string, string> = {
  'stream-flagged-post-en': streamFlaggedPostEn,
  'classwork-material-post-en': classworkMaterialPostEn,
  'mixed-links-post-en': mixedLinksPostEn,
  'rtl-flagged-post-ar': rtlFlaggedPostAr,
  'announcement-detail-en': announcementDetailEn,
  'assignment-details-en': assignmentDetailsEn,
  'material-details-en': materialDetailsEn,
  'student-submissions-en': studentSubmissionsEn,
  'student-work-teacher-en': studentWorkTeacherEn,
};

export const CLASSROOM_PAGES: ClassroomPage[] = CLASSROOM_PAGE_META.map((meta) => ({
  ...meta,
  html: HTML_BY_ID[meta.id] ?? '',
}));

export function getClassroomPage(id: string | null | undefined): ClassroomPage | undefined {
  if (!id) return undefined;
  return CLASSROOM_PAGES.find((page) => page.id === id);
}
