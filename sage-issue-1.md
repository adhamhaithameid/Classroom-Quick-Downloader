## 🌿 Sage — Extension Feature Suggestion
**Agent:** Sage | **Day:** Thursday | **Date:** 2026-03-17

---

### 👤 User Story
As a teacher, I want to filter the types of files downloaded during a "Download All" operation, so that I can only download the specific file formats I need (e.g., only PDFs or only Google Docs) without manually deleting unwanted files later.

### 🔍 Problem Statement
When a teacher uses the "Download All" button on an assignment with a mix of file types (e.g., assignment PDFs, reference videos, and student submitted Docs), the extension downloads every single attachment it detects. Currently, there is no way to selectively download only specific file types, meaning teachers must either download everything and manually delete the unwanted files from their computer, or avoid "Download All" and click individual files one by one.

### 💡 Proposed Solution
Add a lightweight filtering mechanism to the "Download All" flow.
- When clicking a "Download All" button, if there are multiple file types present in the group, a small, non-intrusive flyout or modal could appear asking the user to confirm the download or select specific file types (e.g., checkboxes for "PDFs", "Docs", "Images").
- Alternatively, add a global setting in the popup to "Only download these file types during Download All" (exclusion/inclusion list).
- For V1, the simplest approach might be a popup setting for "Download All file type filter".
- If a file type is excluded by the filter, it should just be skipped during the batch download.

### 🎯 Why Now
Users are asking about file limits and file formats in the FAQ ("Is there a limit to how many files I can download at once?"). As users adopt the extension for larger assignments, the batch sizes grow. Providing filtering reduces the amount of network traffic, reduces local clutter for the user, and makes the core "Download All" feature much more powerful and tailored to teacher workflows.

### 📐 Acceptance Criteria
- [ ] The user can configure a list of allowed or excluded file extensions for "Download All" operations.
- [ ] During a "Download All" operation, files with excluded extensions are successfully skipped.
- [ ] The "Download All" operation still tracks completion correctly (e.g., if 3 of 5 files are skipped, the operation finishes successfully after downloading the 2 allowed files).
- [ ] The filtering logic does not break the single-file download buttons.
- [ ] Edge case handled: What happens if all files in a group are filtered out? (Should show a message like "No files matched your filter" instead of silently doing nothing).
- [ ] Accessibility: Any new UI controls for filtering are keyboard navigable.

### 🔧 Technical Context
- `extension/src/download-all/group-manager.ts` handles the registration of files in a group.
- The `FileEntry` type (in `extension/src/download-all/types.ts`) or `getCanonicalFileKey` could be extended to surface the file extension more prominently.
- The actual batch logic (likely in `extension/src/download-all/index.ts` or related state files) needs to check the filter preferences before adding a file to the active download queue.
- Popup UI changes would go in `extension/entrypoints/popup/App.tsx`.

### 📊 Estimated Complexity
Medium (3–5 days). It requires passing user preferences from the background/popup into the content script's Download All engine, updating the batch download logic to skip files, and handling edge cases where a batch becomes empty due to filters.
### 🔗 Related
None
