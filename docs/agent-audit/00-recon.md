# Agent token audit — Phase 0 recon (2026-10-03)

- **Harness/model**: ZCode desktop; model `GLM-5.3-Flash` via provider `builtin:zai-start-plan` (from `model_usage` rows). Sessions live in SQLite at `~/.zcode/cli/db/db.sqlite` (open `file:...?mode=ro`); 3 rollout JSONLs at `~/.zcode/cli/rollout/` (keys: `attempt, completedAt, durationMs, model, querySource, request, requestId, response, sessionId, startedAt, traceId, turnId, type`).
- **DB schema keys**: `session(id, project_id, task_type, time_created, time_updated)`; `part(id, message_id, session_id, data JSON: type=text/tool/step-start/step-finish/reasoning/compaction, text parts $.text, tool parts $.tool/$.callID/$.state.input/$.state.output)`; **`turn_usage` has REAL token counts** (`input_tokens, output_tokens, reasoning_tokens, cache_creation_input_tokens, cache_read_input_tokens, computed_total_tokens, duration_ms, model_retry_count, tool_error_count, context_exceeded`) — no bytes/4 proxy needed for spend. `tool_usage` has `output_bytes, stdout_bytes, stderr_bytes, truncated, retry_count, exit_code, status`. This project: 46 interactive, 227 subagent_child sessions.
- **Tools**: rtk 0.50.0 (`rtk gain`: 2 cmds, 101/182 tok saved, 55.5%), bd 1.3.0, rg 14.1.1, jq 1.7.1, node v22.14.0, pnpm 10.28.2. **fd: NOT installed.**
- **Per-turn fixed tax inventory**:
  - root `AGENTS.md`: 128 lines, 5,926 B ≈ **1.5k tokens/turn** (plus 2 duplicated beads blocks inside it).
  - Skills: 105 dirs in `~/.zcode/skills` + 187 in `~/.agents/skills`; ≈290 skill names advertised to the model every session in the system reminder.
  - Plugins enabled (10): github, superpowers, ui-theme-designer, superdesign, computer-use, figma, browser-use, feature-dev, ios-simulator, restore-legacy-sessions.
  - MCP servers (5, tool schemas on every turn): computer-use, figma, figma-local, node_repl, playwright.
  - Hooks: `config.json .hooks.events = {}` — none installed (rtk hook not yet installed).
- **Data caveat**: harness does not log system-prompt bytes; system prompt + tool schemas are unmeasurable directly, only estimable.
