# ADR-0003: Graphify in CI with Gemini Free Tier and Code-Only Fallback

- **Status:** accepted
- **Date:** 2026-08-21
- **Deciders:** Adham Haitham

## Context

The knowledge graph has two cost profiles: AST extraction (deterministic, free,
seconds) and semantic extraction of docs/images (needs an LLM). The repo must
stay inside always-free tiers (public repo ⇒ unlimited Actions minutes; Gemini
flash models have a rate-limited free quota). PRs from forks don't receive
secrets.

## Decision

`tools/rebuild_graph.py` runs in `github-pages.yml` on every code-touching push/PR:

- With `GEMINI_API_KEY` (repo secret): full pipeline — AST + Gemini semantic
  extraction + LLM community labels.
- Without it: deterministic code-only fallback (AST + path-derived labels).

Extraction caches are persisted via `actions/cache` keyed per-sha with prefix
restore-keys, so only changed files are reprocessed.

## Consequences

- The public graph at GitHub Pages is always fresh (≤1 commit behind main).
- Gemini flash is more conservative than interactive agent extraction (~35 vs
  ~145 semantic nodes on this corpus) — accepted tradeoff for automation.
- Free-tier rate limits apply; the 31-doc corpus uses a small fraction.
- ⚠️ Free-tier Gemini requests may be used by Google for training — do not put
  secrets or PII into docs that get extracted.

## Alternatives Considered

- Code-only CI + occasional local rich rebuilds: kept as the fallback mode.
- Paid API tier: unnecessary at this corpus size.
