// filepath: extension/tests/v3-mutation-killers.test.ts
/**
 * Mutation killers for the v3-base files (chat 7 Part A, 2026-11-19).
 * Each test names the Stryker mutant(s) it kills (by BEFORE-run mutant id).
 * Targets: capability.ts, config.ts, token-source.ts, file-reconciler.ts.
 */
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeIdentityCapability } from '../src/engines/v3/api/capability';
import { isApiConfigured } from '../src/engines/v3/api/config';
import { setEngineBase } from '../src/engines/engine-base';
import { WebAuthFlowTokenSource } from '../src/engines/v3/api/token-source';
import {
  MAX_RECONCILE_SNAPSHOT_AGE_MS,
  reconcileApiFiles,
} from '../src/engines/v3/file-reconciler';
import { ViewKind } from '../src/engines/types';
import type { PostNode } from '../src/engines/types';
import type { ClassroomApiSnapshot } from '../src/engines/v3/api/types';

if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const CHROMIUM_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/130.0.0.0 Safari/537.36';

describe('capability.ts killers', () => {
  it('no brands + Chromium-only UA never answers getAuthToken (mutants 20)', () => {
    const r = probeIdentityCapability({
      userAgent: CHROMIUM_UA,
      apis: { getAuthToken: () => {} },
    });
    expect(r.identity).toBe('none');
  });

  it('no brands + UA carrying BOTH Chrome/ and Chromium/ is not Google Chrome (mutant 22)', () => {
    const r = probeIdentityCapability({
      userAgent: `${CHROME_UA} Chromium/131.0.0.0`,
      apis: { getAuthToken: () => {} },
    });
    expect(r.identity).toBe('none');
  });

  it('a non-string userAgent with a Brave brand still answers none (mutant 29)', () => {
    const r = probeIdentityCapability({
      userAgent: 42 as unknown as string,
      apis: {},
      brands: ['Brave'],
      relayAvailable: true,
    });
    expect(r.identity).toBe('none');
  });
});

describe('config.ts killers (isApiConfigured)', () => {
  const MANIFEST = (extra: Record<string, unknown> = {}) => ({
    permissions: ['identity'],
    oauth2: {
      client_id: 'c.apps.googleusercontent.com',
      web_client_id: 'w.apps.googleusercontent.com',
    },
    ...extra,
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setEngineBase('v2');
  });

  it('a throwing userAgentData getter reads as not Chrome (mutant 102)', () => {
    vi.stubGlobal('chrome', { runtime: { getManifest: () => MANIFEST() } });
    vi.stubGlobal('navigator', {
      userAgent: CHROME_UA,
      get userAgentData() {
        throw new Error('hostile');
      },
    });
    expect(isApiConfigured()).toBe(false);
  });

  it('a throwing userAgentData getter does not crash the brand read on the web path (covers 112/113 catch)', () => {
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => MANIFEST(), sendMessage: () => {} },
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 Firefox/133.0',
      get userAgentData() {
        throw new Error('hostile');
      },
    });
    setEngineBase('v3');
    expect(isApiConfigured()).toBe(true);
  });

  it('a null brand entry does not hide a later Google Chrome brand (mutant 99)', () => {
    vi.stubGlobal('chrome', { runtime: { getManifest: () => MANIFEST() } });
    vi.stubGlobal('navigator', {
      userAgentData: { brands: [null, { brand: 'Google Chrome' }] },
    });
    expect(isApiConfigured()).toBe(true);
  });

  it('brand names reach the probe: Brave on an unknown UA configures (mutants 103,104,107,108,109)', () => {
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => MANIFEST(), sendMessage: () => {} },
    });
    vi.stubGlobal('navigator', {
      userAgent: 'UnknownHost/1.0',
      userAgentData: { brands: [null, { brand: 'Brave' }] },
    });
    setEngineBase('v3');
    expect(isApiConfigured()).toBe(true);
  });

  it('a manifest with the identity permission but no oauth2 section is false, no throw (mutant 154)', () => {
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ permissions: ['identity'] }) },
    });
    vi.stubGlobal('navigator', { userAgent: CHROME_UA, userAgentData: undefined });
    setEngineBase('v3');
    expect(isApiConfigured()).toBe(false);
  });

  it('an absent navigator reads as an empty UA: false, never throws (mutants 175,178)', () => {
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => MANIFEST() },
      identity: { launchWebAuthFlow: () => {} },
    });
    vi.stubGlobal('navigator', undefined);
    setEngineBase('v3');
    expect(isApiConfigured()).toBe(false);
  });

  it('a DIRECT launchWebAuthFlow surface alone configures (no relay) (mutant 180)', () => {
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => MANIFEST() },
      identity: { launchWebAuthFlow: () => {} },
    });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Firefox/133.0', userAgentData: undefined });
    setEngineBase('v3');
    expect(isApiConfigured()).toBe(true);
  });

  it('the background RELAY alone configures (no identity surface) (mutants 184,187)', () => {
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => MANIFEST(), sendMessage: () => {} },
    });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Firefox/133.0', userAgentData: undefined });
    setEngineBase('v3');
    expect(isApiConfigured()).toBe(true);
  });
});

describe('token-source.ts killers', () => {
  it('the state parameter is unpadded base64url (16 bytes would leave "==") (mutant 202)', async () => {
    let authUrl = '';
    const source = new WebAuthFlowTokenSource({
      getClientId: () => 'cid',
      getRedirectUrl: () => 'https://x.chromiumapp.org/',
      launchWebAuthFlow: async ({ url }) => {
        authUrl = url;
        return undefined;
      },
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
      randomBytes: (n) => new Uint8Array(n).fill(0xa5),
      log: () => {},
    });
    await source.getToken(true);
    const state = new URL(authUrl).searchParams.get('state') ?? '';
    expect(state).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(state).not.toContain('=');
  });
});

describe('file-reconciler.ts killers', () => {
  const NOW = 1_000_000_000;

  function post(): PostNode {
    return {
      id: 'p',
      element: document.createElement('article'),
      viewKind: ViewKind.STUDENT_SUBMISSIONS,
      files: [],
      flags: null,
      lastScannedAt: 0,
    };
  }

  function snap(over: {
    fetchedAt?: number;
    studentSubmissionId?: string | null;
    submissions?: unknown;
  }): ClassroomApiSnapshot {
    return {
      fetchedAt: over.fetchedAt ?? NOW,
      context: {
        viewKind: ViewKind.STUDENT_SUBMISSIONS,
        courseId: 'C',
        courseWorkId: 'W',
        authUser: null,
        studentSubmissionId: over.studentSubmissionId === undefined ? 'S' : over.studentSubmissionId,
      },
      submissions: (over.submissions ?? [
        {
          id: 'S',
          state: 'TURNED_IN',
          attachments: [
            { id: 'F', title: 'a.pdf', downloadUrl: 'u', source: 'driveFile' },
          ],
        },
      ]) as ClassroomApiSnapshot['submissions'],
    };
  }

  it('a snapshot EXACTLY at the age bound is still fresh (mutant 318)', () => {
    const s = snap({ fetchedAt: NOW - MAX_RECONCILE_SNAPSHOT_AGE_MS });
    expect(reconcileApiFiles(s, post(), NOW)).toHaveLength(1);
  });

  it('a null studentSubmissionId reconciles nothing even if a malformed submission has a null id (mutant 323)', () => {
    const s = snap({
      studentSubmissionId: null,
      submissions: [
        {
          id: null,
          state: 'TURNED_IN',
          attachments: [{ id: 'F', title: 'a.pdf', downloadUrl: 'u', source: 'driveFile' }],
        },
      ],
    });
    expect(reconcileApiFiles(s, post(), NOW)).toEqual([]);
  });

  it('the same Drive id twice in one submission yields ONE file (mutant 345)', () => {
    const s = snap({
      submissions: [
        {
          id: 'S',
          state: 'TURNED_IN',
          attachments: [
            { id: 'F', title: 'a.pdf', downloadUrl: 'u', source: 'driveFile' },
            { id: 'F', title: 'a.pdf', downloadUrl: 'u', source: 'driveFile' },
          ],
        },
      ],
    });
    expect(reconcileApiFiles(s, post(), NOW)).toHaveLength(1);
  });
});
