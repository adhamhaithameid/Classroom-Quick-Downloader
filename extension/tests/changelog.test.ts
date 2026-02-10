import { describe, it, expect } from 'vitest';
import { getLatestChange, ChangelogData } from '../entrypoints/utils/changelog';

describe('getLatestChange', () => {
  it('should return the first change of the first entry', () => {
    const mockData: ChangelogData = {
      entries: [{
        id: '1',
        version: '1.0.0',
        date: '2023-01-01',
        changes: ['Fixed bug', 'Added feature']
      }],
      config: { rules: [] },
      lastFetched: 1234567890
    };
    expect(getLatestChange(mockData)).toBe('Fixed bug');
  });

  it('should return null if data is null', () => {
    expect(getLatestChange(null)).toBeNull();
  });

  it('should return null if entries array is empty', () => {
    const mockData: ChangelogData = {
      entries: [],
      config: { rules: [] },
      lastFetched: 1234567890
    };
    expect(getLatestChange(mockData)).toBeNull();
  });

  it('should return null if the first entry has no changes', () => {
    const mockData: ChangelogData = {
      entries: [{
        id: '1',
        version: '1.0.0',
        date: '2023-01-01',
        changes: []
      }],
      config: { rules: [] },
      lastFetched: 1234567890
    };
    expect(getLatestChange(mockData)).toBeNull();
  });
});
