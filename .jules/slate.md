## 2026-06-03 — Removed any type casts for dataset access
**Finding:** TypeScript `HTMLElement.dataset` property is naturally typed as `DOMStringMap` which supports indexing strings. Using `(element.dataset as any)` across 5 files bypassed the type system unnecessarily.
**Action:** Removed `as any` casts and safely accessed dataset properties via `element.dataset['prop']` directly (using bracket notation to bypass strict `noPropertyAccessFromIndexSignature` rules).
**Learning:** In the `extension` package, avoid casting `HTMLElement.dataset` to `any`. Access custom data attributes directly via bracket notation (e.g., `element.dataset['cqdRequestId']`) since TypeScript's `DOMStringMap` natively supports string indices.
