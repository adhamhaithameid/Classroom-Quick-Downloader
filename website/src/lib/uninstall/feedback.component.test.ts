import { describe, expect, it } from 'vitest';
import { buildUninstallNotesPayload, detectBrowserFromUserAgent } from './feedback';

describe('uninstall feedback component helpers', () => {
  it('detects browser names from user agent strings', () => {
    expect(detectBrowserFromUserAgent('Mozilla/5.0 Edg/125.0')).toBe('edge');
    expect(detectBrowserFromUserAgent('Mozilla/5.0 Firefox/127.0')).toBe('firefox');
    expect(detectBrowserFromUserAgent('Mozilla/5.0 Chrome/125.0.0.0')).toBe('chrome');
    expect(detectBrowserFromUserAgent('Unknown UA')).toBe('unknown');
  });

  it('builds a compact notes payload with structured details', () => {
    const notes = buildUninstallNotesPayload({
      reason: 'It did not work on my class account',
      confidenceToReinstall: 'Very likely',
      urgency: 'High',
      selectedFeatures: ['Batch reliability', 'Better progress feedback'],
      notes: 'It failed on my assignments page.'
    });

    expect(notes).toContain('Reason: It did not work on my class account');
    expect(notes).toContain('Reinstall chance: Very likely');
    expect(notes).toContain('Urgency: High');
    expect(notes).toContain('Requested improvements: Batch reliability, Better progress feedback');
    expect(notes).toContain('Details: It failed on my assignments page.');
  });
});
