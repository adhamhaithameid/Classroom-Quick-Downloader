## 🌿 Sage — Extension Feature Suggestion
**Agent:** Sage | **Day:** Thursday | **Date:** 2026-03-19

---

### 👤 User Story
As a teacher, I want to see a list of my recent downloads in the extension popup, so that I can quickly verify what I've downloaded and retry failed downloads if necessary.

### 🔍 Problem Statement
The current popup lacks visibility into the download session history. Users who download multiple files or use "Download All" might not be sure if a specific file was downloaded successfully or what the filename was, especially if background downloads complete silently.

### 💡 Proposed Solution
Add a "Recent Downloads" section below the settings toggles in the popup. It should list the last 5-10 files downloaded in the current session, showing the filename, status (success, failed, cancelled), and a "Retry" button for failed downloads.

### 🎯 Why Now
Improves user confidence and provides a clear recovery path for failed downloads, which is a common pain point.

### 📐 Acceptance Criteria
- [ ] "Recent Downloads" section exists in the popup.
- [ ] Displays up to 10 of the most recent download attempts from the current session.
- [ ] Shows filename and status for each item.
- [ ] Failed items have a "Retry" button that re-triggers the download.
- [ ] Data is persisted per-session.
- [ ] Accessible and keyboard navigable.

### 🔧 Technical Context
Add state tracking to the background script (`extension/entrypoints/background/index.ts`) to keep a small bounded history list of recent downloads. The popup (`extension/entrypoints/popup/App.tsx`) needs to request this history via messaging (`chrome.runtime.sendMessage`) when opened and render the list.

### 📊 Estimated Complexity
Medium (3-5 days) - Requires expanding background state tracking, adding messaging endpoints, and building new UI components in the popup.

### 🔗 Related
N/A
