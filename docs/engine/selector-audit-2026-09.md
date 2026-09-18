# Selector audit — hash-id fallback rate (2026-09)

Issue #615 (Engine V4 S11, Task 5 Item A). Instrumentation for
ENGINE_V4_SYSTEM_DESIGN §5 rule 1: *a hash id is a fallback, never a
default — a rising hash-id rate is an early warning that Classroom changed
its markup, days before users report anything.*

## Mechanism

Engine V2 resolves every file's canonical id in
`extension/src/engines/v2/engine-v2.ts` (`extractFileNode`), through a
first-hit-wins priority chain (mirrored in `src/v2/model/dom-scanner.ts`):

1. `data-drive-id` attribute (Google's own identifier) → `idSource: 'data-drive-id'`
2. Drive file id parsed from the URL (`/d/{id}/`) → `idSource: 'url-parse'`
3. `data-id` + `data-item-id` combination → `idSource: 'data-id-combo'`
4. Normalized URL text as a last resort → `idSource: 'url-hash'`

Every `FileNode` carries the winning source in `FileNode.idSource`
(`extension/src/engines/types.ts`). Only step 4 depends on volatile URL
text — it breaks silently the moment Classroom changes its link shapes,
which is exactly what the rate below watches.

## Exposure

- **Engine API** — `EngineV2.getSelectorStats()` returns
  `{ hashIdCount, totalFiles, hashIdRate }` computed live from the current
  post/file map (`hashIdRate` is a 0..1 ratio; `0` when no files are
  tracked, never NaN).
- **Debug probe** — the additive `window.__cqdPerfSnapshot()` probe
  (`extension/entrypoints/v2_bootstrap.content.ts`) now also returns
  `selectorStats` alongside `handleMutations`, so the qa-perf journey and
  ad-hoc CDP sessions read both with one call:
  `__cqdPerfSnapshot().selectorStats.hashIdRate`.

Pinned by `extension/tests/v2-selector-audit.test.ts` (mixed drive-id /
hash-fallback fixture, zero-state, and the corpus rate below).

## Current corpus rate: 0 hash fallbacks

Measured 2026-09 over the accuracy-corpus classroom fixtures
(`extension/tests/fixtures/classroom/`, manifest v1, 9 labelled pages)
through the real discovery seam (file-anchor scorer + `extractFileNode`):

| idSource         | files | rate   |
| ---------------- | ----- | ------ |
| `data-drive-id`  | 1     | 12.5%  |
| `url-parse`      | 7     | 87.5%  |
| `data-id-combo`  | 0     | 0%     |
| `url-hash`       | **0** | **0%** |
| total            | 8     |        |

**Zero synthetic hash fallbacks** — every fixture file resolves through a
stable attribute or a parseable URL. The rate is pinned in
`v2-selector-audit.test.ts`; the test fails if a future fixture
synthesizes a hash fallback, so the corpus cannot silently normalize the
drift it is supposed to detect.

## Monitoring contract

- **Signal:** `hashIdRate` from `__cqdPerfSnapshot().selectorStats` (or
  `getSelectorStats()` on a live engine instance).
- **Healthy state:** 0 on any real Classroom page load. The corpus
  baseline is 0 (table above); a small nonzero rate on live pages means
  individual attachments already fall to URL text.
- **Alarm:** a rate rising over successive runs. Per §5 rule 1 this is the
  early warning that Classroom changed its attachment markup — the
  priority chain's attribute/URL steps stopped matching and ids degraded
  to volatile URL text (dedupe quality and click-to-file correlation go
  with it).
- **Response:** when the rate rises, capture a live page (the
  `tools/corpus` bookmarklet), diff the attachment anchor markup against
  the corpus fixtures, and repair the matching selector candidate in
  `src/v2/selectors/selector-registry.ts` / `extractFileNode` before
  users report missing or duplicated download buttons.
