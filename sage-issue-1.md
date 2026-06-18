---
title: "Sage: add per-file-type filter to download-all — let teachers download only PDFs"
---
## 🌿 Sage — Extension Feature Suggestion
**Agent:** Sage | **Day:** Thursday | **Date:** 2026-06-18

---

### 👤 User Story
As a teacher, I want to filter the "Download All" action by file type, so that I can download only the final submission formats (like PDFs) instead of downloading every draft, image, or instruction document attached to the assignment.

### 🔍 Problem Statement
Currently, the "Download All" button grabs every detected file in the target group. When an assignment has 30 student submissions, and each student has attached 2 rough drafts (Docs) and 1 final submission (PDF), "Download All" pulls down 90 files. Teachers must then manually sort through their local folders to delete the 60 files they don't want to grade. The extension does not currently offer a way to selectively batch-download by extension type.

### 💡 Proposed Solution
Introduce a lightweight filter dropdown or toggle attached to the "Download All" button.
- What the user sees: Hovering over or clicking a small gear/filter icon next to "Download All" reveals a quick checklist of detected file types in that group (e.g., `[x] PDF (30)  [x] DOCX (60)`).
- How it integrates: The popup would be a small floating UI near the button. Unchecking a file type dynamically updates the "Download All" count.
- Expected behavior: When "Download All" is clicked, only files matching the selected types are added to the download queue.

### 🎯 Why Now
Users are requesting ways to manage large volumes of files without cluttering their local storage. The extension's core promise is reducing repetitive clicks; currently, the user saves clicks downloading, but spends them deleting unwanted files later. This addresses a major friction point in the batch download workflow.

### 📐 Acceptance Criteria
- [ ] The filter UI only displays file extensions that are actually present in the current target group.
- [ ] Deselecting a file type dynamically updates the counter on the "Download All" button.
- [ ] Clicking "Download All" only initiates downloads for the currently selected file types.
- [ ] Edge case handled: If all file types are deselected, the "Download All" button should be disabled.
- [ ] Accessibility: The filter menu must be keyboard navigable and its state must be announced to screen readers.

### 🔧 Technical Context
This would require modifications to `extension/src/download-all/group-manager.ts` and `extension/src/download-all/state.ts` to track and expose the file types present in a `GroupState`. The UI rendering logic in the content script would need to attach the filter menu to the button. The `getCanonicalFileKey` or the `FileEntry` type might need an explicit `.ext` field to make grouping by type easier.

### 📊 Estimated Complexity
Medium (3-5 days) — The underlying state (`GroupState`) needs to group files by type, and we need to inject a new, accessible UI component next to the native DOM buttons without breaking the existing CSS layout.

### 🔗 Related
None.
