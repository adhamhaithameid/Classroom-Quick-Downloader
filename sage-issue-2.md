## 🌿 Sage — Extension Feature Suggestion
**Agent:** Sage | **Day:** Thursday | **Date:** 2026-03-17

---

### 👤 User Story
As a teacher, I want the ability to retry specific files that failed during a "Download All" batch operation, so that I don't have to manually hunt for the failed files or restart the entire batch download.

### 🔍 Problem Statement
Currently, if a "Download All" batch has failures (e.g., due to network timeouts, rate limits, or resolver errors in the Student Work flow), the user is left with a partially completed batch. The extension queues downloads and handles some throttling, but if a file genuinely fails, there is no easy way to retry just the failed items. Users either have to figure out which files failed and click their individual download buttons, or they have to refresh the page and try the whole batch again, which is inefficient and frustrating.

### 💡 Proposed Solution
Introduce a "Retry Failed" capability for the Download All groups.
- When a Download All batch completes but has failures, the state of the group should reflect this (e.g., a "Partial Success" state).
- A UI affordance (like a small "Retry X failed" button next to the completed "Download All" button, or changing the button text to "Retry Failed") should appear.
- Clicking this retry button triggers a new batch operation containing *only* the `FileEntry` items that have `failed: true`.

### 🎯 Why Now
The Student Work resolver flow (`extension/docs/student-work-current-flow.md`) explicitly lists failure modes like `resolver_timeout` and `no_drive_url_found`. As we handle more complex, indirect file resolutions (like iframe-based bridges), the chance of individual file failures in a large batch increases. Handling these failures gracefully is critical for user trust.

### 📐 Acceptance Criteria
- [ ] After a batch download finishes, if any files failed, the user is presented with a way to retry those specific files.
- [ ] Retrying only attempts to download the files that previously failed, not the entire group again.
- [ ] The retry operation correctly updates the file states (from `failed` back to `inProgress`, and then to `downloaded` or `failed`).
- [ ] Edge case handled: If a file fails multiple times, the user can continue retrying, or the UI eventually provides a clear error message.
- [ ] Accessibility: The retry button is keyboard accessible and announced to screen readers.

### 🔧 Technical Context
- The file state is currently tracked in `FileEntry` (`extension/src/download-all/types.ts`), which already has `downloaded: boolean`, `failed: boolean`, and `inProgress: boolean`.
- The `GroupState` tracks `isBusy`.
- The logic to trigger a retry would involve modifying the button controller (e.g., `extension/src/download-all/button-controller.ts`) to check if `group.files` has any files with `failed === true` when the group is not `isBusy`, and dispatching a targeted download action for just those files.
- The UI reflection of the retry state will need to be added to the DOM manipulation logic that updates the button appearance.

### 📊 Estimated Complexity
Small to Medium (2–4 days). The underlying state tracking (`failed: true`) already seems to exist in the data model. The main work is adding the UI state to the Download All button and wiring up the click handler to filter and process only the failed files.
### 🔗 Related
None
