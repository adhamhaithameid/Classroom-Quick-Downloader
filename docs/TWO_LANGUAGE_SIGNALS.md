# The two language signals (browser locale vs page language)

CQD consumes **two different language signals** that answer different questions
and must never be conflated. Every locale-dependent decision in the extension
pulls from exactly one of them.

| Signal | Answers | Source | Priority chain |
| --- | --- | --- | --- |
| **Browser locale** | "What language does the *user* speak?" | `navigator.language`, `chrome.i18n` UI locale | browser locale → `'en'` |
| **Page language** | "What language is the *content* in?" | `document.documentElement.lang` | html lang → browser locale → `'en'` |

## Browser locale — the user's UI

Used for everything the extension *renders itself*:

- UI strings and localized button labels: `extension/entrypoints/content/i18n.ts`
  (resolves the UI language once and serves `t(key)` from it).
- Locale formatting of numbers/dates the extension displays.

A Hungarian user with an English browser still gets English extension UI.

## Page language — the content's language

Used for everything the extension *reads out of Classroom's DOM*:

- Keyword/comment detection language resolution: `detectPageLanguage()`
  (`extension/src/v2/decision/keyword-loader.ts`), consumed by the keyword
  detector (`extension/src/detect/keyword/keyword-detector.ts`) and scorer.
- Attachment **type-label stripping** (`extension/src/core/name/strip.ts`,
  `type-labels.ts`): Classroom renders the localized label next to the file
  name ("Tömörített archívum", "Compressed archive"), so the label locale is
  the *page* locale, not the browser locale.
- Language-controller checks (`extension/entrypoints/utils/language-controller.ts`).

A Hungarian Classroom opened in an English browser must strip Hungarian type
labels and score Hungarian comment indicators — because that is what the page
shows — while the extension's own buttons stay in English.

## Why the split matters (historical bugs)

- **#541** — type labels were hardcoded English, so a Hungarian Classroom
  leaked "Tömörített archívum" into downloaded filenames. Fix: locale-driven
  type-label registry keyed by *page* language.
- **#613** — keyword detection resolved language from the browser instead of
  `document.documentElement.lang`, mis-detecting comment indicators when the
  two signals disagreed. Fix: `detectPageLanguage()` puts html lang first.

## Rule of thumb

Anything that parses **Classroom text** resolves through the page-language
chain (`documentElement.lang` first). Anything the extension **prints**
resolves through the browser locale. A new locale-dependent feature must name
which signal it consumes — if you cannot, the feature is under-specified.
