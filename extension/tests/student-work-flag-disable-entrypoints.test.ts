import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('student-work flag-disable entrypoint guards', () => {
  const commentEntryPath = resolve(process.cwd(), 'entrypoints/comment_frame.content.ts');
  const editedEntryPath = resolve(process.cwd(), 'entrypoints/edited_frame.content.ts');
  const commentSource = readFileSync(commentEntryPath, 'utf-8');
  const editedSource = readFileSync(editedEntryPath, 'utf-8');

  it('comment flag script checks student-work route and exits with cleanup', () => {
    expect(commentSource).toContain("import { isStudentWorkRoute } from '../src/student_work/url-classifier'");
    expect(commentSource).toContain('if (isStudentWorkPage()) {');
    expect(commentSource).toContain('removeCommentArtifacts();');
  });

  it('edited flag script checks student-work route and exits with cleanup', () => {
    expect(editedSource).toContain("import { isStudentWorkRoute } from '../src/student_work/url-classifier'");
    expect(editedSource).toContain('if (isStudentWorkPage()) {');
    expect(editedSource).toContain('removeEditedArtifacts();');
  });
});
