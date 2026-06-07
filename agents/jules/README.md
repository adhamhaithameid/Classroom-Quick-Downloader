# Jules Agents

Google Jules is installed on this repository as an owner-controlled maintenance integration. Jules runs scheduled agents against `main`, creates focused PRs or Issues, and keeps its long-term context in agent journals.

This workflow is internal automation for `adhamhaithameid/Classroom-Quick-Downloader`. It does not change the public contribution policy: external PRs are still not accepted.

## How This Is Organized

- `schedule.md` lists the weekly Jules timetable.
- `prompt-index.md` maps all 36 agents to prompt files, scope, and output type.
- `prompts/` stores the exact prompt body for each custom Jules agent.
- `review-rules.md` explains how to review Jules PRs and Issues.
- `journals.md` documents the ignored `.jules/` runtime journal convention.

## Operating Model

- Jules is configured through the Jules web app, not through committed API automation.
- Agents run weekly from `main`, staggered by day and time.
- Code-changing agents create small PRs.
- Planning and suggestion agents create Issues.
- A no-op run is valid when an agent finds no useful change.
- Agents must not close, merge, or silently supersede existing Issues or PRs.

## API Key Policy

No Jules API key is required for this repository documentation. If API automation is added later, use `JULES_API_KEY` from a local environment variable or GitHub secret. Never commit Jules API keys or generated credentials.

## Current Review Queue

The latest manual GitHub triage snapshot is in `github-triage-2026-06-06.md`.
