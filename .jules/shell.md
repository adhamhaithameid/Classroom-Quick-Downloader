## 2026-06-28 — Fixed unhandled promise rejections on chrome API calls
**Finding:** Found multiple `chrome.tabs.sendMessage` and `chrome.storage.local.set` calls missing proper callbacks to handle `lastError` and unhandled exceptions.
**Action:** Added empty callbacks capturing `lastError` to sendMessage, wrapped `storage.local.set` with try/catch, and ensured `storage.local.get` result parsing uses optional chaining.
**Learning:** In MV3, all async chrome API callbacks that might fail must explicitly check `chrome.runtime.lastError` to avoid throwing silent unhandled promise rejections, and storage responses might be `undefined`.
