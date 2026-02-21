import { describe, expect, it } from 'vitest';
import { loadRepoMarkdown } from './repoMarkdown';

describe('repo markdown acceptance', () => {
  it('loads CHANGELOG.md from repository root', async () => {
    const doc = await loadRepoMarkdown('CHANGELOG.md');
    expect(doc.markdown.length).toBeGreaterThan(1000);
    expect(doc.html).toContain('h1');
    expect(doc.updatedAtIso).toContain('T');
  });

  it('loads PRIVACY.md from repository root', async () => {
    const doc = await loadRepoMarkdown('PRIVACY.md');
    expect(doc.markdown).toContain('Privacy');
    expect(doc.html.toLowerCase()).toContain('privacy');
  });
});
