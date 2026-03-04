import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';

export type RepoMarkdownDoc = {
  sourcePath: string;
  markdown: string;
  html: string;
  updatedAtIso: string;
};

function resolveRepoRootPath(relativePath: string): string {
  const websiteDir = process.cwd();
  return path.resolve(websiteDir, '..', relativePath);
}

export async function loadRepoMarkdown(relativePath: string): Promise<RepoMarkdownDoc> {
  const absolutePath = resolveRepoRootPath(relativePath);
  const [markdown, fileStat] = await Promise.all([readFile(absolutePath, 'utf8'), stat(absolutePath)]);

  const html = marked.parse(markdown, {
    gfm: true,
    breaks: false
  }) as string;

  return {
    sourcePath: relativePath,
    markdown,
    html,
    updatedAtIso: fileStat.mtime.toISOString()
  };
}
