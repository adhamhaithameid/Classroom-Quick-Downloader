import { describe, expect, it } from 'vitest';
import { sanitizeEmailBodyHtml, sanitizeEmailCss } from './sanitize';

describe('sanitizeEmailCss', () => {
  it('removes every < character, killing style-tag breakouts', () => {
    const malicious = 'body { color: red; }</style><script>alert(1)</script><style>';
    const out = sanitizeEmailCss(malicious);
    expect(out).not.toContain('<');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).toContain('body { color: red; }');
  });

  it('keeps legitimate CSS intact', () => {
    const css = '.email-canvas td { padding: 24px 0; background: #f0f4f0; }';
    expect(sanitizeEmailCss(css)).toBe(css);
  });

  it('handles non-string input', () => {
    expect(sanitizeEmailCss(undefined as unknown as string)).toBe('');
  });
});

describe('sanitizeEmailBodyHtml', () => {
  it('strips script tags', () => {
    const out = sanitizeEmailBodyHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).toContain('<p>hi</p>');
    expect(out.toLowerCase()).not.toContain('<script');
  });

  it('strips inline event handlers', () => {
    const out = sanitizeEmailBodyHtml('<img src="x.png" onerror="alert(1)">');
    expect(out).toContain('<img');
    expect(out).not.toContain('onerror');
  });

  it('neutralizes javascript: URLs', () => {
    const out = sanitizeEmailBodyHtml('<a href="javascript:alert(1)">click</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('removes iframe/object/embed/form elements', () => {
    const out = sanitizeEmailBodyHtml(
      '<iframe src="https://evil.example"></iframe><object></object><embed><form action="/x"></form>',
    );
    expect(out.toLowerCase()).not.toContain('<iframe');
    expect(out.toLowerCase()).not.toContain('<object');
    expect(out.toLowerCase()).not.toContain('<embed');
    expect(out.toLowerCase()).not.toContain('<form');
  });

  it('preserves legitimate email markup (tables, images, links, inline styles)', () => {
    const html =
      '<table width="600"><tr><td style="padding:24px"><h1>Title</h1>' +
      '<img src="https://cdn.example/logo.png" width="72" alt="logo">' +
      '<a href="https://example.com">Get it</a></td></tr></table>';
    const out = sanitizeEmailBodyHtml(html);
    expect(out).toContain('<table');
    expect(out).toContain('padding:24px');
    expect(out).toContain('<img');
    expect(out).toContain('href="https://example.com"');
  });

  it('handles non-string input', () => {
    expect(sanitizeEmailBodyHtml(null as unknown as string)).toBe('');
  });
});
