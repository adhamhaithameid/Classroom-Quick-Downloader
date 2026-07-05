## 2026-07-05 — Added defensive programming to storage reads
**Finding:** Missing optional chaining on `chrome.storage.local.get` results in `utils/global-state.ts` and `utils/language-controller.ts`, and missing try/catch in `utils/changelog.ts` operations.
**Action:** Added optional chaining and try/catch blocks.
**Learning:** Always use optional chaining (e.g. `res?.[KEY]`) on storage results and wrap operations in try/catch to prevent unhandled TypeErrors from terminating scripts.
