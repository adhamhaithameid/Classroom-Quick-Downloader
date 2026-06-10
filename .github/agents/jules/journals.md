# Jules Journals

The repository root `.jules/` directory is reserved for Jules agent journals. It is ignored by `.gitignore`, so journals are runtime memory rather than committed documentation.

Each agent should maintain one file named after the prompt file, for example `vex.md`, `atlas.md`, or `oracle.md`. Journals are used to prevent duplicate weekly work and to record repo-specific lessons.

## Entry Format

```markdown
## YYYY-MM-DD — Short summary

**Finding:** What was discovered.
**Action:** What changed or what was filed.
**Learning:** What future runs should remember.
```

Agents should not store secrets, tokens, private credentials, or unreleased vulnerability details in journals.
