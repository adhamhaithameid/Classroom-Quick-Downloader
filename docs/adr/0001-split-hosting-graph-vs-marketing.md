# ADR-0001: Split Hosting — GitHub Pages for the Knowledge Graph, Cloudflare Pages for Marketing

- **Status:** accepted
- **Date:** 2026-08-21
- **Deciders:** Adham Haitham

## Context

The repo produces two genuinely different artifacts: a marketing/product website
(SvelteKit in `website/`) and a graphify knowledge-graph visualization of the
codebase. Initially both were served from GitHub Pages (full site copy with the
graph buried at `/graphify/`), which duplicated the marketing site and made every
graph rebuild pay the full Node/SvelteKit build cost (~8 min).

## Decision

Each host serves exactly one artifact, fully independent of the other:

- **GitHub Pages** (`adhamhaithameid.github.io/Classroom-Quick-Downloader/`) =
  graphify output ONLY. `graph.html` is the entire site; self-contained with
  vendored vis-network; no links to any other site.
- **Cloudflare Pages** = the marketing website only. No graph content.

## Consequences

- Graph deploys drop from ~8 min to ~1–2 min (Python-only pipeline).
- The marketing site no longer carries a `/graphify/` route or nav link.
- `_worker.js` (a Cloudflare Pages Function for redirects) never ships to GH Pages.
- Two deploy pipelines to maintain, but each is radically simpler.

## Alternatives Considered

- Full site + graph on GH Pages (the original setup): rejected — duplication of
  the marketing site and slow graph updates.
- Tiny landing page linking both: rejected — violates the "each host shows one
  thing" separation.
