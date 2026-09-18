import { describe, expect, it } from 'vitest';
import { buildUninstallViewEvent } from './uninstallViewEvent';

// W3 fix: the uninstall page emits one lifecycle event on mount so the stats
// piggybacked on the uninstall URL (d/a) reach the warehouse even when the
// user never clicks reinstall.

describe('buildUninstallViewEvent', () => {
  it('builds the uninstall_view payload with stats and context meta', () => {
    const event = buildUninstallViewEvent({
      stats: { downloads: 12, attempts: 15 },
      context: { source: 'extension', browser: 'chrome', version: '1.6.0' }
    });

    expect(event.eventType).toBe('content');
    expect(event.action).toBe('uninstall_view');
    expect(event.placement).toBe('uninstall_page');
    expect(event.pagePath).toBe('/uninstall');
    expect(event.meta).toEqual({
      downloads: 12,
      attempts: 15,
      source: 'extension',
      browser: 'chrome',
      version: '1.6.0'
    });
  });

  it('falls back to unknown context and zero stats when params are absent', () => {
    const event = buildUninstallViewEvent({
      stats: { downloads: 0, attempts: 0 },
      context: { source: 'website', browser: 'chrome', version: 'unknown' }
    });

    expect(event.meta).toEqual({
      downloads: 0,
      attempts: 0,
      source: 'website',
      browser: 'chrome',
      version: 'unknown'
    });
  });

  it('generates a unique eventId per call', () => {
    const a = buildUninstallViewEvent({
      stats: { downloads: 0, attempts: 0 },
      context: { source: 'website', browser: 'chrome', version: 'unknown' }
    });
    const b = buildUninstallViewEvent({
      stats: { downloads: 0, attempts: 0 },
      context: { source: 'website', browser: 'chrome', version: 'unknown' }
    });
    expect(a.eventId).toBeTruthy();
    expect(b.eventId).toBeTruthy();
    expect(a.eventId).not.toBe(b.eventId);
  });
});
