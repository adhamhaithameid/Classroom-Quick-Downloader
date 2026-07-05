
## 2026-07-05 — Remove unused 'tabs' permission
**Finding:** The `tabs` permission was declared in `extension/wxt.config.ts`, but a full source code scan confirmed it was not actually required. Access to Classroom tab URLs is already covered by `host_permissions`.
**Action:** Removed `tabs` from the permissions array in `wxt.config.ts` to tighten the extension's manifest.
**Learning:** The background script's use of `chrome.tabs.query` and `tab.url` works perfectly without the `tabs` permission because it only needs to act on domains explicitly permitted by `host_permissions`. It safely ignores undefined URLs for out-of-scope tabs.
