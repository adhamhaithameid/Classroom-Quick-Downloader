import { describe, expect, it } from 'vitest';
import { buildUninstallNotesPayload, detectBrowserFromUserAgent } from './feedback';

describe('detectBrowserFromUserAgent — extended', () => {
  it('detects Edge with different version formats', () => {
    expect(detectBrowserFromUserAgent('Mozilla/5.0 Edg/125.0.255')).toBe('edge');
    expect(detectBrowserFromUserAgent('Mozilla/5.0 (Windows) AppleWebKit Edg/130.0.0.0')).toBe('edge');
  });

  it('detects Firefox from various UAs', () => {
    expect(detectBrowserFromUserAgent('Mozilla/5.0 (X11; Linux) Gecko Firefox/127.0')).toBe('firefox');
    expect(detectBrowserFromUserAgent('Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/131.0')).toBe('firefox');
  });

  it('detects Chrome from various UAs', () => {
    expect(detectBrowserFromUserAgent('Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36')).toBe('chrome');
  });

  it('detects Chrome for Brave, Opera, Vivaldi (all Chromium-based)', () => {
    // These all include "Chrome" in their UA
    expect(detectBrowserFromUserAgent('Mozilla/5.0 Chrome/125.0 OPR/112.0')).toBe('chrome');
    expect(detectBrowserFromUserAgent('Mozilla/5.0 Chrome/125.0 Vivaldi/7.0')).toBe('chrome');
  });

  it('returns unknown for Safari (no Chrome in UA)', () => {
    expect(detectBrowserFromUserAgent('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Version/17.0 Safari/537.36')).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(detectBrowserFromUserAgent('')).toBe('unknown');
  });

  it('handles null/undefined gracefully', () => {
    expect(detectBrowserFromUserAgent(null as unknown as string)).toBe('unknown');
    expect(detectBrowserFromUserAgent(undefined as unknown as string)).toBe('unknown');
  });

  it('Edge takes priority over Chrome (Edge UA includes Chrome)', () => {
    const edgeUA = 'Mozilla/5.0 (Windows NT 10.0) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0';
    expect(detectBrowserFromUserAgent(edgeUA)).toBe('edge');
  });
});

describe('buildUninstallNotesPayload — extended', () => {
  it('omits empty features and notes', () => {
    const result = buildUninstallNotesPayload({
      reason: 'Temporary',
      confidenceToReinstall: 'Maybe',
      urgency: 'Normal',
      selectedFeatures: [],
      notes: ''
    });
    expect(result).not.toContain('Requested improvements');
    expect(result).not.toContain('Details');
    expect(result).toContain('Reason: Temporary');
    expect(result).toContain('Reinstall chance: Maybe');
    expect(result).toContain('Urgency: Normal');
  });

  it('trims whitespace-only notes', () => {
    const result = buildUninstallNotesPayload({
      reason: 'Test',
      confidenceToReinstall: 'No',
      urgency: 'Low',
      selectedFeatures: [],
      notes: '   \n\t  '
    });
    expect(result).not.toContain('Details');
  });

  it('includes all features joined by commas', () => {
    const result = buildUninstallNotesPayload({
      reason: 'Test',
      confidenceToReinstall: 'Yes',
      urgency: 'High',
      selectedFeatures: ['A', 'B', 'C'],
      notes: 'My note'
    });
    expect(result).toContain('Requested improvements: A, B, C');
    expect(result).toContain('Details: My note');
  });

  it('produces lines separated by newlines', () => {
    const result = buildUninstallNotesPayload({
      reason: 'R',
      confidenceToReinstall: 'C',
      urgency: 'U',
      selectedFeatures: ['F1'],
      notes: 'N'
    });
    const lines = result.split('\n');
    expect(lines.length).toBe(5);
    expect(lines[0]).toBe('Reason: R');
    expect(lines[1]).toBe('Reinstall chance: C');
    expect(lines[2]).toBe('Urgency: U');
    expect(lines[3]).toBe('Requested improvements: F1');
    expect(lines[4]).toBe('Details: N');
  });
});
