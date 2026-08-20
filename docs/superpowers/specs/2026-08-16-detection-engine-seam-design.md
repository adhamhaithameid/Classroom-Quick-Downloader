# Detection Engine Seam — Design

Date: 2026-08-16
Status: approved (design), not yet planned

## Problem

Detection depends on per-language keyword lists. The lists differ by language, by
page, and by user, and they are the root cause of most filed issues. Two concrete
symptoms in the current code:

- `entrypoints/content/smart-detector-comments.ts:519` loads the page-language
  keywords *plus* hardcoded English *plus* hardcoded Arabic, because the
  page-language signal cannot be trusted alone. `smart-detector.ts:389` does the
  same for edited-keywords. The union is a workaround for not knowing the language.
- `src/v2/decision/flag-scoring.ts` imports `getCommentKeywords` and
  `getEditedKeywords`. The engine intended to work on UI structure is still
  coupled to the keyword monolith, so the coupling exists on both paths.

Scale: ~1,625 lines across `detection-keywords.ts` and
`translations/detection-keywords.ts`, covering 13 languages.

The extension has live users and cannot stop shipping, so the keyword path stays
until something provably better replaces it.

## Goal

Separate detection from wording from rendering, then build a second detector that
uses no language signal at all — and run both side by side, visibly, until the
evidence says which to trust.

## Architecture

Three layers, strictly one-directional:

```
Detect  →  Decide  →  Render
```

### Detect

Answers only: *what is physically on this page?* Emits a `PostObservation`
carrying **semantic facts, not raw text** — e.g. "has a comment indicator, count 3",
not "this element contains the string 'تعليقات'".

Two implementations behind one interface:

- **`KeywordDetector`** — today's V1 logic, moved rather than rewritten. This is
  the **only** module in the system permitted to import keyword tables or reason
  about language. The `pageLang + en + ar` union moves inside it and stops being
  a system-wide concern.
- **`StructuralDetector`** — new. DOM shape, ARIA roles, element relationships.
  No language signal of any kind.

Because both emit the same `PostObservation`, they are directly comparable and
swappable.

### Decide

`PostObservation` → `PostDecision`: which of the three flags apply, whether a
download button belongs, and a confidence score. Fully language-agnostic; it
cannot import keywords. `flag-scoring.ts` loses its keyword imports.

### Render

`PostDecision` + `Theme` → DOM. Never imports keywords, never re-inspects the page
to decide anything. `src/v2/render/button-styles.ts` and `flag-styles.ts` already
exist and become the second theme's home.

## Compare mode

### Themes

A `Theme` is data. Two exist:

| Role | V1 / Keyword | V2 / Structural |
|---|---|---|
| primary action | blue | purple |
| secondary | yellow | nile |
| tertiary | orange | blue |
| error | red | lighter red |
| success | green | lighter green |

### Dev transform

In compare mode every `cqd-*` element gets `opacity: 0.5` plus a drop shadow,
applied **once as a class on the render root** — not per component, so it cannot
leak into production and needs no per-element edits.

### Overlap, not offset

Both engines render in the same position. With 50% opacity this is a feature:
agreement blends into a composite colour, disagreement shows as a pure single hue.
A post found by only one engine is therefore visually obvious.

### Mode gating

`EngineMode = 'v1' | 'v2' | 'compare'`.

wxt is Vite-based, so `wxt build --mode compare` sets
`import.meta.env.MODE === 'compare'`. Compare code is gated on that constant and
is dead-code-eliminated from normal production builds. This yields both
`pnpm dev` and a shareable unpacked build, with no path to the store.

Add script: `build:compare` → `wxt build --mode compare`.

## Instrumentation

One structured record per post per engine: engine name, elapsed ms, what it found,
confidence, and whether the engines agreed.

Two console surfaces:

- **Live** — one grouped line per post as it is scanned.
- **On demand** — `window.__cqd.report()` prints a summary table: per-engine totals,
  mean and median latency, agreement rate, and disagreements with post URLs.

Records are plain JSON underneath, so the same shape can later feed a telemetry
canary without rework.

**Caveat:** in compare mode both engines contend for the same main thread, so
absolute timings are inflated. Relative comparison is meaningful; absolute numbers
are not.

## Migration

Strangler fig. The keyword path stays live and unchanged in production throughout.

1. Golden fixtures frozen (#396/#673) — safety net before touching working code.
2. Extract the seam: `PostObservation`, `PostDecision`, `Theme` contracts.
3. Move V1 logic into `KeywordDetector` behind the interface. No behaviour change.
4. Strip keyword imports from `flag-scoring.ts`.
5. Build `StructuralDetector`.
6. Compare mode: dual render + instrumentation.
7. Evaluate against real pages in real languages. Promote only on evidence.

Steps 2–4 are valuable on their own even if `StructuralDetector` never reaches
100%: they remove the coupling that makes every language bug a system-wide bug.

## Risks

| Risk | Mitigation |
|---|---|
| Refactoring load-bearing code with live users | Golden fixtures first (step 1); steps 2–4 are behaviour-preserving moves |
| `StructuralDetector` never reaches parity | Keyword path stays primary indefinitely; no forced cutover |
| Compare mode reaching production | Gated on `import.meta.env.MODE`, dead-code-eliminated in production builds |
| Classroom DOM changes break structural detection | Same exposure the keyword path already has; instrumentation makes it visible sooner |

## Out of scope

- Migrating keywords to `_locales/` (#611/#612) — orthogonal, and less valuable
  once keywords are confined to one module.
- The V3 API/network engine.
- Promotion of `StructuralDetector` to primary. That is a later decision requiring
  evidence this design is built to produce.

## Open questions

None blocking. Promotion thresholds will be set from real compare-mode data rather
than guessed in advance; the PRD's existing readiness-gate numbers (99.5% coverage
/ 98% precision) are the starting reference.
