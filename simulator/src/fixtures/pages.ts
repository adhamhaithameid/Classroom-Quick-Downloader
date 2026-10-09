/**
 * Classroom page registry — Route B serves the REAL captured fixtures from
 * extension/tests/fixtures/classroom (imported verbatim, ?raw). The wrapper
 * CSS in classroom-driver approximates only Classroom's own page chrome;
 * post markup is byte-for-byte the shipped fixture.
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

export interface ClassroomPage {
  id: string;
  label: string;
  note: string;
  html: string;
  rtl?: boolean;
}

export const CLASSROOM_PAGES: ClassroomPage[] = [
  {
    id: 'stream-flagged-post-en',
    label: 'Stream — flagged post (en)',
    note: 'Stream card with edited text and 5 class comments — the flag-pill target.',
    html: streamFlaggedPostEn,
  },
  {
    id: 'classwork-material-post-en',
    label: 'Classwork — material post (en)',
    note: 'Classwork card shape with a material body.',
    html: classworkMaterialPostEn,
  },
  {
    id: 'mixed-links-post-en',
    label: 'Mixed links post (en)',
    note: 'Two downloadable attachments plus unsupported links — the button-state target.',
    html: mixedLinksPostEn,
  },
  {
    id: 'rtl-flagged-post-ar',
    label: 'RTL flagged post (ar)',
    note: 'Arabic RTL card — edge-ribbon anchoring via body[data-cqd-dir="rtl"].',
    html: rtlFlaggedPostAr,
    rtl: true,
  },
  {
    id: 'announcement-detail-en',
    label: 'Announcement detail (en)',
    note: 'Single announcement detail route.',
    html: announcementDetailEn,
  },
  {
    id: 'assignment-details-en',
    label: 'Assignment details (en)',
    note: 'Assignment detail route.',
    html: assignmentDetailsEn,
  },
  {
    id: 'material-details-en',
    label: 'Material details (en)',
    note: 'Material detail route with a data-drive-id attachment.',
    html: materialDetailsEn,
  },
  {
    id: 'student-submissions-en',
    label: 'Student submissions (en)',
    note: 'Student view of their own work.',
    html: studentSubmissionsEn,
  },
  {
    id: 'student-work-teacher-en',
    label: 'Student work — teacher (en)',
    note: 'Teacher submissions shell; its admin buttons must stay untouched.',
    html: studentWorkTeacherEn,
  },
];

export function getClassroomPage(id: string | null | undefined): ClassroomPage | undefined {
  if (!id) return undefined;
  return CLASSROOM_PAGES.find((page) => page.id === id);
}
