import { describe, it, expect } from 'vitest';
import { loadCorpus, CORPUS_DIR } from './corpus';
import { existsSync } from 'node:fs';

describe('accuracy corpus', () => {
  it('has a corpus directory', () => {
    expect(existsSync(CORPUS_DIR)).toBe(true);
  });

  it('loads every case with html and labels', () => {
    const cases = loadCorpus();
    expect(cases.length).toBeGreaterThan(0);

    for (const c of cases) {
      expect(c.html.length).toBeGreaterThan(0);
      expect(c.expected.caseId.length).toBeGreaterThan(0);
      expect(c.expected.note.length).toBeGreaterThan(0);
      expect(c.expected.posts.length).toBeGreaterThan(0);
    }
  });

  it('uses the directory name as the caseId', () => {
    for (const c of loadCorpus()) {
      expect(c.expected.caseId).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('labels every post with an id that appears in the html', () => {
    for (const c of loadCorpus()) {
      for (const post of c.expected.posts) {
        expect(c.html).toContain(post.postId);
      }
    }
  });
});
