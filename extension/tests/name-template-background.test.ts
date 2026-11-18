// filepath: extension/tests/name-template-background.test.ts
/**
 * Background template application tests (0h4d.3.1): the suggestion-path
 * wrapper. Template-off users see byte-identical suggestions; template-on
 * users get the folder shape with every segment hardened.
 */
import { describe, expect, it } from 'vitest';
import { applyNamingTemplate, resetNameTemplateForTests } from '../entrypoints/background/name-template';
import { composeSuggestedFilename } from '../entrypoints/background/url-helpers';

describe('applyNamingTemplate — suggestion path', () => {
  it('passes the flat suggestion through unchanged when no template is active', () => {
    const base = composeSuggestedFilename({ name: 'report', knownExt: 'pdf' });
    expect(applyNamingTemplate({ baseName: base }, '')).toBe('report.pdf');
    expect(applyNamingTemplate({ baseName: base }, 'no tokens here')).toBe('report.pdf');
  });

  it('wraps the base in the course folder when a template is active', () => {
    const base = composeSuggestedFilename({
      name: 'worksheet',
      knownExt: 'pdf',
    });
    const out = applyNamingTemplate(
      { baseName: base, courseTitle: 'Math 101' },
      '{course}/{filename}',
    );
    expect(out).toBe('Math 101/worksheet.pdf');
  });

  it('collapses the folder when the course title is missing', () => {
    const out = applyNamingTemplate(
      { baseName: 'worksheet.pdf' },
      '{course}/{filename}',
    );
    expect(out).toBe('worksheet.pdf');
  });

  it('hardens hostile course titles at the suggestion boundary', () => {
    const out = applyNamingTemplate(
      { baseName: 'worksheet.pdf', courseTitle: '../../etc' },
      '{course}/{filename}',
    );
    expect(out).toBe('etc/worksheet.pdf');
    expect(out.split('/')).toHaveLength(2);
  });

  it('increments {index} per render within the module life', () => {
    resetNameTemplateForTests();
    const first = applyNamingTemplate({ baseName: 'a.pdf' }, '{filename} ({index})');
    const second = applyNamingTemplate({ baseName: 'b.pdf' }, '{filename} ({index})');
    expect(first).toBe('a.pdf (1)');
    expect(second).toBe('b.pdf (2)');
  });
});
