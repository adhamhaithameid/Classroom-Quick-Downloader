# The two language signals (browser locale vs page language)

Last updated: 2026-09-19

CQD consumes **two different language signals** that answer different questions
and must never be conflated. Every locale-dependent decision in the extension
pulls from exactly one of them — and the shared resolver
(`extension/src/core/i18n/resolve.ts`) is the single place that normalizes,
aliases, and orders candidates for all of them.

| Signal | Answers | Source | Resolution chain |
| --- | --- | --- | --- |
| **Browser locale** | "What language does the *user* speak?" | `navigator.language`, `navigator.languages` | browser full tag → browser base tag → `'en'` |
| **Page language** | "What language is the *content* in?" | `document.documentElement.lang` | page full tag → page base tag → browser tags → `'en'` |

The page-language chain **includes** the browser tags as a lower-priority
fallback, so a page without `<html lang>` still resolves sensibly — but when
the page declares a language the extension can serve, the **page wins**.

## Where language logic lives (the map)

| Module | Role |
| --- | --- |
| `extension/src/core/i18n/resolve.ts` | Shared resolver: candidate expansion, alias mapping (`iw→he`, `nb→no`, `tl→fil`, `zh-*` collapse), full-tag preservation. Pure data + functions, no DOM/chrome APIs — callers pass their own key set. |
| `extension/entrypoints/content/i18n.ts` | UI strings: the `TRANSLATIONS` table + `t(key)`. Resolves via the shared resolver with **page lang first**, falls back to `'en'` per key. |
| `extension/entrypoints/content/translations/completeness.ts` | Test-enforced add/replace patch over `TRANSLATIONS` (missing keys, silent-English leakage, declared fallbacks). Contract: `extension/tests/i18n-translations.test.ts`. |
| `extension/entrypoints/utils/language-controller.ts` | Language state: `auto` / `english` modes, page-lang caching, broadcast on change. Uses the shared resolver's candidate expansion. |
| `extension/src/v2/decision/keyword-loader.ts` | Detection language: `detectPageLanguage()` → html lang → browser → `'en'`; lazy-loads per-language keyword sets. |
| `extension/entrypoints/content/detection-keywords.ts` | The keyword tables themselves (comment/edited lists, ~130 language codes incl. joke locales). Ground truth: see "Keyword verification" below. |
| `extension/src/core/name/type-labels.ts` | Attachment type-label registry keyed by page language (strips "Tömörített archívum" & friends from filenames). |

## The extension's own UI — page language first (changed 2026-09)

Button labels, tooltips, and status strings resolve through
`resolveLanguage(Object.keys(TRANSLATIONS), { pageLang, browserLanguages })` —
candidate order: **page full tag → page base tag → browser full tags → browser
base tags → `'en'`**. The Classroom UI language wins because the buttons sit
*on* that UI: a Hungarian Classroom shows Hungarian CQD buttons even in an
English browser. The `language-controller`'s manual **English mode** is the
user override; its `auto` mode re-resolves whenever `<html lang>` changes
(SPA navigation between accounts/languages re-renders the attribute).

Long tags are preserved end-to-end (`zh-CN` stays `zh-cn` — the controller
used to truncate to an unresolvable base `zh`, and Chinese / pt-PT / sr-Latn
users got English strings; that bug is why the resolver exists).

## Page language — everything the extension *reads* from Classroom

- **Keyword/comment detection**: `detectPageLanguage()`
  (`extension/src/v2/decision/keyword-loader.ts`), consumed by the keyword
  detector (`extension/src/detect/keyword/keyword-detector.ts`) and scorer.
- **Attachment type-label stripping** (`extension/src/core/name/strip.ts`,
  `type-labels.ts`): Classroom renders the localized label next to the file
  name ("Tömörített archívum", "Compressed archive"), so the label locale is
  the *page* locale, not the browser locale.
- **Language-controller checks** (`extension/entrypoints/utils/language-controller.ts`).

A Hungarian Classroom opened in an English browser must strip Hungarian type
labels and score Hungarian comment indicators — because that is what the page
shows.

## Keyword verification — ground truth for the detection lists

The comment/edited keyword lists in `detection-keywords.ts` were largely
authored without per-language ground truth. The verification pipeline closes
that gap; it is documented operationally in
[LIVE_CLASSROOM_TESTING.md](LIVE_CLASSROOM_TESTING.md) (§ Language corpus
capture) and enforced by
`tests/e2e/live/language-reconcile.spec.ts`:

1. **Fixture audit (runs everywhere, incl. CI)** — the committed real-Classroom
   fixtures (`extension/tests/fixtures/classroom/`) double as an English +
   Arabic ground-truth corpus. Verified against real renderings today:
   English `class comments`, `no class comments`, `class comment`,
   `Edited <date>`; Arabic `٥ تعليقات صفية`, `تم التعديل في ١٠ مارس`.
2. **Live corpus capture (`pnpm test:live:langs`)** — renders the real
   classroom.google.com in every candidate language via the `?hl=` parameter
   (read-only; no account changes) and records every visible string +
   aria-label into `qa-artifacts/live-languages/corpus/<lang>.json`.
3. **Reconcile audit (`pnpm test:live:langs:audit`)** — checks each language's
   engine list against its corpus and writes
   `qa-artifacts/live-languages/audit.json` + `AUDIT.md`.

When the audit shows a keyword "missing" for a language, the fix belongs in
`detection-keywords.ts` (or `keyword-loader.ts` fallbacks) — with the corpus
line as the evidence.

## Why the split matters (historical bugs)

- **#541** — type labels were hardcoded English, so a Hungarian Classroom
  leaked "Tömörített archívum" into downloaded filenames. Fix: locale-driven
  type-label registry keyed by *page* language.
- **#613** — keyword detection resolved language from the browser instead of
  `document.documentElement.lang`, mis-detecting comment indicators when the
  two signals disagreed. Fix: `detectPageLanguage()` puts html lang first.
- **zh-CN truncation** — the language controller truncated tags to their base
  code (`zh-CN` → `zh`), which the `TRANSLATIONS` table cannot resolve;
  Chinese / pt-PT / sr-Latn users got English strings. Fix: the shared
  resolver with alias mapping and full-tag preservation
  (`extension/src/core/i18n/resolve.ts`, tested in
  `extension/tests/language-resolution.test.ts`).
- **Silent English leakage** — ~74 locales shipped byte-identical English
  values for `editedTooltip` / `cancelAll`. Fix: the completeness patch with a
  test-enforced contract (`extension/tests/i18n-translations.test.ts`).

## Rule of thumb

Anything that parses **Classroom text** resolves through the page-language
chain (`documentElement.lang` first). Anything the extension **prints**
resolves through the *same* resolver — page first, browser as fallback —
unless the user forced English mode. A new locale-dependent feature must name
which signal it consumes — if you cannot, the feature is under-specified.
