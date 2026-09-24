// filepath: extension/tests/student-work-channel.guard.test.ts
// ============================================================================
// STUDENT-WORK CHANNEL GUARD (S4) — audit
// docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md finding S4.
//
// The BroadcastChannel fallback in src/student_work/channel.ts had no sender
// authentication: any same-origin page JS could inject a
// CQD_SW_RESOLVE_RESULT onto the channel and feed the resolver a chosen
// resolvedUrl. It was unreachable in production (every supported browser
// exposes chrome.runtime in content scripts, and the runtime path checks
// sender.id), but dead code with an unauthenticated ingress is a trap. This
// guard pins its removal: the resolver communicates ONLY over the
// authenticated chrome.runtime relay.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const channelSource = readFileSync(
  join(here, '../src/student_work/channel.ts'),
  'utf8',
);

describe('student-work channel guard (S4)', () => {
  it('uses no BroadcastChannel fallback', () => {
    // Prose may reference the removed fallback in comments; the guard pins
    // the construct itself — no channel may ever be constructed or listened.
    expect(channelSource).not.toMatch(/new\s+BroadcastChannel/);
    expect(channelSource).not.toMatch(/\.onmessage\s*=/);
    expect(channelSource).not.toContain('STUDENT_WORK_CHANNEL_NAME');
  });

  it('still publishes and waits over the authenticated runtime relay', () => {
    expect(channelSource).toContain('sendMessage(');
    expect(channelSource).toContain('onMessage.addListener');
  });

  it('keeps the sender.id check on incoming resolve results', () => {
    expect(channelSource).toMatch(/sender\.id/);
  });
});
