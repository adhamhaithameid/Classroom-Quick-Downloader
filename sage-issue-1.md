## 🌿 Sage — Extension Feature Suggestion
**Agent:** Sage | **Day:** Thursday | **Date:** 2026-03-19

---

### 👤 User Story
As a teacher, I want to filter the "Download All" batch by file type (e.g., only PDFs), so that I can quickly download the specific materials I need without downloading irrelevant files.

### 🔍 Problem Statement
Currently, "Download All" downloads every eligible file in a group. Teachers often have mixed file types in assignments (e.g., a PDF rubric, a Word doc template, and an image reference) but only want to download one specific type (like the PDF rubric) for printing or distribution. They have to manually click individual download buttons or delete unwanted files after a batch download.

### 💡 Proposed Solution
Add a small filter dropdown or icon next to the "Download All" button. When clicked, it shows a list of file extensions present in the group (e.g., "PDF (3)", "DOCX (1)"). Selecting one or more extensions updates the "Download All" button to only download matching files.

### 🎯 Why Now
This is a core friction point in the download experience. It eliminates a common manual workaround (deleting unwanted files post-download) and directly improves the extension's primary value proposition (quick, easy downloads).

### 📐 Acceptance Criteria
- [ ] Filter UI appears near the "Download All" button.
- [ ] Filter options dynamically reflect the file extensions available in the current group.
- [ ] Selecting a filter updates the "Download All" action to exclude non-matching files.
- [ ] Visual indication shows when a filter is active.
- [ ] Keyboard navigable and screen reader accessible.

### 🔧 Technical Context
Modifying `extension/src/download-all/group-manager.ts` to support filtering logic. Updating `extension/src/download-all/state.ts` to manage filter state per group. UI injection for the filter near the "Download All" button element.

### 📊 Estimated Complexity
Medium (3-5 days) - Requires UI injection, state management per group, and modifying the download iteration logic.

### 🔗 Related
N/A
