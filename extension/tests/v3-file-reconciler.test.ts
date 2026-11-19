// filepath: extension/tests/v3-file-reconciler.test.ts
/**
 * ============================================================================
 * FILE RECONCILER — v3-base API-truth file union (2026-11-18 design)
 * ============================================================================
 *
 * reconcileApiFiles is the pure merge half of the v3-base design ("Target
 * design" §1): the Classroom API snapshot's submission attachments become
 * synthetic FileNodes the V2 engine can merge into a tracked post. Pure
 * module — no DOM writes, no engine coupling; every fallback row of the
 * fallback matrix that ends in "DOM verbatim" pins to [] here:
 *
 *   - snapshot null          → 401/403/offline/quota leave no snapshot
 *   - stale snapshot         → same 120s bound as api-detector.ts:93
 *   - studentSubmissionId null → list view: no post-to-student mapping
 *   - submission absent      → the mapped submission is not in the payload
 *   - zero driveFile rows    → links/forms are not Drive downloads
 *   - id already tracked     → idempotent union (the API adds, never removes)
 *
 * The engine-side wiring is pinned in tests/v3-engine-base-files.test.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_RECONCILE_SNAPSHOT_AGE_MS,
  reconcileApiFiles,
} from '../src/engines/v3/file-reconciler';
import { ViewKind } from '../src/engines/types';
import type { FileNode, PostNode } from '../src/engines/types';
import type { ClassroomApiSnapshot } from '../src/engines/v3/api/types';

const NOW = 1_000_000_000;

function makePost(files: FileNode[] = []): PostNode {
  const element = document.createElement('article');
  element.setAttribute('data-stream-item-id', 'post-1');
  document.body.appendChild(element);
  return {
    id: 'post-1',
    element,
    viewKind: ViewKind.STUDENT_SUBMISSIONS,
    files,
    flags: null,
    lastScannedAt: 0,
  };
}

/** A DOM-discovered Drive file, canonicalized the way engine-v2 does. */
function domFile(driveId: string): FileNode {
  return {
    canonicalId: `drive-${driveId}`,
    name: `${driveId}.pdf`,
    ext: 'pdf',
    downloadUrl: `https://drive.google.com/uc?export=download&id=${driveId}`,
    element: document.createElement('a'),
    idSource: 'data-drive-id',
  };
}

function makeSnapshot(overrides: {
  fetchedAt?: number;
  studentSubmissionId?: string | null;
  submissions?: ClassroomApiSnapshot['submissions'];
} = {}): ClassroomApiSnapshot {
  return {
    fetchedAt: overrides.fetchedAt ?? NOW - 1_000,
    context: {
      viewKind: ViewKind.STUDENT_SUBMISSIONS,
      courseId: 'COURSE_1',
      courseWorkId: 'WORK_1',
      authUser: null,
      studentSubmissionId:
        overrides.studentSubmissionId === undefined
          ? 'SUB_1'
          : overrides.studentSubmissionId,
    },
    submissions:
      overrides.submissions ??
      [
        {
          id: 'SUB_1',
          state: 'TURNED_IN',
          attachments: [
            {
              id: 'FILE_1',
              title: 'report.pdf',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_1',
              source: 'driveFile',
            },
            {
              id: 'link:https://example.com',
              title: 'Course site',
              downloadUrl: 'https://example.com',
              source: 'link',
            },
            {
              id: 'form:https://forms.gle/x',
              title: 'Quiz form',
              downloadUrl: 'https://forms.gle/x',
              source: 'form',
            },
          ],
        },
      ],
  };
}

describe('reconcileApiFiles (v3-base)', () => {
  it('binds the staleness bound to the api-detector bound (120s)', () => {
    expect(MAX_RECONCILE_SNAPSHOT_AGE_MS).toBe(120_000);
  });

  it('maps the mapped submission driveFile attachments to synthetic FileNodes', () => {
    const post = makePost();
    const files = reconcileApiFiles(makeSnapshot(), post, NOW);

    // link/form attachments are not Drive downloads — only driveFile rows.
    expect(files).toHaveLength(1);
    const file = files[0];
    expect(file.canonicalId).toBe('drive-FILE_1');
    expect(file.name).toBe('report.pdf');
    expect(file.ext).toBe('pdf');
    expect(file.downloadUrl).toBe('https://drive.google.com/uc?export=download&id=FILE_1');
    expect(file.idSource).toBe('api-snapshot');
    // Synthetic file: rides the post's download-all flow, anchored to the post.
    expect(file.element).toBe(post.element);
  });

  it('parses a lowercase extension from the title, empty when none', () => {
    const post = makePost();
    const snapshot = makeSnapshot({
      submissions: [
        {
          id: 'SUB_1',
          attachments: [
            {
              id: 'FILE_PDF',
              title: 'Notes.Backup.PDF',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_PDF',
              source: 'driveFile',
            },
            {
              id: 'FILE_NOEXT',
              title: 'Shared archive',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_NOEXT',
              source: 'driveFile',
            },
          ],
        },
      ],
    });

    const files = reconcileApiFiles(snapshot, post, NOW);
    expect(files.map((f) => f.ext)).toEqual(['pdf', '']);
  });

  it('snapshot null → [] (401/403/offline/quota leave the engine snapshotless)', () => {
    const post = makePost();
    expect(reconcileApiFiles(null, post, NOW)).toEqual([]);
  });

  it('stale snapshot (fetchedAt = now - 121_000) → []', () => {
    const post = makePost();
    const snapshot = makeSnapshot({ fetchedAt: NOW - 121_000 });
    expect(reconcileApiFiles(snapshot, post, NOW)).toEqual([]);
  });

  it('studentSubmissionId null (list view) → []', () => {
    const post = makePost();
    const snapshot = makeSnapshot({ studentSubmissionId: null });
    expect(reconcileApiFiles(snapshot, post, NOW)).toEqual([]);
  });

  it('mapped submission absent from the payload → []', () => {
    const post = makePost();
    const snapshot = makeSnapshot({
      submissions: [
        {
          id: 'SUB_OTHER',
          attachments: [
            {
              id: 'FILE_1',
              title: 'report.pdf',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_1',
              source: 'driveFile',
            },
          ],
        },
      ],
    });
    expect(reconcileApiFiles(snapshot, post, NOW)).toEqual([]);
  });

  it('zero driveFile attachments → []', () => {
    const post = makePost();
    const snapshot = makeSnapshot({
      submissions: [
        {
          id: 'SUB_1',
          attachments: [
            {
              id: 'link:https://example.com',
              title: 'Course site',
              downloadUrl: 'https://example.com',
              source: 'link',
            },
          ],
        },
      ],
    });
    expect(reconcileApiFiles(snapshot, post, NOW)).toEqual([]);
  });

  it('attachment id already in post.files → [] (idempotent union)', () => {
    const post = makePost([
      {
        canonicalId: 'FILE_1',
        name: 'report.pdf',
        ext: 'pdf',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_1',
        element: document.createElement('a'),
        idSource: 'api-snapshot',
      },
    ]);
    expect(reconcileApiFiles(makeSnapshot(), post, NOW)).toEqual([]);
  });

  it('Drive id already tracked in its DOM canonical form (drive-<id>) → []', () => {
    // engine-v2 canonicalizes DOM Drive anchors as drive-<id>; the union key
    // is the Drive file id, so a file the DOM already found must not be
    // re-added under its raw API id.
    const post = makePost([domFile('FILE_1')]);
    expect(reconcileApiFiles(makeSnapshot(), post, NOW)).toEqual([]);
  });

  it('returns only the NEW files when some are already tracked', () => {
    const post = makePost([domFile('FILE_1')]);
    const snapshot = makeSnapshot({
      submissions: [
        {
          id: 'SUB_1',
          attachments: [
            {
              id: 'FILE_1',
              title: 'report.pdf',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_1',
              source: 'driveFile',
            },
            {
              id: 'FILE_2',
              title: 'essay.docx',
              downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_2',
              source: 'driveFile',
            },
          ],
        },
      ],
    });

    const files = reconcileApiFiles(snapshot, post, NOW);
    expect(files.map((f) => f.canonicalId)).toEqual(['drive-FILE_2']);
    expect(files[0].idSource).toBe('api-snapshot');
  });

  it('canonical form: DOM-then-API order — a DOM drive-<id> file is never re-added', () => {
    const post = makePost([domFile('FILE_1')]);
    expect(reconcileApiFiles(makeSnapshot(), post, NOW)).toEqual([]);
  });

  it('canonical form: API-then-DOM order — the API file carries the SAME id the DOM scan would produce', () => {
    // API first: the synthetic file joins under drive-<id>. The DOM scan that
    // finds the same Drive anchor later produces canonicalId drive-<id> too,
    // so engine-side dedup on canonicalId collapses them to one file.
    const [api] = reconcileApiFiles(makeSnapshot(), makePost(), NOW);
    expect(api.canonicalId).toBe(domFile('FILE_1').canonicalId);
  });
});
