---
title: "Sage: show download history in popup — last 5 files downloaded this session"
---
## 🌿 Sage — Extension Feature Suggestion
**Agent:** Sage | **Day:** Thursday | **Date:** 2026-06-18

---

### 👤 User Story
As a student or teacher, I want to see a list of my recently downloaded files directly in the extension popup, so that I can verify what I just downloaded without having to open my operating system's file explorer or the browser's native download page.

### 🔍 Problem Statement
Currently, the extension popup offers settings and links, but no feedback on the user's active session. When a user downloads a batch of files (or even a single file), there is no easy way to confirm what was successfully saved other than navigating away from the Classroom context to check their local disk. This is especially problematic if a download fails silently or if the user forgets whether they already clicked a button.

### 💡 Proposed Solution
Add a "Recent Downloads" section to the extension popup (`extension/entrypoints/popup/App.tsx`).
- What the user sees: A small list at the top or bottom of the popup displaying the names of the last 5 downloaded files, along with a timestamp (e.g., "Math_Homework.pdf - 2 mins ago").
- How it integrates: The list would pull from the `recentDownloads` Map already maintained in the background service worker.
- Expected behavior: The list updates dynamically as new files are downloaded during the session.

### 🎯 Why Now
The background worker already tracks `recentDownloads` (`recentDownloads.set(pending.fileMeta.name, Date.now())`), but this data is currently invisible to the user. Exposing it in the popup is a low-effort, high-impact way to build trust and provide immediate feedback on the extension's actions, addressing a common usability gap in batch operations.

### 📐 Acceptance Criteria
- [ ] The popup displays a list of up to 5 of the most recently downloaded files.
- [ ] The list shows the filename and a relative timestamp (e.g., "Just now", "5m ago").
- [ ] The list fetches its initial state from the background script upon opening the popup.
- [ ] Edge case handled: If no files have been downloaded this session, display a friendly empty state (e.g., "No recent downloads in this session").
- [ ] Accessibility: The list is readable by screen readers and logically ordered.

### 🔧 Technical Context
The data already exists in `extension/entrypoints/background/index.ts` within the `recentDownloads` map. The implementation requires setting up a message passing bridge (`chrome.runtime.sendMessage`) from the popup (`extension/entrypoints/popup/App.tsx`) to request the recent downloads list when the popup opens.

### 📊 Estimated Complexity
Small (1-2 days) — The tracking logic is already present in the background script. This task primarily involves creating a new UI component in the popup and wiring up the existing data via standard message passing.

### 🔗 Related
None.
