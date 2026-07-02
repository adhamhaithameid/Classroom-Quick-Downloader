---
title: "Sage: show recent download history in popup"
---

## 🌿 Sage — Extension Feature Suggestion
**Agent:** Sage | **Day:** Thursday | **Date:** 2026-07-02

---

### 👤 User Story
As a user (teacher or student), I want to see a history of my recent downloads in the extension's popup, so that I can quickly verify what files I just downloaded and easily access or re-download them if needed without digging through my browser's global download history.

### 🔍 Problem Statement
Currently, the extension's popup (`extension/entrypoints/popup/App.tsx`) shows aggregate analytics (a donut chart of total downloads by file type) and settings. However, when a user triggers a batch "Download All", especially if a few files fail or take time, there is no localized history log indicating exactly which files were successfully downloaded during the current session. Users have to open the browser's generic download page to check on individual files.

### 💡 Proposed Solution
Add a "Recent Downloads" section to the extension popup, distinct from the lifetime analytics chart.
- What the user sees: A list of the last 10–20 files downloaded using the extension.
- Each entry shows the file name, file type icon, timestamp, and status (Success, Failed).
- Include a quick "Re-download" action or a link to open the file directly (if the browser API allows).

### 🎯 Why Now
With the focus on high-volume bulk downloading via "Download All", visibility into individual file statuses is critical. The popup currently lacks actionable day-to-day session data, making it less useful as an immediate reference tool after a large download batch completes.

### 📐 Acceptance Criteria
- [ ] The popup UI contains a new "Recent Downloads" list view, populated with the latest session downloads.
- [ ] Each item in the list clearly indicates file name, status (success/failed), and time of download.
- [ ] The history data is retrieved from local storage or the background script securely, adhering to least-privilege principles (no PII retention beyond the file name and ID for history purposes).
- [ ] The history list does not exceed a reasonable cap (e.g., last 20 items) to prevent storage bloat.
- [ ] Accessibility: The list is readable by screen readers and navigable via keyboard.

### 🔧 Technical Context
- `extension/entrypoints/popup/App.tsx`: Needs a new UI section to render the list.
- `extension/entrypoints/background/index.ts`: The background worker already observes `chrome.downloads.onChanged` to track download completions and updates the lifetime stats in `local_stats`. It should be extended to maintain a bounded array of recent download events in `chrome.storage.local`.
- Storage access should remain encapsulated using standard `browserApi.storage.local` calls. Data stored should be minimal (no sensitive URLs, just names and status).

### 📊 Estimated Complexity
Small to Medium (2–4 days). The background worker already has access to download lifecycle events, so we just need to append minimal metadata to a capped array in local storage. The popup UI work involves building a simple list component and pulling that new array from storage.

### 🔗 Related
None.
