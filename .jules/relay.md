
## 2026-06-28 — Fixed memory leak cleanup alarm
**Finding:** Found `setInterval` and `setTimeout` being used for periodic cleanup in the background service worker, which dies when the service worker is terminated.
**Action:** Replaced `setInterval` and `setTimeout` with `chrome.alarms` to ensure periodic cleanup correctly survives service worker terminations.
**Learning:** Always use `chrome.alarms` for scheduled background tasks instead of `setInterval` or `setTimeout`.
