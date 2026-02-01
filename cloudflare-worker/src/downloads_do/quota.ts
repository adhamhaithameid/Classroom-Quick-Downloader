// filepath: cloudflare-worker/src/downloads_do/quota.ts
/**
 * Quota computation logic for the Durable Object.
 * Determines mode labels, batch sizes, and remote analytics status
 * based on daily request counts.
 */

import type { QuotaDescriptor } from '../types';
import {
  QUOTA_SOFT_LIMIT,
  QUOTA_NORMAL_LIMIT,
  QUOTA_HARD_NORMAL_LIMIT,
  QUOTA_HARD_LIMIT,
  QUOTA_VERY_HARD_LIMIT,
} from './constants';

/**
 * Decide quota level, mode label, remoteEnabled and batchSizeSuggestion
 * from the current daily request count.
 */
export function computeQuotaDescriptor(
  requestsToday: number,
  hardRemoteOff: boolean
): QuotaDescriptor {
  // Admin kill switch
  if (hardRemoteOff) {
    return {
      requestsToday,
      quotaLevel: 'ADMIN_REMOTE_OFF',
      modeLabel: 'off (admin)',
      remoteEnabled: false,
      batchSizeSuggestion: 200,
    };
  }

  // Beyond hard limits - emergency mode
  if (requestsToday >= QUOTA_VERY_HARD_LIMIT) {
    return {
      requestsToday,
      quotaLevel: 'QUOTA_VERY_HARD_LIMIT',
      modeLabel: 'emergency',
      remoteEnabled: false,
      batchSizeSuggestion: 500,
    };
  }

  // Hard limit - minimal processing
  if (requestsToday >= QUOTA_HARD_LIMIT) {
    return {
      requestsToday,
      quotaLevel: 'QUOTA_HARD_LIMIT',
      modeLabel: 'minimal',
      remoteEnabled: true,
      batchSizeSuggestion: 200,
    };
  }

  // Hard normal limit - reduced batching
  if (requestsToday >= QUOTA_HARD_NORMAL_LIMIT) {
    return {
      requestsToday,
      quotaLevel: 'QUOTA_HARD_NORMAL_LIMIT',
      modeLabel: 'reduced',
      remoteEnabled: true,
      batchSizeSuggestion: 150,
    };
  }

  // Normal limit - standard operation
  if (requestsToday >= QUOTA_NORMAL_LIMIT) {
    return {
      requestsToday,
      quotaLevel: 'QUOTA_NORMAL_LIMIT',
      modeLabel: 'standard',
      remoteEnabled: true,
      batchSizeSuggestion: 100,
    };
  }

  // Soft limit - start reducing
  if (requestsToday >= QUOTA_SOFT_LIMIT) {
    return {
      requestsToday,
      quotaLevel: 'QUOTA_SOFT_LIMIT',
      modeLabel: 'busy',
      remoteEnabled: true,
      batchSizeSuggestion: 75,
    };
  }

  // Below all limits - full operation
  return {
    requestsToday,
    quotaLevel: 'BELOW_LIMITS',
    modeLabel: 'chill',
    remoteEnabled: true,
    batchSizeSuggestion: 50,
  };
}
