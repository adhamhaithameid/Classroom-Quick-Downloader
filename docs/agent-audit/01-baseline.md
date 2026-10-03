# Agent token audit — Phase 1 baseline (generated 2026-10-03)

Source: ZCode SQLite (read-only), last 30 interactive sessions of this project (window 21.8 days), current session excluded. Tokens are REAL provider counts from `turn_usage` (not estimates).

## Totals

| metric | value | per week (proj.) |
|---|---|---|
| model turns | 336 | 108 |
| model requests (API calls) | 8,582 | 2,755 |
| model retries | 410 | 132 |
| fresh input tok (uncached) | 56,823,003 | 18,243,573 |
| cache-read tok (incl. in input) | 2,249,688,960 | 722,284,336 |
| output tok | 4,935,242 | 1,584,507 |
| reasoning tok (provider-reported) | 0 | 0 |
| cache-write tok | 0 | 0 |
| computed total tok | 2,311,447,205 | 742,112,416 |
| tool calls | 9,259 | 2,973 |
| failed tool calls | 338 | 109 |
| edit/write calls | 2,444 | 785 |
| compaction events | 2 | 1 |
| cache-collapsed turns | 11 | 4 |
| wall time | 1052.8 h | — |

Model mix: GLM-5.3-Flash(zcode-agent): 8,621 reqs

## Cache

Overall cache-hit ratio: **97.5%** (cache-read / input; the provider reports input_tokens *inclusive* of cached reads — verified against computed_total = input + output).
Fresh (uncached) input: 56,823,003 tok across 8,582 model requests (~268,762 input tok/request, avg).
Sessions with ratio < 0.7: **0/30**. Collapsed turns (turn 3+ with cache_read < 40% of input): **11**, paying 2,708,867 fresh (uncached) input tokens. Context exceeded 100k mid-session in 30 sessions (earliest at turn 1). Compaction events: 2.

## Tool calls

| tool | calls | failed | result bytes | truncated |
|---|---|---|---|---|
| Bash | 4,848 | 108 | 4,464,046 | 0 |
| Edit | 1,994 | 186 | 372,954 | 0 |
| Read | 985 | 5 | 3,386,428 | 0 |
| Write | 450 | 16 | 86,294 | 0 |
| mcp__node_repl__js | 406 | 3 | 4,164,856 | 0 |
| Skill | 208 | 1 | 2,494,810 | 0 |
| TaskOutput | 169 | 2 | 122,105 | 0 |
| Agent | 103 | 9 | 636,029 | 0 |
| WebSearch | 18 | 2 | 64,196 | 0 |
| AskUserQuestion | 16 | 0 | 3,978 | 0 |
| TaskStop | 11 | 2 | 5,527 | 0 |
| ExitPlanMode | 10 | 2 | 39,545 | 0 |

Calls per accepted edit: **3.8** (9,259 calls / 2,444 edits). Median calls before first edit: **23**.

## Result size (top 10 of 20 largest tool results)

| tool | bytes | ident (redacted) |
|---|---|---|
| mcp__node_repl__js | 128,692 | `const root =
  process.env.ZCODE_CUA_PLUGIN_ROOT ??
  process.env.ZCODE_PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT;` |
| mcp__node_repl__js | 127,996 | `const root =
  process.env.ZCODE_CUA_PLUGIN_ROOT ??
  process.env.ZCODE_PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT;` |
| mcp__node_repl__js | 118,863 | `const root =
  process.env.ZCODE_CUA_PLUGIN_ROOT ??
  process.env.ZCODE_PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT;` |
| mcp__node_repl__js | 110,524 | `const root =
  process.env.ZCODE_CUA_PLUGIN_ROOT ??
  process.env.ZCODE_PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT;` |
| mcp__node_repl__js | 110,144 | `const root =
  process.env.ZCODE_CUA_PLUGIN_ROOT ??
  process.env.ZCODE_PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT;` |
| mcp__node_repl__js | 110,140 | `const root =
  process.env.ZCODE_CUA_PLUGIN_ROOT ??
  process.env.ZCODE_PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT;` |
| mcp__node_repl__js | 104,237 | `const root =
  process.env.ZCODE_CUA_PLUGIN_ROOT ??
  process.env.ZCODE_PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT;` |
| mcp__node_repl__js | 102,300 | `const root =
  process.env.ZCODE_CUA_PLUGIN_ROOT ??
  process.env.ZCODE_PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT;` |
| mcp__node_repl__js | 98,323 | `const root =
  process.env.ZCODE_CUA_PLUGIN_ROOT ??
  process.env.ZCODE_PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT;` |
| mcp__node_repl__js | 95,945 | `const root =
  process.env.ZCODE_CUA_PLUGIN_ROOT ??
  process.env.ZCODE_PLUGIN_ROOT ??
  process.env.CLAUDE_PLUGIN_ROOT;` |

Unbounded bash results (>20KB, no head/limit): **1** totalling 24,293B (1,950 tok/wk). ANSI-colored bash outputs: **216**.

## Redundancy

- Files read 3+ times within one session: **15** (top: ~/code/Classroom-Quick-Downloader/cloudflare-worker/src/downloads_do.ts×64, ~/code/Classroom-Quick-Downloader/website/src/routes/+layout.svelte×51, ~/code/Classroom-Quick-Downloader/cloudflare-worker/src/index.ts×35).
- Files read in 5+ different sessions: **10** (top: website/src/routes/+layout.svelte×9, ~/.zcode/cli/memories/projects/classroom-quick-downloader-89e2c8caf3abddfd/memory/MEMORY.md×8, website/src/app.css×7) — candidates for an index entry.
- Noisy read targets (lockfiles/dist/node_modules/etc.): **4 reads**.
- Identical commands run 3+ times (retry loops): **15** distinct.
- Full test-suite invocations: **681**.

## Recurring tool sequences (top 5)

| sequence | n |
|---|---|
| `bash > bash > bash` | 2,501 |
| `bash > bash > bash > bash` | 1,947 |
| `edit > edit > edit` | 584 |
| `edit > bash > bash` | 399 |
| `edit > edit > edit > edit` | 376 |

## Context growth

Sessions reaching >100k input (incl. cache) at some point: 30/30, earliest at turn 1. Compactions: 2. Per-session drift across unrelated tasks: not measurable from logs (titles only) — skipped.

## Verbosity

Reasoning tokens are provider-reported **0** for every turn — GLM-5.3-Flash reasoning is either billed inside output or not reported, so the reasoning-vs-output question is **not measurable** from these logs. Prose share of generated bytes ≈ **57%** (bytes/4 proxy on assistant text vs tool-args; per-message provider token split not logged).

## Ranked top-10 sinks

(est tokens/week = measured window rate × 7; byte-derived figures use the bytes/4 proxy, labeled per row)

| # | sink | class | evidence | est tok/wk | proposed fix | effort |
|---|---|---|---|---|---|---|
| 1 | Verbose assistant prose | (d) | 10,956,284B prose vs 8,175,632B tool args (bytes/4 proxy) | ~879,405 | 6-line final report rule; caveman A/B (2J) | S |
| 2 | Cache-busting (collapses + context>100k) | (e) | 11 collapsed turns paying 2,708,867 fresh input tok (cr<40% of input) | ~869,708 | Stable prefix: no mid-session AGENTS.md/MCP edits (2F) | S |
| 3 | Over-exploration (calls before first edit; calls/edit) | (f) | 890 pre-edit calls; 9259 calls / 2444 edits | ~639,377 | scripts/orient + REPO_MAP.md; read ranges (2D/2E) | M |
| 4 | Re-deriving repo facts (files read 5+ sessions, hot files) | (a) | 10 files in 5+ sessions; 15 files read 3+ times; 4 noisy reads | ~237,183 | docs/INDEX.md pointers + .rgignore for lock/dist (2C/2D) | S |
| 5 | Per-turn fixed tax (AGENTS.md 1.5k tok + ~290 skill names + 5 MCP tool schemas) | (h) | 336 turns in window; AGENTS.md 5926B measured | ~159,872 | Trim AGENTS.md <150 lines; prune unused skills/plugins/MCP (2D/2G) | M |
| 6 | Retry loops (identical cmd 3+) | (c) | 15 commands; 338 failed calls; 0 harness retries | ~111,668 | scripts/check; stop on repeated failure (2E) | M |
| 7 | Redundant verification (full test runs) | (g) | 681 test-suite invocations | ~44,696 | scripts/check --changed (vitest related) (2E) | M |
| 8 | Unbounded bash output (>20KB, no head/limit) | (b) | 1 results, 24,293B; ANSI in 216 outputs | ~1,950 | rtk hook + NO_COLOR/quiet reporters + head caps (2A/2B) | S |

## Caveats

- Spend/cache/context numbers are exact provider counts from `turn_usage`/`model_usage`.
- Result sizes are exact (`tool_usage.output_bytes`); identity of top results comes from tool-part inputs, redacted.
- Output composition (prose vs code) and per-turn fixed tax of skills/MCP schemas are bytes/4 or structural estimates — the harness does not log system-prompt/skill-token sizes.
- Session task drift and golden-task quality are not derivable from these logs.
- No raw transcript content, commands beyond 140 chars, or secrets are stored in this report; all text passed a secret-redaction filter.
