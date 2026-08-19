/**
 * Prints the accuracy table for humans. The gate is the test; this is the
 * number you paste into a session log or a status update.
 *
 * Usage: pnpm --dir extension run accuracy:report
 */
import { execFileSync } from 'node:child_process';

const out = execFileSync(
  'pnpm',
  ['vitest', 'run', 'tests/accuracy/accuracy.test.ts', '--reporter=verbose'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
console.log(out);
