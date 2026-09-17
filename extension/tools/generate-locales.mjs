// filepath: extension/tools/generate-locales.mjs
/**
 * generate-locales.mjs — single source of truth for chrome.i18n `_locales`.
 *
 * Reads TRANSLATIONS out of `entrypoints/content/i18n.ts` (the canonical
 * translation table used by `t()` in content scripts) and emits one
 * `chrome.i18n` messages file per locale:
 *
 *   extension/_locales/<locale_dir>/messages.json
 *
 * Contract (enforced by tests/locales-generated.test.ts and a CI drift step):
 *   - Message strings are byte-identical to the TRANSLATIONS values.
 *   - Each entry is {"message": "<exact string>", "description": "<original key>"}.
 *     The `description` field carries the original camelCase t() key, which
 *     makes the snake_case mapping reversible.
 *   - Message keys are snake_cased (`ariaDownload` -> `aria_download`) because
 *     chrome.i18n message names are case-insensitive and t() keys are camelCase.
 *     `after_posting`-style keys pass through unchanged.
 *   - Locale directories use chrome.i18n underscore format:
 *     language lowercase, region segment uppercase (zh-cn -> zh_CN),
 *     4-letter script segment title-case (sr-latn -> sr_Latn).
 *
 * Design notes:
 *   - chrome.i18n reserves `$name$` for declared placeholders. A survey of
 *     TRANSLATIONS (147 locales x 25 keys) found ZERO `$` characters, so no
 *     escaping is needed. The generator FAILS if a `$` ever appears, forcing
 *     a conscious decision about `$$` escaping / placeholders at that point.
 *   - All 147 locales are generated (none is identical to en; chrome only
 *     requires the default_locale table at minimum, missing messages fall
 *     back to it at runtime).
 *   - Loading i18n.ts: the file is a pure data + functions module (no imports,
 *     no top-level side effects), but it is TypeScript. Node's type-stripping
 *     is version-gated (default only from 22.18/23.6+), so we transpile with
 *     the `typescript` package (a direct devDependency) and import the result
 *     from a temp file. No regex parsing of the source — a real module load.
 *   - `extension/_locales/` is intentionally NOT in the build output yet:
 *     Chrome rejects an extension that has `_locales` without
 *     `default_locale` in the manifest, and the manifest bit lands with the
 *     parallel homepage_url edit (S12 wires default_locale + build copy).
 *     Today `_locales` is the CI drift-check contract for manifest-driven
 *     surfaces (popup/options/store metadata); content-script `t()` keeps
 *     resolving via TRANSLATIONS because chrome.i18n.getMessage follows the
 *     browser UI locale, not the page locale t() must follow.
 *
 * Usage:
 *   node tools/generate-locales.mjs          # regenerate extension/_locales
 *   node tools/generate-locales.mjs --check  # verify; exit 1 on drift, write nothing
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = path.resolve(__dirname, '..');
const I18N_SOURCE = path.join(EXTENSION_ROOT, 'entrypoints', 'content', 'i18n.ts');
const LOCALES_DIR = path.join(EXTENSION_ROOT, '_locales');

/** camelCase/`after_posting` t() key -> chrome.i18n message name ([a-zA-Z0-9_]). */
export function toMessageKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error(`Invalid translation key: ${JSON.stringify(key)}`);
  }
  const snake = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();
  if (!/^[a-zA-Z0-9_]+$/.test(snake)) {
    throw new Error(`Translation key "${key}" maps to "${snake}", which is not a valid chrome.i18n message name ([a-zA-Z0-9_] only).`);
  }
  return snake;
}

/** TRANSLATIONS locale code -> chrome.i18n directory name (en_US style). */
export function toDirName(locale) {
  const segments = locale.split('-');
  const dir = segments
    .map((segment, index) => {
      const lower = segment.toLowerCase();
      if (index === 0) return lower;
      if (lower.length === 2) return lower.toUpperCase(); // region: zh-cn -> zh_CN
      if (lower.length === 4) return lower[0].toUpperCase() + lower.slice(1); // script: sr-latn -> sr_Latn
      return lower;
    })
    .join('_');
  if (!/^[a-zA-Z0-9_]+$/.test(dir)) {
    throw new Error(`Locale "${locale}" maps to directory "${dir}", which is not a valid chrome.i18n locale directory name.`);
  }
  return dir;
}

/** chrome.i18n directory name back to the TRANSLATIONS locale code. */
export function fromDirName(dir) {
  return dir.toLowerCase().replace(/_/g, '-');
}

/**
 * Build the chrome.i18n messages object for one locale table.
 * Returns {[messageName]: {message, description: originalKey}}.
 */
export function buildLocaleMessages(locale, table) {
  if (!table || typeof table !== 'object' || Array.isArray(table)) {
    throw new Error(`Locale "${locale}" has a non-object table.`);
  }
  const messages = {};
  const seen = new Set();
  for (const [key, value] of Object.entries(table)) {
    if (typeof value !== 'string') {
      throw new Error(`Locale "${locale}" key "${key}" is ${typeof value}, expected string.`);
    }
    if (value.includes('$')) {
      throw new Error(
        `Locale "${locale}" key "${key}" contains "$". chrome.i18n treats $name$ as a placeholder reference; ` +
        'decide on $$ escaping / a placeholders section, then relax this guard.',
      );
    }
    const messageKey = toMessageKey(key);
    const caseKey = messageKey.toLowerCase();
    if (seen.has(caseKey)) {
      throw new Error(`Locale "${locale}": message name "${messageKey}" collides with an earlier key (chrome.i18n names are case-insensitive).`);
    }
    seen.add(caseKey);
    messages[messageKey] = { message: value, description: key };
  }
  return messages;
}

/** Serialize one locale's messages.json exactly as the generator writes it. */
export function serializeMessages(messages) {
  return `${JSON.stringify(messages, null, 2)}\n`;
}

/**
 * Build every locale from TRANSLATIONS.
 * Returns { dirName -> messages.json content } for all locales that have at
 * least one non-empty translation.
 */
export function buildAllLocales(translations) {
  if (!translations || typeof translations !== 'object' || !translations.en) {
    throw new Error('TRANSLATIONS must be an object with an "en" (default_locale) table.');
  }
  const files = {};
  for (const [locale, table] of Object.entries(translations)) {
    const hasNonEmpty = Object.values(table).some((v) => typeof v === 'string' && v.length > 0);
    if (!hasNonEmpty) continue;
    files[toDirName(locale)] = serializeMessages(buildLocaleMessages(locale, table));
  }
  return files;
}

/**
 * Load TRANSLATIONS from i18n.ts without fragile source parsing:
 * transpile to CommonJS with the `typescript` package (direct devDependency,
 * version-stable across CI/dev) and load the result via createRequire.
 * Native require cannot be intercepted by bundler/test-runners, so this path
 * behaves identically under plain node and under vitest.
 */
export function loadTranslationsFromSource(sourcePath = I18N_SOURCE) {
  const require = createRequire(import.meta.url);
  let typescript;
  try {
    typescript = require('typescript');
  } catch {
    throw new Error('The `typescript` package is required to transpile i18n.ts (run from the extension workspace).');
  }
  const source = readFileSync(sourcePath, 'utf8');
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2020,
    },
    fileName: path.basename(sourcePath),
  });
  const tempPath = path.join(os.tmpdir(), `cqd-generate-locales-${process.pid}-${Math.random().toString(36).slice(2)}.cjs`);
  writeFileSync(tempPath, transpiled.outputText, 'utf8');
  try {
    const mod = require(tempPath);
    if (!mod.TRANSLATIONS || typeof mod.TRANSLATIONS !== 'object') {
      throw new Error(`No TRANSLATIONS export found in ${sourcePath}.`);
    }
    return mod.TRANSLATIONS;
  } finally {
    rmSync(tempPath, { force: true });
  }
}

/** Compare generated output against the tree on disk. Returns list of drift descriptions. */
export function diffAgainstDisk(files) {
  const drift = [];
  const existingDirs = existsSync(LOCALES_DIR)
    ? readdirSync(LOCALES_DIR).filter((name) => statSync(path.join(LOCALES_DIR, name)).isDirectory())
    : [];
  for (const dir of existingDirs) {
    if (!files[dir]) drift.push(`stale locale directory: _locales/${dir} (no longer in TRANSLATIONS)`);
  }
  for (const [dir, content] of Object.entries(files)) {
    const filePath = path.join(LOCALES_DIR, dir, 'messages.json');
    if (!existsSync(filePath)) {
      drift.push(`missing locale file: _locales/${dir}/messages.json`);
      continue;
    }
    const current = readFileSync(filePath, 'utf8');
    if (current !== content) drift.push(`drifted: _locales/${dir}/messages.json`);
  }
  return drift;
}

/** Write all generated files and prune locale directories removed from TRANSLATIONS. */
export function writeToDisk(files) {
  mkdirSync(LOCALES_DIR, { recursive: true });
  const expectedDirs = new Set(Object.keys(files));
  for (const name of readdirSync(LOCALES_DIR)) {
    const entryPath = path.join(LOCALES_DIR, name);
    if (!statSync(entryPath).isDirectory()) continue;
    if (!expectedDirs.has(name)) {
      rmSync(entryPath, { recursive: true, force: true });
      console.log(`pruned stale locale directory: _locales/${name}`);
    }
  }
  let written = 0;
  for (const [dir, content] of Object.entries(files)) {
    const dirPath = path.join(LOCALES_DIR, dir);
    mkdirSync(dirPath, { recursive: true });
    writeFileSync(path.join(dirPath, 'messages.json'), content, 'utf8');
    written += 1;
  }
  return written;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const translations = await loadTranslationsFromSource();
  const files = buildAllLocales(translations);
  const locales = Object.keys(translations).length;
  const messageCount = Object.values(translations).reduce((sum, table) => sum + Object.values(table).filter((v) => typeof v === 'string' && v.length > 0).length, 0);

  if (checkOnly) {
    const drift = diffAgainstDisk(files);
    if (drift.length > 0) {
      console.error(`_locales drift detected (${drift.length} issue(s)) vs entrypoints/content/i18n.ts:`);
      for (const line of drift) console.error(`  - ${line}`);
      console.error('Run "pnpm -C extension run locales:generate" and commit the result.');
      process.exitCode = 1;
      return;
    }
    console.log(`_locales in sync with i18n.ts (${locales} locales, ${messageCount} messages).`);
    return;
  }

  const written = writeToDisk(files);
  console.log(`Generated ${written} locales (${messageCount} messages) from entrypoints/content/i18n.ts -> extension/_locales/`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
