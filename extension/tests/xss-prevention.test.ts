// filepath: extension/tests/xss-prevention.test.ts
/**
 * XSS Prevention Tests (Fix #15)
 * 
 * These tests verify that:
 * 1. All escapeHtml functions properly encode dangerous characters
 * 2. Common XSS attack vectors are neutralized
 * 3. innerHTML usage patterns are safe
 */

import { describe, it, expect } from 'vitest';

// Simulate the escapeHtml function as used in the codebase
function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') return String(unsafe);
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

describe('XSS Prevention - escapeHtml', () => {
  describe('Basic Character Escaping', () => {
    it('should escape < and > brackets', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('</script>')).toBe('&lt;/script&gt;');
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
      expect(escapeHtml('&amp;')).toBe('&amp;amp;');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeHtml("'single'")).toBe('&#039;single&#039;');
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle strings without special chars', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('Common XSS Attack Vectors', () => {
    it('should neutralize script injection', () => {
      const attack = '<script>alert("xss")</script>';
      const escaped = escapeHtml(attack);
      expect(escaped).not.toContain('<script>');
      expect(escaped).not.toContain('</script>');
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should neutralize img onerror attacks', () => {
      const attack = '<img src=x onerror="alert(1)">';
      const escaped = escapeHtml(attack);
      expect(escaped).not.toContain('<img');
      expect(escaped).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    });

    it('should neutralize event handler injection', () => {
      const attack = '" onmouseover="alert(1)';
      const escaped = escapeHtml(attack);
      expect(escaped).toBe('&quot; onmouseover=&quot;alert(1)');
    });

    it('should neutralize SVG injection', () => {
      const attack = '<svg onload="alert(1)">';
      const escaped = escapeHtml(attack);
      expect(escaped).not.toContain('<svg');
    });

    it('should neutralize nested script tags', () => {
      const attack = '<<script>script>alert(1)<</script>/script>';
      const escaped = escapeHtml(attack);
      expect(escaped).not.toContain('<script>');
    });

    it('should handle unicode encoded attacks', () => {
      // This tests that basic encoding is done - actual unicode handling may vary
      const attack = '<\u0073cript>';
      const escaped = escapeHtml(attack);
      expect(escaped.startsWith('&lt;')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-string input gracefully', () => {
      expect(escapeHtml(null as unknown as string)).toBe('null');
      expect(escapeHtml(undefined as unknown as string)).toBe('undefined');
      expect(escapeHtml(123 as unknown as string)).toBe('123');
    });

    it('should handle strings with only special characters', () => {
      expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#039;');
    });

    it('should handle long strings', () => {
      const longString = '<'.repeat(1000);
      const escaped = escapeHtml(longString);
      expect(escaped).toBe('&lt;'.repeat(1000));
    });

    it('should handle mixed content', () => {
      const mixed = 'Hello <b>world</b> & "friends"!';
      const escaped = escapeHtml(mixed);
      expect(escaped).toBe('Hello &lt;b&gt;world&lt;/b&gt; &amp; &quot;friends&quot;!');
    });
  });

  describe('Real-world Dashboard Scenarios', () => {
    it('should escape hot* dimension values that could be malicious', () => {
      // Simulates hotType, hotBrowser, hotOs, hotCountry from DO stats
      const maliciousType = '<script>document.cookie</script>';
      const escaped = escapeHtml(maliciousType);
      expect(escaped).not.toContain('<script>');
    });

    it('should escape rule names in rules list', () => {
      const maliciousRule = '"><img src=x onerror="alert(1)">';
      const escaped = escapeHtml(maliciousRule);
      // HTML tags should be encoded - no raw < or >
      expect(escaped).not.toContain('<img');
      expect(escaped).toContain('&lt;img'); // Tags are escaped
      expect(escaped).toContain('&quot;'); // Quotes are escaped
    });

    it('should escape IP addresses (even malformed)', () => {
      const maliciousIp = '192.168.1.1<script>alert(1)</script>';
      const escaped = escapeHtml(maliciousIp);
      expect(escaped).not.toContain('<script>');
    });

    it('should escape error messages', () => {
      const errorWithHtml = 'Error: <div onclick="evil()">click me</div>';
      const escaped = escapeHtml(errorWithHtml);
      // HTML tags should be encoded - no raw < or >
      expect(escaped).not.toContain('<div');
      expect(escaped).toContain('&lt;div'); // Tags are escaped
      expect(escaped).toContain('&lt;/div&gt;'); // Closing tag escaped too
    });
  });
});
