## 2026-06-18 — Per-file-type filter and Download history
**Issues Filed:**
- Sage: add per-file-type filter to download-all — let teachers download only PDFs
- Sage: show download history in popup — last 5 files downloaded this session

**Rationale:**
- **Per-file-type filter**: Addresses a significant user pain point in batch operations where users waste time managing unwanted file formats locally. The extension should provide more control over what gets downloaded rather than a pure "all or nothing" approach.
- **Download history in popup**: This is a quick win. The background script already tracks `recentDownloads`, but this data is not surfaced to the user. Showing this history in the popup provides immediate, in-context feedback, reducing the need for users to verify downloads via the OS file explorer.

**Areas for Next Run:**
- Keyboard shortcuts for initiating downloads.
- Improved handling/visibility of failed downloads within the "Download All" flow (e.g. pause/resume or retry failed).
