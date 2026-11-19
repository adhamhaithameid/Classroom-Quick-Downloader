// filepath: extension/tests/architecture/ui-single-source.test.ts
/**
 * Architecture fitness suite — UI single source (v3-base design, test plan
 * item 3 / chat brief test (c)).
 *
 * Design doc: docs/audit/2026-11-18-v3-base-design.md — "V2 render owns all
 * sanctioned UI (buttons, badges, download-all, styles)" and "Second UI
 * exists — V1 legacy stacks, mode-gated". Rule (c): no UI module outside V2
 * render creates UI.
 *
 * Scope (fix round 1 — widened): every .ts/.tsx file under src/** and
 * entrypoints/**, recursively. The sanctioned zone is src/v2/render/** ONLY;
 * everything else scanned must not create DOM unless the allowlist names it.
 *
 * Banned outside the sanctioned zone + allowlist:
 *   - document.createElement, ANY tag (subsumes the button rule: a second UI
 *     can start from a div just as well as from a button).
 *   - innerHTML assignment, insertAdjacentHTML calls.
 * The engine layers (src/engines/**, src/strategies/**, and the V2
 * orchestrator/model/context/decision/selectors dirs) are a focused subset:
 * they compute, they never create DOM. Their dedicated test below survives
 * even if the wide rule is ever loosened.
 *
 * All scans run over comments-AND-strings-stripped source (engine-layers
 * codeOf idiom). The any-tag rule is identifier-style, so string blanking is
 * safe — and it also keeps CSS/HTML text inside template literals (styles.ts,
 * debug-panel.ts PANEL_STYLES) from false-matching.
 *
 * The known second UI is pinned by the sectioned allowlist below instead of
 * passing silently. Sections, so the follow-up bead can find them:
 *   - V1_LEGACY: mode-gated rollback stacks; list must only shrink.
 *   - UNGATED: V1-era student-work/download-all creators reachable from
 *     entrypoints with NO mode gate — the live parallel-UI gap; distinct
 *     section, own follow-up bead.
 *   - CELEBRATION: cross-cutting celebration surface, own bead.
 *   - DEV_TOOLING: developer-only surfaces (debug panel, diagnostics page).
 *
 * Each scanner is canary-tested against a violating snippet, and the probe
 * drill (temp createElement in a guarded file, red, revert) proves the scan
 * bites (non-vacuity).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const EXT = resolve(process.cwd());
const SRC = join(EXT, 'src');
const ENTRYPOINTS_DIR = join(EXT, 'entrypoints');

/** The one sanctioned creator zone: src/v2/render/** (extension-relative). */
const SANCTIONED_ZONE_EXCLUDE = /^src\/v2\/render\//;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** Full scan set (src/** + entrypoints/**, minus the sanctioned zone), as
 * extension-relative posix paths. */
function scanSet(): string[] {
  const files = [...walk(SRC), ...walk(ENTRYPOINTS_DIR)];
  return files.filter((f) => !SANCTIONED_ZONE_EXCLUDE.test(relToExt(f)));
}

/** extension-relative path of a scanned file (posix separators). */
function relToExt(file: string): string {
  return relative(EXT, file).replace(/\\/g, '/');
}

/**
 * Comments AND string-literal contents stripped — a single-pass,
 * escape-aware scanner (codeOf intent from engine-layers.test.ts, made
 * tokenizer-accurate). Sequential regexes cannot do this job: comments-first
 * swallows live code when template-literal CSS text carries `/*` (real case:
 * comment_frame/edited_frame), strings-first swallows live code when a
 * comment carries an apostrophe. The state machine handles both, plus JSDoc
 * backticks. Known limitation: regex literals are not modeled — the
 * no-swallowed/no-fabricated verification over the whole scan set covers
 * this corpus.
 */
function codeOf(source: string): string {
  let out = '';
  let state: 'code' | 'line' | 'block' | 'template' | 'single' | 'double' = 'code';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i]!;
    const d = i + 1 < n ? source[i + 1]! : '';
    if (state === 'code') {
      if (c === '/' && d === '/') {
        state = 'line';
        i += 2;
        continue;
      }
      if (c === '/' && d === '*') {
        state = 'block';
        i += 2;
        continue;
      }
      if (c === '`') {
        state = 'template';
        out += '""';
        i += 1;
        continue;
      }
      if (c === "'") {
        state = 'single';
        out += '""';
        i += 1;
        continue;
      }
      if (c === '"') {
        state = 'double';
        out += '""';
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (c === '\n') {
        state = 'code';
        out += c;
      }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && d === '/') {
        state = 'code';
        i += 2;
        continue;
      }
      if (c === '\n') out += c;
      i += 1;
      continue;
    }
    // String-ish states: honor escapes, recover at end of line for
    // unterminated quotes, close on the state's delimiter.
    if (c === '\\' && i + 1 < n) {
      i += 2;
      continue;
    }
    const closer = state === 'template' ? '`' : state === 'single' ? "'" : '"';
    if (c === closer) {
      state = 'code';
      out += '""';
      i += 1;
      continue;
    }
    if (c === '\n' && state !== 'template') {
      state = 'code';
      out += c;
      i += 1;
      continue;
    }
    i += 1;
  }
  return out;
}

// Brief regexes, verbatim. The `i` flag implements the brief's "any case"
// variant for the tag argument; DOM property names stay case-sensitive.
const BUTTON_CREATION = /createElement\(\s*['"]button['"]/i;
const HTML_ASSIGNMENT = /\.(innerHTML|insertAdjacentHTML)\s*=/;
const INSERT_ADJACENT_CALL = /\.\s*insertAdjacentHTML\s*\(/;
/** The wide rule: no createElement call at all outside the sanctioned zone
 * plus the allowlist (any tag, any quoting). */
const ANY_CREATE_ELEMENT = /document\.createElement\(/;

/**
 * Allowlist — extension-relative paths allowed to create UI, each with its
 * one-line reason. Sectioned (see header). Empty in the mandated red-first
 * run; the green run populates it from what the red run actually lists.
 */
const V1_LEGACY_ALLOWLIST: Record<string, string> = {
  'entrypoints/comment_frame.content.ts':
    'V1 legacy stack, gated by mode-gate; V2-render move deferred (design doc open items)',
  'entrypoints/download_all.content.ts':
    'V1 legacy stack, gated by mode-gate; V2-render move deferred (design doc open items)',
  'entrypoints/edited_frame.content.ts':
    'V1 legacy stack, gated by mode-gate; V2-render move deferred (design doc open items)',
  'entrypoints/content/both-badge.ts':
    'V1 legacy stack, gated by mode-gate; V2-render move deferred (design doc open items)',
  'entrypoints/content/button-factory.ts':
    'V1 legacy stack, gated by mode-gate; V2-render move deferred (design doc open items)',
  'entrypoints/content/flags.ts':
    'V1 legacy stack, gated by mode-gate; V2-render move deferred (design doc open items)',
  'entrypoints/content/styles.ts':
    'V1 legacy stack, gated by mode-gate; V2-render move deferred (design doc open items)',
};

/**
 * UNGATED — the live parallel-UI gap (fix round 1). Files here render UI
 * from entrypoints that never consult mode-gate, so they appear in EVERY
 * mode, including pure-V2. Own follow-up bead; this list must only shrink.
 */
const UNGATED_ALLOWLIST: Record<string, string> = {
  'src/download-all/button-controller.ts':
    'UNGATED V1-era student-work/download-all creators; parallel-UI follow-up (out of chat lane: entrypoints outside content/** are NEEDS-OWNER)',
  'src/student_work/button.ts':
    'UNGATED V1-era student-work/download-all creators; parallel-UI follow-up (out of chat lane: entrypoints outside content/** are NEEDS-OWNER)',
  'src/student_work/resolver.ts':
    'hidden resolver iframe (mechanism, not user-visible UI); documented for inventory completeness',
  'entrypoints/student_work_by_status.content.ts':
    'UNGATED V1-era student-work/download-all creators; parallel-UI follow-up (out of chat lane: entrypoints outside content/** are NEEDS-OWNER)',
  'entrypoints/student_work_sidecar.content.ts':
    'UNGATED V1-era student-work/download-all creators; parallel-UI follow-up (out of chat lane: entrypoints outside content/** are NEEDS-OWNER)',
};

const CELEBRATION_ALLOWLIST: Record<string, string> = {
  'src/celebration/page-celebration.ts':
    'cross-cutting celebration surface (popup + content), own bead',
  'src/celebration/confetti.ts':
    'cross-cutting celebration surface (popup + content), own bead',
};

const DEV_TOOLING_ALLOWLIST: Record<string, string> = {
  'src/v2/debug/debug-panel.ts':
    'debug panel (dev tooling, window.__CQD_DEBUG_PANEL_TOGGLE), read-only, not product UI',
  'src/v2/debug/decision-trace-view.ts':
    'debug panel corpus export (Blob download anchor), dev tooling, not product UI',
  'entrypoints/diagnostics/DiagnosticsApp.tsx':
    'diagnostics support page (user-facing report export), not download UI',
};

const UI_CREATION_ALLOWLIST: Record<string, string> = {
  ...V1_LEGACY_ALLOWLIST,
  ...UNGATED_ALLOWLIST,
  ...CELEBRATION_ALLOWLIST,
  ...DEV_TOOLING_ALLOWLIST,
};

/**
 * Engine layers compute; they never create DOM nodes. Prefixes are
 * extension-relative.
 */
const ENGINE_LAYER_PREFIXES = [
  'src/engines/',
  'src/strategies/',
  'src/v2/orchestrator/',
  'src/v2/model/',
  'src/v2/context/',
  'src/v2/decision/',
  'src/v2/selectors/',
];

function isEngineLayer(rel: string): boolean {
  return ENGINE_LAYER_PREFIXES.some((p) => rel.startsWith(p));
}

describe('fitness: UI single source (v3-base test (c))', () => {
  it('flags button creation and HTML injection in violating snippets (scanner canary)', () => {
    expect(BUTTON_CREATION.test("document.createElement('button')")).toBe(true);
    expect(BUTTON_CREATION.test('document.createElement("BUTTON")')).toBe(true);
    expect(BUTTON_CREATION.test("document.createElement('div')")).toBe(false);
    expect(HTML_ASSIGNMENT.test('el.innerHTML = markup;')).toBe(true);
    expect(HTML_ASSIGNMENT.test('el.insertAdjacentHTML = f;')).toBe(true);
    expect(INSERT_ADJACENT_CALL.test('el. insertAdjacentHTML ("<b>x</b>")')).toBe(true);
    expect(HTML_ASSIGNMENT.test('readInnerHTML();')).toBe(false);
    expect(ANY_CREATE_ELEMENT.test('const d = document.createElement("div");')).toBe(true);
    expect(ANY_CREATE_ELEMENT.test('createElementShim("div");')).toBe(false);
    // CSS/HTML text inside strings must not read as a call after the
    // codeOf-style blanking the file scans apply.
    const blanked = 'const t = ".innerHTML =";'.replace(/"(?:\\.|[^"\\])*"/g, '""');
    expect(blanked).toBe('const t = "";');
    expect(HTML_ASSIGNMENT.test(blanked)).toBe(false);
  });

  it('every allowlist entry names a real file with a reason so the rule cannot rot', () => {
    for (const [p, reason] of Object.entries(UI_CREATION_ALLOWLIST)) {
      expect(existsSync(join(EXT, p)), `${p} must exist`).toBe(true);
      expect(reason.length, `${p} needs a documented reason`).toBeGreaterThan(0);
    }
  });

  it('UNGATED section entries all sit in the merged allowlist so the follow-up bead can find them', () => {
    for (const [p, reason] of Object.entries(UNGATED_ALLOWLIST)) {
      expect(UI_CREATION_ALLOWLIST[p], `${p} must stay merged`).toBe(reason);
    }
  });

  it('scan set is non-empty and covers the files the rule claims to guard', () => {
    const files = scanSet();
    expect(files.length).toBeGreaterThan(0);
    const rels = new Set(files.map(relToExt));
    // The known second-UI files, the guarded layers, and the UNGATED
    // creators are in scope, or the guard lies.
    for (const known of [
      'entrypoints/content/button-factory.ts',
      'entrypoints/download_all.content.ts',
      'src/engines/v3/file-reconciler.ts',
      'src/v2/orchestrator/orchestrator.ts',
      'src/student_work/button.ts',
      'src/download-all/button-controller.ts',
    ]) {
      expect(rels.has(known), `${known} must be in the scan set`).toBe(true);
    }
    // v2/render is the sanctioned creator — excluded from the scan, and the
    // exclusion must be real (the renderer exists).
    expect(rels.has('src/v2/render/button-renderer.ts')).toBe(false);
    expect(existsSync(join(EXT, 'src/v2/render/button-renderer.ts'))).toBe(true);
  });

  it('no scanned module outside v2/render creates UI outside the allowlist', () => {
    const offenders: string[] = [];
    for (const file of scanSet()) {
      const rel = relToExt(file);
      if (rel in UI_CREATION_ALLOWLIST) continue;
      const code = codeOf(readFileSync(file, 'utf8'));
      const hit =
        ANY_CREATE_ELEMENT.test(code) ||
        HTML_ASSIGNMENT.test(code) ||
        INSERT_ADJACENT_CALL.test(code);
      if (hit) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('engine layers create no DOM nodes at all (any tag)', () => {
    const offenders: string[] = [];
    for (const file of scanSet()) {
      const rel = relToExt(file);
      if (!isEngineLayer(rel)) continue;
      if (ANY_CREATE_ELEMENT.test(codeOf(readFileSync(file, 'utf8')))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
