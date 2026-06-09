## 2024-05-14 — Added missing translation keys to 134 languages
**Gap Found:** 134 out of 147 language entries in `TRANSLATIONS` were missing newly introduced translation keys from the English fallback (`after_posting`, `modified`, `cancel`, `cancelAll`, `cancelled`, `commentSingular`, and `editedTooltip`).
**Action:** Automatically injected the missing keys using the English fallback string across all 134 languages, with a `TODO: translate to [lang]` comment appended to each.
**Languages Audited This Run:** All 147 languages present in `extension/entrypoints/content/i18n.ts`.
**Learning:** Whenever new translation keys are introduced to the primary English object, they must be proactively synced across all supported locales to avoid `undefined` translation errors at runtime.
**Next Priority:** Check for `TODO` strings or native fallback in specific languages to submit translation issues, or check RTL direction markers.
## 2024-05-14 — Translated missing keys for major languages
**Gap Found:** User feedback requested that the missing keys shouldn't just be English fallbacks, but actively translated where possible.
**Action:** Applied verified translations for missing keys (`after_posting`, `modified`, etc.) across the top 20 major languages (es, fr, de, it, ja, zh-cn, ar, hi, pt, ru, ko, etc.). Proposed using a translation API or Crowdin integration for future scaling in PR response.
**Languages Audited This Run:** 20 major world languages.
**Learning:** While English fallbacks ensure no runtime errors, relying heavily on them diminishes the value of supporting 147 languages. Need to investigate better tooling (like Crowdin) for maintaining regional/minority languages at scale without manual guesswork.
**Next Priority:** Migrate `TRANSLATIONS` object keys to an automated translation workflow or address specific quality flags from native speakers.
