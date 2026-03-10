import { describe, expect, it } from 'vitest';
import { fetchChangelog } from './changelog';

describe('fetchChangelog (manual source)', () => {
  it('returns manual changelog payload with stable schema', async () => {
    const data = await fetchChangelog();

    expect(data.schemaVersion).toBe('1');
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.entries)).toBe(true);
    expect(data.entries.length).toBeGreaterThan(0);
    expect(data.entries[0]?.version).toBe('1.5.0');
    expect(data.entries[0]?.id).toBe('manual-1.5.0-1');
    expect(data.entries.some((entry) => entry.version === '1.0.0')).toBe(true);
  });

  it('produces normalized entries with required fields', async () => {
    const data = await fetchChangelog();

    for (const entry of data.entries) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.version.length).toBeGreaterThan(0);
      expect(entry.date).toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(Array.isArray(entry.changes)).toBe(true);
      expect(Array.isArray(entry.added)).toBe(true);
      expect(Array.isArray(entry.changed)).toBe(true);
      expect(Array.isArray(entry.fixed)).toBe(true);
      expect(typeof entry.isImportant).toBe('boolean');
    }
  });

  it('uses summary + Added/Changed/Fixed composition for changes', async () => {
    const data = await fetchChangelog();
    const first = data.entries[0];

    expect(first?.summary?.length || 0).toBeGreaterThan(0);
    expect(first?.changes[0]).toContain('Summary:');
    expect(first?.changes.some((line) => line.startsWith('Added:'))).toBe(true);
    expect(first?.changes.some((line) => line.startsWith('Changed:'))).toBe(true);
    expect(first?.changes.some((line) => line.startsWith('Fixed:'))).toBe(true);
  });

  it('returns manual metadata mode with empty runtime rules', async () => {
    const data = await fetchChangelog();

    expect(data.config?.rules ?? []).toEqual([]);
    expect(data.meta?.applyMode).toBe('manual');
    expect(data.meta?.lastAutoSyncStatus).toBe('manual');
  });
});
