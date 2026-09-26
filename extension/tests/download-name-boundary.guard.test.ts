// filepath: extension/tests/download-name-boundary.guard.test.ts
// ============================================================================
// DOWNLOAD NAME BOUNDARY GUARD (S1) — audit
// docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md finding S1.
//
// `handleDownloadRequest` in entrypoints/background/download-handler.ts is the
// SINGLE chokepoint every download request crosses (the CQD_DOWNLOAD onMessage
// listener AND the page-bus bridge both call it). A page-controlled
// `fileMeta.name` that reaches onDeterminingFilename suggest() unfiltered
// relies entirely on the browser sink for sanitization. This guard pins the
// boundary: the chokepoint MUST run `sanitizeDownloadName` (the S1 path
// hardening) over every incoming fileMeta.name, so no future caller can
// reintroduce the raw pass-through without failing CI.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const handlerSource = readFileSync(
  join(here, '../entrypoints/background/download-handler.ts'),
  'utf8',
);

describe('download name boundary guard (S1)', () => {
  it('handleDownloadRequest exists and is the message chokepoint', () => {
    expect(handlerSource).toContain('export function handleDownloadRequest');
  });

  it('sanitizes fileMeta.name through the S1 boundary before registering the pending', () => {
    expect(handlerSource).toMatch(
      /sanitizeDownloadName\s*\(\s*(?:message\.fileMeta|fileMeta)/,
    );
  });

  it('touches message.fileMeta exactly once — only through the boundary call', () => {
    // The single legal occurrence is `sanitizeDownloadName(message.fileMeta)`.
    // Any second use (e.g. the pre-S1 raw `fileMeta,` shorthand fed straight
    // into the PendingDownload literal from an unsanitized source) is a
    // regression of the audit finding.
    const occurrences = handlerSource.match(/message\.fileMeta/g)?.length ?? 0;
    expect(occurrences).toBe(1);
    expect(handlerSource).toMatch(
      /const fileMeta = sanitizeDownloadName\(message\.fileMeta\)/,
    );
  });
});
