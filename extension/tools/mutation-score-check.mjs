// filepath: extension/tools/mutation-score-check.mjs
/**
 * CI gate for the Stryker run on src/core (S12).
 *
 * `stryker run` exits 0 because thresholds.break is null — the score is
 * enforced HERE instead, so a regression fails the nightly job and the
 * workflow auto-files an issue.
 *
 * Usage: node tools/mutation-score-check.mjs [minimum] [reportPath]
 *   minimum    default 80
 *   reportPath default reports/mutation/mutation.json
 *
 * Score formula matches Stryker's own reporting:
 *   detected / (killed + timeout + survived + noCoverage)
 * (Ignored mutants are excluded from the denominator by Stryker itself.)
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const minimumArg = Number(process.argv[2] ?? 80);
const reportArg = process.argv[3] ?? resolve(here, '..', 'reports', 'mutation', 'mutation.json');

if (!existsSync(reportArg)) {
  console.error(`mutation report not found: ${reportArg}`);
  console.error('run `pnpm -C extension run test:mutation` first');
  process.exit(2);
}

if (Number.isNaN(minimumArg) || minimumArg < 0 || minimumArg > 100) {
  console.error(`invalid minimum score: ${process.argv[2]}`);
  process.exit(2);
}

const report = JSON.parse(readFileSync(reportArg, 'utf8'));

const tally = { killed: 0, timeout: 0, survived: 0, noCoverage: 0, ignored: 0, other: 0 };
for (const file of Object.values(report.files)) {
  for (const mutant of file.mutants ?? []) {
    switch (mutant.status) {
      case 'Killed': tally.killed += 1; break;
      case 'Timeout': tally.timeout += 1; break;
      case 'Survived': tally.survived += 1; break;
      case 'NoCoverage': tally.noCoverage += 1; break;
      case 'Ignored': tally.ignored += 1; break;
      default: tally.other += 1; break;
    }
  }
}

const detected = tally.killed + tally.timeout;
const denominator = detected + tally.survived + tally.noCoverage;
const score = denominator === 0 ? 100 : (detected / denominator) * 100;

const perFile = Object.entries(report.files)
  .map(([path, file]) => {
    const c = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0 };
    for (const m of file.mutants ?? []) {
      if (m.status in c) c[m.status] += 1;
    }
    const d = c.Killed + c.Timeout;
    const t = d + c.Survived + c.NoCoverage;
    return { path, score: t === 0 ? 100 : (d / t) * 100 };
  })
  .sort((a, b) => a.score - b.score);

console.log('Mutation score report (src/core)');
console.log(`  killed ${tally.killed} · timeout ${tally.timeout} · survived ${tally.survived} · no-cov ${tally.noCoverage} · ignored ${tally.ignored}`);
for (const f of perFile) {
  console.log(`  ${f.score.toFixed(2).padStart(6)}%  ${f.path}`);
}
console.log(`  TOTAL: ${score.toFixed(2)}% (minimum ${minimumArg}%)`);

if (score < minimumArg) {
  console.error(`FAIL: mutation score ${score.toFixed(2)}% is below the ${minimumArg}% gate`);
  process.exit(1);
}
console.log('PASS');
