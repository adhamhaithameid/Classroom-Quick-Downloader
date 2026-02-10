import { describe, expect, it } from 'vitest';
import { cleanAttachmentName, extractFileMeta } from '../entrypoints/content/file-meta';

describe('content file meta', () => {
  it('cleans garbage labels and duplicated names', () => {
    expect(cleanAttachmentName('report.pdf Microsoft Word')).toBe('report.pdf');
    expect(cleanAttachmentName('file.txtfile.txt')).toBe('file.txt');
    expect(cleanAttachmentName('summary.pdfpdf')).toBe('summary.pdf');
    expect(cleanAttachmentName('')).toBe('');
  });

  it('extracts file metadata from tooltip attributes first', () => {
    const container = document.createElement('div');
    container.setAttribute('data-tooltip', 'slides.pptx');
    const meta = extractFileMeta(container, 'https://example.com/ignored');
    expect(meta.name).toBe('slides.pptx');
    expect(meta.ext).toBe('pptx');
    expect(meta.kind).toBe('other');
  });

  it('falls back to text content when tooltip is missing', () => {
    const container = document.createElement('div');
    container.textContent = 'archive.zip\nSecondary line';
    const meta = extractFileMeta(container, 'https://example.com/ignored');
    expect(meta.name).toBe('archive.zip');
    expect(meta.ext).toBe('zip');
  });

  it('falls back to URL path when element text is empty', () => {
    const container = document.createElement('div');
    const meta = extractFileMeta(container, 'https://example.com/files/notes.txt');
    expect(meta.name).toBe('notes.txt');
    expect(meta.ext).toBe('txt');
  });

  it('returns undefined name/ext when no metadata can be extracted', () => {
    const container = document.createElement('div');
    const meta = extractFileMeta(container, 'not-a-valid-url');
    expect(meta.name).toBeUndefined();
    expect(meta.ext).toBeUndefined();
  });
});

