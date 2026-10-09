#!/usr/bin/env node
// Token-diet audit — Phase 1 (measure). Reads ZCode session SQLite (read-only),
// emits docs/agent-audit/01-baseline.md + docs/agent-audit/baseline.json.
// Stdlib only. Raw transcript text never leaves this process; reports contain
// counts, paths (home-redacted), tool names, byte sizes, hashes only.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(ROOT, "docs", "agent-audit");
const DB = "/Users/adhamhaithameid/.zcode/cli/db/db.sqlite";
const PROJECT_ID =
  "proj_users-adhamhaithameid-desktop-code-classroom-quick-downloader";
const EXCLUDE = new Set(["sess_d46a1936-9922-4854-b917-a438bd28a37f"]); // current session
const N_SESSIONS = 30;

function q(sql) {
  const r = spawnSync("sqlite3", ["-json", `-cmd`, ".timeout 5000", `file:${DB}?mode=ro`, sql], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`sqlite3 failed: ${r.stderr?.slice(0, 300)}`);
  const s = (r.stdout || "").trim();
  return s ? JSON.parse(s) : [];
}

const idq = (s) => `'${s.replace(/'/g, "")}'`;
const home = process.env.HOME || "";
const redactPath = (p) =>
  typeof p === "string" ? p.replace(home, "~") : p;
const SECRET_RE =
  /((?:sk-|ghp_|gho_|github_pat_|AKIA|xoxb-|Bearer\s)[A-Za-z0-9_\-]{6,})|((?:token|key|secret|passwd|password|api[_-]?key)\s*[=:]\s*["']?[^\s"',;]{4,})/gi;
const redact = (s) =>
  String(s ?? "")
    .replace(SECRET_RE, (m, a, b) => (a ? "[REDACTED-TOK]" : m.split(/[=:]/)[0] + "=***"))
    .replace(/\x1b\[[0-9;]*m/g, "");

// ---------- 1. sessions ----------
const sessions = q(
  `SELECT id, title, time_created, time_updated FROM session
   WHERE project_id='${PROJECT_ID}' AND task_type='interactive' AND directory LIKE '%Classroom-Quick-Downloader%'
   ORDER BY time_created DESC LIMIT ${N_SESSIONS * 3}`
).filter((s) => !EXCLUDE.has(s.id)).slice(0, N_SESSIONS);
if (sessions.length === 0) throw new Error("no sessions found");
const ids = sessions.map((s) => s.id);
const IN = ids.map(idq).join(",");

// ---------- 2. per-session spend (REAL token counts) ----------
const spend = q(
  `SELECT session_id, COUNT(*) turns,
     SUM(input_tokens) in_t, SUM(output_tokens) out_t, SUM(reasoning_tokens) reason_t,
     SUM(cache_creation_input_tokens) cache_w, SUM(cache_read_input_tokens) cache_r,
     SUM(computed_total_tokens) total_t, SUM(duration_ms) dur_ms,
     SUM(model_request_count) reqs, SUM(model_retry_count) mret,
     SUM(tool_call_count) tcalls, SUM(tool_error_count) terr,
     SUM(context_exceeded) ctx_ex
   FROM turn_usage WHERE session_id IN (${IN}) GROUP BY session_id`
);
const spendBy = Object.fromEntries(spend.map((r) => [r.session_id, r]));

// ---------- 3. per-turn tokens (cache collapse + context growth) ----------
const turns = q(
  `SELECT session_id, started_at, input_tokens i, output_tokens o,
          cache_read_input_tokens cr, cache_creation_input_tokens cw
   FROM turn_usage WHERE session_id IN (${IN}) ORDER BY session_id, started_at`
);
const turnsBy = new Map();
for (const t of turns) {
  if (!turnsBy.has(t.session_id)) turnsBy.set(t.session_id, []);
  turnsBy.get(t.session_id).push(t);
}

// ---------- 4. tool calls by name/status ----------
const toolAgg = q(
  `SELECT session_id, tool_name, status, COUNT(*) n, SUM(output_bytes) obytes,
          SUM(retry_count) retries, SUM(truncated) trunc
   FROM tool_usage WHERE session_id IN (${IN})
   GROUP BY session_id, tool_name, status`
);

// ---------- 5. per-call dump (ordering, sequences, before-first-edit) ----------
const calls = q(
  `SELECT session_id, tool_name, status, started_at, output_bytes
   FROM tool_usage WHERE session_id IN (${IN}) ORDER BY session_id, started_at`
);
const callsBy = new Map();
for (const c of calls) {
  if (!callsBy.has(c.session_id)) callsBy.set(c.session_id, []);
  callsBy.get(c.session_id).push(c);
}

// ---------- 6. bash commands (retry loops, unbounded output, ANSI) ----------
const bashCmds = q(
  `SELECT tu.session_id sid, tu.output_bytes ob, tu.status st,
          substr(COALESCE(json_extract(p.data,'$.state.input.command'),''),1,300) cmd
   FROM tool_usage tu JOIN part p
     ON json_extract(p.data,'$.callID') = tu.tool_call_id AND p.session_id = tu.session_id
   WHERE tu.session_id IN (${IN}) AND lower(tu.tool_name) IN ('bash','shell','terminal')
     AND json_extract(p.data,'$.type')='tool'`
);
const ansi = q(
  `SELECT COUNT(*) n FROM part p JOIN tool_usage tu
     ON json_extract(p.data,'$.callID') = tu.tool_call_id AND p.session_id = tu.session_id
   WHERE tu.session_id IN (${IN}) AND lower(tu.tool_name) IN ('bash','shell','terminal')
     AND json_extract(p.data,'$.type')='tool'
     AND instr(COALESCE(json_extract(p.data,'$.state.output'),''), char(27)||'[') > 0`
)[0]?.n ?? 0;

// ---------- 7. file reads ----------
const reads = q(
  `SELECT p.session_id sid, COALESCE(
     json_extract(p.data,'$.state.input.filePath'),
     json_extract(p.data,'$.state.input.path'),
     json_extract(p.data,'$.state.input.file_path')) fp
   FROM part p WHERE p.session_id IN (${IN})
     AND json_extract(p.data,'$.type')='tool'
     AND lower(json_extract(p.data,'$.tool')) IN ('read','view','cat')
     AND fp IS NOT NULL`
);

// ---------- 8. verbosity: assistant prose vs tool-arg bytes ----------
const verbosity = q(
  `SELECT
     COALESCE(SUM(CASE WHEN json_extract(m.data,'$.role')='assistant'
       THEN length(COALESCE(json_extract(p.data,'$.text'),'')) END),0) prose_b,
     COALESCE(SUM(CASE WHEN json_extract(p.data,'$.type')='tool'
       THEN length(COALESCE(json_extract(p.data,'$.state.input'),'')) END),0) arg_b
   FROM part p JOIN message m ON m.id = p.message_id
   WHERE p.session_id IN (${IN})`
)[0] ?? { prose_b: 0, arg_b: 0 };

// ---------- 9. top-20 largest tool results ----------
const top = q(
  `SELECT tu.session_id sid, tu.tool_name tool, tu.output_bytes ob, tu.status st,
     substr(COALESCE(
       json_extract(p.data,'$.state.input.command'),
       json_extract(p.data,'$.state.input.filePath'),
       json_extract(p.data,'$.state.input.file_path'),
       json_extract(p.data,'$.state.input.code'),
       json_extract(p.data,'$.state.input.url'),
       json_extract(p.data,'$.state.input.pattern'),''),1,140) ident
   FROM tool_usage tu
   LEFT JOIN part p ON json_extract(p.data,'$.callID') = tu.tool_call_id AND p.session_id = tu.session_id
     AND json_extract(p.data,'$.type')='tool'
   WHERE tu.session_id IN (${IN})
   ORDER BY tu.output_bytes DESC LIMIT 20`
);

// ---------- 10. compaction + model mix ----------
const compactions = q(
  `SELECT session_id, COUNT(*) n FROM part
   WHERE session_id IN (${IN}) AND json_extract(data,'$.type')='compaction' GROUP BY session_id`
);
const modelMix = q(
  `SELECT model_id, agent, COUNT(*) n, SUM(input_tokens) in_t, SUM(output_tokens) out_t,
          SUM(reasoning_tokens) reason_t, SUM(cache_read_input_tokens) cache_r,
          SUM(cache_creation_input_tokens) cache_w
   FROM model_usage WHERE session_id IN (${IN}) GROUP BY model_id, agent ORDER BY 4 DESC`
);

// ================= compute =================
const EDIT_RE = /^(edit|write|multiedit|notebookedit)$/i;
const TEST_RE = /(vitest|jest|playwright test|npm (run )?test|pnpm test|pytest|cargo test)/i;
const BOUNDED_RE = /(\| head|--stat|-q\b|--quiet|\| tail|--name-only|--oneline|-l\b.*\| )/;

const T = sessions.map((s) => {
  const sp = spendBy[s.id] ?? {};
  const tls = turnsBy.get(s.id) ?? [];
  const cs = callsBy.get(s.id) ?? [];
  const tok = (x) => x || 0;
  // provider counts input_tokens INCLUSIVE of cache reads (verified: computed_total = in + out)
  // cache collapse: turn 3+ with cache_r < 40% of input while input > 5k
  let collapses = 0, collapseFresh = 0, ctx100k = null;
  tls.forEach((t, i) => {
    if (i >= 2 && tok(t.i) > 5000 && tok(t.i) > 0 && tok(t.cr) / tok(t.i) < 0.4) {
      collapses++; collapseFresh += tok(t.i) - tok(t.cr);
    }
    if (ctx100k === null && tok(t.i) + tok(t.cw) > 100_000) ctx100k = i + 1;
  });
  const firstEdit = cs.findIndex((c) => EDIT_RE.test(c.tool_name) && c.status === "completed");
  const editCount = cs.filter((c) => EDIT_RE.test(c.tool_name)).length;
  const completed = cs.filter((c) => c.status === "completed").length;
  const failed = cs.filter((c) => c.status !== "completed").length;
  const toolBytes = cs.reduce((a, c) => a + tok(c.output_bytes), 0);
  return {
    id: s.id,
    started: s.time_created, wall_s: Math.round((s.time_updated - s.time_created) / 1000),
    turns: tok(sp.turns), in_t: tok(sp.in_t), out_t: tok(sp.out_t), reason_t: tok(sp.reason_t),
    cache_r: tok(sp.cache_r), cache_w: tok(sp.cache_w), total_t: tok(sp.total_t),
    cache_ratio: (() => { const d = tok(sp.in_t); return d ? +(tok(sp.cache_r) / d).toFixed(3) : null; })(),
    collapses, collapse_fresh_in_t: collapseFresh, ctx100k_turn: ctx100k,
    compactions: compactions.find((c) => c.session_id === s.id)?.n ?? 0,
    tool_calls: cs.length, failed_calls: failed, edits: editCount,
    calls_before_first_edit: firstEdit < 0 ? cs.length : firstEdit,
    calls_per_edit: editCount ? +(cs.length / editCount).toFixed(1) : null,
    tool_result_bytes: toolBytes,
  };
});

// tool totals by name
const toolTotals = {};
for (const r of toolAgg) {
  const k = r.tool_name;
  toolTotals[k] ??= { calls: 0, failed: 0, bytes: 0, retries: 0, truncated: 0 };
  toolTotals[k].calls += r.n;
  if (r.status !== "completed") toolTotals[k].failed += r.n;
  toolTotals[k].bytes += r.obytes || 0;
  toolTotals[k].retries += r.retries || 0;
  toolTotals[k].truncated += r.trunc || 0;
}

// bash analysis
const cmdCount = new Map(); // per-session-agnostic: exact command repeats
for (const b of bashCmds) {
  const key = (b.cmd || "").trim();
  if (!key) continue;
  const m = cmdCount.get(key) ?? { n: 0, bytes: 0, sessions: new Set() };
  m.n++; m.bytes += b.ob || 0; m.sessions.add(b.sid);
  cmdCount.set(key, m);
}
const retryLoops = [...cmdCount.entries()]
  .filter(([, v]) => v.n >= 3)
  .sort((a, b) => b[1].n - a[1].n).slice(0, 15)
  .map(([cmd, v]) => ({ cmd: redact(cmd).slice(0, 100), n: v.n, bytes: v.bytes }));
const bashBytes = bashCmds.reduce((a, b) => a + (b.ob || 0), 0);
const testRuns = [...cmdCount.entries()].filter(([c]) => TEST_RE.test(c));
const testRunCount = testRuns.reduce((a, [, v]) => a + v.n, 0);
const unbounded = bashCmds.filter(
  (b) => (b.ob || 0) > 20_000 && !BOUNDED_RE.test(b.cmd || "")
);
const unboundedBytes = unbounded.reduce((a, b) => a + (b.ob || 0), 0);
const topCmdFamilies = {};
for (const b of bashCmds) {
  const toks = (b.cmd || "").trim().split(/\s+/);
  const fam = toks.slice(0, 2).join(" ").slice(0, 40) || "(empty)";
  topCmdFamilies[fam] ??= { n: 0, bytes: 0 };
  topCmdFamilies[fam].n++; topCmdFamilies[fam].bytes += b.ob || 0;
}

// reads analysis
const readCount = reads.length;
const perFile = new Map();
for (const r of reads) {
  const fp = redactPath(r.fp);
  perFile.set(fp, (perFile.get(fp) ?? 0) + 1);
}
const hotFiles = [...perFile.entries()].filter(([, n]) => n >= 3)
  .sort((a, b) => b[1] - a[1]).slice(0, 15)
  .map(([fp, n]) => ({ file: fp.replace(/^~\/Desktop\/code\//, "~/code/"), n }));
const fileSessions = new Map();
for (const r of reads) {
  const fp = redactPath(r.fp).replace(/^~\/Desktop\/code\/Classroom-Quick-Downloader\//, "");
  (fileSessions.get(fp) ?? fileSessions.set(fp, new Set()).get(fp)).add(r.sid);
}
const crossSessionFiles = [...fileSessions.entries()]
  .filter(([, v]) => v.size >= 5).sort((a, b) => b[1].size - a[1].size).slice(0, 12)
  .map(([fp, v]) => ({ file: fp, sessions: v.size }));
const noisyReads = [...perFile.entries()].filter(([f]) =>
  /(lock|node_modules|dist|\.min\.|pnpm-lock|package-lock|coverage|\.map$|snapshots?|test-results|playwright-report)/i.test(f)
);

// n-grams (tool-name sequences, completed+failed alike)
const gram = new Map();
const pushGram = (arr) => {
  const k = arr.join(" > ");
  gram.set(k, (gram.get(k) ?? 0) + 1);
};
for (const [, cs] of callsBy) {
  for (let i = 0; i + 2 < cs.length; i++) pushGram(cs.slice(i, i + 3).map((c) => c.tool_name.toLowerCase()));
  for (let i = 0; i + 3 < cs.length; i++) pushGram(cs.slice(i, i + 4).map((c) => c.tool_name.toLowerCase()));
}
const topGrams = [...gram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .map(([seq, n]) => ({ seq, n }));

// totals + weekly projection
const sum = (k) => T.reduce((a, t) => a + (t[k] || 0), 0);
const t0 = Math.min(...T.map((t) => t.started));
const t1 = Math.max(...T.map((t) => t.started + t.wall_s * 1000));
const spanDays = Math.max(1, (t1 - t0) / 86400_000);
const weeks = spanDays / 7;
const totals = {
  sessions: T.length,
  window_days: +spanDays.toFixed(1),
  turns: sum("turns"),
  in_t: sum("in_t"), fresh_in_t: sum("in_t") - sum("cache_r"),
  out_t: sum("out_t"), reason_t: sum("reason_t"),
  cache_r: sum("cache_r"), cache_w: sum("cache_w"), total_t: sum("total_t"),
  model_requests: spend.reduce((a, r) => a + (r.reqs || 0), 0),
  model_retries: spend.reduce((a, r) => a + (r.mret || 0), 0),
  wall_hours: +(sum("wall_s") / 3600).toFixed(1),
  tool_calls: T.reduce((a, t) => a + t.tool_calls, 0),
  failed_calls: T.reduce((a, t) => a + t.failed_calls, 0),
  edits: T.reduce((a, t) => a + t.edits, 0),
  collapses: sum("collapses"), collapse_fresh_in_t: sum("collapse_fresh_in_t"),
  compactions: sum("compactions"),
  bash_result_bytes: bashBytes, unbounded_bash_results: unbounded.length,
  unbounded_bash_bytes: unboundedBytes, ansi_colored_outputs: ansi,
  tool_result_bytes: T.reduce((a, t) => a + t.tool_result_bytes, 0),
  reads: readCount, noisy_reads: noisyReads.reduce((a, [, n]) => a + n, 0),
  prose_bytes: verbosity.prose_b, tool_arg_bytes: verbosity.arg_b,
  test_runs: testRunCount,
};
const perWeek = (x) => Math.round((x || 0) / weeks);
const b4 = (bytes) => Math.round((bytes || 0) / 4);

// per-turn fixed tax (h): measured AGENTS.md 5926B (~1481 tok) + skills/MCP schemas (est.)
const AGENTS_MD_B = 5926;
const fixedTaxPerTurnMeas = b4(AGENTS_MD_B);

// ---- sinks (a)-(h) with est tokens/week ----
const sinks = [
  { id: "h", name: "Per-turn fixed tax (AGENTS.md 1.5k tok + ~290 skill names + 5 MCP tool schemas)",
    evidence: `${totals.turns} turns in window; AGENTS.md 5926B measured`,
    est_wk: perWeek(totals.turns * fixedTaxPerTurnMeas), fix: "Trim AGENTS.md <150 lines; prune unused skills/plugins/MCP (2D/2G)", effort: "M" },
  { id: "b", name: "Unbounded bash output (>20KB, no head/limit)",
    evidence: `${unbounded.length} results, ${unboundedBytes.toLocaleString()}B; ANSI in ${ansi} outputs`,
    est_wk: perWeek(b4(unboundedBytes)), fix: "rtk hook + NO_COLOR/quiet reporters + head caps (2A/2B)", effort: "S" },
  { id: "f", name: "Over-exploration (calls before first edit; calls/edit)",
    evidence: `${T.reduce((a, t) => a + t.calls_before_first_edit, 0)} pre-edit calls; ${totals.tool_calls} calls / ${totals.edits} edits`,
    est_wk: perWeek(b4(totals.tool_result_bytes * 0.5)), fix: "scripts/orient + REPO_MAP.md; read ranges (2D/2E)", effort: "M" },
  { id: "a", name: "Re-deriving repo facts (files read 5+ sessions, hot files)",
    evidence: `${crossSessionFiles.length} files in 5+ sessions; ${hotFiles.length} files read 3+ times; ${noisyReads.reduce((a, [, n]) => a + n, 0)} noisy reads`,
    est_wk: perWeek(b4(readCount * 3000)), fix: "docs/INDEX.md pointers + .rgignore for lock/dist (2C/2D)", effort: "S" },
  { id: "e", name: "Cache-busting (collapses + context>100k)",
    evidence: `${totals.collapses} collapsed turns paying ${totals.collapse_fresh_in_t.toLocaleString()} fresh input tok (cr<40% of input)`,
    est_wk: perWeek(totals.collapse_fresh_in_t), fix: "Stable prefix: no mid-session AGENTS.md/MCP edits (2F)", effort: "S" },
  { id: "d", name: "Verbose assistant prose",
    evidence: `${verbosity.prose_b.toLocaleString()}B prose vs ${verbosity.arg_b.toLocaleString()}B tool args (bytes/4 proxy)`,
    est_wk: perWeek(b4(verbosity.prose_b)), fix: "6-line final report rule; caveman A/B (2J)", effort: "S" },
  { id: "c", name: "Retry loops (identical cmd 3+)",
    evidence: `${retryLoops.length} commands; ${totals.failed_calls} failed calls; ${Object.values(toolTotals).reduce((a, v) => a + v.retries, 0)} harness retries`,
    est_wk: perWeek(b4(retryLoops.reduce((a, r) => a + r.bytes, 0) + totals.failed_calls * 4000)), fix: "scripts/check; stop on repeated failure (2E)", effort: "M" },
  { id: "g", name: "Redundant verification (full test runs)",
    evidence: `${testRunCount} test-suite invocations`,
    est_wk: perWeek(b4(testRuns.reduce((a, [, v]) => a + v.bytes, 0))), fix: "scripts/check --changed (vitest related) (2E)", effort: "M" },
];

// rank by est_wk desc
const ranked = [...sinks].sort((a, b) => b.est_wk - a.est_wk);

const baseline = {
  generated_at: new Date().toISOString(),
  db: DB, project_id: PROJECT_ID, excluded_current_session: [...EXCLUDE],
  sessions_analyzed: T.length, window_days: totals.window_days,
  model_mix: modelMix.map((m) => ({ model: m.model_id, agent: m.agent, n: m.n, in_t: m.in_t, out_t: m.out_t, reason_t: m.reason_t, cache_r: m.cache_r, cache_w: m.cache_w })),
  totals,
  per_week_projection: Object.fromEntries(
    ["turns", "model_requests", "fresh_in_t", "out_t", "reason_t", "cache_r", "cache_w", "total_t", "tool_calls", "tool_result_bytes"].map((k) => [k, perWeek(totals[k])])
  ),
  per_session: T,
  tool_totals: Object.fromEntries(Object.entries(toolTotals).sort((a, b) => b[1].calls - a[1].calls)),
  top_tool_results: top.map((r) => ({ session: r.sid.slice(0, 20), tool: r.tool, bytes: r.ob, status: r.st, ident: redact(redactPath(r.ident)).slice(0, 120) })),
  unbounded_bash: unbounded.sort((a, b) => b.ob - a.ob).slice(0, 12).map((b) => ({ bytes: b.ob, cmd: redact(b.cmd).slice(0, 110) })),
  retry_loops: retryLoops,
  hot_files_within_session: hotFiles,
  files_read_5plus_sessions: crossSessionFiles,
  noisy_read_targets: noisyReads.map(([f, n]) => ({ file: f.replace(/^~\/Desktop\/code\/Classroom-Quick-Downloader\//, ""), n })),
  test_commands: testRuns.sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([c, v]) => ({ cmd: redact(c).slice(0, 90), n: v.n })),
  top_tool_sequences: topGrams,
  top_bash_families: Object.fromEntries(Object.entries(topCmdFamilies).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 12)),
  verbosity: { prose_bytes: verbosity.prose_b, tool_arg_bytes: verbosity.arg_b, prose_share: +(verbosity.prose_b / Math.max(1, verbosity.prose_b + verbosity.arg_b)).toFixed(3), method: "bytes/4 proxy for output composition" },
  sinks: ranked,
  fingerprint: createHash("sha256").update(JSON.stringify(totals)).digest("hex").slice(0, 12),
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "baseline.json"), JSON.stringify(baseline, null, 1));

// ================= report =================
const fmt = (n) => (n ?? 0).toLocaleString("en-US");
const lines = [];
const L = (s) => lines.push(s);
L("# Agent token audit — Phase 1 baseline (generated " + baseline.generated_at.slice(0, 10) + ")");
L("");
L(`Source: ZCode SQLite (read-only), last ${T.length} interactive sessions of this project (window ${totals.window_days} days), current session excluded. Tokens are REAL provider counts from \`turn_usage\` (not estimates).`);
L("");
L("## Totals");
L("");
L("| metric | value | per week (proj.) |");
L("|---|---|---|");
for (const [k, label] of [["turns", "model turns"], ["model_requests", "model requests (API calls)"], ["model_retries", "model retries"], ["fresh_in_t", "fresh input tok (uncached)"], ["cache_r", "cache-read tok (incl. in input)"], ["out_t", "output tok"], ["reason_t", "reasoning tok (provider-reported)"], ["cache_w", "cache-write tok"], ["total_t", "computed total tok"], ["tool_calls", "tool calls"], ["failed_calls", "failed tool calls"], ["edits", "edit/write calls"], ["compactions", "compaction events"], ["collapses", "cache-collapsed turns"]])
  L(`| ${label} | ${fmt(totals[k])} | ${fmt(perWeek(totals[k]))} |`);
L(`| wall time | ${totals.wall_hours} h | — |`);
L("");
L(`Model mix: ${modelMix.map((m) => `${m.model_id}(${m.agent}): ${fmt(m.n)} reqs`).join(", ") || "n/a"}`);
L("");
L("## Cache");
L("");
const crRatio = totals.in_t ? totals.cache_r / totals.in_t : null;
L(`Overall cache-hit ratio: **${crRatio !== null ? (crRatio * 100).toFixed(1) : "n/a"}%** (cache-read / input; the provider reports input_tokens *inclusive* of cached reads — verified against computed_total = input + output).`);
L(`Fresh (uncached) input: ${fmt(totals.fresh_in_t)} tok across ${fmt(totals.model_requests)} model requests (~${fmt(Math.round(totals.in_t / Math.max(1, totals.model_requests)))} input tok/request, avg).`);
L(`Sessions with ratio < 0.7: **${T.filter((t) => t.cache_ratio !== null && t.cache_ratio < 0.7).length}/${T.length}**. Collapsed turns (turn 3+ with cache_read < 40% of input): **${totals.collapses}**, paying ${fmt(totals.collapse_fresh_in_t)} fresh (uncached) input tokens. Context exceeded 100k mid-session in ${T.filter((t) => t.ctx100k_turn).length} sessions${T.some((t) => t.ctx100k_turn) ? ` (earliest at turn ${Math.min(...T.map((t) => t.ctx100k_turn))})` : ""}. Compaction events: ${totals.compactions}.`);
L("");
L("## Tool calls");
L("");
L("| tool | calls | failed | result bytes | truncated |");
L("|---|---|---|---|---|");
for (const [k, v] of Object.entries(baseline.tool_totals).slice(0, 12))
  L(`| ${k} | ${fmt(v.calls)} | ${fmt(v.failed)} | ${fmt(v.bytes)} | ${fmt(v.truncated)} |`);
L("");
L(`Calls per accepted edit: **${(totals.tool_calls / Math.max(1, totals.edits)).toFixed(1)}** (${fmt(totals.tool_calls)} calls / ${fmt(totals.edits)} edits). Median calls before first edit: **${median(T.map((t) => t.calls_before_first_edit))}**.`);
L("");
L("## Result size (top 10 of 20 largest tool results)");
L("");
L("| tool | bytes | ident (redacted) |");
L("|---|---|---|");
for (const r of baseline.top_tool_results.slice(0, 10)) L(`| ${r.tool} | ${fmt(r.bytes)} | \`${r.ident}\` |`);
L("");
L(`Unbounded bash results (>20KB, no head/limit): **${unbounded.length}** totalling ${fmt(unboundedBytes)}B (${fmt(perWeek(b4(unboundedBytes)))} tok/wk). ANSI-colored bash outputs: **${ansi}**.`);
L("");
L("## Redundancy");
L("");
L(`- Files read 3+ times within one session: **${hotFiles.length}** (top: ${hotFiles.slice(0, 3).map((h) => `${h.file}×${h.n}`).join(", ")}).`);
L(`- Files read in 5+ different sessions: **${crossSessionFiles.length}** (top: ${crossSessionFiles.slice(0, 3).map((h) => `${h.file}×${h.sessions}`).join(", ")}) — candidates for an index entry.`);
L(`- Noisy read targets (lockfiles/dist/node_modules/etc.): **${totals.noisy_reads} reads**.`);
L(`- Identical commands run 3+ times (retry loops): **${retryLoops.length}** distinct.`);
L(`- Full test-suite invocations: **${testRunCount}**.`);
L("");
L("## Recurring tool sequences (top 5)");
L("");
L("| sequence | n |");
L("|---|---|");
for (const g of topGrams.slice(0, 5)) L(`| \`${g.seq}\` | ${fmt(g.n)} |`);
L("");
L("## Context growth");
L("");
L(`Sessions reaching >100k input (incl. cache) at some point: ${T.filter((t) => t.ctx100k_turn).length}/${T.length}${T.some((t) => t.ctx100k_turn) ? `, earliest at turn ${Math.min(...T.map((t) => t.ctx100k_turn))}` : ""}. Compactions: ${totals.compactions}. Per-session drift across unrelated tasks: not measurable from logs (titles only) — skipped.`);
L("");
L("## Verbosity");
L("");
L(`Reasoning tokens are provider-reported **0** for every turn — GLM-5.3-Flash reasoning is either billed inside output or not reported, so the reasoning-vs-output question is **not measurable** from these logs. Prose share of generated bytes ≈ **${(baseline.verbosity.prose_share * 100).toFixed(0)}%** (bytes/4 proxy on assistant text vs tool-args; per-message provider token split not logged).`);
L("");
L("## Ranked top-10 sinks");
L("");
L("(est tokens/week = measured window rate × 7; byte-derived figures use the bytes/4 proxy, labeled per row)");
L("");
L("| # | sink | class | evidence | est tok/wk | proposed fix | effort |");
L("|---|---|---|---|---|---|---|");
ranked.slice(0, 10).forEach((s, i) =>
  L(`| ${i + 1} | ${s.name} | (${s.id}) | ${s.evidence} | ~${fmt(s.est_wk)} | ${s.fix} | ${s.effort} |`)
);
L("");
L("## Caveats");
L("");
L("- Spend/cache/context numbers are exact provider counts from `turn_usage`/`model_usage`.");
L("- Result sizes are exact (`tool_usage.output_bytes`); identity of top results comes from tool-part inputs, redacted.");
L("- Output composition (prose vs code) and per-turn fixed tax of skills/MCP schemas are bytes/4 or structural estimates — the harness does not log system-prompt/skill-token sizes.");
L("- Session task drift and golden-task quality are not derivable from these logs.");
L("- No raw transcript content, commands beyond 140 chars, or secrets are stored in this report; all text passed a secret-redaction filter.");

writeFileSync(join(OUT_DIR, "01-baseline.md"), lines.join("\n") + "\n");

// console summary (<=60 lines)
console.log(`sessions=${T.length} window=${totals.window_days}d turns=${totals.turns} reqs=${fmt(totals.model_requests)}`);
console.log(`tok: fresh_in=${fmt(totals.fresh_in_t)} cache_r=${fmt(totals.cache_r)} out=${fmt(totals.out_t)} reason=${fmt(totals.reason_t)} total=${fmt(totals.total_t)}`);
console.log(`cache hit=${crRatio !== null ? (crRatio * 100).toFixed(1) : "?"}% collapses=${totals.collapses} ctx>100k sessions=${T.filter((t) => t.ctx100k_turn).length}`);
console.log(`tools=${fmt(totals.tool_calls)} failed=${fmt(totals.failed_calls)} edits=${fmt(totals.edits)} calls/edit=${(totals.tool_calls / Math.max(1, totals.edits)).toFixed(1)}`);
console.log(`unbounded bash: n=${unbounded.length} bytes=${fmt(unboundedBytes)} ansi_outputs=${ansi}`);
console.log(`prose share=${(baseline.verbosity.prose_share * 100).toFixed(0)}% retry_loops=${retryLoops.length} test_runs=${testRunCount} hot_files=${hotFiles.length} cross_session_files=${crossSessionFiles.length}`);
console.log("TOP SINKS (est tok/wk):");
ranked.slice(0, 10).forEach((s, i) => console.log(`${i + 1}. [${s.id}] ~${fmt(s.est_wk)} ${s.name.slice(0, 70)} (${s.effort})`));
console.log(`\nwrote ${join(OUT_DIR, "01-baseline.md")} and baseline.json (fp ${baseline.fingerprint})`);

function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
