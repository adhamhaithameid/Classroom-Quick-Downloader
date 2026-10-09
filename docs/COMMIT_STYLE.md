# Commit Style Contract

Every commit message in this repository passes two gates: the husky `commit-msg`
hook (commitlint `config-conventional`) and a trailer filter that blocks
Claude/Anthropic co-author lines. The 2026-10-03 sessions retro found 20+
`husky - commit-msg script failed` rejections across the last 44 interactive
sessions — nearly all were avoidable format mistakes. This page is the
one-screen contract so commits land on the first try.

## The hook chain

`.husky/commit-msg` does two things, in order:

1. **Blocks disallowed co-author trailers.** Any line matching
   `Co-authored-by: …claude…` or `…@anthropic.com` rejects the commit. Do not
   add AI co-author trailers.
2. **Runs commitlint** (`npx --no -- commitlint --edit`) with
   `commitlint.config.js` → `@commitlint/config-conventional`.

## Rules that actually rejected commits (evidence from session logs)

| Rule | Rejected example | Passes instead |
|------|------------------|----------------|
| `subject-case` | `feat: Add download retry logic` | `feat: add download retry logic` — subject starts lowercase |
| `type-enum` | `update: change engine defaults` | `fix: change engine defaults` — type must be one of `build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test` |
| `header-max-length` | 122-char header | keep `type(scope): subject` ≤ 100 characters |
| `subject-empty` / `type-empty` | `Update files` / bare pasted text | always `type: subject` — merge commits are exempt |

## Template

```
<type>(<optional scope>): <lowercase subject, no trailing period>

<optional body, wrapped>
```

Real commits from this repo's history that pass:

```
test(extension): startup no longer fetches remote config on the free model
ci(stores): one-command three-store publish workflow
docs(ops): october 3 addendum - free model, cron fix, flush window, workflow notes
```

## When the hook rejects a commit

The rejection happens *after* the commit is staged but before it is recorded —
the message is still in your editor / the `-m` argument. Fix and re-run:

```sh
git commit --edit           # fix the message interactively
# or, for the previous -m attempt:
git commit -m "fix: correct subject and retry"
```

If the commit already landed (hook bypassed or pre-hook git version), amend it
before pushing: `git commit --amend -m "fix: corrected message"`.

## Notes

- CI never sees a commit the hook rejected — fixing format locally is always
  cheaper than a force-push to rewrite history later.
- In worktrees without `node_modules`, the hook fails because
  `npx --no` refuses to auto-install. Run `pnpm install` once in that worktree,
  or (one-off, sanctioned for throwaway worktrees) commit with `--no-verify`
  after hand-checking the rules above.
- Pre-push runs the full quality gate — see `docs/QUALITY_BARS.md` for what it
  executes.
