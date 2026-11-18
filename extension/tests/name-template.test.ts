// filepath: extension/tests/name-template.test.ts
/**
 * Naming-template renderer tests (bead 0h4d.3.1).
 *
 * Two test families:
 *   1. traversal safety — token-injection cases over the same hostile
 *      vocabulary the S1 corpus uses; output must never escape the download
 *      directory shape.
 *   2. render contract — token substitution, empty-segment collapse, depth
 *      cap, unknown tokens, never-throws.
 */
import { describe, it, expect } from 'vitest';
import {
  renderNamingTemplate,
  templateProducesFolders,
  DEFAULT_NAMING_TEMPLATE,
  MAX_TEMPLATE_DEPTH,
} from '../src/core/name/template';

const FIXED_NOW = new Date(2026, 0, 24); // local 2026-01-24

function render(template: string, overrides: Record<string, unknown> = {}): string {
  return renderNamingTemplate(template, {
    course: 'Math 101',
    type: '',
    filename: 'worksheet.pdf',
    now: FIXED_NOW,
    index: 3,
    ...overrides,
  });
}

describe('traversal safety — token injection', () => {
  const hostile = [
    '../../etc/passwd',
    '..\\..\\windows\\system32',
    '....//....//escape',
    'foo/../../bar',
    'nested/deeply/course',
    'colon:name',
  ];

  it('keeps hostile course tokens inside inert folder segments', () => {
    for (const bad of hostile) {
      const out = render('{course}/{filename}', { course: bad });
      expect(out).not.toContain('\\');
      expect(out).not.toContain(':');
      const segments = out.split('/');
      expect(segments.length).toBeLessThanOrEqual(MAX_TEMPLATE_DEPTH);
      // No segment may BE a traversal component or start with dots; interior
      // '..' inside a name is inert (S1: separators are gone, so '..' has no
      // path components left to traverse — 'foo....bar' is a plain name).
      for (const seg of segments) {
        expect(seg.length).toBeGreaterThan(0);
        expect(seg).not.toBe('..');
        expect(seg).not.toMatch(/^\.+|^\.+\\/);
      }
    }
  });

  it('hardens hostile filename tokens the same as direct input', () => {
    for (const bad of hostile) {
      const out = render('{filename}', { filename: bad });
      expect(out).not.toContain('\\');
      expect(out).not.toContain(':');
      // One inert flat name: no folder depth, no traversal component.
      expect(out.split('/')).toHaveLength(1);
      expect(out.split('/').every((seg) => seg.length > 0 && seg !== '..')).toBe(true);
    }
  });

  it('rejects depth overflow by falling back to the flat name', () => {
    // Three usable segments exceed the cap: the design says fall back to
    // the flat filename, not silently truncate.
    expect(render('{course}/{type}/{filename}', { course: 'a', type: 'b' })).toBe('worksheet.pdf');
    expect(render('x/{course}/{filename}')).toBe('worksheet.pdf');
    expect(render('{course}/{filename}/extra', { course: 'c' })).toBe('worksheet.pdf');
  });

  it('controls characters cannot smuggle separators', () => {
    const out = render('{course}/{filename}', { course: 'bad\u0000\u001f/name' });
    expect(out).toBe('badname/worksheet.pdf');
  });
});

describe('render contract', () => {
  it('renders the default template into course/filename', () => {
    expect(render(DEFAULT_NAMING_TEMPLATE)).toBe('Math 101/worksheet.pdf');
  });

  it('collapses the folder when the course token is empty', () => {
    expect(render('{course}/{filename}', { course: '' })).toBe('worksheet.pdf');
    expect(render('{course}/{filename}', { course: undefined })).toBe('worksheet.pdf');
  });

  it('renders date and index tokens', () => {
    expect(render('{date}/{filename}')).toBe('2026-01-24/worksheet.pdf');
    expect(render('{filename} ({index})')).toBe('worksheet.pdf (3)');
  });

  it('renders unknown tokens as empty strings', () => {
    expect(render('{foo}/{filename}')).toBe('worksheet.pdf');
    // The dot between tokens is literal text: substitution is empty, the
    // literal punctuation survives ('worksheet.pdf.pdf').
    expect(render('{filename}.{bar}pdf')).toBe('worksheet.pdf.pdf');
  });

  it('falls back to the flat filename for non-template strings', () => {
    expect(render('', {})).toBe('worksheet.pdf');
    expect(render('plain-name', {})).toBe('worksheet.pdf');
    expect(render(null as unknown as string, {})).toBe('worksheet.pdf');
  });

  it('never throws on any input', () => {
    const inputs = [undefined, null, 42, {}, '{', '}}}', '{course}/{course}/{course}/{course}'];
    for (const t of inputs) {
      expect(() => renderNamingTemplate(t as string, { filename: 'f.pdf' })).not.toThrow();
    }
  });

  it('reserves the {type} token (kind taxonomy lands later)', () => {
    expect(render('{type}/{filename}', { type: 'pdf' })).toBe('pdf/worksheet.pdf');
    expect(render('{type}/{filename}')).toBe('worksheet.pdf'); // empty collapses
  });
});

describe('templateProducesFolders', () => {
  it('detects folder-producing templates via a probe render', () => {
    expect(templateProducesFolders('{course}/{filename}')).toBe(true);
    expect(templateProducesFolders('{filename}')).toBe(false);
    expect(templateProducesFolders('')).toBe(false);
    expect(templateProducesFolders(undefined as unknown as string)).toBe(false);
  });
});
