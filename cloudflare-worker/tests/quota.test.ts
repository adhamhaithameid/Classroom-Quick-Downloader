import { describe, it, expect } from 'vitest';
import { computeQuotaDescriptor } from '../src/downloads_do/quota';
import {
  QUOTA_SOFT_LIMIT,
  QUOTA_NORMAL_LIMIT,
  QUOTA_HARD_NORMAL_LIMIT,
  QUOTA_HARD_LIMIT,
  QUOTA_VERY_HARD_LIMIT,
} from '../src/downloads_do/constants';

describe('computeQuotaDescriptor', () => {
  it('should return admin remote off when hardRemoteOff is true', () => {
    const result = computeQuotaDescriptor(100, true);
    expect(result).toEqual({
      requestsToday: 100,
      quotaLevel: 'ADMIN_REMOTE_OFF',
      modeLabel: 'off (admin)',
      remoteEnabled: false,
      batchSizeSuggestion: 200,
    });
  });

  it('should return very hard limit when requestsToday >= QUOTA_VERY_HARD_LIMIT', () => {
    // Exact match
    const result = computeQuotaDescriptor(QUOTA_VERY_HARD_LIMIT, false);
    expect(result).toEqual({
      requestsToday: QUOTA_VERY_HARD_LIMIT,
      quotaLevel: 'QUOTA_VERY_HARD_LIMIT',
      modeLabel: 'emergency',
      remoteEnabled: false,
      batchSizeSuggestion: 500,
    });

    // Over limit
    const resultOver = computeQuotaDescriptor(QUOTA_VERY_HARD_LIMIT + 1000, false);
    expect(resultOver).toEqual(expect.objectContaining({
      quotaLevel: 'QUOTA_VERY_HARD_LIMIT',
      modeLabel: 'emergency',
      remoteEnabled: false,
      batchSizeSuggestion: 500,
    }));
  });

  it('should return hard limit when requestsToday >= QUOTA_HARD_LIMIT but < QUOTA_VERY_HARD_LIMIT', () => {
    // Exact match
    const result = computeQuotaDescriptor(QUOTA_HARD_LIMIT, false);
    expect(result).toEqual({
      requestsToday: QUOTA_HARD_LIMIT,
      quotaLevel: 'QUOTA_HARD_LIMIT',
      modeLabel: 'minimal',
      remoteEnabled: true,
      batchSizeSuggestion: 200,
    });

    // Boundary check below very hard limit
    const resultBelowVeryHard = computeQuotaDescriptor(QUOTA_VERY_HARD_LIMIT - 1, false);
    expect(resultBelowVeryHard).toEqual(expect.objectContaining({
      quotaLevel: 'QUOTA_HARD_LIMIT',
      modeLabel: 'minimal',
      remoteEnabled: true,
      batchSizeSuggestion: 200,
    }));
  });

  it('should return hard normal limit when requestsToday >= QUOTA_HARD_NORMAL_LIMIT but < QUOTA_HARD_LIMIT', () => {
    // Exact match
    const result = computeQuotaDescriptor(QUOTA_HARD_NORMAL_LIMIT, false);
    expect(result).toEqual({
      requestsToday: QUOTA_HARD_NORMAL_LIMIT,
      quotaLevel: 'QUOTA_HARD_NORMAL_LIMIT',
      modeLabel: 'reduced',
      remoteEnabled: true,
      batchSizeSuggestion: 150,
    });

    // Boundary check below hard limit
    const resultBelowHard = computeQuotaDescriptor(QUOTA_HARD_LIMIT - 1, false);
    expect(resultBelowHard).toEqual(expect.objectContaining({
      quotaLevel: 'QUOTA_HARD_NORMAL_LIMIT',
      modeLabel: 'reduced',
      remoteEnabled: true,
      batchSizeSuggestion: 150,
    }));
  });

  it('should return normal limit when requestsToday >= QUOTA_NORMAL_LIMIT but < QUOTA_HARD_NORMAL_LIMIT', () => {
    // Exact match
    const result = computeQuotaDescriptor(QUOTA_NORMAL_LIMIT, false);
    expect(result).toEqual({
      requestsToday: QUOTA_NORMAL_LIMIT,
      quotaLevel: 'QUOTA_NORMAL_LIMIT',
      modeLabel: 'standard',
      remoteEnabled: true,
      batchSizeSuggestion: 100,
    });

    // Boundary check below hard normal limit
    const resultBelowHardNormal = computeQuotaDescriptor(QUOTA_HARD_NORMAL_LIMIT - 1, false);
    expect(resultBelowHardNormal).toEqual(expect.objectContaining({
      quotaLevel: 'QUOTA_NORMAL_LIMIT',
      modeLabel: 'standard',
      remoteEnabled: true,
      batchSizeSuggestion: 100,
    }));
  });

  it('should return soft limit when requestsToday >= QUOTA_SOFT_LIMIT but < QUOTA_NORMAL_LIMIT', () => {
    // Exact match
    const result = computeQuotaDescriptor(QUOTA_SOFT_LIMIT, false);
    expect(result).toEqual({
      requestsToday: QUOTA_SOFT_LIMIT,
      quotaLevel: 'QUOTA_SOFT_LIMIT',
      modeLabel: 'busy',
      remoteEnabled: true,
      batchSizeSuggestion: 75,
    });

    // Boundary check below normal limit
    const resultBelowNormal = computeQuotaDescriptor(QUOTA_NORMAL_LIMIT - 1, false);
    expect(resultBelowNormal).toEqual(expect.objectContaining({
      quotaLevel: 'QUOTA_SOFT_LIMIT',
      modeLabel: 'busy',
      remoteEnabled: true,
      batchSizeSuggestion: 75,
    }));
  });

  it('should return below limits when requestsToday < QUOTA_SOFT_LIMIT', () => {
    // Boundary check below soft limit
    const result = computeQuotaDescriptor(QUOTA_SOFT_LIMIT - 1, false);
    expect(result).toEqual({
      requestsToday: QUOTA_SOFT_LIMIT - 1,
      quotaLevel: 'BELOW_LIMITS',
      modeLabel: 'chill',
      remoteEnabled: true,
      batchSizeSuggestion: 50,
    });

    // Zero
    const resultZero = computeQuotaDescriptor(0, false);
    expect(resultZero).toEqual(expect.objectContaining({
      quotaLevel: 'BELOW_LIMITS',
      modeLabel: 'chill',
      remoteEnabled: true,
      batchSizeSuggestion: 50,
    }));
  });
});
