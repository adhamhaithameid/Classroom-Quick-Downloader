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
import { sanitizeFileName } from '../src/core/name/sanitize';
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
    // Converted to the DOM path's byte-serving endpoint (union-3 #3).
    expect(file.downloadUrl).toBe(
      'https://drive.usercontent.google.com/download?id=FILE_1&export=download&confirm=t',
    );
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

  // ---- review-fixes-union-2 (findings 4, 5, 6) ----

  function snapshotWith(
    attachments: Array<{ id: string; title: string; downloadUrl: string }>,
  ): ClassroomApiSnapshot {
    return makeSnapshot({
      submissions: [
        {
          id: 'SUB_1',
          attachments: attachments.map((a) => ({ ...a, source: 'driveFile' as const })),
        },
      ],
    });
  }

  it('drops rows whose downloadUrl fails the download security gate (finding 4)', () => {
    const snapshot = snapshotWith([
      { id: 'EVIL_1', title: 'a.pdf', downloadUrl: 'https://evil.example.com/a.pdf' },
      { id: 'HTTP_1', title: 'b.pdf', downloadUrl: 'http://drive.google.com/uc?id=HTTP_1' },
      { id: 'JS_1', title: 'c.pdf', downloadUrl: 'javascript:alert(1)' },
      { id: 'EMPTY_1', title: 'd.pdf', downloadUrl: '' },
      {
        id: 'GOOD_1',
        title: 'e.pdf',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=GOOD_1',
      },
    ]);
    const files = reconcileApiFiles(snapshot, makePost(), NOW);
    expect(files.map((f) => f.canonicalId)).toEqual(['drive-GOOD_1']);
  });

  it('sanitizes the API title like a DOM name (finding 5)', () => {
    const snapshot = snapshotWith([
      {
        id: 'FILE_9',
        title: '../../etc/passwd.pdf',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=FILE_9',
      },
    ]);
    const [file] = reconcileApiFiles(snapshot, makePost(), NOW);
    expect(file.name).toBe(sanitizeFileName('../../etc/passwd.pdf'));
    expect(file.name).not.toMatch(/[/\\]/);
  });

  it('an API id that already starts with drive- is still prefixed, never collides with a DOM id (finding 6)', () => {
    // DOM file for Drive id X has canonicalId drive-X. An API attachment whose
    // raw id is literally "drive-X" is a DIFFERENT Drive file (drive-drive-X).
    const post = makePost([domFile('X1234567890')]);
    const snapshot = snapshotWith([
      {
        id: 'drive-X1234567890',
        title: 'other.pdf',
        downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-X1234567890',
      },
    ]);
    const files = reconcileApiFiles(snapshot, post, NOW);
    expect(files.map((f) => f.canonicalId)).toEqual(['drive-drive-X1234567890']);
  });
  // ---- review-fixes-union-3 (findings 1, 2, 3, 5) ----

  it('falls back to Untitled when the title sanitizes to empty, like the DOM path (union-3 #1)', () => {
    const snapshot = snapshotWith([
      { id: 'DOTS_1', title: '...', downloadUrl: 'https://drive.google.com/uc?export=download&id=DOTS_1' },
      { id: 'SLASH_1', title: '/', downloadUrl: 'https://drive.google.com/uc?export=download&id=SLASH_1' },
    ]);
    const files = reconcileApiFiles(snapshot, makePost(), NOW);
    expect(files.map((f) => f.name)).toEqual(['Untitled', 'Untitled']);
  });

  it('dedupes against a DOM file whose canonical is url-/dataid- but whose download URL carries the Drive id (union-3 #2)', () => {
    const usercontent = 'https://drive.usercontent.google.com/download?id=FILE_1&export=download&confirm=t';
    const urlShaped: FileNode = {
      canonicalId: 'url-https://drive.google.com/open?id=FILE_1',
      name: 'report.pdf',
      ext: 'pdf',
      downloadUrl: usercontent,
      element: document.createElement('a'),
      idSource: 'url-hash',
    };
    const dataidShaped: FileNode = { ...urlShaped, canonicalId: 'dataid-9-3', idSource: 'data-id-combo' };
    expect(reconcileApiFiles(makeSnapshot(), makePost([urlShaped]), NOW)).toEqual([]);
    expect(reconcileApiFiles(makeSnapshot(), makePost([dataidShaped]), NOW)).toEqual([]);
  });

  it('a non-Google DOM url with the same id= query does NOT suppress the API file (union-3 #2)', () => {
    const foreign: FileNode = {
      canonicalId: 'url-https://example.com/x?id=FILE_1',
      name: 'x',
      ext: '',
      downloadUrl: 'https://example.com/x?id=FILE_1',
      element: document.createElement('a'),
      idSource: 'url-hash',
    };
    expect(reconcileApiFiles(makeSnapshot(), makePost([foreign]), NOW)).toHaveLength(1);
  });

  it('converts the API url to the same byte-serving endpoint the DOM path uses (union-3 #3)', () => {
    const [file] = reconcileApiFiles(makeSnapshot(), makePost(), NOW);
    expect(file.downloadUrl).toBe(
      'https://drive.usercontent.google.com/download?id=FILE_1&export=download&confirm=t',
    );
  });

  it('carries a numeric authuser into the converted url, drops a non-numeric one (union-3 #3, #5)', () => {
    const withAuth = (authUser: string | null) => {
      const snap = makeSnapshot();
      snap.context.authUser = authUser;
      return reconcileApiFiles(snap, makePost(), NOW);
    };
    expect(withAuth('1')[0].downloadUrl).toBe(
      'https://drive.usercontent.google.com/download?id=FILE_1&export=download&confirm=t&authuser=1',
    );
    // '..' or '%25' in the query authuser must not make the validator drop the file.
    const bad = withAuth('../x%25');
    expect(bad).toHaveLength(1);
    expect(bad[0].downloadUrl).toBe(
      'https://drive.usercontent.google.com/download?id=FILE_1&export=download&confirm=t',
    );
  });
});
