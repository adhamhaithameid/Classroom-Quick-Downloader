## 2024-05-14 — Fixed missing cancel keys for sr-latn
**Gap Found:** The `sr-latn` language entry was missing `cancel`, `cancelled`, and `cancelAll` keys, which caused completeness tests or visual bugs if UI fell back.
**Action:** Added `cancel`, `cancelled`, and `cancelAll` keys with English fallbacks to `sr-latn` in `extension/entrypoints/content/i18n.ts`. Also added TODO comments for native translation.
**Languages Audited This Run:** All languages in `i18n.ts` for completeness compared to `en`, plus empty array/string checks in `detection-keywords.ts`.
**Learning:** Some translation objects in `i18n.ts` are missing newer keys. A comprehensive audit script found 3650 missing keys across many languages when comparing to `en`.
**Next Priority:** Fix the rest of the missing keys across the remaining languages (e.g., `modified`, `after_posting` in `ar`, `ja`, etc.).
