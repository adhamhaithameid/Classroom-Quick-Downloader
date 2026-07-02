---
title: "Sage: add per-file-type filter to download-all"
---

## 🌿 Sage — Extension Feature Suggestion
**Agent:** Sage | **Day:** Thursday | **Date:** 2026-07-02

---

### 👤 User Story
As a teacher, I want to filter the "Download All" action by file type (e.g., only download PDFs or Google Docs), so that I don't clutter my local machine with irrelevant file types like supplementary images or instructions when collecting student submissions.

### 🔍 Problem Statement
Currently, the "Download All" button downloads every single file attached to a stream item or assignment. If an assignment includes both student-submitted PDFs and various informational image attachments or template files, the teacher has no way to select just the PDFs in bulk. They are forced to either download everything and sort it locally, or individually click each student's specific file, which defeats the purpose of the bulk downloader.

### 💡 Proposed Solution
Introduce a simple file-type filter dropdown or toggle list adjacent to the "Download All" button.
- What the user sees: When hovering over or clicking near "Download All", a small menu appears showing the available file extensions (e.g., PDF, DOCX, JPG) present in that group.
- The user can uncheck/check file types. The "Download All" button updates its count (e.g., "Download 15 files" instead of 20).
- When triggered, the download-all orchestrator only queues files matching the selected extensions.

### 🎯 Why Now
With the improved support for student work resolution and bulk downloads via the V2 engine, teachers are downloading larger batches of files more reliably. Filtering is a natural next step to enhance this core workflow, making the extension significantly more useful for grading specific submission types without the noise of supplementary materials.

### 📐 Acceptance Criteria
- [ ] The "Download All" UI element includes a mechanism to select/deselect file types present in the file group.
- [ ] Unselected file types are excluded from the download queue when "Download All" is clicked.
- [ ] The button UI correctly reflects the number of files that will be downloaded based on the active filter.
- [ ] The filter state applies correctly to the `GroupState` without modifying the underlying DOM attachments, so individual downloads still work.
- [ ] Accessibility: The filter controls are keyboard navigable and accessible to screen readers.

### 🔧 Technical Context
This feature would involve changes to the download-all group management and UI rendering:
- `extension/src/download-all/state.ts` and `extension/src/download-all/types.ts`: `GroupState` would need to track active file type filters.
- `extension/src/download-all/button-controller.ts`: The logic that processes the group download must filter `group.files` based on the selected extensions before queuing.
- `extension/src/download-all/group-manager.ts`: We need to extract and maintain a unique list of file extensions present in `group.files`.
- UI rendering: The filter UI needs to be injected alongside the `cqd-download-all-btn`.

### 📊 Estimated Complexity
Medium (3–5 days). It requires modifying the injected UI for the download-all button to support a dropdown/menu, updating the state model to track filters, and ensuring the queuing logic respects the filter. The hardest part is making the injected UI look native and accessible within the Google Classroom DOM.

### 🔗 Related
None.
