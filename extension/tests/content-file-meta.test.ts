import { describe, expect, it } from 'vitest';
import { cleanAttachmentName, extractFileMeta } from '../entrypoints/content/file-meta';
import { getTypeLabels } from '../src/core/name/type-labels';

describe('content file meta', () => {
  it('cleans garbage labels and duplicated names', () => {
    expect(cleanAttachmentName('report.pdf Microsoft Word')).toBe('report.pdf');
    expect(cleanAttachmentName('file.txtfile.txt')).toBe('file.txt');
    expect(cleanAttachmentName('summary.pdfpdf')).toBe('summary.pdf');
    expect(cleanAttachmentName('')).toBe('');
  });

  it('strips a localized label glued to the extension (D10 Hungarian report)', () => {
    // Classroom renders filename + localized type label with no separator.
    expect(cleanAttachmentName('example.zipTömörített archívum', 'hu')).toBe('example.zip');
    expect(cleanAttachmentName('example.zipTömörített archívum')).toBe('example.zip');
    expect(cleanAttachmentName('dokumentum.pdfDokumentum', 'hu')).toBe('dokumentum.pdf');
  });

  it('never strips a label without a corroborating extension (D10 anchor rule)', () => {
    // A real file named "Design Document" must not lose its name.
    expect(cleanAttachmentName('Design Document')).toBe('Design Document');
    // Same for localized label words: no extension before the label, no strip.
    expect(cleanAttachmentName('Tömörített archívum', 'hu')).toBe('Tömörített archívum');
    expect(cleanAttachmentName('Tervdokumentum', 'hu')).toBe('Tervdokumentum');
  });

  it('is case-insensitive on labels', () => {
    expect(cleanAttachmentName('report.PDFPdf')).toBe('report.PDF');
  });

  it('exposes a locale-driven TypeLabelRegistry with an English fallback', () => {
    expect(getTypeLabels('hu')).toContain('Tömörített archívum');
    expect(getTypeLabels('hu')).toContain('PDF'); // English labels stay in play
    expect(getTypeLabels('zz')).toContain('Compressed archive');
    expect(getTypeLabels()).toContain('Microsoft Excel');
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

