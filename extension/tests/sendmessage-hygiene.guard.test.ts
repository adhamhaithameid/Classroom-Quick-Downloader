// filepath: extension/tests/sendmessage-hygiene.guard.test.ts
// ============================================================================
// SENDMESSAGE HYGIENE GUARD (S5) — audit
// docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md finding S5.
//
// Fire-and-forget chrome.runtime/tabs.sendMessage calls without a callback
// make Chrome log "Unchecked runtime.lastError: The message port closed
// before a response was received." whenever the receiver is gone (extension
// reload, background asleep, no listener). Every fire-and-forget site must
// pass a callback that consumes lastError — the repo idiom is
// `(response) => void chrome.runtime.lastError`.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(here, '..');

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Strip string/template literals and comments so regex scanning of call
 *  shapes does not trip over prose or fixture payloads. */
function stripLiteralsAndComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

describe('sendMessage hygiene guard (S5)', () => {
  const files = [
    ...listTsFiles(join(extensionRoot, 'entrypoints')),
    ...listTsFiles(join(extensionRoot, 'src')),
  ].filter((f) => !f.includes(`${extensionRoot}/node_modules`));

  it('scanned a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('every fire-and-forget sendMessage passes a lastError-consuming callback', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(extensionRoot, file);
      const stripped = stripLiteralsAndComments(readFileSync(file, 'utf8'));

      // Find each sendMessage( and inspect the argument list for a trailing
      // callback argument before its closing paren.
      const callRe = /\.(sendMessage|connect)\s*\(/g;
      let match: RegExpExecArray | null;
      while ((match = callRe.exec(stripped)) !== null) {
        const open = match.index + match[0].length;
        let depth = 1;
        let i = open;
        for (; i < stripped.length && depth > 0; i++) {
          const ch = stripped[i];
          if (ch === '(') depth += 1;
          else if (ch === ')') depth -= 1;
        }
        const args = stripped.slice(open, i - 1);
        // A trailing arrow/function callback that consumes lastError is the
        // accepted pattern. Detect `lastError` inside the argument list.
        if (!args.includes('lastError')) {
          offenders.push(`${rel}: ${match[0]}…${args.trim().slice(0, 60)}`);
        }
      }
    }

    expect(offenders, JSON.stringify(offenders, null, 1)).toEqual([]);
  });
});
