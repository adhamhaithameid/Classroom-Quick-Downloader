import { describe, expect, it } from 'vitest';
import {
  FAILURE_COPY,
  composeFailureMessage,
  failureCopyFor,
} from '../src/core/acquire/failure-copy';

// ============================================================================
// FAILURE COPY REGISTRY (bead 0h4d.1.4, plan
// docs/superpowers/plans/2026-09-28-failure-reasons-ui.md). One canonical
// errorCode → {title, action} table for every classified failure the flow
// can settle on. The guarantee: no user-facing failure without specific,
// actionable copy — a new class without a table entry fails this suite.
// ============================================================================

/** The full observable taxonomy: interrupt classes (chrome.downloads) + flow classes. */
const TAXONOMY = [
  // chrome.downloads permanent interrupt classes
  'FILE_FAILED',
  'STORAGE_FULL',
  'CRASH',
  'SERVER_BAD_CONTENT',
  'FILE_VIRUS_INFECTED',
  'FILE_BLOCKED',
  // chrome.downloads transient classes (shown when the policy exhausts)
  'NETWORK_FAILED',
  'SERVER_FAILED',
  'NETWORK_TIMED_OUT',
  // flow-level classes
  'INVALID_URL',
  'BROWSER_START_FAIL',
  'BROWSER_START_FAIL_DIRECT',
  'DOWNLOAD_START_TIMEOUT',
  'AUTH_ALL_FAILED',
  'SIZE_MISMATCH',
  'AUTH_CHECK',
] as const;

describe('failure copy registry (0h4d.1.4)', () => {
  it('every taxonomy class has copy with a non-empty title and action', () => {
    for (const code of TAXONOMY) {
      const copy = FAILURE_COPY[code];
      expect(copy, `missing copy for ${code}`).toBeTruthy();
      expect(copy.title.length, `${code} title empty`).toBeGreaterThan(0);
      expect(copy.action.length, `${code} action empty`).toBeGreaterThan(0);
    }
  });

  it('failureCopyFor resolves taxonomy codes and returns undefined for unknown', () => {
    expect(failureCopyFor('STORAGE_FULL')?.action.length).toBeGreaterThan(0);
    expect(failureCopyFor('NOT_A_REAL_CODE')).toBeUndefined();
    expect(failureCopyFor(undefined)).toBeUndefined();
  });

  it('composeFailureMessage yields a specific sentence with no raw code leakage', () => {
    for (const code of TAXONOMY) {
      const msg = composeFailureMessage(code);
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toContain(code); // never surface the raw code to users
    }
  });

  it('composed copy for the permanent classes preserves the classified guidance', () => {
    expect(composeFailureMessage('STORAGE_FULL')).toContain('disk is full');
    expect(composeFailureMessage('FILE_VIRUS_INFECTED')).toContain('infected');
    expect(composeFailureMessage('DOWNLOAD_START_TIMEOUT')).toContain(
      'could not be started',
    );
    expect(composeFailureMessage('AUTH_ALL_FAILED')).toContain('your Google accounts');
  });
});
