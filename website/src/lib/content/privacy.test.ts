import { describe, expect, it } from 'vitest';
import { privacyContent } from './privacy';
import type { ManualPrivacyContent, ManualPrivacySection } from './privacy';

describe('privacyContent static structure', () => {
  it('has required top-level fields', () => {
    expect(privacyContent.headline).toBeTruthy();
    expect(privacyContent.description).toBeTruthy();
    expect(privacyContent.fullPrivacyUrl).toMatch(/^https:\/\//);
    expect(typeof privacyContent.lastUpdatedAtUtc).toBe('number');
    expect(privacyContent.lastUpdatedAtUtc).toBeGreaterThan(0);
  });

  it('has at least 2 privacy sections', () => {
    expect(privacyContent.sections.length).toBeGreaterThanOrEqual(2);
  });

  it('every section has required fields', () => {
    for (const section of privacyContent.sections) {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.summary).toBeTruthy();
      expect(Array.isArray(section.bullets)).toBe(true);
    }
  });

  it('every section has unique ids', () => {
    const ids = privacyContent.sections.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('includes a "what we collect" section', () => {
    const section = privacyContent.sections.find((s) => s.id === 'what-we-collect');
    expect(section).toBeDefined();
    expect(section!.bullets.length).toBeGreaterThan(0);
  });

  it('includes a "what we do not collect" section', () => {
    const section = privacyContent.sections.find((s) => s.id === 'what-we-do-not-collect');
    expect(section).toBeDefined();
    expect(section!.bullets.length).toBeGreaterThan(0);
  });

  it('fullPrivacyUrl points to the GitHub PRIVACY.md', () => {
    expect(privacyContent.fullPrivacyUrl).toContain('PRIVACY.md');
    expect(privacyContent.fullPrivacyUrl).toContain('github.com');
  });

  it('lastUpdatedAtUtc is a valid UTC timestamp', () => {
    const date = new Date(privacyContent.lastUpdatedAtUtc);
    expect(date.getFullYear()).toBeGreaterThanOrEqual(2024);
    expect(date.getTime()).toBe(privacyContent.lastUpdatedAtUtc);
  });

  it('all bullet strings are non-empty and trimmed', () => {
    for (const section of privacyContent.sections) {
      for (const bullet of section.bullets) {
        expect(bullet.trim().length).toBeGreaterThan(0);
        expect(bullet).toBe(bullet.trim());
      }
    }
  });
});
