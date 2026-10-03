# Merge plan — 1.8.9 wave (no merges or pushes performed)

All branches sit on top of origin/main at 232d6f0c. Push and merge in this order. One branch per day keeps the daily commit streak; commits already carry their real dates — do not backdate.

| Day | Branch | Commits | Touches | Conflict risk |
|---|---|---|---|---|
| 1 | `docs/shallow-module-audit` | 07b09d3f | docs/ (new audit doc) | None |
| 2 | `docs/agent-navigation-retro` | a6afb071..8c4e274a (7) | AGENTS.md, docs/, tools/pre-push-scope.mjs | None alone — but merge BEFORE docs/ste100-rule |
| 3 | `docs/retro-100-sessions` | fc1d2cb9..54da1907 (6) | docs/, tools/worktree-report.mjs | None |
| 4 | `chore/token-diet` | 0fe8fcc9, 960c577e | tools/agent-audit/, docs/agent-audit/ | None |
| 5 | `fix/engine-bugs-1.8.9` | 9a6fe5ac, c446f765, f0fc594c, 1c446564, bdf7b5e2, 728bcbe9, 44297052 (7) | extension/ only | None (no other branch touches extension/) |
| 6 | `website/seo-branding` | 6f9ab9eb, 10d9faa2, 3f57b74f, a6551d7e (4) | website/ | None |
| 7 | `docs/ste100-rule` | d1a1c6d7 | AGENTS.md (pointer at file end), docs/ASD_STE100_RULES.md | AGENTS.md vs day 2 — rebase onto it if git does not auto-merge; the pointer block appends at the end, so the rebase is trivial |
| 8 | `prototypes/1.8.9` | 256d9fab | prototypes/ only (does not ship) | None |
| 9 | `release/1.8.9` | 155a9739 + version-bump commit | CHANGELOG.md, extension/package.json, data/changelog/*, generated files, user-friendly-changelog.md, docs/ | Low. Merge AFTER day 5 so the 1.8.9 changelog describes merged code |

## After the merges

1. Run a live-Classroom check of the four engine fixes before publishing (they are jsdom-verified, 4,288 tests, but not yet verified against real Classroom — HITL).
2. Tag `v1.8.9`, push the tag.
3. Publish with the one-command workflow: `gh workflow run extension-stores.yml -f ref=v1.8.9` — see docs/STORE_PUBLISHING_GUIDE.md. The CWS leg needs `CWS_REFRESH_TOKEN` first.
4. CWS note: 1.8.7 was hand-submitted for review on 2026-10-03; do not re-publish 1.8.7 through the API (immutable versions).

## Watch-outs

- The pre-push gate runs per workspace; worktrees need a root `pnpm install` before pushing from them.
- The Mimosa git-gate may still block pushes from this machine; if a push is rejected by a hook, report the exact hook output rather than disabling anything.
- `docs/RELIABILITY_GATE.md` and `docs/STORE_PUBLISHING_GUIDE.md` mention 1.8.7 as history — they are not version references and were not bumped.
